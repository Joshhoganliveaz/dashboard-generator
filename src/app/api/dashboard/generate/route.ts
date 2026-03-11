import { NextResponse } from "next/server";
import { runFullAnalysis } from "@/lib/csv-engine";
import { askClaudeWithPDF, askClaudeWithImages, askClaudeWithWebSearch, askClaude } from "@/lib/claude-api";
import { MLS_EXTRACTION_PROMPT, TAX_RECORDS_EXTRACTION_PROMPT, CROMFORD_EXTRACTION_PROMPT, webResearchPrompt, contentGenerationPrompt, sellContentPrompt, buyerContentPrompt, buySellContentPrompt } from "@/lib/claude-prompts";
import { injectConfig } from "@/lib/template-engine";
import { getTemplateHtml } from "@/lib/template-loader";
import { validateDashboardConfig } from "@/lib/types";
import { estimateCurrentBalance } from "@/lib/loan-estimator";
import { TEMPLATE_REGISTRY, isFileRelevant } from "@/lib/template-registry";
import type { TemplateType } from "@/lib/template-registry";
import type { ClientDetails, DashboardConfig, SellDashboardConfig, BuyerDashboardConfig, BuySellDashboardConfig, AnyDashboardConfig, SubjectProperty, Feature, CromfordMetric, Development, Upgrade } from "@/lib/types";

export const maxDuration = 300; // 5 min timeout for long generation

function sendSSE(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

function parseJSONFromClaude(text: string): Record<string, unknown> {
  let cleaned = text.trim();

  // Strip markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Try parsing as-is first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Claude sometimes adds prose before/after the JSON — extract the outermost { }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error(`No JSON object found in response: ${cleaned.slice(0, 100)}...`);
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();

  // Parse template type
  const templateType = (formData.get("templateType") as TemplateType) || "houseversary";
  const templateConfig = TEMPLATE_REGISTRY[templateType];
  if (!templateConfig) {
    return NextResponse.json({ error: `Unknown template type: ${templateType}` }, { status: 400 });
  }

  // Parse client details from form
  const clientDetailsRaw = formData.get("clientDetails") as string;
  let clientDetails: ClientDetails & {
    targetAreas?: string;
    budgetMin?: number;
    budgetMax?: number;
    bedsMin?: number;
    bathsMin?: number;
    mustHaves?: string[];
    schoolPreference?: string;
    homeSearchUrl?: string;
    sellAddress?: string;
    sellCityStateZip?: string;
    loanPayoff?: number;
    compLinks?: string;
  };
  try {
    clientDetails = JSON.parse(clientDetailsRaw);
  } catch {
    return NextResponse.json({ error: "Invalid client details" }, { status: 400 });
  }

  // Get uploaded files
  const csvFile = formData.get("csv") as File | null;
  const mlsPdf = formData.get("mlsPdf") as File | null;
  const taxRecordsPdf = formData.get("taxRecords") as File | null;
  const cromfordFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "cromford" && value instanceof File) {
      cromfordFiles.push(value);
    }
  }

  // Validate required files
  if (templateConfig.requiredFiles.includes("csv") && !csvFile) {
    return NextResponse.json({ error: "CSV file is required for this dashboard type" }, { status: 400 });
  }
  if (templateConfig.requiredFiles.includes("mlsPdf") && !mlsPdf) {
    return NextResponse.json({ error: "MLS PDF is required for this dashboard type" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let streamClosed = false;
      try {
        // === STEP 1: Extract from MLS PDF ===
        let subject: SubjectProperty = { beds: 0, baths: 0, sqft: 0, yearBuilt: 0, pool: false, stories: 1 };
        let features: Feature[] = [];
        let mlsPurchasePrice: number | null = null;
        let mlsPurchaseDate: string | null = null;
        let lotSqft = 0;
        let propertyHighlights: string[] = [];

        if (mlsPdf && isFileRelevant(templateType, "mlsPdf")) {
          sendSSE(controller, { step: "extracting_mls", progress: 5 });

          const pdfBuffer = Buffer.from(await mlsPdf.arrayBuffer());
          const pdfBase64 = pdfBuffer.toString("base64");

          const mlsResponse = await askClaudeWithPDF(MLS_EXTRACTION_PROMPT, pdfBase64, { maxTokens: 2048 });
          const mlsData = parseJSONFromClaude(mlsResponse) as {
            beds: number; baths: number; sqft: number; yearBuilt: number;
            pool: boolean; stories: number; features: Feature[];
            purchasePrice?: number | null; purchaseDate?: string | null;
            lotSqft?: number; highlights?: string[];
          };

          if (mlsData.purchasePrice) mlsPurchasePrice = mlsData.purchasePrice;
          if (mlsData.purchaseDate) mlsPurchaseDate = mlsData.purchaseDate;

          subject = {
            beds: mlsData.beds,
            baths: mlsData.baths,
            sqft: mlsData.sqft,
            yearBuilt: mlsData.yearBuilt,
            pool: mlsData.pool,
            stories: mlsData.stories,
          };
          features = mlsData.features || [];
          lotSqft = mlsData.lotSqft || 0;
          propertyHighlights = mlsData.highlights || [];

          sendSSE(controller, { step: "extracting_mls", progress: 15 });
        }

        // === STEP 2: CSV Analysis ===
        let csvResult = null;
        if (csvFile && isFileRelevant(templateType, "csv")) {
          sendSSE(controller, { step: "parsing_csv", progress: 18 });

          const csvBuffer = Buffer.from(await csvFile.arrayBuffer());
          csvResult = await runFullAnalysis(csvBuffer, {
            ...subject,
            subdivision: clientDetails.subdivision,
            communityName: clientDetails.communityName,
            cityStateZip: clientDetails.cityStateZip,
            address: clientDetails.address,
          }, templateConfig.lens);

          if (csvResult.comps.length === 0) {
            const reason = csvResult.metadata.warnings.length > 0
              ? csvResult.metadata.warnings.join('; ')
              : "No comparable sales found in CSV data";
            sendSSE(controller, { step: "error", message: `CSV analysis failed: ${reason}. Cannot generate dashboard without comps.` });
            throw new Error(`CSV analysis produced 0 comps: ${reason}`);
          } else {
            sendSSE(controller, { step: "parsing_csv", progress: 35, message: `Analyzed ${csvResult.metadata.totalParsed} sales, selected ${csvResult.comps.length} comps` });
          }

          // === STEP 2.5: Extract from Tax Records (before comp review so user can verify) ===
          let purchasePrice = clientDetails.purchasePrice || 0;
          let purchaseDate = clientDetails.purchaseDate || "";
          let loanBalance = clientDetails.loanBalance || 0;
          let taxExtracted = false;
          let extractedOriginalLoanAmount = 0;
          let extractedLoanDate = "";
          let extractedRefinances: { date: string; amount: number }[] = [];

          if (taxRecordsPdf && isFileRelevant(templateType, "taxRecords")) {
            sendSSE(controller, { step: "reading_tax_records", progress: 35 });

            const taxBuffer = Buffer.from(await taxRecordsPdf.arrayBuffer());
            const taxBase64 = taxBuffer.toString("base64");

            try {
              const taxResponse = await askClaudeWithPDF(TAX_RECORDS_EXTRACTION_PROMPT, taxBase64, { maxTokens: 2048 });
              const taxData = parseJSONFromClaude(taxResponse) as {
                purchasePrice: number | null;
                purchaseDate: string | null;
                originalLoanAmount: number | null;
                loanDate: string | null;
                refinances: { date: string; amount: number }[] | null;
                assessedValue: number | null;
                taxYear: number | null;
                legalDescription: string | null;
              };

              if (taxData.purchasePrice) purchasePrice = taxData.purchasePrice;
              if (taxData.purchaseDate) purchaseDate = taxData.purchaseDate;

              // Validation: detect misclassified original loan
              const refinances = taxData.refinances || [];
              let needsSwap = false;
              let swapReason = "";

              if (taxData.originalLoanAmount && taxData.purchasePrice && taxData.originalLoanAmount < taxData.purchasePrice * 0.50) {
                needsSwap = true;
                swapReason = `originalLoanAmount $${taxData.originalLoanAmount} is <50% of purchasePrice $${taxData.purchasePrice} (likely HELOC/second lien)`;
              } else if (taxData.loanDate && taxData.purchaseDate) {
                const loanTime = new Date(taxData.loanDate).getTime();
                const purchaseTime = new Date(taxData.purchaseDate).getTime();
                const monthsApart = Math.abs(loanTime - purchaseTime) / (1000 * 60 * 60 * 24 * 30);
                if (monthsApart > 6) {
                  needsSwap = true;
                  swapReason = `loanDate ${taxData.loanDate} is ${Math.round(monthsApart)} months from purchaseDate ${taxData.purchaseDate} (likely a later refi, not original mortgage)`;
                }
              }

              if (needsSwap && taxData.originalLoanAmount && taxData.purchasePrice) {
                const purchaseTime = taxData.purchaseDate ? new Date(taxData.purchaseDate).getTime() : 0;
                const betterMatch = refinances
                  .filter(r => r.amount >= taxData.purchasePrice! * 0.50 && r.amount <= taxData.purchasePrice! * 1.05)
                  .sort((a, b) => {
                    const aDist = Math.abs(new Date(a.date).getTime() - purchaseTime);
                    const bDist = Math.abs(new Date(b.date).getTime() - purchaseTime);
                    return aDist - bDist;
                  })[0];

                if (betterMatch) {
                  console.log(`Loan swap: ${swapReason}. Swapping with refinance of $${betterMatch.amount} from ${betterMatch.date}.`);
                  taxData.refinances = refinances.filter(r => r !== betterMatch);
                  taxData.refinances.push({ date: taxData.loanDate || taxData.purchaseDate || betterMatch.date, amount: taxData.originalLoanAmount });
                  taxData.refinances.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  taxData.originalLoanAmount = betterMatch.amount;
                  taxData.loanDate = betterMatch.date;
                } else {
                  console.warn(`Warning: ${swapReason}, but no better candidate found in refinances. Proceeding with available data.`);
                }
              }

              // Capture extraction details for UI
              extractedOriginalLoanAmount = taxData.originalLoanAmount || 0;
              extractedLoanDate = taxData.loanDate || taxData.purchaseDate || "";
              extractedRefinances = taxData.refinances || [];

              if (taxData.originalLoanAmount && (taxData.loanDate || taxData.purchaseDate)) {
                const estimate = estimateCurrentBalance(
                  taxData.originalLoanAmount,
                  taxData.loanDate || taxData.purchaseDate!,
                  taxData.refinances || [],
                  purchasePrice || undefined,
                );
                loanBalance = estimate.estimatedBalance;
                taxExtracted = true;
                console.log(`Loan estimate: $${estimate.estimatedBalance} at ${estimate.rate}% (payment: $${estimate.monthlyPayment}/mo)`);
              }
            } catch (err) {
              console.error("Tax records extraction failed, continuing:", err);
            }
          }

          // Merge MLS purchase data as fallback
          if (!purchasePrice && mlsPurchasePrice) purchasePrice = mlsPurchasePrice;
          if (!purchaseDate && mlsPurchaseDate) purchaseDate = mlsPurchaseDate;

          // Pause for comp review — emit comps + pass-through data, then close stream
          sendSSE(controller, {
            step: "review_comps",
            progress: 36,
            comps: csvResult.comps,
            csvResult: {
              marketMetrics: csvResult.marketMetrics,
              neighborhood: csvResult.neighborhood,
              bedroomAnalysis: csvResult.bedroomAnalysis,
              subjectAdvantages: csvResult.subjectAdvantages,
              metadata: csvResult.metadata,
            },
            mlsData: { subject, features, purchasePrice: mlsPurchasePrice, purchaseDate: mlsPurchaseDate, lotSqft, propertyHighlights },
            loanData: taxExtracted ? {
              purchasePrice,
              purchaseDate,
              loanBalance,
              originalLoanAmount: extractedOriginalLoanAmount,
              loanDate: extractedLoanDate,
              refinances: extractedRefinances,
            } : null,
          });
          streamClosed = true;
          controller.close();
          return;
        }

        // === STEP 3: Read Cromford Screenshots ===
        let cromfordMetrics: CromfordMetric[] = [];
        let cromfordTakeaway = "";
        let cromfordSource = "";

        if (cromfordFiles.length > 0 && isFileRelevant(templateType, "cromford")) {
          sendSSE(controller, { step: "reading_cromford", progress: 38 });

          const images = await Promise.all(
            cromfordFiles.map(async (f) => {
              const buf = Buffer.from(await f.arrayBuffer());
              return {
                base64: buf.toString("base64"),
                mediaType: f.type || "image/png",
              };
            })
          );

          const cromfordResponse = await askClaudeWithImages(CROMFORD_EXTRACTION_PROMPT, images, { maxTokens: 2048 });
          const cromfordData = parseJSONFromClaude(cromfordResponse) as {
            metrics: CromfordMetric[];
            takeaway: string;
            source: string;
          };

          cromfordMetrics = cromfordData.metrics || [];
          cromfordTakeaway = cromfordData.takeaway || "";
          cromfordSource = cromfordData.source || "";

          sendSSE(controller, { step: "reading_cromford", progress: 48 });
        }

        // === STEP 3.5: Extract from Tax Records (houseversary only) ===
        let purchasePrice = clientDetails.purchasePrice || 0;
        let purchaseDate = clientDetails.purchaseDate || "";
        let loanBalance = clientDetails.loanBalance || 0;

        if (taxRecordsPdf && isFileRelevant(templateType, "taxRecords")) {
          sendSSE(controller, { step: "reading_tax_records", progress: 50 });

          const taxBuffer = Buffer.from(await taxRecordsPdf.arrayBuffer());
          const taxBase64 = taxBuffer.toString("base64");

          try {
            const taxResponse = await askClaudeWithPDF(TAX_RECORDS_EXTRACTION_PROMPT, taxBase64, { maxTokens: 2048 });
            const taxData = parseJSONFromClaude(taxResponse) as {
              purchasePrice: number | null;
              purchaseDate: string | null;
              originalLoanAmount: number | null;
              loanDate: string | null;
              refinances: { date: string; amount: number }[] | null;
              assessedValue: number | null;
              taxYear: number | null;
              legalDescription: string | null;
            };

            if (taxData.purchasePrice) purchasePrice = taxData.purchasePrice;
            if (taxData.purchaseDate) purchaseDate = taxData.purchaseDate;

            // Validation: detect misclassified original loan
            // Case 1: originalLoanAmount is too small (<50% LTV) — likely a HELOC or second lien
            // Case 2: loanDate is too far from purchaseDate (>6 months) — Claude grabbed a later refi
            const refinances = taxData.refinances || [];
            let needsSwap = false;
            let swapReason = "";

            if (taxData.originalLoanAmount && taxData.purchasePrice && taxData.originalLoanAmount < taxData.purchasePrice * 0.50) {
              needsSwap = true;
              swapReason = `originalLoanAmount $${taxData.originalLoanAmount} is <50% of purchasePrice $${taxData.purchasePrice} (likely HELOC/second lien)`;
            } else if (taxData.loanDate && taxData.purchaseDate) {
              const loanTime = new Date(taxData.loanDate).getTime();
              const purchaseTime = new Date(taxData.purchaseDate).getTime();
              const monthsApart = Math.abs(loanTime - purchaseTime) / (1000 * 60 * 60 * 24 * 30);
              if (monthsApart > 6) {
                needsSwap = true;
                swapReason = `loanDate ${taxData.loanDate} is ${Math.round(monthsApart)} months from purchaseDate ${taxData.purchaseDate} (likely a later refi, not original mortgage)`;
              }
            }

            if (needsSwap && taxData.originalLoanAmount && taxData.purchasePrice) {
              // Look for a better candidate: recorded near purchase date with typical LTV (50-105%)
              const purchaseTime = taxData.purchaseDate ? new Date(taxData.purchaseDate).getTime() : 0;
              const betterMatch = refinances
                .filter(r => r.amount >= taxData.purchasePrice! * 0.50 && r.amount <= taxData.purchasePrice! * 1.05)
                .sort((a, b) => {
                  // Prefer the one closest to purchase date
                  const aDist = Math.abs(new Date(a.date).getTime() - purchaseTime);
                  const bDist = Math.abs(new Date(b.date).getTime() - purchaseTime);
                  return aDist - bDist;
                })[0];

              if (betterMatch) {
                console.log(`Loan swap: ${swapReason}. Swapping with refinance of $${betterMatch.amount} from ${betterMatch.date}.`);
                taxData.refinances = refinances.filter(r => r !== betterMatch);
                taxData.refinances.push({ date: taxData.loanDate || taxData.purchaseDate || betterMatch.date, amount: taxData.originalLoanAmount });
                taxData.refinances.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                taxData.originalLoanAmount = betterMatch.amount;
                taxData.loanDate = betterMatch.date;
              } else {
                console.warn(`Warning: ${swapReason}, but no better candidate found in refinances. Proceeding with available data.`);
              }
            }

            if (taxData.originalLoanAmount && (taxData.loanDate || taxData.purchaseDate)) {
              const estimate = estimateCurrentBalance(
                taxData.originalLoanAmount,
                taxData.loanDate || taxData.purchaseDate!,
                taxData.refinances || [],
                purchasePrice || undefined,
              );
              loanBalance = estimate.estimatedBalance;
              console.log(`Loan estimate: $${estimate.estimatedBalance} at ${estimate.rate}% (payment: $${estimate.monthlyPayment}/mo)`);
            }
          } catch (err) {
            console.error("Tax records extraction failed, continuing:", err);
          }

          sendSSE(controller, { step: "reading_tax_records", progress: 58 });
        }

        // Merge MLS purchase data as fallback
        if (!purchasePrice && mlsPurchasePrice) purchasePrice = mlsPurchasePrice;
        if (!purchaseDate && mlsPurchaseDate) purchaseDate = mlsPurchaseDate;

        // === STEP 4: Web Research (houseversary only) ===
        const city = clientDetails.cityStateZip.split(",")[0]?.trim() || "";

        let developments: Development[] = [];
        let infrastructure: Development[] = [];
        let areaHighlights: Development[] = [];

        if (templateType === "houseversary") {
          sendSSE(controller, { step: "researching", progress: 60 });

          try {
            const researchResponse = await askClaudeWithWebSearch(
              webResearchPrompt(city),
              { maxTokens: 4096 }
            );
            const researchData = parseJSONFromClaude(researchResponse) as {
              developments: Development[];
              infrastructure: Development[];
              areaHighlights: Development[];
            };
            developments = researchData.developments || [];
            infrastructure = researchData.infrastructure || [];
            areaHighlights = researchData.areaHighlights || [];
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("Web research failed, continuing:", errMsg);
            sendSSE(controller, { step: "warning", message: `City research failed: ${errMsg}` });
          }

          sendSSE(controller, { step: "researching", progress: 70 });
        }

        // === STEP 5: Generate Content ===
        sendSSE(controller, { step: "generating_content", progress: 72 });

        // Parse comp links from textarea
        const compLinks: string[] = clientDetails.compLinks
          ? clientDetails.compLinks.split("\n").map(s => s.trim()).filter(s => s.startsWith("http"))
          : [];

        let finalConfig: AnyDashboardConfig;

        if (templateType === "houseversary") {
          finalConfig = await buildHouseversaryConfig(
            clientDetails, subject, features, csvResult, cromfordMetrics, cromfordTakeaway, cromfordSource,
            purchaseDate, purchasePrice, loanBalance,
            developments, infrastructure, areaHighlights, controller
          );
        } else if (templateType === "sell") {
          finalConfig = await buildSellConfig(
            clientDetails, subject, features, csvResult, cromfordMetrics, cromfordTakeaway, cromfordSource,
            lotSqft, propertyHighlights, compLinks, controller
          );
        } else if (templateType === "buyer") {
          finalConfig = await buildBuyerConfig(clientDetails, csvResult, controller);
        } else {
          finalConfig = await buildBuySellConfig(
            clientDetails, subject, features, csvResult, cromfordMetrics, cromfordTakeaway, cromfordSource,
            lotSqft, propertyHighlights, compLinks, controller
          );
        }

        // === STEP 6: Inject into template ===
        sendSSE(controller, { step: "assembling", progress: 90 });

        const templateHtml = getTemplateHtml(templateType);
        const finalHtml = injectConfig(templateHtml, finalConfig);

        sendSSE(controller, { step: "complete", progress: 100, html: finalHtml, templateType });
      } catch (err) {
        console.error("Generation error:", err);
        sendSSE(controller, {
          step: "error",
          message: (err as Error).message || "Unknown error",
        });
      } finally {
        if (!streamClosed) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// === Houseversary Pipeline (existing logic) ===

async function buildHouseversaryConfig(
  clientDetails: ClientDetails,
  subject: SubjectProperty,
  features: Feature[],
  csvResult: Awaited<ReturnType<typeof runFullAnalysis>> | null,
  cromfordMetrics: CromfordMetric[],
  cromfordTakeaway: string,
  cromfordSource: string,
  purchaseDate: string,
  purchasePrice: number,
  loanBalance: number,
  developments: Development[],
  infrastructure: Development[],
  areaHighlights: Development[],
  controller: ReadableStreamDefaultController,
): Promise<DashboardConfig> {
  if (!csvResult) throw new Error("CSV analysis result is required for houseversary dashboard");

  const purchaseDateObj = purchaseDate ? new Date(purchaseDate) : new Date();
  const now = new Date();
  const yearsOwned = purchaseDate
    ? Math.max(1, Math.round((now.getTime() - purchaseDateObj.getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
    : 1;

  const contentResponse = await askClaude(
    contentGenerationPrompt(
      { ...subject, address: clientDetails.address, subdivision: clientDetails.subdivision, communityName: clientDetails.communityName, cityStateZip: clientDetails.cityStateZip },
      csvResult.marketMetrics,
      csvResult.neighborhood,
      csvResult.bedroomAnalysis,
      cromfordMetrics,
      yearsOwned
    ),
    { maxTokens: 4096 }
  );
  const contentData = parseJSONFromClaude(contentResponse) as {
    headerTitle: string;
    outlookNarrative: string[];
    neighborhoodNarrative: string;
    bedroomNarrative: string;
    upgrades: Upgrade[];
    resources: {
      seasonal: { spring: string; summer: string; fall: string; winter: string };
      links: { label: string; url: string; desc: string }[];
    };
  };

  csvResult.neighborhood.narrative = contentData.neighborhoodNarrative || csvResult.neighborhood.narrative;
  if (contentData.bedroomNarrative) {
    csvResult.bedroomAnalysis.narrative = contentData.bedroomNarrative;
  }

  sendSSE(controller, { step: "generating_content", progress: 85 });

  const rawConfig = {
    clientNames: clientDetails.clientNames,
    fullName: clientDetails.fullName,
    email: clientDetails.email,
    address: clientDetails.address,
    cityStateZip: clientDetails.cityStateZip,
    subdivision: clientDetails.subdivision,
    communityName: clientDetails.communityName,
    headerTitle: contentData.headerTitle || `Happy ${yearsOwned}-Year Houseversary!`,
    purchaseDate,
    purchasePrice,
    loanBalance,
    agentKey: clientDetails.agentKey,
    ...subject,
    comps: csvResult.comps,
    marketMetrics: csvResult.marketMetrics,
    neighborhood: csvResult.neighborhood,
    bedroomAnalysis: csvResult.bedroomAnalysis,
    subjectAdvantages: csvResult.subjectAdvantages,
    features,
    cromfordMetrics,
    cromfordTakeaway,
    cromfordSource,
    outlookNarrative: contentData.outlookNarrative || [],
    upgrades: contentData.upgrades || [],
    developments,
    infrastructure,
    areaHighlights,
    resources: contentData.resources || {
      seasonal: { spring: "", summer: "", fall: "", winter: "" },
      links: [],
    },
  };

  const config: DashboardConfig = validateDashboardConfig(rawConfig);

  // Check for negative equity
  const estimatedEquity = csvResult.marketMetrics.derivedValue - loanBalance;
  if (estimatedEquity < 0) {
    sendSSE(controller, {
      step: "warning",
      progress: 92,
      message: `Negative equity detected ($${estimatedEquity.toLocaleString()}). Review the comp data in the CSV and consider running a manual comp analysis before delivering this dashboard.`,
    });
  }

  return config;
}

// === Sell Pipeline ===

async function buildSellConfig(
  clientDetails: ClientDetails & { loanPayoff?: number },
  subject: SubjectProperty,
  features: Feature[],
  csvResult: Awaited<ReturnType<typeof runFullAnalysis>> | null,
  cromfordMetrics: CromfordMetric[],
  cromfordTakeaway: string,
  cromfordSource: string,
  lotSqft: number,
  propertyHighlights: string[],
  compLinks: string[],
  controller: ReadableStreamDefaultController,
): Promise<SellDashboardConfig> {
  if (!csvResult) throw new Error("CSV analysis result is required for sell dashboard");

  const city = clientDetails.cityStateZip.split(",")[0]?.trim() || "";

  const contentResponse = await askClaude(
    sellContentPrompt(
      { ...subject, address: clientDetails.address, subdivision: clientDetails.subdivision, communityName: clientDetails.communityName, cityStateZip: clientDetails.cityStateZip, lotSqft },
      csvResult.marketMetrics,
      csvResult.comps,
      cromfordMetrics,
      city
    ),
    { maxTokens: 4096 }
  );
  const contentData = parseJSONFromClaude(contentResponse) as {
    pricingStrategy: string;
    competition: { address: string; price: number; status: string; dom: number; beds: string; baths: string; sqft: number; pool: string; note: string }[];
    marketSnapshot: { label: string; value: string }[];
    prepItems: { key: string; label: string; defaultCost: number; desc: string }[];
    marketingPlan: string[];
    timeline: { phase: string; dates: string; items: string[] }[];
    propertyHighlights: string[];
    upgrades: { name: string; value: string }[];
  };

  sendSSE(controller, { step: "generating_content", progress: 85 });

  return {
    templateType: "sell",
    clientNames: clientDetails.clientNames,
    fullName: clientDetails.fullName,
    email: clientDetails.email,
    address: clientDetails.address,
    cityStateZip: clientDetails.cityStateZip,
    subdivision: clientDetails.subdivision,
    communityName: clientDetails.communityName,
    agentKey: clientDetails.agentKey,
    beds: Number(subject.beds) || 0,
    baths: Number(subject.baths) || 0,
    sqft: Number(subject.sqft) || 0,
    lotSqft: Number(lotSqft) || 0,
    yearBuilt: Number(subject.yearBuilt) || 0,
    pool: subject.pool,
    stories: Number(subject.stories) || 1,
    estimatedSalePrice: Number(csvResult.marketMetrics.derivedValue) || 0,
    loanPayoff: Number(clientDetails.loanPayoff) || 0,
    propertyHighlights: Array.isArray(contentData.propertyHighlights) ? contentData.propertyHighlights : propertyHighlights,
    upgrades: Array.isArray(contentData.upgrades) ? contentData.upgrades : [],
    comps: csvResult.comps,
    marketMetrics: csvResult.marketMetrics,
    pricingStrategy: contentData.pricingStrategy || "",
    competition: Array.isArray(contentData.competition) ? contentData.competition : [],
    marketSnapshot: Array.isArray(contentData.marketSnapshot) ? contentData.marketSnapshot : [],
    prepItems: Array.isArray(contentData.prepItems) ? contentData.prepItems : [],
    marketingPlan: Array.isArray(contentData.marketingPlan) ? contentData.marketingPlan : [],
    timeline: Array.isArray(contentData.timeline) ? contentData.timeline : [],
    cromfordMetrics,
    cromfordTakeaway,
    cromfordSource,
    features,
    referenceLinks: compLinks.length > 0
      ? compLinks.map(url => ({ url, label: extractDomainLabel(url) }))
      : undefined,
  };
}

function extractDomainLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const path = new URL(url).pathname;
    // Try to extract address-like info from path
    const parts = path.split("/").filter(Boolean);
    const addressPart = parts.find(p => /\d+.*(?:st|rd|ave|dr|ln|ct|way|blvd|cir|pl)/i.test(p));
    if (addressPart) return addressPart.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return hostname;
  } catch {
    return url;
  }
}

// === Buyer Pipeline ===

async function buildBuyerConfig(
  clientDetails: ClientDetails & {
    targetAreas?: string;
    budgetMin?: number;
    budgetMax?: number;
    bedsMin?: number;
    bathsMin?: number;
    mustHaves?: string[];
    schoolPreference?: string;
    homeSearchUrl?: string;
  },
  csvResult: Awaited<ReturnType<typeof runFullAnalysis>> | null,
  controller: ReadableStreamDefaultController,
): Promise<BuyerDashboardConfig> {
  const contentResponse = await askClaude(
    buyerContentPrompt(
      clientDetails.clientNames,
      clientDetails.targetAreas || "",
      clientDetails.budgetMin || 400000,
      clientDetails.budgetMax || 800000,
      clientDetails.bedsMin || 3,
      clientDetails.bathsMin || 2,
      clientDetails.mustHaves || [],
      clientDetails.schoolPreference || "",
      clientDetails.cityStateZip
    ),
    { model: "claude-opus-4-6", maxTokens: 8192 }
  );
  const contentData = parseJSONFromClaude(contentResponse) as {
    neighborhoods: BuyerDashboardConfig["neighborhoods"];
    schoolDistricts: BuyerDashboardConfig["schoolDistricts"];
    timeline: BuyerDashboardConfig["timeline"];
    marketSnapshot: { label: string; value: string }[];
  };

  sendSSE(controller, { step: "generating_content", progress: 85 });

  return {
    templateType: "buyer",
    clientNames: clientDetails.clientNames,
    fullName: clientDetails.fullName,
    email: clientDetails.email,
    agentKey: clientDetails.agentKey,
    targetAreas: clientDetails.targetAreas || "",
    budgetMin: Number(clientDetails.budgetMin) || 400000,
    budgetMax: Number(clientDetails.budgetMax) || 800000,
    bedsMin: Number(clientDetails.bedsMin) || 3,
    bathsMin: Number(clientDetails.bathsMin) || 2,
    mustHaves: Array.isArray(clientDetails.mustHaves) ? clientDetails.mustHaves : [],
    schoolPreference: clientDetails.schoolPreference || "",
    neighborhoods: Array.isArray(contentData.neighborhoods) ? contentData.neighborhoods : [],
    schoolDistricts: Array.isArray(contentData.schoolDistricts) ? contentData.schoolDistricts : [],
    timeline: Array.isArray(contentData.timeline) ? contentData.timeline : [],
    marketSnapshot: Array.isArray(contentData.marketSnapshot) ? contentData.marketSnapshot : [],
    homeSearchUrl: clientDetails.homeSearchUrl || undefined,
  };
}

// === Buy/Sell Pipeline ===

async function buildBuySellConfig(
  clientDetails: ClientDetails & {
    targetAreas?: string;
    budgetMin?: number;
    budgetMax?: number;
    bedsMin?: number;
    bathsMin?: number;
    mustHaves?: string[];
    schoolPreference?: string;
    homeSearchUrl?: string;
    sellAddress?: string;
    sellCityStateZip?: string;
    loanPayoff?: number;
  },
  subject: SubjectProperty,
  features: Feature[],
  csvResult: Awaited<ReturnType<typeof runFullAnalysis>> | null,
  cromfordMetrics: CromfordMetric[],
  cromfordTakeaway: string,
  cromfordSource: string,
  lotSqft: number,
  propertyHighlights: string[],
  compLinks: string[],
  controller: ReadableStreamDefaultController,
): Promise<BuySellDashboardConfig> {
  if (!csvResult) throw new Error("CSV analysis result is required for buy/sell dashboard");

  const contentResponse = await askClaude(
    buySellContentPrompt(
      { ...subject, address: clientDetails.address, subdivision: clientDetails.subdivision, communityName: clientDetails.communityName, cityStateZip: clientDetails.cityStateZip, lotSqft },
      csvResult.marketMetrics,
      csvResult.comps,
      clientDetails.clientNames,
      clientDetails.targetAreas || "",
      clientDetails.budgetMin || 400000,
      clientDetails.budgetMax || 800000,
      clientDetails.bedsMin || 3,
      clientDetails.bathsMin || 2,
      clientDetails.mustHaves || [],
      clientDetails.schoolPreference || "",
      cromfordMetrics
    ),
    { model: "claude-opus-4-6", maxTokens: 8192 }
  );
  const contentData = parseJSONFromClaude(contentResponse) as {
    sellPricingStrategy: string;
    sellCompetition: BuySellDashboardConfig["sellCompetition"];
    sellPropertyHighlights: string[];
    neighborhoods: BuySellDashboardConfig["neighborhoods"];
    schoolDistricts: BuySellDashboardConfig["schoolDistricts"];
    strategyOptions: BuySellDashboardConfig["strategyOptions"];
    strategyTimeline: BuySellDashboardConfig["strategyTimeline"];
  };

  sendSSE(controller, { step: "generating_content", progress: 85 });

  return {
    templateType: "buysell",
    clientNames: clientDetails.clientNames,
    fullName: clientDetails.fullName,
    email: clientDetails.email,
    agentKey: clientDetails.agentKey,
    sellAddress: clientDetails.address,
    sellCityStateZip: clientDetails.cityStateZip,
    sellSubdivision: clientDetails.subdivision,
    sellCommunityName: clientDetails.communityName,
    sellBeds: Number(subject.beds) || 0,
    sellBaths: Number(subject.baths) || 0,
    sellSqft: Number(subject.sqft) || 0,
    sellLotSqft: Number(lotSqft) || 0,
    sellYearBuilt: Number(subject.yearBuilt) || 0,
    sellPool: subject.pool,
    sellStories: Number(subject.stories) || 1,
    estimatedSalePrice: Number(csvResult.marketMetrics.derivedValue) || 0,
    loanPayoff: Number(clientDetails.loanPayoff) || 0,
    sellPropertyHighlights: Array.isArray(contentData.sellPropertyHighlights) ? contentData.sellPropertyHighlights : propertyHighlights,
    sellComps: csvResult.comps,
    sellMarketMetrics: csvResult.marketMetrics,
    sellPricingStrategy: contentData.sellPricingStrategy || "",
    sellCompetition: Array.isArray(contentData.sellCompetition) ? contentData.sellCompetition : [],
    targetAreas: clientDetails.targetAreas || "",
    budgetMin: Number(clientDetails.budgetMin) || 400000,
    budgetMax: Number(clientDetails.budgetMax) || 800000,
    bedsMin: Number(clientDetails.bedsMin) || 3,
    bathsMin: Number(clientDetails.bathsMin) || 2,
    mustHaves: Array.isArray(clientDetails.mustHaves) ? clientDetails.mustHaves : [],
    schoolPreference: clientDetails.schoolPreference || "",
    neighborhoods: Array.isArray(contentData.neighborhoods) ? contentData.neighborhoods : [],
    schoolDistricts: Array.isArray(contentData.schoolDistricts) ? contentData.schoolDistricts : [],
    strategyOptions: Array.isArray(contentData.strategyOptions) ? contentData.strategyOptions : [],
    strategyTimeline: Array.isArray(contentData.strategyTimeline) ? contentData.strategyTimeline : [],
    cromfordMetrics,
    cromfordTakeaway,
    cromfordSource,
    features,
    homeSearchUrl: clientDetails.homeSearchUrl || undefined,
    sellReferenceLinks: compLinks.length > 0
      ? compLinks.map(url => ({ url, label: extractDomainLabel(url) }))
      : undefined,
  };
}
