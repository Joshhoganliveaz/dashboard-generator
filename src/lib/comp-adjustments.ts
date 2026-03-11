import type { CompSale, SubjectProperty } from "./types";

export interface AdjustedComp {
  addr: string;
  soldPrice: number;
  adjustedPrice: number;
  adjustments: { label: string; amount: number }[];
  grossAdjPct: number;
}

/**
 * Parse baths string (e.g. "2", "2.5", "3.1") to a number.
 * CompSale stores baths as a string; SubjectProperty as a number.
 */
function parseBaths(baths: string | number): number {
  return typeof baths === "number" ? baths : parseFloat(baths) || 0;
}

/**
 * Parse pool field. CompSale.pool is a string like "Yes", "No", "Private", "Community", etc.
 * SubjectProperty.pool is a boolean.
 */
function hasPool(pool: string | boolean): boolean {
  if (typeof pool === "boolean") return pool;
  const lower = pool.toLowerCase().trim();
  return lower === "yes" || lower === "private" || lower === "priv" || lower === "y";
}

/**
 * Adjust a single comp's sold price for differences from the subject.
 * Uses calibrated rates from appraisal observations (see claude-prompts.ts).
 *
 * Convention: Subject SUPERIOR → add to comp price. Subject INFERIOR → subtract.
 */
export function adjustCompPrice(comp: CompSale, subject: SubjectProperty): AdjustedComp {
  const adjustments: { label: string; amount: number }[] = [];

  // --- GLA Adjustment ---
  // Rate: 30% of comp's $/SF per SF difference. 10% dead zone on subject SF.
  const sfDiff = subject.sqft - comp.sf;
  const deadZone = subject.sqft * 0.1;
  if (Math.abs(sfDiff) > deadZone) {
    const rate = comp.ppsf * 0.30;
    const glaAdj = Math.round((sfDiff * rate) / 500) * 500; // round to nearest $500
    if (glaAdj !== 0) {
      adjustments.push({ label: "GLA", amount: glaAdj });
    }
  }

  // --- Bathroom Adjustment ---
  // $10K per full bath, $5K per half bath difference
  const compBaths = parseBaths(comp.baths);
  const subjectBaths = subject.baths;
  const bathDiff = subjectBaths - compBaths;
  if (bathDiff !== 0) {
    const fullBathDiff = Math.trunc(bathDiff);
    const halfBathDiff = Math.round((bathDiff - fullBathDiff) * 10); // e.g. 0.5 → 5, but we treat any fractional as half-bath count
    const bathAdj = fullBathDiff * 10000 + (halfBathDiff !== 0 ? Math.sign(halfBathDiff) * 5000 : 0);
    if (bathAdj !== 0) {
      adjustments.push({ label: "Baths", amount: bathAdj });
    }
  }

  // --- Pool Adjustment ---
  // $20K standard, $45K for $1M+ homes
  const subjectHasPool = hasPool(subject.pool);
  const compHasPool = hasPool(comp.pool);
  if (subjectHasPool !== compHasPool) {
    const poolRate = comp.sp >= 1_000_000 ? 45_000 : 20_000;
    const poolAdj = subjectHasPool ? poolRate : -poolRate;
    adjustments.push({ label: "Pool", amount: poolAdj });
  }

  const totalAdj = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const adjustedPrice = comp.sp + totalAdj;
  const grossAdj = adjustments.reduce((sum, a) => sum + Math.abs(a.amount), 0);
  const grossAdjPct = comp.sp > 0 ? (grossAdj / comp.sp) * 100 : 0;

  return {
    addr: comp.addr,
    soldPrice: comp.sp,
    adjustedPrice,
    adjustments,
    grossAdjPct,
  };
}

/**
 * Derive an estimated value from adjusted comparable sales.
 * Filters to comps with gross adjustment < 25%, then takes a
 * weighted average by similarity score.
 */
export function deriveValueFromComps(
  comps: CompSale[],
  subject: SubjectProperty,
): {
  derivedValue: number;
  derivedRange: { low: number; high: number };
  compsUsedForValue: number;
  adjustedComps: AdjustedComp[];
} {
  if (comps.length === 0) {
    return {
      derivedValue: 0,
      derivedRange: { low: 0, high: 0 },
      compsUsedForValue: 0,
      adjustedComps: [],
    };
  }

  const adjustedComps = comps.map((c) => adjustCompPrice(c, subject));

  // Filter to comps with gross adjustment under 25%
  let usable = adjustedComps.filter((ac) => ac.grossAdjPct < 25);

  // If all comps exceed 25%, fall back to all comps (don't return 0)
  if (usable.length === 0) {
    usable = adjustedComps;
  }

  // Match adjusted comps back to original comps for matchScore
  const scoreMap = new Map(comps.map((c) => [c.addr, c.matchScore]));

  // Weighted average by similarity score
  let weightedSum = 0;
  let weightTotal = 0;
  for (const ac of usable) {
    const score = scoreMap.get(ac.addr) || 1;
    weightedSum += ac.adjustedPrice * score;
    weightTotal += score;
  }

  const derivedValue = weightTotal > 0
    ? Math.round(weightedSum / weightTotal / 1000) * 1000
    : 0;

  const adjustedPrices = usable.map((ac) => ac.adjustedPrice);
  const derivedRange = {
    low: Math.round(Math.min(...adjustedPrices) / 1000) * 1000,
    high: Math.round(Math.max(...adjustedPrices) / 1000) * 1000,
  };

  return {
    derivedValue,
    derivedRange,
    compsUsedForValue: usable.length,
    adjustedComps,
  };
}
