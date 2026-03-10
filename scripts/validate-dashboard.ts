#!/usr/bin/env tsx
/**
 * Validate a generated dashboard HTML file.
 * Usage: npx tsx scripts/validate-dashboard.ts <html-file>
 */
import { readFileSync } from "fs";

const REQUIRED_FIELDS: Record<string, string> = {
  clientNames: "string",
  fullName: "string",
  email: "string",
  address: "string",
  cityStateZip: "string",
  subdivision: "string",
  communityName: "string",
  headerTitle: "string",
  purchaseDate: "string",
  purchasePrice: "number",
  loanBalance: "number",
  agentKey: "string",
  beds: "number",
  baths: "number",
  sqft: "number",
  yearBuilt: "number",
  pool: "boolean",
  stories: "number",
  comps: "array",
  marketMetrics: "object",
  neighborhood: "object",
  bedroomAnalysis: "object",
  subjectAdvantages: "array",
  features: "array",
  cromfordMetrics: "array",
  cromfordTakeaway: "string",
  cromfordSource: "string",
  outlookNarrative: "array",
  upgrades: "array",
  developments: "array",
  infrastructure: "array",
  areaHighlights: "array",
  resources: "object",
};

const MARKET_METRICS_FIELDS: Record<string, string> = {
  medianSoldPrice: "number",
  medianPpsf: "number",
  avgPpsf: "number",
  ppsfRange: "object",
  derivedValue: "number",
  derivedRange: "object",
  compsUsedForValue: "number",
  avgDom: "number",
  medianDom: "number",
  saleToListRatio: "number",
  priceTrendDirection: "string",
  priceTrendDetail: "string",
  totalSalesInPeriod: "number",
};

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/validate-dashboard.ts <html-file>");
    process.exit(1);
  }

  let html: string;
  try {
    html = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Could not read file: ${filePath}`);
    process.exit(1);
  }

  // Extract CONFIG
  const match = html.match(/var CONFIG = ([\s\S]*?);\s*\n\s*\/\/\s*={2,}.*\n\s*\/\/\s*===?\s*END CONFIG/);
  if (!match) {
    console.error("ERROR: Could not find CONFIG section in HTML");
    process.exit(1);
  }

  let config: Record<string, unknown>;
  try {
    config = new Function(`return ${match[1]}`)() as Record<string, unknown>;
  } catch (err) {
    console.error(`ERROR: CONFIG is not valid JavaScript: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log("CONFIG parsed successfully.\n");

  let errors = 0;
  let warnings = 0;

  // Check top-level fields
  for (const [field, expectedType] of Object.entries(REQUIRED_FIELDS)) {
    const val = config[field];
    if (val === undefined || val === null) {
      console.error(`  MISSING: ${field} (expected ${expectedType})`);
      errors++;
      continue;
    }
    const actualType = Array.isArray(val) ? "array" : typeof val;
    if (actualType !== expectedType) {
      console.error(`  TYPE MISMATCH: ${field} is ${actualType}, expected ${expectedType}`);
      errors++;
    }
  }

  // Check marketMetrics sub-fields
  if (config.marketMetrics && typeof config.marketMetrics === "object") {
    const mm = config.marketMetrics as Record<string, unknown>;
    for (const [field, expectedType] of Object.entries(MARKET_METRICS_FIELDS)) {
      const val = mm[field];
      if (val === undefined || val === null) {
        console.warn(`  WARNING: marketMetrics.${field} is missing`);
        warnings++;
      } else {
        const actualType = Array.isArray(val) ? "array" : typeof val;
        if (actualType !== expectedType) {
          console.error(`  TYPE MISMATCH: marketMetrics.${field} is ${actualType}, expected ${expectedType}`);
          errors++;
        }
      }
    }

    // Validate priceTrendDirection enum
    if (mm.priceTrendDirection && !["rising", "stable", "declining"].includes(mm.priceTrendDirection as string)) {
      console.error(`  INVALID ENUM: priceTrendDirection = "${mm.priceTrendDirection}" (must be rising/stable/declining)`);
      errors++;
    }
  }

  // Check data quality
  const comps = config.comps as unknown[];
  if (Array.isArray(comps)) {
    if (comps.length === 0) {
      console.warn("  WARNING: comps array is empty");
      warnings++;
    } else {
      console.log(`  comps: ${comps.length} comparable sales`);
    }
  }

  const cromford = config.cromfordMetrics as unknown[];
  if (Array.isArray(cromford)) {
    if (cromford.length === 0) {
      console.warn("  WARNING: cromfordMetrics array is empty");
      warnings++;
    } else {
      console.log(`  cromfordMetrics: ${cromford.length} metrics`);
    }
  }

  if (config.purchasePrice === 0) {
    console.warn("  WARNING: purchasePrice is 0");
    warnings++;
  }

  if (config.sqft === 0) {
    console.warn("  WARNING: sqft is 0");
    warnings++;
  }

  console.log(`\nResult: ${errors} errors, ${warnings} warnings`);

  if (errors > 0) {
    console.error("\nVALIDATION FAILED");
    process.exit(1);
  } else {
    console.log("\nVALIDATION PASSED");
  }
}

main();
