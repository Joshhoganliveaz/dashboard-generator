/**
 * Generate a test dashboard from fixture data (no Claude API needed).
 *
 * NOTE: Since csv-engine now uses the Claude API, this script requires
 * ANTHROPIC_API_KEY to be set. For offline testing, mock the API.
 *
 * Usage: npm run generate:test
 * Output: out/brandon-test-dashboard.html
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { runFullAnalysis } from "../src/lib/csv-engine";
import { injectConfig } from "../src/lib/template-engine";
import { validateDashboardConfig } from "../src/lib/types";
import {
  mockMLSExtraction,
  mockCromfordData,
  mockWebResearch,
  mockContentGeneration,
} from "../src/lib/__tests__/fixtures/mock-claude-responses";
import manifest from "../src/lib/__tests__/fixtures/brandon-manifest.json";

const ROOT = join(__dirname, "..");
const CSV_PATH = join(ROOT, "src/lib/__tests__/fixtures/brandon-test.csv");
const TEMPLATE_PATH = join(ROOT, "public/template.html");
const OUT_DIR = join(ROOT, "out");
const OUT_PATH = join(OUT_DIR, "brandon-test-dashboard.html");

async function main() {
  // Read source files
  const csvBuffer = Buffer.from(readFileSync(CSV_PATH, "utf-8"));
  const templateHtml = readFileSync(TEMPLATE_PATH, "utf-8");

  // Step 1: Run CSV analysis (now async - calls Claude API)
  const subject = {
    beds: mockMLSExtraction.beds,
    baths: mockMLSExtraction.baths,
    sqft: mockMLSExtraction.sqft,
    yearBuilt: mockMLSExtraction.yearBuilt,
    pool: mockMLSExtraction.pool,
    stories: mockMLSExtraction.stories,
  };

  const csvResult = await runFullAnalysis(csvBuffer, {
    ...subject,
    subdivision: manifest.subdivision,
    communityName: manifest.communityName,
    cityStateZip: manifest.cityStateZip,
    address: manifest.address,
  });
  console.log(`Analyzed ${csvResult.metadata.totalParsed} sales, ${csvResult.comps.length} comps selected`);

  // Step 2: Merge mock Claude responses
  csvResult.neighborhood.narrative = mockContentGeneration.neighborhoodNarrative;
  csvResult.bedroomAnalysis.narrative = mockContentGeneration.bedroomNarrative;

  // Step 3: Assemble config
  const rawConfig = {
    clientNames: manifest.clientNames,
    fullName: manifest.fullName,
    email: manifest.email,
    address: manifest.address,
    cityStateZip: manifest.cityStateZip,
    subdivision: manifest.subdivision,
    communityName: manifest.communityName,
    headerTitle: mockContentGeneration.headerTitle,
    purchaseDate: manifest.purchaseDate,
    purchasePrice: manifest.purchasePrice,
    loanBalance: manifest.loanBalance,
    agentKey: manifest.agentKey,
    ...subject,
    comps: csvResult.comps,
    marketMetrics: csvResult.marketMetrics,
    neighborhood: csvResult.neighborhood,
    bedroomAnalysis: csvResult.bedroomAnalysis,
    subjectAdvantages: csvResult.subjectAdvantages,
    features: mockMLSExtraction.features,
    cromfordMetrics: mockCromfordData.metrics,
    cromfordTakeaway: mockCromfordData.takeaway,
    cromfordSource: mockCromfordData.source,
    outlookNarrative: mockContentGeneration.outlookNarrative,
    upgrades: mockContentGeneration.upgrades,
    developments: mockWebResearch.developments,
    infrastructure: mockWebResearch.infrastructure,
    areaHighlights: mockWebResearch.areaHighlights,
    resources: mockContentGeneration.resources,
  };

  const config = validateDashboardConfig(rawConfig);

  // Step 4: Inject into template
  const finalHtml = injectConfig(templateHtml, config);

  // Step 5: Write output
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, finalHtml, "utf-8");

  console.log(`Dashboard written to ${OUT_PATH}`);
  console.log(`Open in browser: file://${OUT_PATH}`);
}

main().catch((err) => {
  console.error("Failed to generate test dashboard:", err);
  process.exit(1);
});
