import { describe, it, expect } from "vitest";
import {
  SellDashboardConfigSchema,
  BuyerDashboardConfigSchema,
  validateConfig,
  type SellDashboardConfig,
  type BuyerDashboardConfig,
} from "../schemas/dashboard";

// Minimal valid sell config
const validSellConfig = {
  templateType: "sell" as const,
  clientNames: "John & Jane Doe",
  fullName: "John Doe",
  email: "john@example.com",
  address: "123 Main St",
  cityStateZip: "Mesa, AZ 85202",
  subdivision: "Saratoga Lakes",
  communityName: "Saratoga Lakes at Dobson Ranch",
  agentKey: "josh_jacqui",
  listingStatus: "pre-listing" as const,
  beds: 4,
  baths: 2.5,
  sqft: 1920,
  lotSqft: 8500,
  yearBuilt: 1986,
  pool: true,
  stories: 1,
  estimatedSalePrice: 575000,
  loanPayoff: 200000,
  propertyHighlights: ["Pool home", "Updated kitchen"],
  upgrades: [{ name: "Kitchen remodel", value: "$45,000" }],
  comps: [],
  marketMetrics: {
    medianSoldPrice: 550000,
    medianPpsf: 290,
    avgPpsf: 295,
    ppsfRange: { low: 250, high: 340 },
    derivedValue: 558000,
    derivedRange: { low: 541000, high: 575000 },
    compsUsedForValue: 6,
    avgDom: 20,
    medianDom: 15,
    saleToListRatio: 0.985,
    priceTrendDirection: "rising",
    priceTrendDetail: "",
    totalSalesInPeriod: 18,
    subdivisionSalesCount: 8,
    earliestSale: "2025-03-10",
    latestSale: "2026-02-28",
    analysisPeriodMonths: 12,
  },
  pricingStrategy: "Price at market",
  competition: [],
  marketSnapshot: [],
  prepItems: [],
  marketingPlan: [],
  timeline: [],
  cromfordMetrics: [],
  cromfordTakeaway: "",
  cromfordSource: "",
  features: [],
};

// Minimal valid buyer config
const validBuyerConfig = {
  templateType: "buyer" as const,
  clientNames: "John & Jane Doe",
  fullName: "John Doe",
  email: "john@example.com",
  agentKey: "josh_jacqui",
  targetAreas: "Mesa, Gilbert",
  budgetMin: 400000,
  budgetMax: 600000,
  bedsMin: 3,
  bathsMin: 2,
  mustHaves: ["Pool", "3-car garage"],
  schoolPreference: "Gilbert Unified",
  neighborhoods: [],
  schoolDistricts: [],
  timeline: [],
  marketSnapshot: [],
};

describe("SellDashboardConfigSchema", () => {
  it("validates a complete sell config", () => {
    const result = SellDashboardConfigSchema.safeParse(validSellConfig);
    expect(result.success).toBe(true);
  });

  it("fails on missing required field (address)", () => {
    const { address: _, ...incomplete } = validSellConfig;
    const result = SellDashboardConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldNames = result.error.issues.map((i) => i.path.join("."));
      expect(fieldNames).toContain("address");
    }
  });
});

describe("BuyerDashboardConfigSchema", () => {
  it("validates a complete buyer config", () => {
    const result = BuyerDashboardConfigSchema.safeParse(validBuyerConfig);
    expect(result.success).toBe(true);
  });

  it("fails on missing required field (targetAreas)", () => {
    const { targetAreas: _, ...incomplete } = validBuyerConfig;
    const result = BuyerDashboardConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});

describe("validateConfig", () => {
  it("returns typed result for valid sell config", () => {
    const result = validateConfig(validSellConfig, "sell");
    expect(result.templateType).toBe("sell");
    expect((result as SellDashboardConfig).address).toBe("123 Main St");
  });

  it("throws with descriptive error for invalid config", () => {
    expect(() => validateConfig({}, "sell")).toThrow();
  });

  it("returns typed result for valid buyer config", () => {
    const result = validateConfig(validBuyerConfig, "buyer");
    expect(result.templateType).toBe("buyer");
    expect((result as BuyerDashboardConfig).targetAreas).toBe("Mesa, Gilbert");
  });
});
