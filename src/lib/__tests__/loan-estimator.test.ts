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
    // After ~4 years of payments, balance should be lower but still substantial
    expect(result.estimatedBalance).toBeLessThan(468000);
    expect(result.estimatedBalance).toBeGreaterThan(400000);
  });

  it("uses the latest refinance when available", () => {
    const result = estimateCurrentBalance(468000, "2022-03-14", [
      { date: "2023-06-15", amount: 490000 },
    ]);

    // Should use the refinance data, not the original
    expect(result.loanAmount).toBe(490000);
    expect(result.loanDate).toBe("2023-06-15");
    expect(result.rate).toBe(6.57); // Q2 2023
  });

  it("picks the most recent of multiple refinances", () => {
    const result = estimateCurrentBalance(400000, "2020-01-15", [
      { date: "2021-03-01", amount: 420000 },
      { date: "2023-09-01", amount: 450000 },
    ]);

    expect(result.loanAmount).toBe(450000);
    expect(result.loanDate).toBe("2023-09-01");
    expect(result.rate).toBe(7.07); // Q3 2023
  });

  it("returns 0 balance for fully paid loan (far future)", () => {
    // Loan from 30+ years ago should be nearly or fully paid
    const result = estimateCurrentBalance(100000, "1990-01-01");
    expect(result.estimatedBalance).toBe(0);
  });

  it("returns full balance for brand new loan", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = estimateCurrentBalance(500000, today);
    // Balance should be very close to original (0 months elapsed)
    expect(result.estimatedBalance).toBeGreaterThan(499000);
  });

  describe("purchase price sanity check", () => {
    it("corrects implausibly small loan amount", () => {
      // Tax records extracted $24,500 as loan but purchase was $355,700
      const result = estimateCurrentBalance(24500, "2021-02-17", [], 355700);

      // Should correct to 80% LTV = $284,560
      expect(result.loanAmount).toBe(284560);
      expect(result.originalLoanCorrected).toBe(true);
      // Balance after ~5 years should be substantial
      expect(result.estimatedBalance).toBeGreaterThan(200000);
    });

    it("does not correct a reasonable loan amount", () => {
      // $284K loan on $355K purchase = ~80% LTV — totally normal
      const result = estimateCurrentBalance(284560, "2021-02-17", [], 355700);

      expect(result.loanAmount).toBe(284560);
      expect(result.originalLoanCorrected).toBeFalsy();
    });

    it("does not correct when no purchase price provided", () => {
      // Without purchase price, can't sanity check — trust the data
      const result = estimateCurrentBalance(24500, "2021-02-17");

      expect(result.loanAmount).toBe(24500);
      expect(result.originalLoanCorrected).toBeFalsy();
    });
  });

  describe("refinance classification", () => {
    it("classifies a cash-out refi correctly", () => {
      // $284K loan from 2021, then refi for $400K in 2023 = cash out
      const result = estimateCurrentBalance(284000, "2021-02-17", [
        { date: "2023-06-01", amount: 400000 },
      ]);

      expect(result.refiAnalysis).toBeDefined();
      expect(result.refiAnalysis![0].type).toBe("cash_out");
      expect(result.refiAnalysis![0].priorBalance).toBeLessThan(284000);
      // Final loan should be the refi amount
      expect(result.loanAmount).toBe(400000);
      expect(result.loanDate).toBe("2023-06-01");
    });

    it("classifies a rate-and-term refi correctly", () => {
      // $300K loan from 2022, refi for ~$280K in 2024 (close to remaining balance)
      const result = estimateCurrentBalance(300000, "2022-01-15", [
        { date: "2024-01-15", amount: 280000 },
      ]);

      expect(result.refiAnalysis).toBeDefined();
      expect(result.refiAnalysis![0].type).toBe("rate_term");
      expect(result.loanAmount).toBe(280000);
    });

    it("handles corrected original loan with cash-out refi", () => {
      // The Escondido scenario: bad extraction of $24.5K, but real refi for $400K
      const result = estimateCurrentBalance(24500, "2021-02-17", [
        { date: "2023-06-01", amount: 400000 },
      ], 355700);

      // Original should be corrected to 80% LTV
      expect(result.originalLoanCorrected).toBe(true);
      // Refi should be classified as cash-out (400K vs ~$252K remaining)
      expect(result.refiAnalysis).toBeDefined();
      expect(result.refiAnalysis![0].type).toBe("cash_out");
      // Final loan is the cash-out refi amount
      expect(result.loanAmount).toBe(400000);
      expect(result.estimatedBalance).toBeGreaterThan(350000);
    });
  });
});
