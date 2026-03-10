import { describe, it, expect } from "vitest";
import { getHistoricalRate, estimateCurrentBalance } from "../loan-estimator";

describe("getHistoricalRate", () => {
  it("returns exact rate for known quarter", () => {
    expect(getHistoricalRate("2022-03-14")).toBe(3.76); // Q1 2022
  });

  it("returns correct quarter for mid-year date", () => {
    expect(getHistoricalRate("2023-07-15")).toBe(7.07); // Q3 2023
  });

  it("returns nearest rate for date before range", () => {
    expect(getHistoricalRate("2015-01-01")).toBe(4.22); // earliest available
  });

  it("returns nearest rate for date after range", () => {
    expect(getHistoricalRate("2030-01-01")).toBe(6.30); // latest available
  });
});

describe("estimateCurrentBalance", () => {
  it("estimates a reasonable balance for a known loan", () => {
    // $468,000 loan from March 2022 at ~3.76%
    const result = estimateCurrentBalance(468000, "2022-03-14");

    expect(result.rate).toBe(3.76);
    expect(result.loanAmount).toBe(468000);
    expect(result.monthlyPayment).toBeGreaterThan(2000);
    expect(result.monthlyPayment).toBeLessThan(2500);
    expect(result.estimatedBalance).toBeLessThan(468000);
    expect(result.estimatedBalance).toBeGreaterThan(400000);
  });

  it("returns 0 balance for fully paid loan (far future)", () => {
    const result = estimateCurrentBalance(100000, "1990-01-01");
    expect(result.estimatedBalance).toBe(0);
  });

  it("returns full balance for brand new loan", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = estimateCurrentBalance(500000, today);
    expect(result.estimatedBalance).toBeGreaterThan(499000);
  });

  describe("purchase context", () => {
    it("calculates down payment and LTV from purchase price", () => {
      // $284K loan on $355K purchase = 80% LTV, $71K down
      const result = estimateCurrentBalance(284560, "2021-02-17", [], 355700);

      expect(result.downPayment).toBe(71140);
      expect(result.ltv).toBeCloseTo(0.80, 1);
      expect(result.loanAmount).toBe(284560);
    });

    it("handles high-LTV loans (FHA/VA)", () => {
      // 96.5% LTV FHA loan
      const result = estimateCurrentBalance(343000, "2021-02-17", [], 355700);

      expect(result.downPayment).toBe(12700);
      expect(result.ltv).toBeCloseTo(0.964, 2);
      expect(result.loanAmount).toBe(343000);
    });

    it("handles small loan amounts without correction", () => {
      // $24.5K on a $355K home — could be a second lien, HELOC, etc.
      // Use the actual data, don't assume 80% LTV
      const result = estimateCurrentBalance(24500, "2021-02-17", [], 355700);

      expect(result.loanAmount).toBe(24500);
      expect(result.downPayment).toBe(331200);
      expect(result.ltv).toBeCloseTo(0.069, 2);
    });
  });

  describe("refinance classification", () => {
    it("classifies a cash-out refi (amount >> remaining balance)", () => {
      // $284K loan from 2021, then refi for $400K in 2023 = cash out
      const result = estimateCurrentBalance(284000, "2021-02-17", [
        { date: "2023-06-01", amount: 400000 },
      ]);

      expect(result.refiAnalysis).toBeDefined();
      expect(result.refiAnalysis![0].type).toBe("cash_out");
      expect(result.refiAnalysis![0].cashOut).toBeGreaterThan(100000);
      expect(result.refiAnalysis![0].priorBalance).toBeLessThan(284000);
      expect(result.loanAmount).toBe(400000);
      expect(result.loanDate).toBe("2023-06-01");
    });

    it("classifies a rate-and-term refi (amount ≈ remaining balance)", () => {
      // $300K loan from 2022, refi for ~$280K in 2024
      const result = estimateCurrentBalance(300000, "2022-01-15", [
        { date: "2024-01-15", amount: 280000 },
      ]);

      expect(result.refiAnalysis).toBeDefined();
      expect(result.refiAnalysis![0].type).toBe("rate_term");
      expect(result.refiAnalysis![0].cashOut).toBeUndefined();
      expect(result.loanAmount).toBe(280000);
    });

    it("walks a chain of multiple refinances", () => {
      const result = estimateCurrentBalance(400000, "2020-01-15", [
        { date: "2021-03-01", amount: 420000 },
        { date: "2023-09-01", amount: 450000 },
      ]);

      expect(result.refiAnalysis).toHaveLength(2);
      // First refi: $420K vs ~$391K remaining = cash-out (~$29K)
      expect(result.refiAnalysis![0].type).toBe("rate_term");
      // Second refi: $450K vs ~$397K remaining = cash-out (~$53K)
      expect(result.refiAnalysis![1].type).toBe("cash_out");
      expect(result.loanAmount).toBe(450000);
      expect(result.loanDate).toBe("2023-09-01");
    });

    it("handles small original loan + large refi (misextracted original)", () => {
      // Tax records extracted $24.5K as original (likely a lien), then $400K refi
      // The refi is classified as cash-out relative to the $24.5K balance,
      // and becomes the active loan going forward
      const result = estimateCurrentBalance(24500, "2021-02-17", [
        { date: "2023-06-01", amount: 400000 },
      ], 355700);

      expect(result.refiAnalysis).toBeDefined();
      expect(result.refiAnalysis![0].type).toBe("cash_out");
      // Final active loan is the $400K refi
      expect(result.loanAmount).toBe(400000);
      expect(result.estimatedBalance).toBeGreaterThan(350000);
    });

    it("handles small cash-out refi on top of existing balance", () => {
      // $284K loan from 2021, refi for $310K in 2023 = small cash-out (~$40K)
      const result = estimateCurrentBalance(284000, "2021-02-17", [
        { date: "2023-06-01", amount: 310000 },
      ]);

      expect(result.refiAnalysis).toBeDefined();
      expect(result.refiAnalysis![0].type).toBe("cash_out");
      expect(result.refiAnalysis![0].cashOut).toBeGreaterThan(30000);
      expect(result.refiAnalysis![0].cashOut).toBeLessThan(50000);
      expect(result.loanAmount).toBe(310000);
    });
  });
});
