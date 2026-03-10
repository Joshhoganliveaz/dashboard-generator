import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { runFullAnalysis, type CSVAnalysisResult } from "../csv-engine";
import { injectConfig } from "../template-engine";
import { validateDashboardConfig } from "../types";
import { estimateCurrentBalance } from "../loan-estimator";
import {
  mockMLSExtraction,
  mockCromfordData,
  mockWebResearch,
  mockContentGeneration,
  mockTaxRecordsExtraction,
} from "./fixtures/mock-claude-responses";
import manifest from "./fixtures/brandon-manifest.json";

// Mock the Claude API
vi.mock("../claude-api", () => ({
  askClaude: vi.fn(),
}));

import { askClaude } from "../claude-api";
const mockAskClaude = vi.mocked(askClaude);

const CSV_PATH = join(__dirname, "fixtures", "brandon-test.csv");

// A realistic mock CSV analysis result for the pipeline tests
const mockCSVResult: CSVAnalysisResult = {
  comps: [
    { addr: "2300 S Estrella Cir", sub: "Saratoga Lakes", community: "Saratoga Lakes at Dobson Ranch", close: "2026-01-15", sp: 575000, sf: 1850, ppsf: 310.81, beds: "4", baths: "2", pool: "Y", dom: "12", yearBuilt: 1985, stories: 1, matchScore: 82, note: "" },
    { addr: "2157 S Longmore", sub: "Dobson Ranch", community: "Dobson Ranch", close: "2025-12-01", sp: 520000, sf: 1920, ppsf: 270.83, beds: "4", baths: "2.5", pool: "N", dom: "28", yearBuilt: 1984, stories: 1, matchScore: 65, note: "Dobson Ranch" },
  ],
  marketMetrics: {
    medianSoldPrice: 547500, medianPpsf: 290.82, avgPpsf: 295.10,
    ppsfRange: { low: 250, high: 340 },
    derivedValue: 558000, derivedRange: { low: 541000, high: 575000 },
    compsUsedForValue: 6, avgDom: 20, medianDom: 15,
    saleToListRatio: 0.985, priceTrendDirection: "rising",
    priceTrendDetail: "Median $/SF moved from $280 to $295 (+5.4%)",
    totalSalesInPeriod: 18, subdivisionSalesCount: 8,
    earliestSale: "2025-03-10", latestSale: "2026-02-28",
    analysisPeriodMonths: 12,
  },
  neighborhood: {
    name: "Saratoga Lakes at Dobson Ranch", city: "Mesa",
    sourcePeriod: "March 2025 - March 2026",
    yoy: { recentCount: 18, priorCount: 15, countChgPct: 20, recentMedianPrice: 547500, priorMedianPrice: 520000, medianPriceChgPct: 5.3, recentMedianPpsf: 290, priorMedianPpsf: 275, medianPpsfChgPct: 5.5 },
    trends: [{ period: "H1 2025", sales: 8, medianPrice: 530000, medianPpsf: 280 }],
    pool: { poolCount: 10, poolMedianPrice: 580000, poolMedianPpsf: 305, noPoolCount: 8, noPoolMedianPrice: 500000, noPoolMedianPpsf: 270, premiumDollar: 80000 },
    sizeSegments: [
      { label: "Under 1,800 SF", count: 5, medianPrice: 480000, medianPpsf: 310, isSubjectTier: false },
      { label: "1,800-2,399 SF", count: 10, medianPrice: 550000, medianPpsf: 285, isSubjectTier: true },
      { label: "2,400+ SF", count: 3, medianPrice: 650000, medianPpsf: 260, isSubjectTier: false },
    ],
    narrative: "",
  },
  bedroomAnalysis: {
    hasEnoughData: true, subjectBeds: 4, subjectPpsf: 295,
    breakdown: [
      { beds: 3, count: 5, avgPpsf: 280, medianPpsf: 278 },
      { beds: 4, count: 8, avgPpsf: 295, medianPpsf: 292 },
    ],
    narrative: "",
  },
  subjectAdvantages: ["Pool home in a market where pool homes command an $80K premium"],
  metadata: { totalParsed: 20, totalAfterFilter: 18, warnings: [] },
};

beforeEach(() => {
  mockAskClaude.mockReset();
  mockAskClaude.mockResolvedValue(JSON.stringify(mockCSVResult));
});

describe("Full pipeline integration", () => {
  const csvBuffer = Buffer.from(readFileSync(CSV_PATH, "utf-8"));

  it("assembles a complete CONFIG from CSV + mock Claude responses", async () => {
    const subject = {
      beds: mockMLSExtraction.beds,
      baths: mockMLSExtraction.baths,
      sqft: mockMLSExtraction.sqft,
      yearBuilt: mockMLSExtraction.yearBuilt,
      pool: mockMLSExtraction.pool,
      stories: mockMLSExtraction.stories,
    };

    // Step 1: CSV analysis (via mocked Claude API)
    const csvResult = await runFullAnalysis(csvBuffer, {
      ...subject,
      subdivision: manifest.subdivision,
      communityName: manifest.communityName,
      cityStateZip: manifest.cityStateZip,
      address: manifest.address,
    });
    expect(csvResult.comps.length).toBeGreaterThan(0);

    // Step 2: Update narratives from mock content
    csvResult.neighborhood.narrative = mockContentGeneration.neighborhoodNarrative;
    csvResult.bedroomAnalysis.narrative = mockContentGeneration.bedroomNarrative;

    // Step 3: Assemble raw config
    const rawConfig = {
      clientNames: manifest.clientNames,
      fullName: manifest.fullName,
      email: manifest.email,
      address: manifest.address,
      cityStateZip: manifest.cityStateZip,
      subdivision: manifest.subdivision,
      communityName: manifest.communityName,
      headerTitle: mockContentGeneration.headerTitle,
      purchaseDate: manifest.purchaseDate,
      purchasePrice: manifest.purchasePrice,
      loanBalance: manifest.loanBalance,
      agentKey: manifest.agentKey,
      ...subject,
      comps: csvResult.comps,
      marketMetrics: csvResult.marketMetrics,
      neighborhood: csvResult.neighborhood,
      bedroomAnalysis: csvResult.bedroomAnalysis,
      subjectAdvantages: csvResult.subjectAdvantages,
      features: mockMLSExtraction.features,
      cromfordMetrics: mockCromfordData.metrics,
      cromfordTakeaway: mockCromfordData.takeaway,
      cromfordSource: mockCromfordData.source,
      outlookNarrative: mockContentGeneration.outlookNarrative,
      upgrades: mockContentGeneration.upgrades,
      developments: mockWebResearch.developments,
      infrastructure: mockWebResearch.infrastructure,
      areaHighlights: mockWebResearch.areaHighlights,
      resources: mockContentGeneration.resources,
    };

    // Step 4: Validate config
    const config = validateDashboardConfig(rawConfig);

    expect(config.clientNames).toBe("Brandon & Nicole");
    expect(config.address).toBe("2252 S Estrella Cir");
    expect(config.beds).toBe(4);
    expect(config.pool).toBe(true);
    expect(config.comps.length).toBeGreaterThan(0);
    expect(config.marketMetrics.medianPpsf).toBeGreaterThan(0);
    expect(config.cromfordMetrics.length).toBe(10);
    expect(config.developments.length).toBeGreaterThan(0);
    expect(config.upgrades.length).toBeGreaterThan(0);
    expect(config.outlookNarrative.length).toBe(2);
  });

  it("injects into template and produces valid HTML with CONFIG", async () => {
    const subject = {
      beds: mockMLSExtraction.beds,
      baths: mockMLSExtraction.baths,
      sqft: mockMLSExtraction.sqft,
      yearBuilt: mockMLSExtraction.yearBuilt,
      pool: mockMLSExtraction.pool,
      stories: mockMLSExtraction.stories,
    };

    const csvResult = await runFullAnalysis(csvBuffer, {
      ...subject,
      subdivision: manifest.subdivision,
      communityName: manifest.communityName,
      cityStateZip: manifest.cityStateZip,
      address: manifest.address,
    });
    csvResult.neighborhood.narrative = mockContentGeneration.neighborhoodNarrative;
    csvResult.bedroomAnalysis.narrative = mockContentGeneration.bedroomNarrative;

    const config = validateDashboardConfig({
      clientNames: manifest.clientNames,
      fullName: manifest.fullName,
      email: manifest.email,
      address: manifest.address,
      cityStateZip: manifest.cityStateZip,
      subdivision: manifest.subdivision,
      communityName: manifest.communityName,
      headerTitle: mockContentGeneration.headerTitle,
      purchaseDate: manifest.purchaseDate,
      purchasePrice: manifest.purchasePrice,
      loanBalance: manifest.loanBalance,
      agentKey: manifest.agentKey,
      ...subject,
      comps: csvResult.comps,
      marketMetrics: csvResult.marketMetrics,
      neighborhood: csvResult.neighborhood,
      bedroomAnalysis: csvResult.bedroomAnalysis,
      subjectAdvantages: csvResult.subjectAdvantages,
      features: mockMLSExtraction.features,
      cromfordMetrics: mockCromfordData.metrics,
      cromfordTakeaway: mockCromfordData.takeaway,
      cromfordSource: mockCromfordData.source,
      outlookNarrative: mockContentGeneration.outlookNarrative,
      upgrades: mockContentGeneration.upgrades,
      developments: mockWebResearch.developments,
      infrastructure: mockWebResearch.infrastructure,
      areaHighlights: mockWebResearch.areaHighlights,
      resources: mockContentGeneration.resources,
    });

    // Use a minimal template with CONFIG markers for testing
    const template = `<!DOCTYPE html>
<html><head><script>
// ============================================================
// === CONFIG \u2014 The only section that changes per client ===
// ============================================================
var CONFIG = {};
// ============================================================
// === END CONFIG ===
// ============================================================
</script></head><body></body></html>`;

    const html = injectConfig(template, config);

    // Verify data is present in the HTML
    expect(html).toContain("Brandon & Nicole");
    expect(html).toContain("2252 S Estrella Cir");
    expect(html).toContain("Saratoga Lakes");

    // Extract and validate CONFIG is valid JS
    const match = html.match(/var CONFIG = ([\s\S]*?);\n\/\/ ====/);
    expect(match).toBeTruthy();
    const parsed = new Function(`return ${match![1]}`)();
    expect(parsed.clientNames).toBe("Brandon & Nicole");
    expect(parsed.comps.length).toBeGreaterThan(0);
    expect(parsed.marketMetrics.derivedValue).toBeGreaterThan(0);
  });

  it("validateDashboardConfig fills missing fields with defaults", () => {
    const sparse = {
      clientNames: "Test",
      address: "123 Main St",
    };

    const config = validateDashboardConfig(sparse);

    expect(config.clientNames).toBe("Test");
    expect(config.address).toBe("123 Main St");
    expect(config.beds).toBe(0);
    expect(config.comps).toEqual([]);
    expect(config.marketMetrics.priceTrendDirection).toBe("stable");
    expect(config.resources.seasonal.spring).toBe("");
  });

  it("validateDashboardConfig corrects invalid priceTrendDirection", () => {
    const config = validateDashboardConfig({
      marketMetrics: { priceTrendDirection: "up" },
    });
    expect(config.marketMetrics.priceTrendDirection).toBe("stable");
  });

  it("estimates loan balance from mock tax records data", () => {
    const taxData = mockTaxRecordsExtraction;

    const estimate = estimateCurrentBalance(
      taxData.originalLoanAmount,
      taxData.loanDate,
      taxData.refinances,
    );

    expect(estimate.rate).toBe(3.76); // Q1 2022
    expect(estimate.estimatedBalance).toBeLessThan(taxData.originalLoanAmount);
    expect(estimate.estimatedBalance).toBeGreaterThan(400000);

    // Can be used in config assembly
    const config = validateDashboardConfig({
      clientNames: manifest.clientNames,
      address: manifest.address,
      purchaseDate: taxData.purchaseDate,
      purchasePrice: taxData.purchasePrice,
      loanBalance: estimate.estimatedBalance,
    });

    expect(config.purchasePrice).toBe(585000);
    expect(config.loanBalance).toBeGreaterThan(0);
    expect(config.loanBalance).toBeLessThan(468000);
  });
});
