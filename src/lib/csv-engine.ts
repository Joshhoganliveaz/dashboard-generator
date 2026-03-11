import { askClaude } from "./claude-api";
import { csvAnalysisPrompt } from "./claude-prompts";
import type {
  CompSale,
  MarketMetrics,
  NeighborhoodAnalysis,
  BedroomAnalysis,
  SubjectProperty,
} from "./types";
import type { AnalysisLens } from "./template-registry";

// --- Full Analysis Result ---

export interface CSVAnalysisResult {
  comps: CompSale[];
  marketMetrics: MarketMetrics;
  neighborhood: NeighborhoodAnalysis;
  bedroomAnalysis: BedroomAnalysis;
  subjectAdvantages: string[];
  metadata: {
    totalParsed: number;
    totalAfterFilter: number;
    warnings: string[];
  };
}

// --- Default result for error/empty cases ---

function emptyResult(): CSVAnalysisResult {
  return {
    comps: [],
    marketMetrics: {
      medianSoldPrice: 0, medianPpsf: 0, avgPpsf: 0,
      ppsfRange: { low: 0, high: 0 },
      derivedValue: 0, derivedRange: { low: 0, high: 0 },
      compsUsedForValue: 0, avgDom: 0, medianDom: 0,
      saleToListRatio: 0, priceTrendDirection: "stable",
      priceTrendDetail: "", totalSalesInPeriod: 0,
      subdivisionSalesCount: 0, earliestSale: "", latestSale: "",
      analysisPeriodMonths: 12,
    },
    neighborhood: {
      name: "", city: "", sourcePeriod: "",
      yoy: { recentCount: 0, priorCount: 0, countChgPct: 0, recentMedianPrice: 0, priorMedianPrice: 0, medianPriceChgPct: 0, recentMedianPpsf: 0, priorMedianPpsf: 0, medianPpsfChgPct: 0 },
      trends: [], pool: { poolCount: 0, poolMedianPrice: 0, poolMedianPpsf: 0, noPoolCount: 0, noPoolMedianPrice: 0, noPoolMedianPpsf: 0, premiumDollar: 0 },
      sizeSegments: [], narrative: "",
    },
    bedroomAnalysis: {
      hasEnoughData: false, subjectBeds: 0, subjectPpsf: 0, breakdown: [], narrative: "",
    },
    subjectAdvantages: [],
    metadata: { totalParsed: 0, totalAfterFilter: 0, warnings: [] },
  };
}

// --- Parse JSON from Claude response (strip markdown fences if present) ---

function parseJSONResponse(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleaned);
}

// --- Validate and coerce Claude's response into CSVAnalysisResult ---

function validateResponse(data: Record<string, unknown>): CSVAnalysisResult {
  const defaults = emptyResult();

  // Validate comps array
  const comps: CompSale[] = Array.isArray(data.comps)
    ? (data.comps as Record<string, unknown>[]).map((c) => ({
        addr: String(c.addr || ""),
        sub: String(c.sub || ""),
        community: String(c.community || ""),
        close: String(c.close || ""),
        sp: Number(c.sp) || 0,
        sf: Number(c.sf) || 0,
        ppsf: Number(c.ppsf) || 0,
        beds: String(c.beds || "0"),
        baths: String(c.baths || "0"),
        pool: String(c.pool || "N"),
        dom: String(c.dom || "0"),
        yearBuilt: Number(c.yearBuilt) || 0,
        stories: Number(c.stories) || 1,
        matchScore: Number(c.matchScore) || 0,
        note: String(c.note || ""),
      }))
    : [];

  // Validate marketMetrics
  const mm = data.marketMetrics && typeof data.marketMetrics === "object"
    ? data.marketMetrics as Record<string, unknown>
    : {};
  const ppsfRange = mm.ppsfRange && typeof mm.ppsfRange === "object"
    ? mm.ppsfRange as Record<string, unknown>
    : {};
  const derivedRange = mm.derivedRange && typeof mm.derivedRange === "object"
    ? mm.derivedRange as Record<string, unknown>
    : {};

  const trendDir = String(mm.priceTrendDirection || "stable");
  const validTrends = ["rising", "stable", "declining"];

  const marketMetrics: MarketMetrics = {
    medianSoldPrice: Number(mm.medianSoldPrice) || 0,
    medianPpsf: Number(mm.medianPpsf) || 0,
    avgPpsf: Number(mm.avgPpsf) || 0,
    ppsfRange: { low: Number(ppsfRange.low) || 0, high: Number(ppsfRange.high) || 0 },
    derivedValue: Number(mm.derivedValue) || 0,
    derivedRange: { low: Number(derivedRange.low) || 0, high: Number(derivedRange.high) || 0 },
    compsUsedForValue: Number(mm.compsUsedForValue) || 0,
    avgDom: Number(mm.avgDom) || 0,
    medianDom: Number(mm.medianDom) || 0,
    saleToListRatio: Number(mm.saleToListRatio) || 0,
    priceTrendDirection: validTrends.includes(trendDir) ? trendDir as MarketMetrics["priceTrendDirection"] : "stable",
    priceTrendDetail: String(mm.priceTrendDetail || ""),
    totalSalesInPeriod: Number(mm.totalSalesInPeriod) || 0,
    subdivisionSalesCount: Number(mm.subdivisionSalesCount) || 0,
    earliestSale: String(mm.earliestSale || ""),
    latestSale: String(mm.latestSale || ""),
    analysisPeriodMonths: Number(mm.analysisPeriodMonths) || 12,
  };

  // Validate neighborhood
  const nh = data.neighborhood && typeof data.neighborhood === "object"
    ? data.neighborhood as Record<string, unknown>
    : {};
  const nhYoy = nh.yoy && typeof nh.yoy === "object" ? nh.yoy as Record<string, unknown> : {};
  const nhPool = nh.pool && typeof nh.pool === "object" ? nh.pool as Record<string, unknown> : {};

  const neighborhood: NeighborhoodAnalysis = {
    name: String(nh.name || ""),
    city: String(nh.city || ""),
    sourcePeriod: String(nh.sourcePeriod || ""),
    yoy: {
      recentCount: Number(nhYoy.recentCount) || 0,
      priorCount: Number(nhYoy.priorCount) || 0,
      countChgPct: Number(nhYoy.countChgPct) || 0,
      recentMedianPrice: Number(nhYoy.recentMedianPrice) || 0,
      priorMedianPrice: Number(nhYoy.priorMedianPrice) || 0,
      medianPriceChgPct: Number(nhYoy.medianPriceChgPct) || 0,
      recentMedianPpsf: Number(nhYoy.recentMedianPpsf) || 0,
      priorMedianPpsf: Number(nhYoy.priorMedianPpsf) || 0,
      medianPpsfChgPct: Number(nhYoy.medianPpsfChgPct) || 0,
    },
    trends: Array.isArray(nh.trends)
      ? (nh.trends as Record<string, unknown>[]).map((t) => ({
          period: String(t.period || ""),
          sales: Number(t.sales) || 0,
          medianPrice: Number(t.medianPrice) || 0,
          medianPpsf: Number(t.medianPpsf) || 0,
        }))
      : [],
    pool: {
      poolCount: Number(nhPool.poolCount) || 0,
      poolMedianPrice: Number(nhPool.poolMedianPrice) || 0,
      poolMedianPpsf: Number(nhPool.poolMedianPpsf) || 0,
      noPoolCount: Number(nhPool.noPoolCount) || 0,
      noPoolMedianPrice: Number(nhPool.noPoolMedianPrice) || 0,
      noPoolMedianPpsf: Number(nhPool.noPoolMedianPpsf) || 0,
      premiumDollar: Number(nhPool.premiumDollar) || 0,
    },
    sizeSegments: Array.isArray(nh.sizeSegments)
      ? (nh.sizeSegments as Record<string, unknown>[]).map((s) => ({
          label: String(s.label || ""),
          count: Number(s.count) || 0,
          medianPrice: Number(s.medianPrice) || 0,
          medianPpsf: Number(s.medianPpsf) || 0,
          isSubjectTier: Boolean(s.isSubjectTier),
        }))
      : [],
    narrative: String(nh.narrative || ""),
  };

  // Validate bedroomAnalysis
  const ba = data.bedroomAnalysis && typeof data.bedroomAnalysis === "object"
    ? data.bedroomAnalysis as Record<string, unknown>
    : {};

  const bedroomAnalysis: BedroomAnalysis = {
    hasEnoughData: Boolean(ba.hasEnoughData),
    subjectBeds: Number(ba.subjectBeds) || 0,
    subjectPpsf: Number(ba.subjectPpsf) || 0,
    breakdown: Array.isArray(ba.breakdown)
      ? (ba.breakdown as Record<string, unknown>[]).map((b) => ({
          beds: Number(b.beds) || 0,
          count: Number(b.count) || 0,
          avgPpsf: Number(b.avgPpsf) || 0,
          medianPpsf: Number(b.medianPpsf) || 0,
        }))
      : [],
    narrative: String(ba.narrative || ""),
  };

  // Validate metadata
  const meta = data.metadata && typeof data.metadata === "object"
    ? data.metadata as Record<string, unknown>
    : {};

  return {
    comps,
    marketMetrics,
    neighborhood,
    bedroomAnalysis,
    subjectAdvantages: Array.isArray(data.subjectAdvantages)
      ? (data.subjectAdvantages as unknown[]).map(String)
      : [],
    metadata: {
      totalParsed: Number(meta.totalParsed) || 0,
      totalAfterFilter: Number(meta.totalAfterFilter) || 0,
      warnings: Array.isArray(meta.warnings) ? (meta.warnings as unknown[]).map(String) : [],
    },
  };
}

// --- Parse CSV fields respecting quoted values ---

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// --- Pre-parse Features column into compact summary ---

function compactFeatures(raw: string): string {
  if (!raw || raw.length < 10) return "";
  const parts: string[] = [];

  // Garage spaces: look for "N Car Garage" or "Garage Spaces|N"
  const garageMatch = raw.match(/(\d)\s*Car\s*Garage/i) || raw.match(/Garage\s*Spaces?\|(\d)/i);
  if (garageMatch) parts.push(`Gar:${garageMatch[1]}`);

  // RV access
  if (/RV\s*Gate/i.test(raw)) parts.push("RV:Y");
  else if (/RV\s*(?:Parking|Garage)/i.test(raw)) parts.push("RV:Y");

  // Solar
  if (/Solar\s*Owned/i.test(raw)) parts.push("Solar:Owned");
  else if (/Solar\s*Leased/i.test(raw)) parts.push("Solar:Leased");

  // Spa
  if (/Private\s*Heated\s*Spa/i.test(raw) || (/Spa\|.*Heated/i.test(raw) && /Spa\|.*Private/i.test(raw))) parts.push("Spa:PrivateHeated");
  else if (/Private\s*Spa/i.test(raw) || /Spa\|.*Private/i.test(raw)) parts.push("Spa:Private");
  else if (/\bSpa\b/i.test(raw) && /Yes/i.test(raw.slice(raw.search(/\bSpa\b/i), raw.search(/\bSpa\b/i) + 30))) parts.push("Spa:Y");

  // Guest house
  if (/Guest\s*(?:House|Quarters)|Casita/i.test(raw)) parts.push("Guest:Y");

  // Countertops
  const counterMatch = raw.match(/(?:Kitchen\s*Features?|Counter(?:top)?s?)\|?\s*(Granite|Quartz|Marble|Slab|Laminate)/i);
  if (counterMatch) parts.push(`Counters:${counterMatch[1]}`);

  // Gated community
  if (/Gated\s*Community|Guard\s*Gated/i.test(raw)) parts.push("Gated:Y");

  // HOA fee
  const hoaMatch = raw.match(/HOA\s*(?:Fee|Dues?)?\|?\$?\s*(\d[\d,.]*)/i);
  if (hoaMatch) parts.push(`HOA:${hoaMatch[1].replace(/,/g, "")}`);

  // Pool type
  if (/Play\s*Pool/i.test(raw)) parts.push("PoolType:Play");
  else if (/Diving\s*Pool/i.test(raw)) parts.push("PoolType:Diving");
  else if (/Heated\s*Pool/i.test(raw)) parts.push("PoolType:Heated");
  else if (/Pebble(?:tec|sheen)/i.test(raw)) parts.push("PoolType:Pebble");

  // View
  const viewMatch = raw.match(/(Mountain|Lake|City\s*Light|Golf\s*Course|Desert)\s*View/i);
  if (viewMatch) parts.push(`View:${viewMatch[1].replace(/\s+/g, "")}`);

  // Corner lot
  if (/Corner\s*Lot/i.test(raw)) parts.push("Corner:Y");

  return parts.join(";");
}

// --- Strip CSV to only columns needed for analysis ---

const KEEP_COLUMNS = new Set([
  "House Number", "Compass", "Street Name", "St Suffix",
  "Sold Price", "List Price", "Original List Price",
  "Approx SQFT", "Price/SqFt",
  "# Bedrooms", "Total Bathrooms", "Full Bathrooms", "Half Bathrooms",
  "Year Built", "Exterior Stories",
  "Close of Escrow Date", "Days on Market",
  "Subdivision", "Dwelling Styles",
  "Source Apx Lot SqFt", "Approx Lot SqFt",
  "Private Pool Y/N", "Status",
  "Fireplace Y/N", "Fireplaces Total",
  "Cross Street", "Features",
]);

function trimCSVColumns(csvText: string): string {
  const lines = csvText.split("\n");
  if (lines.length < 2) return csvText;

  const headerFields = parseCSVLine(lines[0]);
  const keepIndices = headerFields
    .map((h, i) => KEEP_COLUMNS.has(h.trim()) ? i : -1)
    .filter((i) => i >= 0);

  // If we can't find any matching columns, return original (might be a different format)
  if (keepIndices.length === 0) return csvText;

  // Find the Features column index among the kept columns
  const featuresColOrigIdx = headerFields.findIndex((h) => h.trim() === "Features");

  const trimmedLines: string[] = [];
  let isHeader = true;
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    const kept = keepIndices.map((i) => {
      let val = fields[i] ?? "";
      // Pre-parse Features column into compact summary (skip header row)
      if (!isHeader && i === featuresColOrigIdx && val.length > 0) {
        val = compactFeatures(val);
      }
      // Re-quote if the value contains commas or quotes
      return val.includes(",") || val.includes('"')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    });
    trimmedLines.push(kept.join(","));
    isHeader = false;
  }

  return trimmedLines.join("\n");
}

// --- Main entry point: Claude-powered CSV analysis ---

export async function runFullAnalysis(
  csvBuffer: Buffer,
  subject: SubjectProperty & {
    subdivision: string;
    communityName: string;
    cityStateZip: string;
    address: string;
  },
  lens: AnalysisLens = "homeowner"
): Promise<CSVAnalysisResult> {
  // Decode CSV as latin-1
  let csvText: string;
  try {
    const decoder = new TextDecoder("latin1");
    csvText = decoder.decode(csvBuffer);
  } catch {
    csvText = csvBuffer.toString("utf-8");
  }

  // Quick sanity check: ensure we have CSV data
  const lineCount = csvText.split("\n").filter((l) => l.trim()).length;
  if (lineCount < 2) {
    const result = emptyResult();
    result.metadata.warnings.push("CSV file appears empty or has no data rows");
    return result;
  }

  // Strip to only needed columns to avoid exceeding context limits
  csvText = trimCSVColumns(csvText);

  // Build prompt and call Claude
  const prompt = csvAnalysisPrompt(csvText, subject, lens);

  try {
    const response = await askClaude(prompt, {
      model: "claude-sonnet-4-20250514",
      maxTokens: 16384,
    });
    const parsed = parseJSONResponse(response);
    return validateResponse(parsed);
  } catch (err) {
    console.error("Claude CSV analysis failed:", err);
    const result = emptyResult();
    result.metadata.warnings.push(`Claude analysis failed: ${(err as Error).message}`);
    result.metadata.totalParsed = lineCount - 1; // rough estimate (header row)
    return result;
  }
}
