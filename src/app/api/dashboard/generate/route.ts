import { NextResponse } from "next/server";
import { runFullAnalysis } from "@/lib/csv-engine";
import { askClaudeWithPDF, askClaudeWithImages, askClaudeWithWebSearch, askClaude } from "@/lib/claude-api";
import { MLS_EXTRACTION_PROMPT, TAX_RECORDS_EXTRACTION_PROMPT, CROMFORD_EXTRACTION_PROMPT, webResearchPrompt, contentGenerationPrompt } from "@/lib/claude-prompts";
import { injectConfig } from "@/lib/template-engine";
import { getTemplateHtml } from "@/lib/template-loader";
import { validateDashboardConfig } from "@/lib/types";
import { estimateCurrentBalance } from "@/lib/loan-estimator";
import type { ClientDetails, DashboardConfig, SubjectProperty, Feature, CromfordMetric, Development, Upgrade } from "@/lib/types";

export const maxDuration = 300; // 5 min timeout for long generation

function sendSSE(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

function parseJSONFromClaude(text: string): Record<string, unknown> {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  const formData = await request.formData();

  // Parse client details from form
  const clientDetailsRaw = formData.get("clientDetails") as string;
  let clientDetails: ClientDetails;
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

  if (!csvFile) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // === STEP 1: Extract from MLS PDF (do this first to get subject details) ===
        let subject: SubjectProperty = { beds: 0, baths: 0, sqft: 0, yearBuilt: 0, pool: false, stories: 1 };
        let features: Feature[] = [];
        let mlsPurchasePrice: number | null = null;
        let mlsPurchaseDate: string | null = null;

        if (mlsPdf) {
          sendSSE(controller, { step: "extracting_mls", progress: 5 });

          const pdfBuffer = Buffer.from(await mlsPdf.arrayBuffer());
          const pdfBase64 = pdfBuffer.toString("base64");

          const mlsResponse = await askClaudeWithPDF(MLS_EXTRACTION_PROMPT, pdfBase64, { maxTokens: 2048 });
          const mlsData = parseJSONFromClaude(mlsResponse) as {
            beds: number; baths: number; sqft: number; yearBuilt: number;
            pool: boolean; stories: number; features: Feature[];
            purchasePrice?: number | null; purchaseDate?: string | null;
          };

          // Capture MLS purchase data as fallback
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

          sendSSE(controller, { step: "extracting_mls", progress: 15 });
        }

        // === STEP 2: CSV Analysis via Claude (with full subject data) ===
        sendSSE(controller, { step: "parsing_csv", progress: 18 });

        const csvBuffer = Buffer.from(await csvFile.arrayBuffer());
        const csvResult = await runFullAnalysis(csvBuffer, {
          ...subject,
          subdivision: clientDetails.subdivision,
          communityName: clientDetails.communityName,
          cityStateZip: clientDetails.cityStateZip,
          address: clientDetails.address,
        });
        if (csvResult.comps.length === 0 && csvResult.metadata.warnings.length > 0) {
          sendSSE(controller, { step: "parsing_csv", progress: 35, message: `Warning: ${csvResult.metadata.warnings.join('; ')}` });
        } else {
          sendSSE(controller, { step: "parsing_csv", progress: 35, message: `Analyzed ${csvResult.metadata.totalParsed} sales, selected ${csvResult.comps.length} comps` });
        }

        // === STEP 3: Read Cromford Screenshots ===
        let cromfordMetrics: CromfordMetric[] = [];
        let cromfordTakeaway = "";
        let cromfordSource = "";

        if (cromfordFiles.length > 0) {
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

        // === STEP 3.5: Extract from Tax Records ===
        let purchasePrice = clientDetails.purchasePrice || 0;
        let purchaseDate = clientDetails.purchaseDate || "";
        let loanBalance = clientDetails.loanBalance || 0;

        if (taxRecordsPdf) {
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

            // Tax records are most authoritative for purchase data
            if (taxData.purchasePrice) purchasePrice = taxData.purchasePrice;
            if (taxData.purchaseDate) purchaseDate = taxData.purchaseDate;

            // Estimate loan balance from mortgage data
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

        // Merge MLS purchase data as fallback (if tax records didn't provide it)
        // mlsPurchasePrice/mlsPurchaseDate would be set during MLS extraction above
        if (!purchasePrice && mlsPurchasePrice) purchasePrice = mlsPurchasePrice;
        if (!purchaseDate && mlsPurchaseDate) purchaseDate = mlsPurchaseDate;

        // === STEP 4: Web Research ===
        sendSSE(controller, { step: "researching", progress: 60 });

        const city = clientDetails.cityStateZip.split(",")[0]?.trim() || "";
        const neighborhood = clientDetails.communityName || clientDetails.subdivision;

        let developments: Development[] = [];
        let infrastructure: Development[] = [];
        let areaHighlights: Development[] = [];

        try {
          const researchResponse = await askClaudeWithWebSearch(
            webResearchPrompt(city, neighborhood),
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
          console.error("Web research failed, continuing:", err);
          sendSSE(controller, { step: "warning", message: "Neighborhood research unavailable — section will be empty" });
        }

        sendSSE(controller, { step: "researching", progress: 70 });

        // === STEP 5: Generate Content ===
        sendSSE(controller, { step: "generating_content", progress: 72 });

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

        // Update narratives from Claude
        csvResult.neighborhood.narrative = contentData.neighborhoodNarrative || csvResult.neighborhood.narrative;
        if (contentData.bedroomNarrative) {
          csvResult.bedroomAnalysis.narrative = contentData.bedroomNarrative;
        }

        sendSSE(controller, { step: "generating_content", progress: 85 });

        // === STEP 6: Assemble CONFIG ===
        sendSSE(controller, { step: "assembling", progress: 90 });

        const rawConfig = {
          // Client identity
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

          // Property
          ...subject,

          // Market analysis
          comps: csvResult.comps,
          marketMetrics: csvResult.marketMetrics,
          neighborhood: csvResult.neighborhood,
          bedroomAnalysis: csvResult.bedroomAnalysis,
          subjectAdvantages: csvResult.subjectAdvantages,

          // Content
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

        // Validate and fill missing fields with safe defaults
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

        // === STEP 7: Inject into template ===
        const templateHtml = getTemplateHtml();
        const finalHtml = injectConfig(templateHtml, config);

        sendSSE(controller, { step: "complete", progress: 100, html: finalHtml });
      } catch (err) {
        console.error("Generation error:", err);
        sendSSE(controller, {
          step: "error",
          message: (err as Error).message || "Unknown error",
        });
      } finally {
        controller.close();
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
