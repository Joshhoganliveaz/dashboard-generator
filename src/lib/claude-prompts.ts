import type { SubjectProperty, MarketMetrics, NeighborhoodAnalysis, BedroomAnalysis, CompSale, CromfordMetric } from "./types";
import type { AnalysisLens } from "./template-registry";

// CSV analysis skill instructions inlined to avoid readFileSync (breaks Cloudflare Workers)
const CSV_SKILL_INSTRUCTIONS = `# CSV Market Analysis Engine

## Purpose

You are a real estate market analyst for **Live AZ Co**. This skill takes a raw ARMLS/FlexMLS CSV export and a subject property profile, then produces a complete market analysis package optimized for the selected lens.

**CRITICAL OPERATING RULES:**
1. Follow every instruction in this prompt LITERALLY. Do not improvise, estimate, or use judgment where a formula or rule is provided.
2. Never fabricate data. If a field is missing from the CSV, use null/zero — never invent values.
3. The CSV has been pre-filtered to closed sales only (Status = C). If you see any non-closed row, skip it.
4. Your output will be validated server-side. Scores will be recalculated, comps with missing sold prices or close dates will be removed, and data will be cross-checked against the CSV. Hallucinated data will be caught and flagged.
5. When in doubt between two interpretations of an instruction, choose the more literal one.

**This skill does all the heavy lifting.** The consuming skill (homeowner dashboard, houseversary review, listing presentation, buyer analysis, appraisal support packet, etc.) receives fully processed data and ready-to-use narratives. It should not need to do any CSV parsing, scoring, filtering, or metric calculation on its own.

### Analysis Lenses

This skill supports 4 lenses that control tone, framing, and which data is surfaced:

| Lens | When to Use | Key Behavior |
|---|---|---|
| **Homeowner** (default) | Dashboards, houseversary reviews, equity updates | Positive framing, subject advantages only, no jargon |
| **Listing** | Pre-listing presentations, pricing strategy | Strategic/confident, cherry-pick highest defensible comps, do NOT suggest list price |
| **Buyer** | Buyer consultations, offer strategy | Objective, shows advantages AND disadvantages, flags overpricing |
| **Appraiser** | Appraisal support packets, pre-appraisal prep | Formal/technical, advantages AND disadvantages, Castle-calibrated adjustment grid |

**Lens selection:** Auto-detect from prompt keywords. Default to homeowner if unclear.

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
| \\\`Full Bathrooms\\\` | \\\`full_baths\\\` | Convert to int; granular bath data |
| \\\`Half Bathrooms\\\` | \\\`half_baths\\\` | Convert to int; granular bath data |
| \\\`Year Built\\\` | \\\`year_built\\\` | Convert to int |
| \\\`Exterior Stories\\\` | \\\`stories\\\` | Convert to int; normalize "Two" = 2, "One" = 1, "Three" = 3 |
| \\\`Close of Escrow Date\\\` | \\\`close_date\\\` | Parse to date object; handle MM/DD/YYYY and YYYY-MM-DD |
| \\\`Days on Market\\\` | \\\`dom\\\` | Convert to int |
| \\\`Subdivision\\\` | \\\`subdivision\\\` | Strip whitespace, title case |
| \\\`Dwelling Styles\\\` | \\\`dwelling_style\\\` | As-is |
| \\\`Approx Lot SqFt\\\` OR \\\`Source Apx Lot SqFt\\\` | \\\`lot_sqft\\\` | Try both columns; convert to int |
| \\\`Private Pool Y/N\\\` | \\\`pool\\\` | Normalize to "Yes" / "No" |
| \\\`Public Remarks\\\` | \\\`remarks\\\` | As-is; used for upgrade/feature extraction |
| \\\`Features\\\` | \\\`features\\\` | As-is; used for garage, HOA, upgrades, parsed features |
| \\\`Status\\\` | \\\`status\\\` | Pre-filtered to closed sales only (Status = C). If any non-closed row appears, ignore it. |
| \\\`Fireplace Y/N\\\` | \\\`fireplace_yn\\\` | Normalize to "Yes" / "No" |
| \\\`Fireplaces Total\\\` | \\\`fireplaces_total\\\` | Convert to int; adjustment grid |
| \\\`Cross Street\\\` | \\\`cross_street\\\` | As-is; location context |

### Features Column Parsing

Parse these structured attributes from the Features column text:

| Feature | Parse Logic | Output Field |
|---|---|---|
| Garage Spaces | Count from "2 Car Garage", "3 Car", etc. | \\\`garage_spaces\\\` (int) |
| RV Gate / RV Garage | Look for "RV Gate", "RV Garage", "RV Parking" | \\\`rv_access\\\` ("Gate" / "Garage" / "None") |
| View type | "Lake View", "Mountain View", "City Light", etc. | \\\`view_type\\\` (string or None) |
| Solar | "Solar Owned", "Solar Leased", "Solar Panels" | \\\`solar\\\` ("Owned" / "Leased" / "None") |
| Spa | "Private Heated Spa", "Private Spa", "Spa" | \\\`spa\\\` ("Private Heated" / "Private" / "None") |
| Guest House | "Guest House", "Guest Quarters", "Casita" | \\\`guest_house\\\` ("Yes" / "No") |
| Countertop material | "Granite", "Quartz", "Laminate" | \\\`countertops\\\` (string or None) |
| Gated community | "Gated Community", "Gated", "Guard Gated" | \\\`gated\\\` ("Yes" / "No") |
| HOA monthly fee | Dollar amount near "HOA" | \\\`hoa_monthly\\\` (float or None) |
| Architecture style | "Spanish", "Santa Fe", "Contemporary", etc. | \\\`arch_style\\\` (string or None) |
| All Items Updated | Kitchen, Bath, Floor, Roof, HVAC, Pool, Plumbing | \\\`updates\\\` (dict of item: year/scope or None) |

### Cleaning Rules
- Drop any row where \\\`sold_price\\\` is null, zero, or non-numeric
- Drop any row where \\\`close_date\\\` is null or unparseable
- Drop any row where \\\`sqft\\\` is null, zero, or < 500 (data errors)
- If \\\`price_per_sqft\\\` is missing or zero, calculate it: \\\`sold_price / sqft\\\`
- Normalize \\\`stories\\\` text values: "One" = 1, "Two" = 2, "Three" = 3, "Split" = 2
- Strip all currency formatting ($, commas) before numeric conversion
- Handle both date formats: MM/DD/YYYY and YYYY-MM-DD
- CRITICAL: Only use rows with Status = "C" (Closed). Never use Active (A), Pending (P), or any other status. Active listings have no sold price or close date -- do not fabricate these values.

---

## Filtering

### Step 1: Exclude New Construction
Remove any sale where \\\`year_built\\\` is within the last 2 years of the most recent \\\`close_date\\\` in the dataset. Exception: only include new construction if the subject property itself is new construction AND the user explicitly requests it.

### Step 2: Product Type Match
Flag (do not remove) any sale that does not match the subject's \\\`stories\\\` count. These can appear in the dataset but should be clearly labeled and scored lower.

### Step 3: Recency Window
Include sales from the last 12 months, but prioritize proximity and recency in layers:

1. **First pass (closest + most recent):** Same subdivision, last 6 months.
2. **Second pass (nearby + recent):** Adjacent subdivisions, last 6 months.
3. **Third pass (expand timeframe):** Same subdivision + nearby, 6-12 months ago.

The goal is 3 strong comps for value derivation. Always start with what's closest and most recent, then expand outward only as needed.

### Step 4: Extract Features
Parse the Features column for each sale using the Features Column Parsing table above. Attach parsed fields to each sale record for use in scoring, adjustment grid, and narrative generation.

### Step 5: Location Premium Detection
Scan the \\\`Public Remarks\\\`, \\\`Features\\\`, and \\\`view_type\\\` fields for location premiums that can inflate $/SF beyond what the physical property warrants. Flag (do not remove) any sale with these markers:

- **Waterfront/Lake views:** "lake view", "waterfront", "lake lot", "water view", "lakefront"
- **Golf course:** "golf course", "golf lot", "backs to golf", "fairway"
- **Mountain views:** "mountain view", "city light view", "sunset view"
- **Greenbelt/Park:** "backs to park", "greenbelt", "walking path", "open space"
- **Premium lot:** "corner lot", "cul-de-sac", "oversized lot", "pie-shaped lot"

When a sale has a location premium flag:
- Include it in the dataset but note the premium in its record
- When comparing $/SF, understand that these sales may be elevated by location rather than home features
- In narratives, acknowledge location premiums as context rather than using them to inflate the subject's value unless the subject shares that premium
- When selecting top comps for value derivation, prefer sales that match the subject's lot position

---

## Scoring & Ranking

**IMPORTANT: Match scores will be recalculated server-side using the exact formula below. Your scores are advisory only — the server overwrites them. However, you MUST still apply this rubric when selecting which comps to include, since only your top 8-10 are returned.**

Score each sale on a 0-100 scale based on **physical similarity** to the subject only. No price-based scoring. The goal is to find the most physically comparable properties so adjustments are minimal and the value indication is reliable.

### Base Scoring Weights (Homeowner & Listing lenses)

Apply this as a **strict formula** — add points per factor, no rounding, no judgment adjustments:

| Factor | Points | Logic |
|---|---|---|
| **Same subdivision** | 20 | Exact match = 20, Different = 0 |
| **Story count match** | 16 | Exact match = 16, Mismatch = 0 (near-hard-filter) |
| **Pool match** | 16 | Both match = 16, Mismatch = 0 |
| **Size proximity (SF)** | 15 | ≤100 = 15, ≤200 = 12, ≤300 = 8, ≤500 = 4, >500 = 0 |
| **Recency** | 12 | 0-90 days = 12, 91-180 = 8, 181-270 = 4, 271-365 = 2, >365 = 0 |
| **Year built proximity** | 7 | ≤3yr = 7, ≤5 = 5, ≤10 = 3, >10 = 0 |
| **Lot size proximity** | 6 | ≤500 SF = 6, ≤1K = 4, ≤2K = 2, >2K = 0 |
| **Bedroom match** | 4 | Exact = 4, Off by 1 = 2, Off by 2+ = 0 |
| **Bathroom proximity** | 4 | ≤0.5 diff = 4, ≤1 = 2, >1 = 0 |

### Scoring Rules
- **No negative scoring.** Low-scoring sales simply don't get featured.
- **No price-based scoring.** We select the most physically similar properties and let the adjusted comparable sales method derive an honest, defensible value indication.
- **No subjective adjustments.** Do not add or subtract points for "overall feel", upgrades, condition, or any factor not in the table above. The score is the sum of the formula — nothing more.

---

## Value Derivation: Adjusted Comparable Sales Method

Select the most physically similar sales, adjust each one to the subject's features using market-calibrated rates, and use the adjusted sale prices to indicate value.

### Step 1: Select Comps for Adjustment

Top 4-6 by similarity score. Mix of in-community and nearby. Prefer same story count. Prefer comps that will need the fewest adjustments.

### Step 2: Apply Adjustments

For each comp, calculate adjustments to make it equivalent to the subject. **Subject SUPERIOR = add to comp. Subject INFERIOR = subtract from comp.**

#### GLA (Gross Living Area) -- CALIBRATED

**Rate: ~30% of the comp's price per square foot** (calibrated from 8 Castle Appraising appraisals; observed range 25%-37%, mean 30.5%)

Dead zone: 10% of the SUBJECT's square footage. If the SF difference is within this range, NO GLA ADJUSTMENT. If it exceeds the dead zone, adjust the ENTIRE difference (not just the amount over 10%).

Example: Subject is 2,372 SF, comp is 2,243 SF at $312/SF.
- Dead zone = 237 SF. Difference = 129 SF. Within 10% = no adjustment.
Example: Subject is 3,396 SF, comp is 2,651 SF at $235/SF.
- Dead zone = 340 SF. Difference = 745 SF. Exceeds 10%.
- Rate = $235 x 0.30 = $70.50/SF. Adjustment = 745 x $70.50 = +$52,523 (round to nearest $500).

#### Bathrooms -- CALIBRATED

**Full bathroom (1.0 difference): $10,000** (majority of observations, standard rate)
**Half bathroom (0.1 difference): $5,000** (confirmed across 7 observations)

Flat rate per bathroom difference. No tapering.

#### Pool -- CALIBRATED

**Pool adjustment logic:**
1. Scoring strongly favors pool-to-pool matches (16 points), minimizing mismatches in the first place
2. When a mismatch occurs, attempt paired sales analysis from the dataset first
3. Fall back to $20K only if no paired sales exist

**Standard rates (fallback):**
- **Pool vs No Pool: $20,000** (standard East Valley residential, confirmed 11 observations)
- **Pool/Spa vs Pool: $10,000** (spa premium, confirmed 4 observations)
- **Pool at higher value points ($1M+): $45,000** (1 observation)

#### Garage -- CALIBRATED

**Per garage bay: $15,000-$20,000** (12 observations of 1-bay differences)
- Use $15,000 for homes under $700K, $20,000 for homes $700K+

#### Fireplace -- CALIBRATED

**Per fireplace: $1,500** (12 observations at exactly $1,500 per FP difference)
**2 FP difference: $3,500** (averaged from observations)
**3+ FP difference: $6,000** (averaged from observations)

#### Condition -- CALIBRATED

**Good vs Average: $20,000** (6 observations, all exactly $20,000)
**Good vs Average-Good: $10,000** (7 observations)
**Average-Good vs Average: $10,000** (implied)

Each condition step = $10,000 in the $600-$800K range.

#### Lot Size -- PARTIALLY CALIBRATED

Approximate rate: **$2.00-$2.50 per lot SF** for differences over 1,000 SF in standard subdivisions.

#### Age / Year Built -- CALIBRATED as $0

**In same-subdivision comparisons: $0** (confirmed across all 8 appraisals)
Only adjust age when comparing across subdivisions with 10+ year gaps.

### Step 3: Validate Adjustments

**Gross Adjustment % = sum(abs(all adjustments)) / comp sold price x 100**
- Under 15%: Strong. Full confidence.
- 15-25%: Acceptable. Note it.
- Over 25%: Weak. Weight lower. Flag it.

### Step 4: Derive Value Indication

1. Prefer comps with gross adjustments under 25%.
2. Weight by similarity score: weighted_value = sum(adjusted_price * score) / sum(scores)
3. Report: range (low to high adjusted price), weighted average, number of comps used.
4. Round to nearest $1,000.

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

**Trend Calculation:**
Sort all filtered sales by close_date. Split into two halves by date. Compare median $/SF. >2% higher = "rising", >2% lower = "declining", otherwise "stable".

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
    {"period": "Q1 2024", "sales": 28, "medianPrice": 540000, "medianPpsf": 265},
    {"period": "Q2 2024", "sales": 32, "medianPrice": 548000, "medianPpsf": 272},
    {"period": "Q3 2024", "sales": 25, "medianPrice": 535000, "medianPpsf": 270},
    {"period": "Q4 2024", "sales": 24, "medianPrice": 542000, "medianPpsf": 276},
    {"period": "Q1 2025", "sales": 30, "medianPrice": 545000, "medianPpsf": 268},
    {"period": "Q2 2025", "sales": 27, "medianPrice": 540000, "medianPpsf": 271},
    {"period": "Q3 2025", "sales": 26, "medianPrice": 548000, "medianPpsf": 280},
    {"period": "Q4 2025", "sales": 29, "medianPrice": 543000, "medianPpsf": 277}
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

**Quarterly trends:** Q1 = Jan-Mar, Q2 = Apr-Jun, Q3 = Jul-Sep, Q4 = Oct-Dec. Include partial current quarter if data exists. Go back as far as the data allows.

**Pool analysis:** Omit the pool premium section if the subject does NOT have a pool (homeowner lens). Only include when the subject has a pool, where it reinforces their investment.

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

Only generate a premium narrative if the subject has MORE bedrooms than the most common config AND higher $/SF. If 5BR homes show lower $/SF than 4BR (common -- oversized homes often have lower $/SF), note the subject sits in the "sweet spot" configuration.

### Output 5: Subject Advantages (subjectAdvantages)

Array of strings describing genuine advantages the subject has over the comparison sales. Only list features where the subject is equal to or better than the majority.

---

## Narrative Language Rules

### Homeowner (default)
- Use: "Your home" / "Your neighborhood" / "Your investment"
- Use: "Recent sales nearby" / "Homes in your area" / "Your community"
- Never use: "comp" / "comparable" / "subject property" / "adjustment"
- Never use: "appraisal" / "appraised value" / "USPAP"
- Never frame negatively
- No em-dashes

### Listing
- Strategic/confident: "the data supports...", "three homes with similar features closed between..."
- OK to use: "list price", "days on market", "sale-to-list ratio"
- Never suggest a specific list price
- No em-dashes

### Buyer
- Objective: "based on comparable closed sales...", "the asking price sits X% above/below..."
- OK to flag overpricing or underpricing
- No em-dashes

### Appraiser
- Formal/technical: "comparable sales were identified...", "after adjustments, the indicated value range is..."
- OK to use all technical terms: "comp", "adjustment", "USPAP", "reconciliation"
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
  "originalLoanAmount": (number or null) - the FIRST mortgage/deed of trust recorded at or near the purchase date,
  "loanDate": (string "YYYY-MM-DD" or null) - the date of the original mortgage recording,
  "refinances": [
    {"date": "YYYY-MM-DD", "amount": 468000}
  ],
  "assessedValue": (number or null) - the current assessed/full cash value,
  "taxYear": (number or null) - the tax year of the assessment,
  "legalDescription": (string or null) - the legal description of the property
}

Instructions:
- Extract ALL mortgage/deed of trust recordings from the document.
- purchasePrice should come from the deed of sale, warranty deed, or transfer deed amount.
- Return null for any field not found in the document.
- If there are no refinances, return an empty array for refinances.

CRITICAL — Classifying original purchase mortgage vs refinances:
Step 1: Find the purchase date from the deed of sale, warranty deed, or transfer deed.
Step 2: Find the mortgage/deed of trust recorded CLOSEST to that purchase date (within 60 days). That is the original purchase mortgage → originalLoanAmount/loanDate. It is typically 70-97% of the purchase price (conventional or FHA financing).
Step 3: ALL other mortgages/deeds of trust go into refinances[], regardless of amount.

Common patterns to get right:
- Original purchase mortgage (e.g., $480,000 on a $500,000 purchase in 2019) = originalLoanAmount. This is the FIRST mortgage, not the most recent.
- A later recording for a SMALLER amount (e.g., $250,000 in 2022) = cash-out refi or HELOC → goes in refinances[].
- A later recording for a SIMILAR or LARGER amount (e.g., $460,000 in 2023) = rate-and-term or cash-out refi → goes in refinances[].
- DO NOT use the most recent recording as originalLoanAmount. The original mortgage is always the one recorded at the time of purchase.
- If multiple recordings exist near the purchase date, the LARGEST consistent with typical financing (70-97% LTV) is the purchase mortgage.

Sort refinances[] by date ascending.

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
  },
  lens: AnalysisLens = "homeowner"
): string {
  const skillInstructions = CSV_SKILL_INSTRUCTIONS;
  const city = subject.cityStateZip.split(",")[0]?.trim() || "";

  const lensDescriptions: Record<AnalysisLens, string> = {
    homeowner: "homeowner** (positive framing, subject advantages only, no jargon)",
    listing: "listing** (strategic/confident, cherry-pick highest defensible comps, do NOT suggest list price)",
    buyer: "buyer** (objective, shows advantages AND disadvantages, flags overpricing)",
  };

  return `${skillInstructions}

---

## YOUR TASK

Analyze the CSV data below for the following subject property and return results as a single JSON object.

**Lens: ${lensDescriptions[lens]}

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
    "trends": [
      {"period": "Q1 2025", "sales": 0, "medianPrice": 0, "medianPpsf": 0},
      {"period": "Q2 2025", "sales": 0, "medianPrice": 0, "medianPpsf": 0},
      {"period": "Q3 2025", "sales": 0, "medianPrice": 0, "medianPpsf": 0},
      {"period": "Q4 2025", "sales": 0, "medianPrice": 0, "medianPpsf": 0}
    ],
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
    "lens": "homeowner",
    "warnings": []
  }
}

IMPORTANT:
- Return ONLY the JSON object, no other text or markdown fences.
- All numeric values must be actual numbers, not strings (except beds, baths, dom, pool which are strings in the comps array).
- priceTrendDirection must be exactly one of: "rising", "stable", "declining".
- Pool values in comps must be "Y" or "N".
- Close dates must be in YYYY-MM-DD format.
- matchScore must be computed using the exact scoring formula above (sum of factor points). Do not round, estimate, or adjust. Scores will be recalculated and overwritten server-side.
- derivedValue must use the adjusted comparable sales method: adjust each of the top 4-6 comps for GLA, bath, pool, garage, fireplace differences using the Castle-calibrated rates, then weight-average the adjusted prices by similarity score.
- For pool adjustments, attempt paired sales analysis from the dataset first before falling back to $20K.
- For the neighborhood analysis, use ALL sales in the CSV, not just the top comps.
- Trends should be quarterly (Q1-Q4) not half-year periods.
- Use the ${lens} lens as described above.
- Every data point (sold price, close date, sqft, beds, baths, year built, etc.) must come directly from a CSV row. Never estimate, interpolate, or fabricate any value.`;
}

// === Sell Dashboard Content Prompt ===

export function sellContentPrompt(
  subject: SubjectProperty & { address: string; subdivision: string; communityName: string; cityStateZip: string; lotSqft: number },
  metrics: MarketMetrics,
  comps: CompSale[],
  cromfordMetrics: { label: string; value: string }[],
  city: string
): string {
  const topComps = comps.slice(0, 5).map(c => `  ${c.addr}: $${c.sp.toLocaleString()} (${c.sf} SF, $${c.ppsf}/SF, ${c.beds}/${c.baths}, pool: ${c.pool})`).join("\n");

  return `You are writing content for a sell dashboard (pre-listing CMA) for a property at ${subject.address}, ${subject.cityStateZip} in ${subject.communityName}.

Property: ${subject.beds} bed / ${subject.baths} bath / ${subject.sqft.toLocaleString()} SF / Lot ${subject.lotSqft.toLocaleString()} SF / built ${subject.yearBuilt} / ${subject.pool ? "pool" : "no pool"} / ${subject.stories}-story
Market: Derived value ~$${metrics.derivedValue.toLocaleString()}, Median $/SF $${metrics.medianPpsf}, Trend: ${metrics.priceTrendDirection}
Top comps:
${topComps}

Generate a JSON object with these fields:

{
  "pricingStrategy": "2-3 paragraph pricing strategy analysis. Reference the derived value range ($${metrics.derivedRange.low.toLocaleString()}-$${metrics.derivedRange.high.toLocaleString()}), comparable sales patterns, and market conditions. Strategic and confident tone. Do NOT recommend a specific list price.",
  "competition": [
    {"address": "123 Main St", "price": 850000, "status": "Active", "dom": 45, "beds": "4", "baths": "3", "sqft": 2200, "pool": "Y", "note": "Direct competitor, priced above market"}
  ],
  "marketSnapshot": [
    {"label": "${city} Median Price", "value": "$XXX,XXX"},
    {"label": "${subject.subdivision} Median $/SF", "value": "$XXX"},
    {"label": "Avg Days on Market", "value": "XX days"}
  ],
  "prepItems": [
    {"key": "paint", "label": "Interior Paint", "defaultCost": 5000, "desc": "Fresh paint throughout main living areas"},
    {"key": "landscape", "label": "Landscaping & Yard", "defaultCost": 2500, "desc": "Curb appeal cleanup"},
    {"key": "staging", "label": "Professional Staging", "defaultCost": 4000, "desc": "Full staging for photos and showings"},
    {"key": "deepClean", "label": "Deep Clean", "defaultCost": 1500, "desc": "Professional deep cleaning"},
    {"key": "minorRepairs", "label": "Minor Repairs", "defaultCost": 2000, "desc": "Touch-up items and small fixes"}
  ],
  "marketingPlan": [
    "Professional photography and video walkthrough",
    "Zillow Showcase listing with premium placement",
    "Targeted social media campaign",
    "Strategic open house schedule",
    "Custom property website"
  ],
  "timeline": [
    {"phase": "Phase 1", "dates": "Weeks 1-2", "items": ["Complete prep items", "Professional photography", "Staging"]},
    {"phase": "Phase 2", "dates": "Week 3", "items": ["Go live on MLS", "Launch marketing campaign", "First open house"]},
    {"phase": "Phase 3", "dates": "Weeks 3-6", "items": ["Showings and open houses", "Review offers", "Negotiate terms"]},
    {"phase": "Phase 4", "dates": "Weeks 6-10", "items": ["Under contract", "Inspections and appraisal", "Close of escrow"]}
  ],
  "propertyHighlights": ["Highlight 1 about this specific property", "Highlight 2", "Highlight 3"],
  "upgrades": [
    {"name": "Recent Kitchen Remodel", "value": "$45,000"},
    {"name": "Pool Resurfacing 2024", "value": "$8,000"}
  ]
}

Rules:
- Competition: Generate 3-5 realistic competing listings based on the market data. Use the actual subdivision and nearby areas. Include mix of Active, Under Contract, and Price Drop statuses.
- Prep items: Tailor to this specific property type and condition. Include 5-7 items.
- Timeline: 4 phases covering pre-listing through close.
- Property highlights: 4-6 bullet points about what makes THIS home stand out vs. competition.
- Upgrades: List documented or likely upgrades based on the property features.
- Market snapshot: 3-4 key market stats for the area.
- Never use the word "just".
- No em-dashes.

Return ONLY the JSON object.`;
}

// === Buyer Dashboard Content Prompt ===

export function buyerContentPrompt(
  clientNames: string,
  targetAreas: string,
  budgetMin: number,
  budgetMax: number,
  bedsMin: number,
  bathsMin: number,
  mustHaves: string[],
  schoolPreference: string,
  cityStateZip: string
): string {
  const city = cityStateZip.split(",")[0]?.trim() || "Phoenix";

  return `You are writing content for a buyer dashboard for ${clientNames}. They are looking to buy a home in the ${city} metro area.

Search criteria:
- Target areas: ${targetAreas || "East Valley (Gilbert, Chandler, Mesa, Queen Creek)"}
- Budget: $${budgetMin.toLocaleString()} - $${budgetMax.toLocaleString()}
- Minimum beds: ${bedsMin}, Minimum baths: ${bathsMin}
- Must-haves: ${mustHaves.length > 0 ? mustHaves.join(", ") : "Not specified"}
- School preference: ${schoolPreference || "Not specified"}

Generate a JSON object with ALL of these fields. Use REAL, accurate information about Arizona neighborhoods and schools:

{
  "neighborhoods": [
    {
      "name": "Neighborhood Name",
      "badge": "Top Pick",
      "badgeColor": "sage",
      "priceRange": "$550K-$750K",
      "homeSize": "1,800-3,200 SF",
      "commuteTime": "25 min to downtown",
      "description": "2-3 sentence neighborhood description with real details about the community, amenities, and character.",
      "whyItWorks": "1-2 sentences explaining why this neighborhood matches their specific criteria."
    }
  ],
  "schoolDistricts": [
    {
      "name": "Gilbert Public Schools",
      "description": "Brief district overview",
      "schools": [
        {
          "name": "School Name",
          "badge": "A+",
          "type": "Elementary",
          "grades": "K-6",
          "rating": "9/10",
          "description": "Brief description of the school",
          "url": "https://..."
        }
      ]
    }
  ],
  "timeline": [
    {"phase": "Phase 1", "title": "Get Ready (Now)", "items": ["Get pre-approved for mortgage", "Define must-haves vs. nice-to-haves", "Set up automated search alerts"]},
    {"phase": "Phase 2", "title": "Search & Tour (Weeks 1-4)", "items": ["Tour top neighborhoods", "Attend open houses", "Calibrate expectations"]},
    {"phase": "Phase 3", "title": "Make Your Move", "items": ["Write competitive offer", "Negotiate inspection items", "Lock in mortgage rate"]},
    {"phase": "Phase 4", "title": "Close & Move In", "items": ["Final walkthrough", "Sign closing documents", "Get your keys!"]}
  ],
  "marketSnapshot": [
    {"label": "${city} Median Price", "value": "$XXX,XXX"},
    {"label": "Avg Days on Market", "value": "XX days"},
    {"label": "Inventory Level", "value": "X.X months"}
  ]
}

Rules:
- Neighborhoods: Generate 4-6 neighborhoods that genuinely match their criteria. Use REAL neighborhood/subdivision names in the ${city} area. Badge colors: "sage" for top picks, "terra" for value picks, "sand" for honorable mentions.
- Schools: Generate 2-3 school districts with 2-4 schools each. Use REAL school names and ratings. Include elementary, middle, and high schools. URLs should be real school website URLs.
- Timeline: 4 phases from preparation through closing.
- Market snapshot: 3-4 real market stats for the target area.
- All information must be factually accurate for Arizona real estate.
- Never use the word "just".
- No em-dashes.

Return ONLY the JSON object.`;
}

// === Buy/Sell Dashboard Content Prompt ===

export function buySellContentPrompt(
  subject: SubjectProperty & { address: string; subdivision: string; communityName: string; cityStateZip: string; lotSqft: number },
  metrics: MarketMetrics,
  comps: CompSale[],
  clientNames: string,
  targetAreas: string,
  budgetMin: number,
  budgetMax: number,
  bedsMin: number,
  bathsMin: number,
  mustHaves: string[],
  schoolPreference: string,
  cromfordMetrics: { label: string; value: string }[]
): string {
  const city = subject.cityStateZip.split(",")[0]?.trim() || "";
  const topComps = comps.slice(0, 5).map(c => `  ${c.addr}: $${c.sp.toLocaleString()} ($${c.ppsf}/SF)`).join("\n");

  return `You are writing content for a buy/sell dashboard for ${clientNames}. They are selling their current home and buying a new one.

SELL SIDE - Current Home:
- Address: ${subject.address}, ${subject.cityStateZip}
- Subdivision: ${subject.subdivision} (${subject.communityName})
- Property: ${subject.beds}/${subject.baths}, ${subject.sqft.toLocaleString()} SF, built ${subject.yearBuilt}, ${subject.pool ? "pool" : "no pool"}
- Derived value: $${metrics.derivedValue.toLocaleString()} ($${metrics.derivedRange.low.toLocaleString()}-$${metrics.derivedRange.high.toLocaleString()})
- Top comps:
${topComps}

BUY SIDE - New Home Search:
- Target areas: ${targetAreas || "East Valley"}
- Budget: $${budgetMin.toLocaleString()} - $${budgetMax.toLocaleString()}
- Needs: ${bedsMin}+ beds, ${bathsMin}+ baths
- Must-haves: ${mustHaves.length > 0 ? mustHaves.join(", ") : "Not specified"}
- School preference: ${schoolPreference || "Not specified"}

Generate a JSON object:

{
  "sellPricingStrategy": "1-2 paragraph pricing analysis for the sell side. Reference derived value and comps.",
  "sellCompetition": [
    {"address": "123 Main St", "price": 850000, "status": "Active", "dom": 45, "beds": "4", "baths": "3", "sqft": 2200, "pool": "Y", "note": "Direct competitor"}
  ],
  "sellPropertyHighlights": ["Highlight about this specific property"],
  "neighborhoods": [
    {
      "name": "Neighborhood Name",
      "badge": "Top Pick",
      "badgeColor": "sage",
      "priceRange": "$550K-$750K",
      "homeSize": "1,800-3,200 SF",
      "commuteTime": "25 min",
      "description": "Neighborhood description.",
      "whyItWorks": "Why it matches their criteria."
    }
  ],
  "schoolDistricts": [
    {
      "name": "District Name",
      "description": "District overview",
      "schools": [
        {"name": "School", "badge": "A+", "type": "Elementary", "grades": "K-6", "rating": "9/10", "description": "Brief desc", "url": "https://..."}
      ]
    }
  ],
  "strategyOptions": [
    {"label": "Option A", "title": "Buy with Contingency", "pros": ["Faster if priced right"], "cons": ["Weaker offer position"]},
    {"label": "Option B", "title": "Sell First, Then Buy", "pros": ["Strongest offer position"], "cons": ["Need bridge housing"]},
    {"label": "Option C", "title": "Bridge Financing (HELOC)", "pros": ["Buy before selling"], "cons": ["Temporary double payments"]}
  ],
  "strategyTimeline": [
    {"phase": "Phase 1", "title": "Lay Groundwork (Now)", "items": ["Get pre-approved", "Prep home for sale", "Research target neighborhoods"]},
    {"phase": "Phase 2", "title": "Execute Strategy", "items": ["List home / start searching", "Coordinate timelines"]},
    {"phase": "Phase 3", "title": "Under Contract", "items": ["Negotiate both transactions", "Coordinate closings"]},
    {"phase": "Phase 4", "title": "Close & Move", "items": ["Close on sale", "Close on purchase", "Move!"]}
  ]
}

Rules:
- Competition: 3-5 realistic competing listings near the current home.
- Neighborhoods: 4-6 real neighborhoods matching their buy criteria.
- Schools: 2-3 real districts with real schools.
- Strategy options: 3 approaches with honest pros/cons.
- All data must be factually accurate for Arizona.
- Never use "just". No em-dashes.

Return ONLY the JSON object.`;
}

export function dashboardEditPrompt(configJson: string, instruction: string): string {
  return `You are editing a real estate dashboard config object. The user wants to make a change.

Current config (JSON):
${configJson}

User's edit instruction:
${instruction}

Rules:
- Return ONLY the complete modified config as a JSON object
- Preserve all fields not mentioned in the edit instruction
- For numeric fields, maintain proper number types (not strings)
- For array fields (comps, features, etc.), maintain the existing structure
- Do not add or remove top-level keys unless the instruction specifically requires it
- Never use "just". No em-dashes.`;
}
