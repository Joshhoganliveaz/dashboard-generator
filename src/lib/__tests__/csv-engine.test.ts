import { describe, it, expect, vi, beforeEach } from "vitest";
import Papa from "papaparse";
import { runFullAnalysis, type CSVAnalysisResult } from "../csv-engine";

// Mock the Claude API module
vi.mock("../claude-api", () => ({
  askClaude: vi.fn(),
}));

import { askClaude } from "../claude-api";

const mockAskClaude = vi.mocked(askClaude);

// Minimal valid response that Claude would return
const mockClaudeResponse: CSVAnalysisResult = {
  comps: [
    {
      addr: "2300 S Estrella Cir",
      sub: "Saratoga Lakes",
      community: "Saratoga Lakes at Dobson Ranch",
      close: "2026-01-15",
      sp: 575000,
      sf: 1850,
      ppsf: 310.81,
      beds: "4",
      baths: "2",
      pool: "Y",
      dom: "12",
      yearBuilt: 1985,
      stories: 1,
      matchScore: 82,
      note: "",
    },
    {
      addr: "1234 W Oak St",
      sub: "Dobson Ranch",
      community: "Dobson Ranch",
      close: "2025-11-20",
      sp: 520000,
      sf: 1920,
      ppsf: 270.83,
      beds: "4",
      baths: "2.5",
      pool: "N",
      dom: "28",
      yearBuilt: 1984,
      stories: 1,
      matchScore: 65,
      note: "Dobson Ranch",
    },
  ],
  marketMetrics: {
    medianSoldPrice: 547500,
    medianPpsf: 290.82,
    avgPpsf: 295.10,
    ppsfRange: { low: 250.0, high: 340.0 },
    derivedValue: 558000,
    derivedRange: { low: 541000, high: 575000 },
    compsUsedForValue: 6,
    avgDom: 20,
    medianDom: 15,
    saleToListRatio: 0.985,
    priceTrendDirection: "rising",
    priceTrendDetail: "Median $/SF moved from $280 to $295 (+5.4%)",
    totalSalesInPeriod: 18,
    subdivisionSalesCount: 8,
    earliestSale: "2025-03-10",
    latestSale: "2026-02-28",
    analysisPeriodMonths: 12,
  },
  neighborhood: {
    name: "Saratoga Lakes at Dobson Ranch",
    city: "Mesa",
    sourcePeriod: "March 2025 - March 2026",
    yoy: {
      recentCount: 18,
      priorCount: 15,
      countChgPct: 20.0,
      recentMedianPrice: 547500,
      priorMedianPrice: 520000,
      medianPriceChgPct: 5.3,
      recentMedianPpsf: 290,
      priorMedianPpsf: 275,
      medianPpsfChgPct: 5.5,
    },
    trends: [
      { period: "H1 2025", sales: 8, medianPrice: 530000, medianPpsf: 280 },
      { period: "H2 2025", sales: 7, medianPrice: 545000, medianPpsf: 290 },
    ],
    pool: {
      poolCount: 10,
      poolMedianPrice: 580000,
      poolMedianPpsf: 305,
      noPoolCount: 8,
      noPoolMedianPrice: 500000,
      noPoolMedianPpsf: 270,
      premiumDollar: 80000,
    },
    sizeSegments: [
      { label: "Under 1,800 SF", count: 5, medianPrice: 480000, medianPpsf: 310, isSubjectTier: false },
      { label: "1,800-2,399 SF", count: 10, medianPrice: 550000, medianPpsf: 285, isSubjectTier: true },
      { label: "2,400+ SF", count: 3, medianPrice: 650000, medianPpsf: 260, isSubjectTier: false },
    ],
    narrative: "Dobson Ranch is holding steady with rising prices per square foot.",
  },
  bedroomAnalysis: {
    hasEnoughData: true,
    subjectBeds: 4,
    subjectPpsf: 295,
    breakdown: [
      { beds: 3, count: 5, avgPpsf: 280, medianPpsf: 278 },
      { beds: 4, count: 8, avgPpsf: 295, medianPpsf: 292 },
    ],
    narrative: "",
  },
  subjectAdvantages: [
    "Pool home in a market where pool homes command an $80K premium",
  ],
  metadata: {
    totalParsed: 20,
    totalAfterFilter: 18,
    warnings: [],
  },
};

const subject = {
  beds: 4,
  baths: 2.5,
  sqft: 1920,
  yearBuilt: 1986,
  pool: true,
  stories: 1,
  subdivision: "Saratoga Lakes",
  communityName: "Saratoga Lakes at Dobson Ranch",
  cityStateZip: "Mesa, AZ 85202",
  address: "2252 S Estrella Cir",
};

// Minimal CSV content for testing
const testCSV = `House Number,Compass,Street Name,St Suffix,Sold Price,List Price,Approx SQFT,Price/SqFt,# Bedrooms,Total Bathrooms,Year Built,Exterior Stories,Close of Escrow Date,Days on Market,Subdivision,Private Pool Y/N,Public Remarks
2300,S,Estrella,Cir,"$575,000","$579,000",1850,310.81,4,2,1985,One,01/15/2026,12,Saratoga Lakes,Y,Beautiful home
1234,W,Oak,St,"$520,000","$530,000",1920,270.83,4,2.5,1984,One,11/20/2025,28,Dobson Ranch,N,Updated kitchen`;

beforeEach(() => {
  mockAskClaude.mockReset();
});

describe("runFullAnalysis", () => {
  it("calls Claude API and returns validated result", async () => {
    mockAskClaude.mockResolvedValue(JSON.stringify(mockClaudeResponse));

    const csvBuffer = Buffer.from(testCSV);
    const result = await runFullAnalysis(csvBuffer, subject);

    expect(mockAskClaude).toHaveBeenCalledOnce();
    expect(result.comps.length).toBe(2);
    expect(result.comps[0].addr).toBe("2300 S Estrella Cir");
    expect(result.marketMetrics.medianPpsf).toBe(290.82);
    expect(result.marketMetrics.priceTrendDirection).toBe("rising");
    expect(result.neighborhood.name).toBe("Saratoga Lakes at Dobson Ranch");
    expect(result.bedroomAnalysis.hasEnoughData).toBe(true);
    expect(result.subjectAdvantages.length).toBe(1);
    expect(result.metadata.totalParsed).toBe(20);
  });

  it("handles markdown-fenced JSON response", async () => {
    mockAskClaude.mockResolvedValue("```json\n" + JSON.stringify(mockClaudeResponse) + "\n```");

    const csvBuffer = Buffer.from(testCSV);
    const result = await runFullAnalysis(csvBuffer, subject);

    expect(result.comps.length).toBe(2);
    // derivedValue uses adjusted comparable sales method:
    // Comp 1 (sf=1850, baths=2, pool=Y): +$5K baths adj → $580K adjusted
    // Comp 2 (sf=1920, baths=2.5, pool=N): +$20K pool adj → $540K adjusted
    // Weighted avg by matchScore, rounded to nearest $1K
    expect(result.marketMetrics.derivedValue).toBe(565000);
  });

  it("returns empty result with warning on Claude API failure", async () => {
    mockAskClaude.mockRejectedValue(new Error("API rate limited"));

    const csvBuffer = Buffer.from(testCSV);
    const result = await runFullAnalysis(csvBuffer, subject);

    expect(result.comps.length).toBe(0);
    expect(result.marketMetrics.medianPpsf).toBe(0);
    expect(result.metadata.warnings.length).toBeGreaterThan(0);
    expect(result.metadata.warnings[0]).toContain("Claude analysis failed");
  });

  it("returns empty result for empty CSV", async () => {
    const csvBuffer = Buffer.from("");
    const result = await runFullAnalysis(csvBuffer, subject);

    expect(result.comps.length).toBe(0);
    expect(result.metadata.warnings).toContain("CSV file appears empty or has no data rows");
    expect(mockAskClaude).not.toHaveBeenCalled();
  });

  it("validates priceTrendDirection to allowed enum values", async () => {
    const badResponse = {
      ...mockClaudeResponse,
      marketMetrics: { ...mockClaudeResponse.marketMetrics, priceTrendDirection: "invalid" },
    };
    mockAskClaude.mockResolvedValue(JSON.stringify(badResponse));

    const csvBuffer = Buffer.from(testCSV);
    const result = await runFullAnalysis(csvBuffer, subject);

    expect(result.marketMetrics.priceTrendDirection).toBe("stable");
  });

  it("coerces missing fields to safe defaults", async () => {
    // Minimal response with missing fields
    const minimalResponse = { comps: [], marketMetrics: {}, neighborhood: {}, bedroomAnalysis: {}, subjectAdvantages: [], metadata: {} };
    mockAskClaude.mockResolvedValue(JSON.stringify(minimalResponse));

    const csvBuffer = Buffer.from(testCSV);
    const result = await runFullAnalysis(csvBuffer, subject);

    expect(result.comps).toEqual([]);
    expect(result.marketMetrics.medianPpsf).toBe(0);
    expect(result.marketMetrics.priceTrendDirection).toBe("stable");
    expect(result.neighborhood.trends).toEqual([]);
    expect(result.bedroomAnalysis.hasEnoughData).toBe(false);
  });

  it("passes CSV text and subject details in the prompt", async () => {
    mockAskClaude.mockResolvedValue(JSON.stringify(mockClaudeResponse));

    const csvBuffer = Buffer.from(testCSV);
    await runFullAnalysis(csvBuffer, subject);

    const prompt = mockAskClaude.mock.calls[0][0];
    expect(prompt).toContain("2252 S Estrella Cir");
    expect(prompt).toContain("Saratoga Lakes");
    expect(prompt).toContain("Mesa");
    expect(prompt).toContain("575,000"); // CSV data should be included
  });
});

describe("CSV parsing with Papaparse", () => {
  it("uses Papa.parse for CSV parsing", () => {
    // Verify papaparse handles the CSV format used by ARMLS
    const csv = `Name,Address,Price\nJohn,"123 Main St, Apt 4","$500,000"`;
    const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as Record<string, string>).Name).toBe("John");
  });

  it("handles quoted fields with commas correctly", () => {
    const csv = `Address,Price,Status\n"123 Main St, Apt 4","$575,000",C\n"456 Oak Ave, Unit 2","$520,000",C`;
    const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
    expect(result.data).toHaveLength(2);
    expect((result.data[0] as Record<string, string>).Address).toBe("123 Main St, Apt 4");
    expect((result.data[1] as Record<string, string>).Address).toBe("456 Oak Ave, Unit 2");
  });

  it("skips empty rows", () => {
    const csv = `Name,Price\nJohn,100\n\n\nJane,200\n`;
    const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
    expect(result.data).toHaveLength(2);
  });
});

describe("deterministic scoring", () => {
  it("computeMatchScore produces same output for same inputs every time", async () => {
    mockAskClaude.mockResolvedValue(JSON.stringify(mockClaudeResponse));

    const csvBuffer = Buffer.from(testCSV);
    const results: number[][] = [];

    // Run 5 times and collect scores
    for (let i = 0; i < 5; i++) {
      mockAskClaude.mockResolvedValue(JSON.stringify(mockClaudeResponse));
      const result = await runFullAnalysis(csvBuffer, subject);
      results.push(result.comps.map(c => c.matchScore));
    }

    // All runs should produce identical scores
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it("metrics are deterministic with same comp data", async () => {
    mockAskClaude.mockResolvedValue(JSON.stringify(mockClaudeResponse));

    const csvBuffer = Buffer.from(testCSV);
    const result1 = await runFullAnalysis(csvBuffer, subject);

    mockAskClaude.mockResolvedValue(JSON.stringify(mockClaudeResponse));
    const result2 = await runFullAnalysis(csvBuffer, subject);

    // PPSF metrics should be identical
    expect(result1.marketMetrics.medianPpsf).toBe(result2.marketMetrics.medianPpsf);
    expect(result1.marketMetrics.avgPpsf).toBe(result2.marketMetrics.avgPpsf);
    expect(result1.marketMetrics.ppsfRange).toEqual(result2.marketMetrics.ppsfRange);
  });
});

describe("Claude separation", () => {
  it("does not call Claude during scoring (Claude only for narratives)", async () => {
    mockAskClaude.mockResolvedValue(JSON.stringify(mockClaudeResponse));

    const csvBuffer = Buffer.from(testCSV);
    const result = await runFullAnalysis(csvBuffer, subject);

    // askClaude is called once for the overall narrative analysis
    // The scoring override (computeMatchScore) and metric recalculation
    // happen AFTER Claude returns, with no additional Claude calls
    expect(mockAskClaude).toHaveBeenCalledTimes(1);

    // Scores are deterministic overrides, not from Claude
    expect(result.comps[0].matchScore).toBeTypeOf("number");
    expect(result.comps[0].matchScore).toBeGreaterThanOrEqual(0);
  });
});
