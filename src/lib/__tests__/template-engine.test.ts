import { describe, it, expect } from "vitest";
import { serializeValue, injectConfig } from "../template-engine";
import type { DashboardConfig } from "../types";

describe("serializeValue", () => {
  it("serializes primitives", () => {
    expect(serializeValue(null)).toBe("null");
    expect(serializeValue(undefined)).toBe("null");
    expect(serializeValue(true)).toBe("true");
    expect(serializeValue(false)).toBe("false");
    expect(serializeValue(42)).toBe("42");
    expect(serializeValue(3.14)).toBe("3.14");
  });

  it("serializes strings with proper escaping", () => {
    expect(serializeValue("hello")).toBe('"hello"');
    expect(serializeValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(serializeValue("line1\nline2")).toBe('"line1\\nline2"');
    expect(serializeValue("tab\there")).toBe('"tab\\there"');
  });

  it("escapes </script> sequences", () => {
    const result = serializeValue("before</script>after");
    expect(result).not.toContain("</script>");
    expect(result).toContain("<\\/script>");
  });

  it("escapes backticks", () => {
    const result = serializeValue("use `code` here");
    expect(result).toContain("\\`");
  });

  it("escapes Unicode line/paragraph separators", () => {
    const result = serializeValue("a\u2028b\u2029c");
    expect(result).toContain("\\u2028");
    expect(result).toContain("\\u2029");
  });

  it("handles emoji in strings", () => {
    const result = serializeValue("Happy Houseversary! \ud83c\udf89");
    // Should produce valid JS
    expect(() => new Function(`return ${result}`)).not.toThrow();
    const parsed = new Function(`return ${result}`)();
    expect(parsed).toBe("Happy Houseversary! \ud83c\udf89");
  });

  it("handles Infinity and NaN", () => {
    expect(serializeValue(Infinity)).toBe("0");
    expect(serializeValue(-Infinity)).toBe("0");
    expect(serializeValue(NaN)).toBe("0");
  });

  it("serializes empty arrays and objects", () => {
    expect(serializeValue([])).toBe("[]");
    expect(serializeValue({})).toBe("{}");
  });

  it("serializes nested objects", () => {
    const obj = { name: "test", nested: { a: 1, b: [2, 3] } };
    const result = serializeValue(obj);
    expect(() => new Function(`return ${result}`)).not.toThrow();
    const parsed = new Function(`return ${result}`)();
    expect(parsed.name).toBe("test");
    expect(parsed.nested.a).toBe(1);
    expect(parsed.nested.b).toEqual([2, 3]);
  });
});

describe("injectConfig", () => {
  const makeTemplate = (configContent: string) =>
    `<html><head><script>
// ============================================================
// === CONFIG \u2014 The only section that changes per client ===
// ============================================================
var CONFIG = ${configContent};
// ============================================================
// === END CONFIG ===
// ============================================================
</script></head></html>`;

  const minimalConfig: DashboardConfig = {
    clientNames: "Test Client",
    fullName: "Test Client Full",
    email: "test@test.com",
    address: "123 Test St",
    cityStateZip: "Mesa, AZ 85202",
    subdivision: "Test Sub",
    communityName: "Test Community",
    headerTitle: "Happy 1-Year Houseversary!",
    purchaseDate: "2025-01-01",
    purchasePrice: 500000,
    loanBalance: 400000,
    agentKey: "josh_jacqui",
    beds: 3,
    baths: 2,
    sqft: 1500,
    yearBuilt: 2000,
    pool: false,
    stories: 1,
    comps: [],
    marketMetrics: {
      medianSoldPrice: 450000,
      medianPpsf: 300,
      avgPpsf: 305,
      ppsfRange: { low: 280, high: 320 },
      derivedValue: 450000,
      derivedRange: { low: 436000, high: 464000 },
      compsUsedForValue: 6,
      avgDom: 20,
      medianDom: 18,
      saleToListRatio: 0.978,
      priceTrendDirection: "stable",
      priceTrendDetail: "Stable",
      totalSalesInPeriod: 50,
      subdivisionSalesCount: 10,
      earliestSale: "2025-01-01",
      latestSale: "2026-01-01",
      analysisPeriodMonths: 12,
    },
    neighborhood: {
      name: "Test",
      city: "Mesa",
      sourcePeriod: "Jan 2025 - Jan 2026",
      yoy: {
        recentCount: 25,
        priorCount: 20,
        countChgPct: 25,
        recentMedianPrice: 450000,
        priorMedianPrice: 430000,
        medianPriceChgPct: 4.7,
        recentMedianPpsf: 300,
        priorMedianPpsf: 287,
        medianPpsfChgPct: 4.5,
      },
      trends: [],
      pool: {
        poolCount: 10,
        poolMedianPrice: 500000,
        poolMedianPpsf: 310,
        noPoolCount: 15,
        noPoolMedianPrice: 420000,
        noPoolMedianPpsf: 290,
        premiumDollar: 80000,
      },
      sizeSegments: [],
      narrative: "",
    },
    bedroomAnalysis: {
      hasEnoughData: true,
      subjectBeds: 3,
      subjectPpsf: 300,
      breakdown: [],
      narrative: "",
    },
    subjectAdvantages: [],
    features: [],
    cromfordMetrics: [],
    cromfordTakeaway: "",
    cromfordSource: "",
    outlookNarrative: [],
    upgrades: [],
    developments: [],
    infrastructure: [],
    areaHighlights: [],
    resources: {
      seasonal: { spring: "", summer: "", fall: "", winter: "" },
      links: [],
    },
  };

  it("injects CONFIG between markers", () => {
    const template = makeTemplate("{}");
    const result = injectConfig(template, minimalConfig);

    expect(result).toContain("var CONFIG =");
    expect(result).toContain("Test Client");
    expect(result).toContain("// === END CONFIG ===");
  });

  it("produces valid JS in the CONFIG section", () => {
    const template = makeTemplate("{}");
    const result = injectConfig(template, minimalConfig);

    // Extract CONFIG value
    const match = result.match(/var CONFIG = ([\s\S]*?);\n\/\/ ====/);
    expect(match).toBeTruthy();
    expect(() => new Function(`return ${match![1]}`)).not.toThrow();
  });

  it("round-trips config data correctly", () => {
    const template = makeTemplate("{}");
    const result = injectConfig(template, minimalConfig);

    const match = result.match(/var CONFIG = ([\s\S]*?);\n\/\/ ====/);
    const parsed = new Function(`return ${match![1]}`)();

    expect(parsed.clientNames).toBe("Test Client");
    expect(parsed.purchasePrice).toBe(500000);
    expect(parsed.beds).toBe(3);
    expect(parsed.pool).toBe(false);
    expect(parsed.marketMetrics.medianPpsf).toBe(300);
  });

  it("handles special characters in content", () => {
    const configWithSpecialChars = {
      ...minimalConfig,
      headerTitle: "Happy Houseversary! \ud83c\udf89\ud83c\udfe0",
      cromfordTakeaway: 'Values are "strong" & rising</script><script>alert("xss")',
    };
    const template = makeTemplate("{}");
    const result = injectConfig(template, configWithSpecialChars);

    // Should not break the HTML
    expect(result).not.toContain("</script><script>");
    // Should still be valid JS
    const match = result.match(/var CONFIG = ([\s\S]*?);\n\/\/ ====/);
    expect(() => new Function(`return ${match![1]}`)).not.toThrow();
  });

  it("throws on missing markers", () => {
    expect(() => injectConfig("<html></html>", minimalConfig)).toThrow("Could not find CONFIG markers");
  });
});
