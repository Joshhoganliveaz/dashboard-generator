/**
 * Estimates current mortgage balance using amortization math and historical rate data.
 * Includes sanity checks against purchase price and refinance classification
 * (rate-and-term vs cash-out) to handle messy tax record extractions.
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

const DEFAULT_LTV = 0.80;
const MIN_LTV_THRESHOLD = 0.20; // Below this, the "loan" is probably not the primary mortgage
const CASH_OUT_THRESHOLD = 1.10; // Refi amount > 110% of remaining balance = cash-out

export interface Refinance {
  date: string;
  amount: number;
}

export type RefiType = "rate_term" | "cash_out";

export interface RefiAnalysis {
  date: string;
  amount: number;
  type: RefiType;
  priorBalance: number;
}

export interface LoanEstimate {
  estimatedBalance: number;
  rate: number;
  monthlyPayment: number;
  loanDate: string;
  loanAmount: number;
  originalLoanCorrected?: boolean;
  refiAnalysis?: RefiAnalysis[];
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
 * Calculate remaining balance at a specific point in time for a given loan.
 */
function balanceAtMonth(principal: number, monthlyRate: number, totalPayments: number, monthsElapsed: number): number {
  const k = Math.min(Math.max(monthsElapsed, 0), totalPayments);
  const factorN = Math.pow(1 + monthlyRate, totalPayments);
  const factorK = Math.pow(1 + monthlyRate, k);
  return principal * (factorN - factorK) / (factorN - 1);
}

/**
 * Calculate months between two date strings.
 */
function monthsBetween(startDate: string, endDate: string): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  return (e.getUTCFullYear() - s.getUTCFullYear()) * 12
    + (e.getUTCMonth() - s.getUTCMonth());
}

/**
 * Estimate the current loan balance using standard 30-year amortization.
 *
 * When purchasePrice is provided, validates the original loan amount and
 * classifies each refinance as rate-and-term or cash-out to build an
 * accurate amortization chain.
 */
export function estimateCurrentBalance(
  loanAmount: number,
  loanDate: string,
  refinances: Refinance[] = [],
  purchasePrice?: number,
): LoanEstimate {
  let originalLoanCorrected = false;
  let activeLoanAmount = loanAmount;
  let activeLoanDate = loanDate;

  // Sanity check: if original loan is implausibly small relative to purchase price,
  // it's likely a lien, second deed of trust, or extraction error — not the primary mortgage.
  if (purchasePrice && loanAmount < purchasePrice * MIN_LTV_THRESHOLD) {
    activeLoanAmount = Math.round(purchasePrice * DEFAULT_LTV);
    originalLoanCorrected = true;
    console.log(
      `Loan sanity check: $${loanAmount} is < 20% of purchase price $${purchasePrice}. ` +
      `Using estimated ${DEFAULT_LTV * 100}% LTV: $${activeLoanAmount}`
    );
  }

  // Sort refinances chronologically
  const sortedRefis = [...refinances].sort((a, b) => a.date.localeCompare(b.date));

  // Walk through each refinance, classifying and building the amortization chain
  const refiAnalysis: RefiAnalysis[] = [];
  let currentPrincipal = activeLoanAmount;
  let currentDate = activeLoanDate;
  let currentRate = getHistoricalRate(currentDate);
  let currentMonthlyRate = currentRate / 100 / 12;

  for (const refi of sortedRefis) {
    // Calculate what the balance would have been at the refi date
    const elapsed = monthsBetween(currentDate, refi.date);
    const priorBalance = Math.round(balanceAtMonth(currentPrincipal, currentMonthlyRate, 360, elapsed));

    // Classify: if refi amount is meaningfully higher than remaining balance, it's cash-out
    const type: RefiType = refi.amount > priorBalance * CASH_OUT_THRESHOLD
      ? "cash_out"
      : "rate_term";

    refiAnalysis.push({ date: refi.date, amount: refi.amount, type, priorBalance });

    console.log(
      `Refi ${refi.date}: $${refi.amount} vs prior balance $${priorBalance} → ${type}` +
      (type === "cash_out" ? ` (cash out ~$${refi.amount - priorBalance})` : "")
    );

    // Advance the chain: new loan starts from refi amount at refi date
    currentPrincipal = refi.amount;
    currentDate = refi.date;
    currentRate = getHistoricalRate(refi.date);
    currentMonthlyRate = currentRate / 100 / 12;
  }

  // Final active loan values after walking the chain
  activeLoanAmount = currentPrincipal;
  activeLoanDate = currentDate;

  const rate = getHistoricalRate(activeLoanDate);
  const monthlyRate = rate / 100 / 12;
  const totalPayments = 360;

  const factor = Math.pow(1 + monthlyRate, totalPayments);
  const monthlyPayment = activeLoanAmount * (monthlyRate * factor) / (factor - 1);

  const now = new Date();
  const monthsElapsed = monthsBetween(activeLoanDate, now.toISOString().slice(0, 10));
  const estimatedBalance = balanceAtMonth(activeLoanAmount, monthlyRate, totalPayments, monthsElapsed);

  return {
    estimatedBalance: Math.max(0, Math.round(estimatedBalance)),
    rate,
    monthlyPayment: Math.round(monthlyPayment),
    loanDate: activeLoanDate,
    loanAmount: activeLoanAmount,
    originalLoanCorrected,
    refiAnalysis: refiAnalysis.length > 0 ? refiAnalysis : undefined,
  };
}
