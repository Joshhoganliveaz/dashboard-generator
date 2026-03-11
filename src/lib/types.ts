export interface ClientDetails {
  folderName: string;
  clientNames: string;
  fullName: string;
  email: string;
  address: string;
  cityStateZip: string;
  subdivision: string;
  communityName: string;
  purchaseDate?: string;
  purchasePrice?: number;
  loanBalance?: number;
  agentKey: string;
}

export interface SubjectProperty {
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  pool: boolean;
  stories: number;
}

export interface CompSale {
  addr: string;
  sub: string;
  community: string;
  close: string;
  sp: number;
  sf: number;
  ppsf: number;
  beds: string;
  baths: string;
  pool: string;
  dom: string;
  yearBuilt: number;
  stories: number;
  matchScore: number;
  note: string;
}

export interface MarketMetrics {
  medianSoldPrice: number;
  medianPpsf: number;
  avgPpsf: number;
  ppsfRange: { low: number; high: number };
  derivedValue: number;
  derivedRange: { low: number; high: number };
  compsUsedForValue: number;
  avgDom: number;
  medianDom: number;
  saleToListRatio: number;
  priceTrendDirection: "rising" | "stable" | "declining";
  priceTrendDetail: string;
  totalSalesInPeriod: number;
  subdivisionSalesCount: number;
  earliestSale: string;
  latestSale: string;
  analysisPeriodMonths: number;
}

export interface TrendPeriod {
  period: string;
  sales: number;
  medianPrice: number;
  medianPpsf: number;
}

export interface NeighborhoodAnalysis {
  name: string;
  city: string;
  sourcePeriod: string;
  yoy: {
    recentCount: number;
    priorCount: number;
    countChgPct: number;
    recentMedianPrice: number;
    priorMedianPrice: number;
    medianPriceChgPct: number;
    recentMedianPpsf: number;
    priorMedianPpsf: number;
    medianPpsfChgPct: number;
  };
  trends: TrendPeriod[];
  pool: {
    poolCount: number;
    poolMedianPrice: number;
    poolMedianPpsf: number;
    noPoolCount: number;
    noPoolMedianPrice: number;
    noPoolMedianPpsf: number;
    premiumDollar: number;
  };
  sizeSegments: {
    label: string;
    count: number;
    medianPrice: number;
    medianPpsf: number;
    isSubjectTier: boolean;
  }[];
  narrative: string;
}

export interface BedroomAnalysis {
  hasEnoughData: boolean;
  subjectBeds: number;
  subjectPpsf: number;
  breakdown: {
    beds: number;
    count: number;
    avgPpsf: number;
    medianPpsf: number;
  }[];
  narrative: string;
}

export interface Feature {
  title: string;
  desc: string;
}

export interface CromfordMetric {
  label: string;
  value: string;
  arrow: string;
  color: string;
  ctx: string;
}

export interface Development {
  emoji: string;
  title: string;
  desc: string;
  source: string;
  url: string;
}

export interface Upgrade {
  name: string;
  emoji: string;
  cost: string;
  roi: string;
  desc: string;
}

// --- Sell Dashboard Types ---

export interface CompetitionListing {
  address: string;
  price: number;
  status: string;
  dom: number;
  beds: string;
  baths: string;
  sqft: number;
  pool: string;
  note: string;
}

export interface PrepItem {
  key: string;
  label: string;
  defaultCost: number;
  desc: string;
}

export interface SellDashboardConfig {
  templateType: "sell";
  // Client
  clientNames: string;
  fullName: string;
  email: string;
  address: string;
  cityStateZip: string;
  subdivision: string;
  communityName: string;
  agentKey: string;
  // Property
  beds: number;
  baths: number;
  sqft: number;
  lotSqft: number;
  yearBuilt: number;
  pool: boolean;
  stories: number;
  // Sell-specific
  estimatedSalePrice: number;
  loanPayoff: number;
  propertyHighlights: string[];
  upgrades: { name: string; value: string }[];
  // Market
  comps: CompSale[];
  marketMetrics: MarketMetrics;
  pricingStrategy: string;
  competition: CompetitionListing[];
  marketSnapshot: { label: string; value: string }[];
  // Listing plan
  prepItems: PrepItem[];
  marketingPlan: string[];
  timeline: { phase: string; dates: string; items: string[] }[];
  // Cromford
  cromfordMetrics: CromfordMetric[];
  cromfordTakeaway: string;
  cromfordSource: string;
  // Features from MLS
  features: Feature[];
}

// --- Buyer Dashboard Types ---

export interface NeighborhoodCard {
  name: string;
  badge: string;
  badgeColor: string;
  priceRange: string;
  homeSize: string;
  commuteTime: string;
  description: string;
  whyItWorks: string;
}

export interface SchoolInfo {
  name: string;
  badge: string;
  type: string;
  grades: string;
  rating: string;
  description: string;
  url: string;
}

export interface SchoolDistrict {
  name: string;
  description: string;
  schools: SchoolInfo[];
}

export interface BuyerDashboardConfig {
  templateType: "buyer";
  // Client
  clientNames: string;
  fullName: string;
  email: string;
  agentKey: string;
  // Search criteria
  targetAreas: string;
  budgetMin: number;
  budgetMax: number;
  bedsMin: number;
  bathsMin: number;
  mustHaves: string[];
  schoolPreference: string;
  // Content
  neighborhoods: NeighborhoodCard[];
  schoolDistricts: SchoolDistrict[];
  timeline: { phase: string; title: string; items: string[] }[];
  // Optional market context from CSV
  marketSnapshot: { label: string; value: string }[];
}

// --- Buy/Sell Dashboard Types ---

export interface BuySellDashboardConfig {
  templateType: "buysell";
  // Client
  clientNames: string;
  fullName: string;
  email: string;
  agentKey: string;
  // Sell-side (current home)
  sellAddress: string;
  sellCityStateZip: string;
  sellSubdivision: string;
  sellCommunityName: string;
  sellBeds: number;
  sellBaths: number;
  sellSqft: number;
  sellLotSqft: number;
  sellYearBuilt: number;
  sellPool: boolean;
  sellStories: number;
  estimatedSalePrice: number;
  loanPayoff: number;
  sellPropertyHighlights: string[];
  sellComps: CompSale[];
  sellMarketMetrics: MarketMetrics;
  sellPricingStrategy: string;
  sellCompetition: CompetitionListing[];
  // Buy-side
  targetAreas: string;
  budgetMin: number;
  budgetMax: number;
  bedsMin: number;
  bathsMin: number;
  mustHaves: string[];
  schoolPreference: string;
  neighborhoods: NeighborhoodCard[];
  schoolDistricts: SchoolDistrict[];
  // Strategy
  strategyOptions: { label: string; title: string; pros: string[]; cons: string[] }[];
  strategyTimeline: { phase: string; title: string; items: string[] }[];
  // Cromford
  cromfordMetrics: CromfordMetric[];
  cromfordTakeaway: string;
  cromfordSource: string;
  // Features from MLS
  features: Feature[];
}

// --- Houseversary Dashboard Types (existing) ---

export interface DashboardConfig {
  templateType?: "houseversary";
  clientNames: string;
  fullName: string;
  email: string;
  address: string;
  cityStateZip: string;
  subdivision: string;
  communityName: string;
  headerTitle: string;
  purchaseDate: string;
  purchasePrice: number;
  loanBalance: number;
  agentKey: string;

  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  pool: boolean;
  stories: number;

  comps: CompSale[];
  marketMetrics: MarketMetrics;
  neighborhood: NeighborhoodAnalysis;
  bedroomAnalysis: BedroomAnalysis;
  subjectAdvantages: string[];

  features: Feature[];
  cromfordMetrics: CromfordMetric[];
  cromfordTakeaway: string;
  cromfordSource: string;
  outlookNarrative: string[];
  upgrades: Upgrade[];
  developments: Development[];
  infrastructure: Development[];
  areaHighlights: Development[];
  resources: {
    seasonal: {
      spring: string;
      summer: string;
      fall: string;
      winter: string;
    };
    links: { label: string; url: string; desc: string }[];
  };
}

/**
 * Validate and fill missing fields in a DashboardConfig with safe defaults.
 */
export function validateDashboardConfig(config: Record<string, unknown>): DashboardConfig {
  const str = (key: string, fallback = "") => typeof config[key] === "string" ? config[key] as string : fallback;
  const num = (key: string, fallback = 0) => typeof config[key] === "number" && isFinite(config[key] as number) ? config[key] as number : fallback;
  const bool = (key: string, fallback = false) => typeof config[key] === "boolean" ? config[key] as boolean : fallback;
  const arr = <T>(key: string): T[] => Array.isArray(config[key]) ? config[key] as T[] : [];

  const defaultMetrics: MarketMetrics = {
    medianSoldPrice: 0, medianPpsf: 0, avgPpsf: 0,
    ppsfRange: { low: 0, high: 0 },
    derivedValue: 0, derivedRange: { low: 0, high: 0 },
    compsUsedForValue: 0, avgDom: 0, medianDom: 0,
    saleToListRatio: 0, priceTrendDirection: "stable",
    priceTrendDetail: "", totalSalesInPeriod: 0,
    subdivisionSalesCount: 0, earliestSale: "", latestSale: "",
    analysisPeriodMonths: 12,
  };

  const defaultNeighborhood: NeighborhoodAnalysis = {
    name: "", city: "", sourcePeriod: "",
    yoy: { recentCount: 0, priorCount: 0, countChgPct: 0, recentMedianPrice: 0, priorMedianPrice: 0, medianPriceChgPct: 0, recentMedianPpsf: 0, priorMedianPpsf: 0, medianPpsfChgPct: 0 },
    trends: [], pool: { poolCount: 0, poolMedianPrice: 0, poolMedianPpsf: 0, noPoolCount: 0, noPoolMedianPrice: 0, noPoolMedianPpsf: 0, premiumDollar: 0 },
    sizeSegments: [], narrative: "",
  };

  const defaultBedroom: BedroomAnalysis = {
    hasEnoughData: false, subjectBeds: 0, subjectPpsf: 0, breakdown: [], narrative: "",
  };

  const defaultResources = {
    seasonal: { spring: "", summer: "", fall: "", winter: "" },
    links: [] as { label: string; url: string; desc: string }[],
  };

  const mm = config.marketMetrics && typeof config.marketMetrics === "object"
    ? { ...defaultMetrics, ...(config.marketMetrics as Record<string, unknown>) } as MarketMetrics
    : defaultMetrics;

  // Validate priceTrendDirection enum
  if (!["rising", "stable", "declining"].includes(mm.priceTrendDirection)) {
    mm.priceTrendDirection = "stable";
  }

  const nh = config.neighborhood && typeof config.neighborhood === "object"
    ? { ...defaultNeighborhood, ...(config.neighborhood as Record<string, unknown>) } as NeighborhoodAnalysis
    : defaultNeighborhood;

  const ba = config.bedroomAnalysis && typeof config.bedroomAnalysis === "object"
    ? { ...defaultBedroom, ...(config.bedroomAnalysis as Record<string, unknown>) } as BedroomAnalysis
    : defaultBedroom;

  const resources = config.resources && typeof config.resources === "object"
    ? { ...defaultResources, ...(config.resources as Record<string, unknown>) } as typeof defaultResources
    : defaultResources;

  return {
    clientNames: str("clientNames"),
    fullName: str("fullName"),
    email: str("email"),
    address: str("address"),
    cityStateZip: str("cityStateZip"),
    subdivision: str("subdivision"),
    communityName: str("communityName"),
    headerTitle: str("headerTitle", "Your Home Dashboard"),
    purchaseDate: str("purchaseDate"),
    purchasePrice: num("purchasePrice"),
    loanBalance: num("loanBalance"),
    agentKey: str("agentKey", "josh_jacqui"),
    beds: num("beds"),
    baths: num("baths"),
    sqft: num("sqft"),
    yearBuilt: num("yearBuilt"),
    pool: bool("pool"),
    stories: num("stories", 1),
    comps: arr<CompSale>("comps"),
    marketMetrics: mm,
    neighborhood: nh,
    bedroomAnalysis: ba,
    subjectAdvantages: arr<string>("subjectAdvantages"),
    features: arr<Feature>("features"),
    cromfordMetrics: arr<CromfordMetric>("cromfordMetrics"),
    cromfordTakeaway: str("cromfordTakeaway"),
    cromfordSource: str("cromfordSource"),
    outlookNarrative: arr<string>("outlookNarrative"),
    upgrades: arr<Upgrade>("upgrades"),
    developments: arr<Development>("developments"),
    infrastructure: arr<Development>("infrastructure"),
    areaHighlights: arr<Development>("areaHighlights"),
    resources,
  };
}

export type GenerationStepName =
  | "parsing_csv"
  | "extracting_mls"
  | "reading_cromford"
  | "reading_tax_records"
  | "researching"
  | "generating_content"
  | "assembling"
  | "warning"
  | "complete"
  | "error";

export interface GenerationStep {
  step: GenerationStepName;
  message: string;
  progress: number;
}

/** Union type for all dashboard configs */
export type AnyDashboardConfig =
  | DashboardConfig
  | SellDashboardConfig
  | BuyerDashboardConfig
  | BuySellDashboardConfig;
