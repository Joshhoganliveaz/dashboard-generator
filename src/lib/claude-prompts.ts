import type { SubjectProperty, MarketMetrics, NeighborhoodAnalysis, BedroomAnalysis } from "./types";

// CSV analysis skill instructions inlined to avoid readFileSync (breaks Cloudflare Workers)
const CSV_SKILL_INSTRUCTIONS = `# Homeowner CSV Market Analysis Engine

## Purpose

You are a real estate market analyst for **Live AZ Co**. This skill takes a raw ARMLS/FlexMLS CSV export and a subject property profile, then produces a complete, homeowner-optimized market analysis package.

**This skill does all the heavy lifting.** The consuming skill (homeowner dashboard, houseversary review, etc.) receives fully processed data and ready-to-use narratives. It should not need to do any CSV parsing, scoring, filtering, or metric calculation on its own.

**The homeowner lens:** Every output from this skill is optimized to make the homeowner feel informed, proud, and confident about their investment. We lead with strength, emphasize appreciation, and frame their neighborhood positively. There is no appraiser to prep for, no rebuttal to build, no "sales that hurt." This is a relationship touchpoint, not a valuation defense.

---

## CSV Parsing Specification

### Encoding
Always parse with \\\`encoding='latin-1'\\\`. ARMLS/FlexMLS exports use Latin-1, not UTF-8. This is non-negotiable.

### Column Mapping

Map these CSV columns to standardized field names:

| CSV Column(s) | Standardized Field | Notes |
|---|---|---|
| \\\`House Number\\\` + \\\`Compass\\\` + \\\`Street Name\\\` + \\\`St Suffix\\\` | \\\`address\\\` | Concatenate with spaces, title case |
| \\\`Sold Price\\\` | \\\`sold_price\\\` | Strip \\\`$\\\` and commas, convert to float |
| \\\`List Price\\\` | \\\`list_price\\\` | Strip \\\`$\\\` and commas, convert to float |
| \\\`Original List Price\\\` | \\\`original_list_price\\\` | Strip \\\`$\\\` and commas, convert to float |
| \\\`Approx SQFT\\\` | \\\`sqft\\\` | Convert to int |
| \\\`Price/SqFt\\\` | \\\`price_per_sqft\\\` | Convert to float; if missing, calculate from sold_price / sqft |
| \\\`# Bedrooms\\\` | \\\`beds\\\` | Convert to int |
| \\\`Total Bathrooms\\\` | \\\`baths\\\` | Convert to float (handles 2.5, etc.) |
| \\\`Year Built\\\` | \\\`year_built\\\` | Convert to int |
| \\\`Exterior Stories\\\` | \\\`stories\\\` | Convert to int; normalize "Two" = 2, "One" = 1, "Three" = 3 |
| \\\`Close of Escrow Date\\\` | \\\`close_date\\\` | Parse to date object; handle MM/DD/YYYY and YYYY-MM-DD |
| \\\`Days on Market\\\` | \\\`dom\\\` | Convert to int |
| \\\`Subdivision\\\` | \\\`subdivision\\\` | Strip whitespace, title case |
| \\\`Dwelling Styles\\\` | \\\`dwelling_style\\\` | As-is |
| \\\`Approx Lot SqFt\\\` OR \\\`Source Apx Lot SqFt\\\` | \\\`lot_sqft\\\` | Try both columns; convert to int |
| \\\`Private Pool Y/N\\\` | \\\`pool\\\` | Normalize to "Yes" / "No" |
| \\\`Public Remarks\\\` | \\\`remarks\\\` | As-is; used for upgrade/feature extraction |
| \\\`Features\\\` | \\\`features\\\` | As-is; used for garage, HOA, upgrades |

### Cleaning Rules
- Drop any row where \\\`sold_price\\\` is null, zero, or non-numeric
- Drop any row where \\\`close_date\\\` is null or unparseable
- Drop any row where \\\`sqft\\\` is null, zero, or < 500 (data errors)
- If \\\`price_per_sqft\\\` is missing or zero, calculate it: \\\`sold_price / sqft\\\`
- Normalize \\\`stories\\\` text values: "One" = 1, "Two" = 2, "Three" = 3, "Split" = 2
- Strip all currency formatting ($, commas) before numeric conversion
- Handle both date formats: MM/DD/YYYY and YYYY-MM-DD

---

## Filtering

### Step 1: Exclude New Construction
Remove any sale where \\\`year_built\\\` is within the last 2 years of the most recent \\\`close_date\\\` in the dataset.

### Step 2: Product Type Match
Flag (do not remove) any sale that does not match the subject's \\\`stories\\\` count. These can appear in the dataset but should be clearly labeled and scored lower.

### Step 3: Recency Window
Include sales from the last 12 months. For scoring purposes, sales within 6 months get full recency credit; 6-12 months get partial credit.

---

## Scoring & Ranking

Score each sale on a 0-100 scale using the following weighted factors:

| Factor | Max Points | Logic |
|---|---|---|
| **Same subdivision** | 25 | Exact subdivision match = 25. Different subdivision = 0. |
| **Recency** | 15 | 0-90 days = 15. 91-180 days = 10. 181-270 days = 5. 271-365 days = 2. |
| **Size proximity (SF)** | 12 | Within 100 SF = 12. Within 200 = 9. Within 300 = 6. Within 500 = 3. Beyond 500 = 0. |
| **$/SF at or above subject** | 12 | Sale $/SF >= subject $/SF = 12. Within $10 below = 8. Within $20 below = 4. More than $20 below = 0. |
| **Bedroom match** | 10 | Exact match = 10. Off by 1 = 5. Off by 2+ = 0. |
| **Year built proximity** | 8 | Within 3 years = 8. Within 5 = 5. Within 10 = 3. Beyond 10 = 0. |
| **Story count match** | 8 | Exact match = 8. Mismatch = 0. |
| **Bathroom proximity** | 5 | Within 0.5 = 5. Within 1 = 3. Beyond 1 = 0. |
| **Pool match** | 5 | Both have pool or both don't = 5. Mismatch = 2. |
| **Lot size proximity** | 5 | Within 500 SF = 5. Within 1000 = 3. Within 2000 = 1. Beyond 2000 = 0. |

### Scoring Notes
- **No negative scoring.** Low-scoring sales simply don't get featured.
- **$/SF bias is intentional.** Weighting toward sales at or above the subject's $/SF means featured sales naturally reinforce the homeowner's value.

---

## Output Package

After parsing, filtering, and scoring, produce ALL of the following as a single JSON object.

### Output 1: Top Sales (comps)

Return the top 8-10 sales sorted by score descending. Each sale includes:
- addr, sub (subdivision), community, close (YYYY-MM-DD), sp (sold price), sf (sqft), ppsf (price per sqft), beds (string), baths (string), pool ("Y"/"N"), dom (string), yearBuilt, stories, matchScore, note

### Output 2: Market Metrics (marketMetrics)

\\\`\\\`\\\`json
{
  "medianSoldPrice": 540000,
  "medianPpsf": 277.50,
  "avgPpsf": 280.12,
  "ppsfRange": {"low": 220.00, "high": 340.00},
  "derivedValue": 680000,
  "derivedRange": {"low": 660000, "high": 700000},
  "compsUsedForValue": 6,
  "avgDom": 45,
  "medianDom": 38,
  "saleToListRatio": 0.985,
  "priceTrendDirection": "rising",
  "priceTrendDetail": "Median $/SF moved from $265 to $277 (+4.5%)",
  "totalSalesInPeriod": 62,
  "subdivisionSalesCount": 12,
  "earliestSale": "2025-03-15",
  "latestSale": "2026-03-01",
  "analysisPeriodMonths": 12
}
\\\`\\\`\\\`

**Value Derivation Method:**
Use the top 6 scored comps. Take the median $/SF of those comps, multiply by subject SF. The derivedRange is +/- 3% of derivedValue, rounded to nearest $1,000.

**Trend Calculation:**
Sort all filtered sales by close_date, split into two halves, compare median $/SF. >2% higher = "rising", >2% lower = "declining", otherwise "stable".

### Output 3: Neighborhood Analysis (neighborhood)

Use ALL closed sales in the CSV (not just scored comps):

\\\`\\\`\\\`json
{
  "name": "Dobson Ranch",
  "city": "Mesa",
  "sourcePeriod": "March 2025 - March 2026",
  "yoy": {
    "recentCount": 109,
    "priorCount": 104,
    "countChgPct": 4.8,
    "recentMedianPrice": 540000,
    "priorMedianPrice": 546000,
    "medianPriceChgPct": -1.1,
    "recentMedianPpsf": 277,
    "priorMedianPpsf": 269,
    "medianPpsfChgPct": 2.8
  },
  "trends": [
    {"period": "H1 2024", "sales": 56, "medianPrice": 546000, "medianPpsf": 269},
    {"period": "H2 2024", "sales": 49, "medianPrice": 540000, "medianPpsf": 274}
  ],
  "pool": {
    "poolCount": 46,
    "poolMedianPrice": 604500,
    "poolMedianPpsf": 289,
    "noPoolCount": 63,
    "noPoolMedianPrice": 500000,
    "noPoolMedianPpsf": 267,
    "premiumDollar": 104500
  },
  "sizeSegments": [
    {"label": "Under 1,800 SF", "count": 37, "medianPrice": 450000, "medianPpsf": 310, "isSubjectTier": false},
    {"label": "1,800-2,399 SF", "count": 49, "medianPrice": 550000, "medianPpsf": 268, "isSubjectTier": false},
    {"label": "2,400+ SF", "count": 23, "medianPrice": 630000, "medianPpsf": 247, "isSubjectTier": true}
  ],
  "narrative": "Dobson Ranch is holding steady..."
}
\\\`\\\`\\\`

### Output 4: Bedroom Analysis (bedroomAnalysis)

\\\`\\\`\\\`json
{
  "hasEnoughData": true,
  "subjectBeds": 4,
  "subjectPpsf": 218,
  "breakdown": [
    {"beds": 3, "count": 5, "avgPpsf": 205, "medianPpsf": 203},
    {"beds": 4, "count": 3, "avgPpsf": 222, "medianPpsf": 218}
  ],
  "narrative": ""
}
\\\`\\\`\\\`

Only generate a premium narrative if the subject has MORE bedrooms than the most common config AND higher $/SF.

### Output 5: Subject Advantages (subjectAdvantages)

Array of strings describing genuine advantages the subject has over the comparison sales. Only list features where the subject is equal to or better than the majority.

---

## Narrative Language Rules
- Use: "Your home" / "Your neighborhood" / "Your investment"
- Use: "Recent sales nearby" / "Homes in your area" / "Your community"
- Never use: "comp" / "comparable" / "subject property" / "adjustment"
- Never use: "appraisal" / "appraised value" / "USPAP"
- Never frame negatively
- No em-dashes

---

## Error Handling
- If fewer than 5 total sales pass filtering, warn that analysis may not be representative
- If zero sales match the subject's subdivision, use all sales as "nearby"
- Try both date formats (MM/DD/YYYY and YYYY-MM-DD)
- If encoding fails, fall back to utf-8`;

export const MLS_EXTRACTION_PROMPT = `You are a real estate data extraction assistant. Extract the following from this MLS listing PDF:

Return a JSON object with these fields:
{
  "beds": (integer),
  "baths": (number, e.g. 2.5),
  "sqft": (integer, living area square footage),
  "yearBuilt": (integer),
  "pool": (boolean),
  "stories": (integer),
  "features": [
    {"title": "Feature Name", "desc": "Brief description of why this matters to a homeowner"}
  ],
  "purchasePrice": (number or null) - prior sale price if shown on the listing,
  "purchaseDate": (string "YYYY-MM-DD" or null) - prior sale date if shown
}

For features, extract 4-6 standout property features (pool, garage, lot size, upgrades, views, etc.). Each description should be 1 sentence emphasizing homeowner value.

Return null for purchasePrice/purchaseDate if not found on the listing.

Return ONLY the JSON object, no other text.`;

export const TAX_RECORDS_EXTRACTION_PROMPT = `You are a real estate data extraction assistant. Extract ownership and mortgage information from this tax records PDF.

Return a JSON object with EXACTLY these fields:
{
  "purchasePrice": (number or null) - the price paid in the most recent purchase deed/sale,
  "purchaseDate": (string "YYYY-MM-DD" or null) - the date of the most recent purchase,
  "originalLoanAmount": (number or null) - the original mortgage/deed of trust amount at purchase,
  "loanDate": (string "YYYY-MM-DD" or null) - the date of the original mortgage recording,
  "refinances": [
    {"date": "YYYY-MM-DD", "amount": 468000}
  ],
  "assessedValue": (number or null) - the current assessed/full cash value,
  "taxYear": (number or null) - the tax year of the assessment,
  "legalDescription": (string or null) - the legal description of the property
}

Instructions:
- Extract ALL mortgage/deed of trust recordings. The original purchase mortgage goes in originalLoanAmount/loanDate.
- Any subsequent refinance recordings go in the refinances array, sorted by date ascending.
- If there are no refinances, return an empty array.
- purchasePrice should come from the deed of sale, warranty deed, or transfer deed amount.
- Return null for any field not found in the document.

Return ONLY the JSON object, no other text.`;

export const CROMFORD_EXTRACTION_PROMPT = `You are analyzing Cromford Report screenshots for a real estate market analysis.

Extract exactly 10 key metrics from these screenshots. For each metric, provide:
- label: The metric name (e.g., "Cromford Supply Index", "Months of Supply")
- value: The current value as displayed
- arrow: "▲" if trending up, "▼" if trending down
- color: "var(--positive)" if the trend is good for sellers/homeowners, "var(--negative)" if bad
- ctx: A brief 2-4 word context note

Prioritize these metrics (in order):
1. Cromford Supply Index
2. Months of Supply
3. Monthly Sales $/SF
4. Sale-to-List %
5. Median Sold Price
6. Days on Market
7. Annual Appreciation $/SF
8. Contract Ratio
9. Listing Success Rate
10. Active Listings

Also write:
- "takeaway": A 2-3 sentence summary of what these metrics mean for a homeowner. Reference the city name and key indicators. Frame positively.
- "source": The source citation line (e.g., "Source: Cromford Report, [City] Single Family Detached, as of [date]")

Return a JSON object:
{
  "metrics": [...],
  "takeaway": "...",
  "source": "..."
}

Return ONLY the JSON object.`;

export function webResearchPrompt(city: string): string {
  return `Research recent developments in ${city}, Arizona. I need REAL, verified information with source URLs.

Find and return a JSON object with three arrays:

{
  "developments": [
    {"emoji": "🏬", "title": "Short title", "desc": "2-3 sentence description", "source": "Source name", "url": "https://..."}
  ],
  "infrastructure": [
    {"emoji": "🛣️", "title": "Short title", "desc": "2-3 sentence description", "source": "Source name", "url": "https://..."}
  ],
  "areaHighlights": [
    {"emoji": "🏅", "title": "Short title", "desc": "2-3 sentence description", "source": "Source name", "url": "https://..."}
  ]
}

For developments: Find 3-4 new restaurants, retail, businesses, or commercial projects opening in ${city}. Use restaurant/retail emojis.
For infrastructure: Find 3-4 road projects, transit improvements, park developments, or city investments in ${city}. Use construction/road emojis.
For areaHighlights: Find 2-3 city rankings, awards, notable achievements, or growth stats for ${city}. Use medal/star emojis.

Every item MUST have a real, working source URL. Do not fabricate URLs.
Return ONLY the JSON object.`;
}

export function contentGenerationPrompt(
  subject: SubjectProperty & { address: string; subdivision: string; communityName: string; cityStateZip: string },
  metrics: MarketMetrics,
  neighborhood: NeighborhoodAnalysis,
  bedroomAnalysis: BedroomAnalysis,
  cromfordMetrics: { label: string; value: string }[],
  yearsOwned: number
): string {
  const city = subject.cityStateZip.split(",")[0]?.trim() || "";

  // Build bedroom breakdown context for Claude
  const bedroomBreakdownText = bedroomAnalysis.hasEnoughData
    ? bedroomAnalysis.breakdown
        .map((b) => `  ${b.beds}-bed: ${b.count} sales, median $/SF $${b.medianPpsf}`)
        .join("\n")
    : "  Not enough data for bedroom breakdown.";

  // Find most common bedroom config
  const mostCommonBed = bedroomAnalysis.hasEnoughData
    ? [...bedroomAnalysis.breakdown].sort((a, b) => b.count - a.count)[0]
    : null;

  const subjectBedGroup = bedroomAnalysis.breakdown.find((b) => b.beds === subject.beds);
  const hasBedroomPremium =
    mostCommonBed &&
    subjectBedGroup &&
    subject.beds > mostCommonBed.beds &&
    subjectBedGroup.medianPpsf > mostCommonBed.medianPpsf;

  return `You are writing content for a homeowner dashboard for a property at ${subject.address}, ${subject.cityStateZip} in ${subject.communityName}.

Property: ${subject.beds} bed / ${subject.baths} bath / ${subject.sqft.toLocaleString()} SF / built ${subject.yearBuilt} / ${subject.pool ? "pool" : "no pool"} / ${subject.stories}-story
Market: Median $/SF $${metrics.medianPpsf}, Derived value ~$${metrics.derivedValue.toLocaleString()}, Trend: ${metrics.priceTrendDirection}
Neighborhood: ${neighborhood.name}, ${neighborhood.yoy.recentCount} sales in last 12mo

Bedroom breakdown:
${bedroomBreakdownText}
Most common config: ${mostCommonBed ? `${mostCommonBed.beds}-bed (${mostCommonBed.count} sales)` : "N/A"}
Subject has bedroom premium: ${hasBedroomPremium ? "YES" : "NO"}

Generate a JSON object with these fields:

{
  "headerTitle": "Happy ${yearsOwned}-Year Houseversary! 🎉",
  "outlookNarrative": [
    "First paragraph: City-level market outlook using Cromford data. Reference specific numbers. 3-4 sentences.",
    "Second paragraph: Neighborhood-specific outlook. Reference ${neighborhood.name} and community strengths. 2-3 sentences."
  ],
  "neighborhoodNarrative": "2-3 sentence neighborhood analysis narrative for the 'Our Take' section. Lead with trend direction. Mention pool premium if subject has pool. Reference size tier. Frame positively.",
  "bedroomNarrative": "IMPORTANT: Only generate a premium narrative if the subject has MORE bedrooms than the most common config AND the $/SF is higher for the subject's bedroom count. If the subject does NOT have both conditions met, return empty string. If it does, write 1-2 sentences about the bedroom premium advantage.",
  "upgrades": [
    {"name": "Upgrade Name", "emoji": "🔧", "cost": "$X-$Y", "roi": "70-80%", "desc": "1-2 sentences tailored to THIS property. Reference the property's specific features."}
  ],
  "resources": {
    "seasonal": {
      "spring": "Arizona-specific spring maintenance tips, 1 sentence",
      "summer": "Arizona-specific summer maintenance tips, 1 sentence",
      "fall": "Arizona-specific fall maintenance tips, 1 sentence",
      "winter": "Arizona-specific winter maintenance tips, 1 sentence"
    },
    "links": [
      {"label": "Maricopa County Assessor", "url": "https://mcassessor.maricopa.gov/", "desc": "Property tax info and assessed values"},
      {"label": "City of ${city} Utilities", "url": "https://www.${city.toLowerCase().replace(/ /g, '')}az.gov/residents/utilities", "desc": "Water, trash, and utility services"},
      {"label": "${subject.communityName || subject.subdivision} HOA", "url": "", "desc": "Community info, amenities, and events"}
    ]
  }
}

Rules:
- Never use the word "just" (undercuts authority)
- Never use em-dashes
- Frame everything positively for the homeowner
- Upgrades should be 4-5 items, tailored to this specific property type and age
- The headerTitle should celebrate the houseversary milestone

Return ONLY the JSON object.`;
}

export function csvAnalysisPrompt(
  csvText: string,
  subject: {
    address: string;
    cityStateZip: string;
    subdivision: string;
    communityName: string;
    beds: number;
    baths: number;
    sqft: number;
    yearBuilt: number;
    pool: boolean;
    stories: number;
  }
): string {
  const skillInstructions = CSV_SKILL_INSTRUCTIONS;
  const city = subject.cityStateZip.split(",")[0]?.trim() || "";

  return `${skillInstructions}

---

## YOUR TASK

Analyze the CSV data below for the following subject property and return results as a single JSON object.

### Subject Property
- Address: ${subject.address}
- City: ${city}
- Subdivision: ${subject.subdivision}
- Community: ${subject.communityName}
- Beds: ${subject.beds}
- Baths: ${subject.baths}
- SqFt: ${subject.sqft.toLocaleString()}
- Year Built: ${subject.yearBuilt}
- Stories: ${subject.stories}
- Pool: ${subject.pool ? "Yes" : "No"}

### CSV Data (ARMLS/FlexMLS Export)

\`\`\`csv
${csvText}
\`\`\`

### Required JSON Output

Return a single JSON object with exactly these keys. Follow the schemas defined above precisely.

{
  "comps": [
    {
      "addr": "123 E Main St",
      "sub": "Morrison Ranch",
      "community": "Morrison Ranch",
      "close": "2025-11-15",
      "sp": 680000,
      "sf": 2314,
      "ppsf": 293.86,
      "beds": "4",
      "baths": "3",
      "pool": "Y",
      "dom": "45",
      "yearBuilt": 1979,
      "stories": 1,
      "matchScore": 72,
      "note": ""
    }
  ],
  "marketMetrics": {
    "medianSoldPrice": 0,
    "medianPpsf": 0,
    "avgPpsf": 0,
    "ppsfRange": {"low": 0, "high": 0},
    "derivedValue": 0,
    "derivedRange": {"low": 0, "high": 0},
    "compsUsedForValue": 0,
    "avgDom": 0,
    "medianDom": 0,
    "saleToListRatio": 0,
    "priceTrendDirection": "stable",
    "priceTrendDetail": "",
    "totalSalesInPeriod": 0,
    "subdivisionSalesCount": 0,
    "earliestSale": "",
    "latestSale": "",
    "analysisPeriodMonths": 12
  },
  "neighborhood": {
    "name": "",
    "city": "",
    "sourcePeriod": "",
    "yoy": {
      "recentCount": 0, "priorCount": 0, "countChgPct": 0,
      "recentMedianPrice": 0, "priorMedianPrice": 0, "medianPriceChgPct": 0,
      "recentMedianPpsf": 0, "priorMedianPpsf": 0, "medianPpsfChgPct": 0
    },
    "trends": [],
    "pool": {
      "poolCount": 0, "poolMedianPrice": 0, "poolMedianPpsf": 0,
      "noPoolCount": 0, "noPoolMedianPrice": 0, "noPoolMedianPpsf": 0,
      "premiumDollar": 0
    },
    "sizeSegments": [],
    "narrative": ""
  },
  "bedroomAnalysis": {
    "hasEnoughData": false,
    "subjectBeds": 0,
    "subjectPpsf": 0,
    "breakdown": [],
    "narrative": ""
  },
  "subjectAdvantages": [],
  "metadata": {
    "totalParsed": 0,
    "totalAfterFilter": 0,
    "warnings": []
  }
}

IMPORTANT:
- Return ONLY the JSON object, no other text or markdown fences.
- All numeric values must be actual numbers, not strings (except beds, baths, dom, pool which are strings in the comps array).
- priceTrendDirection must be exactly one of: "rising", "stable", "declining".
- Pool values in comps must be "Y" or "N".
- Close dates must be in YYYY-MM-DD format.
- matchScore should be 0-100 based on the scoring rubric above.
- derivedValue should use the median $/SF of the top 6 scored comps multiplied by subject sqft.
- For the neighborhood analysis, use ALL sales in the CSV, not just the top comps.`;
}
