/**
 * Estimates current mortgage balance using amortization math and historical rate data.
 * Uses actual purchase data (price, loan amount, down payment) as the foundation,
 * then classifies each subsequent refinance as rate-and-term or cash-out.
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

// Refi amount > 110% of remaining balance at that date = cash-out
const CASH_OUT_THRESHOLD = 1.10;

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
  cashOut?: number;
}

export interface LoanEstimate {
  estimatedBalance: number;
  rate: number;
  monthlyPayment: number;
  loanDate: string;
  loanAmount: number;
  downPayment?: number;
  ltv?: number;
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
 * Starts from the actual original loan data (amount, date, implied down payment),
 * then walks through each refinance chronologically. At each refi, calculates what
 * the remaining balance would have been and classifies the refi:
 *
 * - Rate-and-term: refi amount ≈ remaining balance (just refinancing the existing debt)
 * - Cash-out: refi amount significantly exceeds remaining balance (borrower pulled equity)
 *
 * The final loan in the chain is amortized to today's date.
 */
export function estimateCurrentBalance(
  loanAmount: number,
  loanDate: string,
  refinances: Refinance[] = [],
  purchasePrice?: number,
): LoanEstimate {
  // Start from the actual extracted loan data
  const downPayment = purchasePrice ? purchasePrice - loanAmount : undefined;
  const ltv = purchasePrice ? loanAmount / purchasePrice : undefined;

  if (purchasePrice) {
    console.log(
      `Original loan: $${loanAmount} on $${purchasePrice} purchase ` +
      `(${Math.round((ltv!) * 100)}% LTV, $${downPayment} down)`
    );
  }

  // Sort refinances chronologically
  const sortedRefis = [...refinances].sort((a, b) => a.date.localeCompare(b.date));

  // Walk through each refinance, classifying and building the amortization chain
  const refiAnalysis: RefiAnalysis[] = [];
  let currentPrincipal = loanAmount;
  let currentDate = loanDate;
  let currentRate = getHistoricalRate(currentDate);
  let currentMonthlyRate = currentRate / 100 / 12;

  for (const refi of sortedRefis) {
    // Calculate what the balance would have been at the refi date
    const elapsed = monthsBetween(currentDate, refi.date);
    const priorBalance = Math.round(balanceAtMonth(currentPrincipal, currentMonthlyRate, 360, elapsed));

    // Classify: if refi amount is meaningfully higher than remaining balance, it's cash-out
    const isCashOut = refi.amount > priorBalance * CASH_OUT_THRESHOLD;
    const type: RefiType = isCashOut ? "cash_out" : "rate_term";
    const cashOut = isCashOut ? refi.amount - priorBalance : undefined;

    refiAnalysis.push({ date: refi.date, amount: refi.amount, type, priorBalance, cashOut });

    console.log(
      `Refi ${refi.date}: $${refi.amount} vs prior balance $${priorBalance} → ${type}` +
      (cashOut ? ` (cash out ~$${cashOut})` : "")
    );

    // Advance the chain: new loan starts from refi amount at refi date
    currentPrincipal = refi.amount;
    currentDate = refi.date;
    currentRate = getHistoricalRate(refi.date);
    currentMonthlyRate = currentRate / 100 / 12;
  }

  // Final active loan values after walking the chain
  const activeLoanAmount = currentPrincipal;
  const activeLoanDate = currentDate;

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
    downPayment,
    ltv: ltv ? Math.round(ltv * 1000) / 1000 : undefined,
    refiAnalysis: refiAnalysis.length > 0 ? refiAnalysis : undefined,
  };
}
