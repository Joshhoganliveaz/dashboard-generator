import { NextResponse } from "next/server";
import { askClaudeWithPDF, askClaudeWithImages, askClaudeWithWebSearch, askClaude } from "@/lib/claude-api";
import { MLS_EXTRACTION_PROMPT, TAX_RECORDS_EXTRACTION_PROMPT, CROMFORD_EXTRACTION_PROMPT, webResearchPrompt, contentGenerationPrompt, sellContentPrompt, buyerContentPrompt, buySellContentPrompt } from "@/lib/claude-prompts";
import { injectConfig } from "@/lib/template-engine";
import { deriveValueFromComps } from "@/lib/comp-adjustments";
import { getTemplateHtml } from "@/lib/template-loader";
import { validateDashboardConfig } from "@/lib/types";
import { estimateCurrentBalance } from "@/lib/loan-estimator";
import { TEMPLATE_REGISTRY, isFileRelevant } from "@/lib/template-registry";
import type { TemplateType } from "@/lib/template-registry";
import type { ClientDetails, DashboardConfig, SellDashboardConfig, BuyerDashboardConfig, BuySellDashboardConfig, AnyDashboardConfig, SubjectProperty, Feature, CompSale, MarketMetrics, CromfordMetric, Development, Upgrade, NeighborhoodAnalysis, BedroomAnalysis } from "@/lib/types";

export const maxDuration = 300;

function sendSSE(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

function parseJSONFromClaude(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return JSON.parse(fenceMatch[1].trim());
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error(`No JSON object found in response: ${cleaned.slice(0, 100)}...`);
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function recalcMetricsFromComps(
  baseMetrics: MarketMetrics,
  approvedComps: CompSale[],
  subject: SubjectProperty,
): MarketMetrics {
  if (approvedComps.length === 0) return baseMetrics;

  const ppsfValues = approvedComps.map((c) => c.ppsf);
  const medianPpsf = median(ppsfValues);
  const avgPpsf = ppsfValues.reduce((a, b) => a + b, 0) / ppsfValues.length;
  const ppsfRange = { low: Math.min(...ppsfValues), high: Math.max(...ppsfValues) };

  // Adjusted Comparable Sales Method — adjust each comp for GLA/bath/pool
  // differences, then derive value via weighted average by similarity score
  const adjusted = deriveValueFromComps(approvedComps, subject);

  return {
    ...baseMetrics,
    medianPpsf,
    avgPpsf,
    ppsfRange,
    derivedValue: adjusted.derivedValue,
    derivedRange: adjusted.derivedRange,
    compsUsedForValue: adjusted.compsUsedForValue,
  };
}

function extractDomainLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const path = new URL(url).pathname;
    const parts = path.split("/").filter(Boolean);
    const addressPart = parts.find(p => /\d+.*(?:st|rd|ave|dr|ln|ct|way|blvd|cir|pl)/i.test(p));
    if (addressPart) return addressPart.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return hostname;
  } catch { return url; }
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const templateType = (formData.get("templateType") as TemplateType) || "houseversary";
  const templateConfig = TEMPLATE_REGISTRY[templateType];
  if (!templateConfig) {
    return NextResponse.json({ error: `Unknown template type: ${templateType}` }, { status: 400 });
  }

  // Parse JSON fields from FormData
  const clientDetailsRaw = formData.get("clientDetails") as string;
  let clientDetails: ClientDetails & {
    targetAreas?: string; budgetMin?: number; budgetMax?: number;
    bedsMin?: number; bathsMin?: number; mustHaves?: string[];
    schoolPreference?: string; homeSearchUrl?: string;
    sellAddress?: string; sellCityStateZip?: string; loanPayoff?: number; compLinks?: string;
  };
  try { clientDetails = JSON.parse(clientDetailsRaw); } catch {
    return NextResponse.json({ error: "Invalid client details" }, { status: 400 });
  }

  let approvedComps: CompSale[];
  try { approvedComps = JSON.parse(formData.get("approvedComps") as string); } catch {
    return NextResponse.json({ error: "Invalid approvedComps" }, { status: 400 });
  }

  let csvResultData: {
    marketMetrics: MarketMetrics;
    neighborhood: Record<string, unknown>;
    bedroomAnalysis: Record<string, unknown>;
    subjectAdvantages: string[];
    metadata: Record<string, unknown>;
  };
  try { csvResultData = JSON.parse(formData.get("csvResult") as string); } catch {
    return NextResponse.json({ error: "Invalid csvResult" }, { status: 400 });
  }

  let mlsData: {
    subject: SubjectProperty;
    features: Feature[];
    purchasePrice: number | null;
    purchaseDate: string | null;
    lotSqft: number;
    propertyHighlights: string[];
  };
  try { mlsData = JSON.parse(formData.get("mlsData") as string); } catch {
    return NextResponse.json({ error: "Invalid mlsData" }, { status: 400 });
  }

  const { subject, features } = mlsData;
  let { purchasePrice: mlsPurchasePrice, purchaseDate: mlsPurchaseDate } = mlsData;
  const { lotSqft, propertyHighlights } = mlsData;

  // Read Phase 1-extracted purchase data (from tax records / MLS)
  const extractedPurchasePriceRaw = formData.get("extractedPurchasePrice") as string | null;
  const extractedPurchaseDateRaw = formData.get("extractedPurchaseDate") as string | null;

  // Recalculate comp-dependent metrics from approved comps
  const recalcedMetrics = recalcMetricsFromComps(csvResultData.marketMetrics, approvedComps, subject);

  // Reassemble csvResult with approved comps
  const csvResult = {
    comps: approvedComps,
    marketMetrics: recalcedMetrics,
    neighborhood: csvResultData.neighborhood as unknown as NeighborhoodAnalysis,
    bedroomAnalysis: csvResultData.bedroomAnalysis as unknown as BedroomAnalysis,
    subjectAdvantages: csvResultData.subjectAdvantages,
    metadata: csvResultData.metadata,
  };

  // Get user-verified loan overrides from Phase 1 comp review
  const verifiedOriginalLoanRaw = formData.get("verifiedOriginalLoan") as string | null;
  const verifiedOriginalLoan = verifiedOriginalLoanRaw ? parseInt(verifiedOriginalLoanRaw, 10) : null;
  const verifiedLoanBalanceRaw = formData.get("verifiedLoanBalance") as string | null;
  const verifiedLoanBalance = verifiedLoanBalanceRaw ? parseInt(verifiedLoanBalanceRaw, 10) : null;

  // Get file uploads
  const taxRecordsPdf = formData.get("taxRecords") as File | null;
  const cromfordFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "cromford" && value instanceof File) {
      cromfordFiles.push(value);
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // === STEP 3: Read Cromford Screenshots ===
        let cromfordMetrics: CromfordMetric[] = [];
        let cromfordTakeaway = "";
        let cromfordSource = "";

        if (cromfordFiles.length > 0 && isFileRelevant(templateType, "cromford")) {
          sendSSE(controller, { step: "reading_cromford", progress: 38 });

          const images = await Promise.all(
            cromfordFiles.map(async (f) => {
              const buf = Buffer.from(await f.arrayBuffer());
              return { base64: buf.toString("base64"), mediaType: f.type || "image/png" };
            })
          );

          const cromfordResponse = await askClaudeWithImages(CROMFORD_EXTRACTION_PROMPT, images, { maxTokens: 2048 });
          const cromfordData = parseJSONFromClaude(cromfordResponse) as {
            metrics: CromfordMetric[]; takeaway: string; source: string;
          };

          cromfordMetrics = cromfordData.metrics || [];
          cromfordTakeaway = cromfordData.takeaway || "";
          cromfordSource = cromfordData.source || "";

          sendSSE(controller, { step: "reading_cromford", progress: 48 });
        }

        // === STEP 3.5: Loan balance — use verified value from Phase 1 comp review ===
        let purchasePrice = clientDetails.purchasePrice || 0;
        let purchaseDate = clientDetails.purchaseDate || "";
        let loanBalance = clientDetails.loanBalance || 0;

        // Phase 1 extraction overrides form values (tax records / MLS data from Phase 1)
        if (extractedPurchasePriceRaw) {
          const parsed = parseInt(extractedPurchasePriceRaw, 10);
          if (!isNaN(parsed) && parsed > 0) purchasePrice = parsed;
        }
        if (extractedPurchaseDateRaw) {
          purchaseDate = extractedPurchaseDateRaw;
        }

        if (verifiedLoanBalance !== null && !isNaN(verifiedLoanBalance)) {
          // User directly overrode the balance — use as-is
          loanBalance = verifiedLoanBalance;
          console.log(`Using user-verified loan balance: $${verifiedLoanBalance}`);
        } else if (verifiedOriginalLoan !== null && !isNaN(verifiedOriginalLoan) && verifiedOriginalLoan > 0) {
          // User corrected the original loan amount — re-run amortization
          const loanDate = clientDetails.purchaseDate || purchaseDate;
          if (loanDate) {
            const estimate = estimateCurrentBalance(
              verifiedOriginalLoan,
              loanDate,
              [], // refinances already accounted for in Phase 1
              purchasePrice || undefined,
            );
            loanBalance = estimate.estimatedBalance;
            console.log(`Re-amortized from user-corrected original loan $${verifiedOriginalLoan}: balance $${estimate.estimatedBalance} at ${estimate.rate}%`);
          } else {
            console.warn(`No loan date available for re-amortization, using original loan as balance`);
            loanBalance = verifiedOriginalLoan;
          }
        } else if (taxRecordsPdf && isFileRelevant(templateType, "taxRecords")) {
          // Fallback: extract from tax records if no verified balance provided
          sendSSE(controller, { step: "reading_tax_records", progress: 50 });

          const taxBuffer = Buffer.from(await taxRecordsPdf.arrayBuffer());
          const taxBase64 = taxBuffer.toString("base64");

          try {
            const taxResponse = await askClaudeWithPDF(TAX_RECORDS_EXTRACTION_PROMPT, taxBase64, { maxTokens: 2048 });
            const taxData = parseJSONFromClaude(taxResponse) as {
              purchasePrice: number | null; purchaseDate: string | null;
              originalLoanAmount: number | null; loanDate: string | null;
              refinances: { date: string; amount: number }[] | null;
              assessedValue: number | null; taxYear: number | null; legalDescription: string | null;
            };

            if (taxData.purchasePrice) purchasePrice = taxData.purchasePrice;
            if (taxData.purchaseDate) purchaseDate = taxData.purchaseDate;

            // Validation: detect misclassified original loan
            const refinances = taxData.refinances || [];
            let needsSwap = false;
            let swapReason = "";

            if (taxData.originalLoanAmount && taxData.purchasePrice && taxData.originalLoanAmount < taxData.purchasePrice * 0.50) {
              needsSwap = true;
              swapReason = `originalLoanAmount $${taxData.originalLoanAmount} is <50% of purchasePrice $${taxData.purchasePrice}`;
            } else if (taxData.loanDate && taxData.purchaseDate) {
              const loanTime = new Date(taxData.loanDate).getTime();
              const purchaseTime = new Date(taxData.purchaseDate).getTime();
              const monthsApart = Math.abs(loanTime - purchaseTime) / (1000 * 60 * 60 * 24 * 30);
              if (monthsApart > 6) {
                needsSwap = true;
                swapReason = `loanDate ${taxData.loanDate} is ${Math.round(monthsApart)} months from purchaseDate ${taxData.purchaseDate}`;
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
                console.log(`Loan swap: ${swapReason}. Swapping with $${betterMatch.amount} from ${betterMatch.date}.`);
                taxData.refinances = refinances.filter(r => r !== betterMatch);
                taxData.refinances.push({ date: taxData.loanDate || taxData.purchaseDate || betterMatch.date, amount: taxData.originalLoanAmount });
                taxData.refinances.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                taxData.originalLoanAmount = betterMatch.amount;
                taxData.loanDate = betterMatch.date;
              } else {
                console.warn(`Warning: ${swapReason}, but no better candidate found in refinances.`);
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
            }
          } catch (err) {
            console.error("Tax records extraction failed, continuing:", err);
          }

          sendSSE(controller, { step: "reading_tax_records", progress: 58 });
        }

        if (!purchasePrice && mlsPurchasePrice) purchasePrice = mlsPurchasePrice;
        if (!purchaseDate && mlsPurchaseDate) purchaseDate = mlsPurchaseDate;
        if (!purchaseDate && clientDetails.closingDate) purchaseDate = clientDetails.closingDate;

        // === STEP 4: Web Research (houseversary only) ===
        const city = clientDetails.cityStateZip.split(",")[0]?.trim() || "";
        let developments: Development[] = [];
        let infrastructure: Development[] = [];
        let areaHighlights: Development[] = [];

        if (templateType === "houseversary") {
          sendSSE(controller, { step: "researching", progress: 60 });
          try {
            const researchResponse = await askClaudeWithWebSearch(webResearchPrompt(city), { maxTokens: 4096 });
            const researchData = parseJSONFromClaude(researchResponse) as {
              developments: Development[]; infrastructure: Development[]; areaHighlights: Development[];
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

        const compLinks: string[] = clientDetails.compLinks
          ? clientDetails.compLinks.split("\n").map(s => s.trim()).filter(s => s.startsWith("http"))
          : [];

        let finalConfig: AnyDashboardConfig;

        if (templateType === "houseversary") {
          finalConfig = await buildHouseversaryConfig(
            clientDetails, subject, features, csvResult as Parameters<typeof buildHouseversaryConfig>[3],
            cromfordMetrics, cromfordTakeaway, cromfordSource,
            purchaseDate, purchasePrice, loanBalance,
            developments, infrastructure, areaHighlights, controller
          );
        } else if (templateType === "sell") {
          finalConfig = await buildSellConfig(
            clientDetails, subject, features, csvResult as Parameters<typeof buildSellConfig>[3],
            cromfordMetrics, cromfordTakeaway, cromfordSource,
            lotSqft, propertyHighlights, compLinks, controller
          );
        } else if (templateType === "buyer") {
          finalConfig = await buildBuyerConfig(clientDetails, csvResult as Parameters<typeof buildBuyerConfig>[1], controller);
        } else {
          finalConfig = await buildBuySellConfig(
            clientDetails, subject, features, csvResult as Parameters<typeof buildBuySellConfig>[3],
            cromfordMetrics, cromfordTakeaway, cromfordSource,
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
        sendSSE(controller, { step: "error", message: (err as Error).message || "Unknown error" });
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

// === Builder functions (mirrored from Phase 1 route) ===

async function buildHouseversaryConfig(
  clientDetails: ClientDetails,
  subject: SubjectProperty,
  features: Feature[],
  csvResult: { comps: CompSale[]; marketMetrics: MarketMetrics; neighborhood: NeighborhoodAnalysis; bedroomAnalysis: BedroomAnalysis; subjectAdvantages: string[] } | null,
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

async function buildSellConfig(
  clientDetails: ClientDetails & { loanPayoff?: number },
  subject: SubjectProperty,
  features: Feature[],
  csvResult: { comps: CompSale[]; marketMetrics: MarketMetrics } | null,
  cromfordMetrics: CromfordMetric[],
  cromfordTakeaway: string,
  cromfordSource: string,
  lotSqft: number,
  propertyHighlights: string[],
  compLinks: string[],
  controller: ReadableStreamDefaultController,
): Promise<SellDashboardConfig> {
  if (!csvResult) throw new Error("CSV analysis result is required for sell dashboard");

  const contentResponse = await askClaude(
    sellContentPrompt(
      { ...subject, address: clientDetails.address, subdivision: clientDetails.subdivision, communityName: clientDetails.communityName, cityStateZip: clientDetails.cityStateZip, lotSqft },
      csvResult.marketMetrics,
      csvResult.comps,
      cromfordMetrics,
      clientDetails.cityStateZip.split(",")[0]?.trim() || ""
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

async function buildBuyerConfig(
  clientDetails: ClientDetails & {
    targetAreas?: string; budgetMin?: number; budgetMax?: number;
    bedsMin?: number; bathsMin?: number; mustHaves?: string[];
    schoolPreference?: string; homeSearchUrl?: string;
  },
  csvResult: { comps: CompSale[]; marketMetrics: MarketMetrics } | null,
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

async function buildBuySellConfig(
  clientDetails: ClientDetails & {
    targetAreas?: string; budgetMin?: number; budgetMax?: number;
    bedsMin?: number; bathsMin?: number; mustHaves?: string[];
    schoolPreference?: string; homeSearchUrl?: string;
    sellAddress?: string; sellCityStateZip?: string; loanPayoff?: number;
  },
  subject: SubjectProperty,
  features: Feature[],
  csvResult: { comps: CompSale[]; marketMetrics: MarketMetrics } | null,
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
