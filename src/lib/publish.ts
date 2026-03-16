import { getDashboard, listPropertiesOfInterest } from "@/lib/supabase/db";
import { getTemplateHtml } from "@/lib/template-loader";
import { injectConfig } from "@/lib/template-engine";
import type { DashboardWithData } from "@/lib/supabase/types";
import type {
  AnyDashboardConfig,
  SellDashboardConfig,
  BuyerDashboardConfig,
  BuySellDashboardConfig,
  MarketMetrics,
  PropertyOfInterestConfig,
} from "@/lib/types";
import type { PropertyOfInterest } from "@/lib/supabase/types";

const defaultMetrics: MarketMetrics = {
  medianSoldPrice: 0,
  medianPpsf: 0,
  avgPpsf: 0,
  ppsfRange: { low: 0, high: 0 },
  derivedValue: 0,
  derivedRange: { low: 0, high: 0 },
  compsUsedForValue: 0,
  avgDom: 0,
  medianDom: 0,
  saleToListRatio: 0,
  priceTrendDirection: "stable",
  priceTrendDetail: "",
  totalSalesInPeriod: 0,
  subdivisionSalesCount: 0,
  earliestSale: "",
  latestSale: "",
  analysisPeriodMonths: 12,
};

/**
 * Map a DashboardWithData record to the CONFIG shape the template expects.
 * The CONFIG is the same structure the generation pipeline produces.
 */
/** Map DB PropertyOfInterest rows to camelCase CONFIG shape */
function mapPOI(properties: PropertyOfInterest[]): PropertyOfInterestConfig[] {
  return properties.map((p) => ({
    address: p.address,
    price: p.price ?? undefined,
    listingUrl: p.listing_url ?? undefined,
    photoUrl: p.photo_url ?? undefined,
    notes: p.notes ?? undefined,
  }));
}

export function buildConfigFromDashboard(dashboard: DashboardWithData, properties?: PropertyOfInterest[]): AnyDashboardConfig {
  const { type, client_names, full_name, email, agent_key } = dashboard;

  if (type === "sell") {
    const sd = dashboard.sell_data;
    const config: SellDashboardConfig = {
      templateType: "sell",
      clientNames: client_names,
      fullName: full_name ?? "",
      email: email ?? "",
      agentKey: agent_key,
      listingStatus: sd?.listing_status ?? "pre-listing",
      // Property
      address: sd?.address ?? "",
      cityStateZip: sd?.city_state_zip ?? "",
      subdivision: sd?.subdivision ?? "",
      communityName: sd?.community_name ?? "",
      beds: sd?.beds ?? 0,
      baths: sd?.baths ?? 0,
      sqft: sd?.sqft ?? 0,
      lotSqft: sd?.lot_sqft ?? 0,
      yearBuilt: sd?.year_built ?? 0,
      pool: sd?.pool ?? false,
      stories: sd?.stories ?? 1,
      // Sell-specific
      estimatedSalePrice: sd?.estimated_sale_price ?? 0,
      loanPayoff: sd?.loan_payoff ?? 0,
      propertyHighlights: sd?.property_highlights ?? [],
      upgrades: sd?.upgrades ?? [],
      // Market
      comps: sd?.comps ?? [],
      marketMetrics: isNonEmptyObject(sd?.market_metrics) ? sd!.market_metrics as MarketMetrics : defaultMetrics,
      pricingStrategy: sd?.pricing_strategy ?? "",
      competition: sd?.competition ?? [],
      marketSnapshot: sd?.market_snapshot ?? [],
      // Listing plan
      prepItems: sd?.prep_items ?? [],
      marketingPlan: sd?.marketing_plan ?? [],
      timeline: sd?.timeline ?? [],
      // Cromford
      cromfordMetrics: sd?.cromford_metrics ?? [],
      cromfordTakeaway: sd?.cromford_takeaway ?? "",
      cromfordSource: "",
      // Features
      features: sd?.features ?? [],
    };
    return config;
  }

  if (type === "buyer") {
    const bd = dashboard.buy_data;
    const config: BuyerDashboardConfig = {
      templateType: "buyer",
      clientNames: client_names,
      fullName: full_name ?? "",
      email: email ?? "",
      agentKey: agent_key,
      // Search criteria
      targetAreas: bd?.target_areas ?? "",
      budgetMin: bd?.budget_min ?? 0,
      budgetMax: bd?.budget_max ?? 0,
      bedsMin: bd?.beds_min ?? 0,
      bathsMin: bd?.baths_min ?? 0,
      mustHaves: bd?.must_haves ?? [],
      schoolPreference: bd?.school_preference ?? "",
      // Content
      neighborhoods: bd?.neighborhoods ?? [],
      schoolDistricts: bd?.school_districts ?? [],
      timeline: bd?.timeline ?? [],
      marketSnapshot: bd?.market_snapshot ?? [],
      propertiesOfInterest: mapPOI(properties ?? []),
      homeSearchUrl: bd?.home_search_url ?? "",
    };
    return config;
  }

  // buysell
  const sd = dashboard.sell_data;
  const bd = dashboard.buy_data;
  const config: BuySellDashboardConfig = {
    templateType: "buysell",
    clientNames: client_names,
    fullName: full_name ?? "",
    email: email ?? "",
    agentKey: agent_key,
    sellListingStatus: sd?.listing_status ?? "pre-listing",
    // Sell-side
    sellAddress: sd?.address ?? "",
    sellCityStateZip: sd?.city_state_zip ?? "",
    sellSubdivision: sd?.subdivision ?? "",
    sellCommunityName: sd?.community_name ?? "",
    sellBeds: sd?.beds ?? 0,
    sellBaths: sd?.baths ?? 0,
    sellSqft: sd?.sqft ?? 0,
    sellLotSqft: sd?.lot_sqft ?? 0,
    sellYearBuilt: sd?.year_built ?? 0,
    sellPool: sd?.pool ?? false,
    sellStories: sd?.stories ?? 1,
    estimatedSalePrice: sd?.estimated_sale_price ?? 0,
    loanPayoff: sd?.loan_payoff ?? 0,
    sellPropertyHighlights: sd?.property_highlights ?? [],
    sellComps: sd?.comps ?? [],
    sellMarketMetrics: isNonEmptyObject(sd?.market_metrics) ? sd!.market_metrics as MarketMetrics : defaultMetrics,
    sellPricingStrategy: sd?.pricing_strategy ?? "",
    sellCompetition: sd?.competition ?? [],
    // Buy-side
    targetAreas: bd?.target_areas ?? "",
    budgetMin: bd?.budget_min ?? 0,
    budgetMax: bd?.budget_max ?? 0,
    bedsMin: bd?.beds_min ?? 0,
    bathsMin: bd?.baths_min ?? 0,
    mustHaves: bd?.must_haves ?? [],
    schoolPreference: bd?.school_preference ?? "",
    neighborhoods: bd?.neighborhoods ?? [],
    schoolDistricts: bd?.school_districts ?? [],
    // Strategy
    strategyOptions: [],
    strategyTimeline: [],
    // Cromford
    cromfordMetrics: sd?.cromford_metrics ?? [],
    cromfordTakeaway: sd?.cromford_takeaway ?? "",
    cromfordSource: "",
    // Features
    features: sd?.features ?? [],
    propertiesOfInterest: mapPOI(properties ?? []),
    homeSearchUrl: bd?.home_search_url ?? "",
  };
  return config;
}

/**
 * Render a dashboard to HTML from its database record.
 * Chains: getDashboard -> getTemplateHtml -> buildConfigFromDashboard -> injectConfig
 */
export async function renderDashboardHtml(dashboardId: string): Promise<string> {
  const dashboard = await getDashboard(dashboardId);
  const template = getTemplateHtml(dashboard.type);

  // Fetch POI for buyer/buysell types (sell dashboards don't show POI)
  let properties: PropertyOfInterest[] | undefined;
  if (dashboard.type === "buyer" || dashboard.type === "buysell") {
    properties = await listPropertiesOfInterest(dashboard.id);
  }

  const config = buildConfigFromDashboard(dashboard, properties);
  return injectConfig(template, config);
}

/** Helper: check if a value is a non-empty object (not {} default from Supabase) */
function isNonEmptyObject(val: unknown): boolean {
  return val != null && typeof val === "object" && Object.keys(val).length > 0;
}
