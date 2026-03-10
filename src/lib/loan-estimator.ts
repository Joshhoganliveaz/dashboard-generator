/**
 * Estimates current mortgage balance using amortization math and historical rate data.
 */

/** Average 30-year fixed rates by quarter (Freddie Mac PMMS) */
const HISTORICAL_RATES: Record<string, number> = {
  "2018-Q1": 4.22, "2018-Q2": 4.54, "2018-Q3": 4.55, "2018-Q4": 4.83,
  "2019-Q1": 4.37, "2019-Q2": 3.99, "2019-Q3": 3.73, "2019-Q4": 3.68,
  "2020-Q1": 3.45, "2020-Q2": 3.23, "2020-Q3": 2.94, "2020-Q4": 2.76,
  "2021-Q1": 2.81, "2021-Q2": 2.98, "2021-Q3": 2.87, "2021-Q4": 3.07,
  "2022-Q1": 3.76, "2022-Q2": 5.27, "2022-Q3": 5.55, "2022-Q4": 6.67,
  "2023-Q1": 6.36, "2023-Q2": 6.57, "2023-Q3": 7.07, "2023-Q4": 7.31,
  "2024-Q1": 6.87, "2024-Q2": 6.92, "2024-Q3": 6.50, "2024-Q4": 6.72,
  "2025-Q1": 6.76, "2025-Q2": 6.65, "2025-Q3": 6.50, "2025-Q4": 6.40,
  "2026-Q1": 6.35, "2026-Q2": 6.30,
};

export interface Refinance {
  date: string;
  amount: number;
}

export interface LoanEstimate {
  estimatedBalance: number;
  rate: number;
  monthlyPayment: number;
  loanDate: string;
  loanAmount: number;
}

/**
 * Look up the average 30-year fixed rate for a given date's quarter.
 * Falls back to nearest available quarter if exact match not found.
 */
export function getHistoricalRate(dateStr: string): number {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const quarter = Math.ceil((d.getUTCMonth() + 1) / 3);
  const key = `${year}-Q${quarter}`;

  if (HISTORICAL_RATES[key] !== undefined) {
    return HISTORICAL_RATES[key];
  }

  // Find nearest available quarter
  const keys = Object.keys(HISTORICAL_RATES).sort();
  if (key < keys[0]) return HISTORICAL_RATES[keys[0]];
  if (key > keys[keys.length - 1]) return HISTORICAL_RATES[keys[keys.length - 1]];

  // Find closest key
  for (let i = keys.length - 1; i >= 0; i--) {
    if (keys[i] <= key) return HISTORICAL_RATES[keys[i]];
  }

  return 6.5; // safe fallback
}

/**
 * Estimate the current loan balance using standard 30-year amortization.
 *
 * Picks the most recent loan event (original loan or latest refinance),
 * looks up the historical rate, and calculates remaining balance.
 */
export function estimateCurrentBalance(
  loanAmount: number,
  loanDate: string,
  refinances: Refinance[] = [],
): LoanEstimate {
  // Find the most recent loan event
  let activeLoanAmount = loanAmount;
  let activeLoanDate = loanDate;

  for (const refi of refinances) {
    if (refi.date > activeLoanDate) {
      activeLoanAmount = refi.amount;
      activeLoanDate = refi.date;
    }
  }

  const rate = getHistoricalRate(activeLoanDate);
  const monthlyRate = rate / 100 / 12;
  const totalPayments = 360; // 30-year fixed

  // Monthly payment: M = P * [r(1+r)^n] / [(1+r)^n - 1]
  const factor = Math.pow(1 + monthlyRate, totalPayments);
  const monthlyPayment = activeLoanAmount * (monthlyRate * factor) / (factor - 1);

  // Calculate months elapsed
  const loanStart = new Date(activeLoanDate);
  const now = new Date();
  const monthsElapsed = (now.getUTCFullYear() - loanStart.getUTCFullYear()) * 12
    + (now.getUTCMonth() - loanStart.getUTCMonth());

  // Clamp to valid range
  const k = Math.min(Math.max(monthsElapsed, 0), totalPayments);

  // Remaining balance: P * [(1+r)^n - (1+r)^k] / [(1+r)^n - 1]
  const estimatedBalance = activeLoanAmount
    * (Math.pow(1 + monthlyRate, totalPayments) - Math.pow(1 + monthlyRate, k))
    / (Math.pow(1 + monthlyRate, totalPayments) - 1);

  return {
    estimatedBalance: Math.max(0, Math.round(estimatedBalance)),
    rate,
    monthlyPayment: Math.round(monthlyPayment),
    loanDate: activeLoanDate,
    loanAmount: activeLoanAmount,
  };
}
