import type { LoanOrigination } from "./types";
import { getHistoricalRate } from "./historical-rates";

/** Default fallback rate for empty loan arrays (decimal) */
const DEFAULT_RATE = 0.0665;

/**
 * Result of classifying a loan origination history into purchase,
 * refinance, and second lien categories.
 */
export interface ClassifiedLoans {
  /** The original purchase loan (closest to purchase date within 60 days) */
  originalLoan: LoanOrigination | null;
  /** The most recent primary mortgage (last refi, or original if no refi) */
  currentPrimary: LoanOrigination | null;
  /** Non-primary loans after the most recent primary (HELOCs, second mortgages) */
  secondLiens: LoanOrigination[];
  /** Sum of all active second lien amounts */
  secondLienTotal: number;
  /** True if the current primary differs from the original purchase loan */
  refiDetected: boolean;
  /** Historical PMMS rate looked up from the current primary's origination date */
  lookupRate: number;
}

/** Subsequent loan >= 60% of current primary = refinance */
const REFI_THRESHOLD = 0.60;

/** Purchase loan must be within 60 days of the recorded purchase date */
const PURCHASE_WINDOW_DAYS = 60;

/** Milliseconds in one day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Classify a loan origination history into purchase loan, refinances,
 * and second liens. Pure function with no side effects.
 *
 * Algorithm:
 * 1. Sort loans chronologically (oldest first) on a copy
 * 2. Find original purchase loan (within 60-day window of purchaseDate, or earliest)
 * 3. Walk forward: >= 60% of current primary = refi, < 60% = second lien
 * 4. Filter second liens to only those after the most recent primary
 * 5. Sum active second liens
 *
 * @param loans - Array of loan originations from Monsoon tax record
 * @param purchaseDate - ISO date string of property purchase, or null for $0 deed
 * @returns Classified loan breakdown
 */
export function classifyLoans(
  loans: LoanOrigination[],
  purchaseDate: string | null
): ClassifiedLoans {
  // Handle empty/null case
  if (!loans || loans.length === 0) {
    return {
      originalLoan: null,
      currentPrimary: null,
      secondLiens: [],
      secondLienTotal: 0,
      refiDetected: false,
      lookupRate: DEFAULT_RATE,
    };
  }

  // Sort chronologically (oldest first) -- never mutate the original array
  const sorted = [...loans].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Find original purchase loan
  let originalLoan: LoanOrigination;

  if (purchaseDate) {
    const purchaseDateMs = new Date(purchaseDate).getTime();
    const withinWindow = sorted.filter(
      (l) =>
        Math.abs(new Date(l.date).getTime() - purchaseDateMs) / MS_PER_DAY <=
        PURCHASE_WINDOW_DAYS
    );
    originalLoan =
      withinWindow.length > 0
        ? withinWindow.reduce((max, l) => (l.amount > max.amount ? l : max))
        : sorted[0];
  } else {
    // $0 deed fallback: earliest loan
    originalLoan = sorted[0];
  }

  // Walk forward classifying each subsequent loan
  let currentPrimary = originalLoan;
  const allSecondLiens: LoanOrigination[] = [];

  for (const loan of sorted) {
    if (loan === originalLoan) continue;

    if (loan.amount >= currentPrimary.amount * REFI_THRESHOLD) {
      // Refinance: becomes the new current primary
      currentPrimary = loan;
    } else {
      // Second lien / HELOC
      allSecondLiens.push(loan);
    }
  }

  // Only count second liens AFTER the most recent primary's date
  const primaryDate = new Date(currentPrimary.date).getTime();
  const activeSecondLiens = allSecondLiens.filter(
    (l) => new Date(l.date).getTime() > primaryDate
  );

  const secondLienTotal = activeSecondLiens.reduce(
    (sum, l) => sum + l.amount,
    0
  );
  const refiDetected = currentPrimary !== originalLoan;
  const lookupRate = getHistoricalRate(currentPrimary.date);

  return {
    originalLoan,
    currentPrimary,
    secondLiens: activeSecondLiens,
    secondLienTotal,
    refiDetected,
    lookupRate,
  };
}

/**
 * Annotate each loan with its assumed PMMS interest rate.
 * Preserves any existing assumedRate (manual override) and only fills in
 * missing values from historical PMMS data.
 *
 * @param loans - Array of loan originations
 * @returns New array with assumedRate populated on each loan
 */
export function annotateLoansWithRates(loans: LoanOrigination[]): LoanOrigination[] {
  return loans.map(loan => ({
    ...loan,
    assumedRate: loan.assumedRate ?? getHistoricalRate(loan.date),
  }));
}
