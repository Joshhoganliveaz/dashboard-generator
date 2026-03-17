import { z } from "zod";

// --- Shared sub-schemas ---

const CompSaleSchema = z.object({
  addr: z.string(),
  sub: z.string(),
  community: z.string(),
  close: z.string(),
  sp: z.number(),
  sf: z.number(),
  ppsf: z.number(),
  beds: z.string(),
  baths: z.string(),
  pool: z.string(),
  dom: z.string(),
  yearBuilt: z.number(),
  stories: z.number(),
  matchScore: z.number(),
  note: z.string(),
  url: z.string().optional(),
});

const MarketMetricsSchema = z.object({
  medianSoldPrice: z.number(),
  medianPpsf: z.number(),
  avgPpsf: z.number(),
  ppsfRange: z.object({ low: z.number(), high: z.number() }),
  derivedValue: z.number(),
  derivedRange: z.object({ low: z.number(), high: z.number() }),
  compsUsedForValue: z.number(),
  avgDom: z.number(),
  medianDom: z.number(),
  saleToListRatio: z.number(),
  priceTrendDirection: z.enum(["rising", "stable", "declining"]),
  priceTrendDetail: z.string(),
  totalSalesInPeriod: z.number(),
  subdivisionSalesCount: z.number(),
  earliestSale: z.string(),
  latestSale: z.string(),
  analysisPeriodMonths: z.number(),
});

const CromfordMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  arrow: z.string(),
  color: z.string(),
  ctx: z.string(),
});

const FeatureSchema = z.object({
  title: z.string(),
  desc: z.string(),
});

const PrepItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  defaultCost: z.number(),
  desc: z.string(),
});

const MarketSnapshotItemSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const TimelinePhaseSchema = z.object({
  phase: z.string(),
  dates: z.string(),
  items: z.array(z.string()),
});

// --- Sell Dashboard ---

export const SellDashboardConfigSchema = z.object({
  templateType: z.literal("sell"),
  // Client
  clientNames: z.string(),
  fullName: z.string(),
  email: z.string(),
  address: z.string(),
  cityStateZip: z.string(),
  subdivision: z.string(),
  communityName: z.string(),
  agentKey: z.string(),
  // Listing status
  listingStatus: z.enum(["pre-listing", "active", "pending", "closed"]),
  // Property
  beds: z.number(),
  baths: z.number(),
  sqft: z.number(),
  lotSqft: z.number(),
  yearBuilt: z.number(),
  pool: z.boolean(),
  stories: z.number(),
  // Sell-specific
  estimatedSalePrice: z.number(),
  loanPayoff: z.number(),
  propertyHighlights: z.array(z.string()),
  upgrades: z.array(z.object({ name: z.string(), value: z.string() })),
  // Market
  comps: z.array(CompSaleSchema),
  marketMetrics: MarketMetricsSchema,
  pricingStrategy: z.string(),
  competitionLink: z.string().optional(),
  marketSnapshot: z.array(MarketSnapshotItemSchema),
  // Listing plan
  prepItems: z.array(PrepItemSchema),
  marketingPlan: z.array(z.string()),
  timeline: z.array(TimelinePhaseSchema),
  // Cromford
  cromfordMetrics: z.array(CromfordMetricSchema),
  cromfordTakeaway: z.string(),
  cromfordSource: z.string(),
  // Features
  features: z.array(FeatureSchema),
  // Links
  referenceLinks: z.array(z.object({ url: z.string(), label: z.string().optional() })).optional(),
});

export type SellDashboardConfig = z.infer<typeof SellDashboardConfigSchema>;

// --- Property of Interest Config ---

const PropertyOfInterestConfigSchema = z.object({
  address: z.string(),
  price: z.number().optional(),
  listingUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
});

// --- Buyer Dashboard ---

const NeighborhoodCardSchema = z.object({
  name: z.string(),
  badge: z.string(),
  badgeColor: z.string(),
  priceRange: z.string(),
  homeSize: z.string(),
  commuteTime: z.string(),
  description: z.string(),
  whyItWorks: z.string(),
});

const SchoolInfoSchema = z.object({
  name: z.string(),
  badge: z.string(),
  type: z.string(),
  grades: z.string(),
  rating: z.string(),
  description: z.string(),
  url: z.string(),
});

const SchoolDistrictSchema = z.object({
  name: z.string(),
  description: z.string(),
  schools: z.array(SchoolInfoSchema),
});

const BuyerTimelinePhaseSchema = z.object({
  phase: z.string(),
  title: z.string(),
  items: z.array(z.string()),
});

export const BuyerDashboardConfigSchema = z.object({
  templateType: z.literal("buyer"),
  // Client
  clientNames: z.string(),
  fullName: z.string(),
  email: z.string(),
  agentKey: z.string(),
  // Search criteria
  targetAreas: z.string(),
  budgetMin: z.number(),
  budgetMax: z.number(),
  bedsMin: z.number(),
  bathsMin: z.number(),
  mustHaves: z.array(z.string()),
  schoolPreference: z.string(),
  // Content
  neighborhoods: z.array(NeighborhoodCardSchema),
  schoolDistricts: z.array(SchoolDistrictSchema),
  timeline: z.array(BuyerTimelinePhaseSchema),
  // Optional market context
  marketSnapshot: z.array(MarketSnapshotItemSchema),
  // Properties of interest
  propertiesOfInterest: z.array(PropertyOfInterestConfigSchema),
  // Links
  homeSearchUrl: z.string().optional(),
  competitionLink: z.string().optional(),
});

export type BuyerDashboardConfig = z.infer<typeof BuyerDashboardConfigSchema>;

// --- BuySell Dashboard ---

const StrategyOptionSchema = z.object({
  label: z.string(),
  title: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
});

export const BuySellDashboardConfigSchema = z.object({
  templateType: z.literal("buysell"),
  // Client
  clientNames: z.string(),
  fullName: z.string(),
  email: z.string(),
  agentKey: z.string(),
  // Sell-side listing status
  sellListingStatus: z.enum(["pre-listing", "active", "pending", "closed"]),
  // Sell-side
  sellAddress: z.string(),
  sellCityStateZip: z.string(),
  sellSubdivision: z.string(),
  sellCommunityName: z.string(),
  sellBeds: z.number(),
  sellBaths: z.number(),
  sellSqft: z.number(),
  sellLotSqft: z.number(),
  sellYearBuilt: z.number(),
  sellPool: z.boolean(),
  sellStories: z.number(),
  estimatedSalePrice: z.number(),
  loanPayoff: z.number(),
  sellPropertyHighlights: z.array(z.string()),
  sellComps: z.array(CompSaleSchema),
  sellMarketMetrics: MarketMetricsSchema,
  sellPricingStrategy: z.string(),
  competitionLink: z.string().optional(),
  // Buy-side
  targetAreas: z.string(),
  budgetMin: z.number(),
  budgetMax: z.number(),
  bedsMin: z.number(),
  bathsMin: z.number(),
  mustHaves: z.array(z.string()),
  schoolPreference: z.string(),
  neighborhoods: z.array(NeighborhoodCardSchema),
  schoolDistricts: z.array(SchoolDistrictSchema),
  // Strategy
  strategyOptions: z.array(StrategyOptionSchema),
  strategyTimeline: z.array(BuyerTimelinePhaseSchema),
  // Cromford
  cromfordMetrics: z.array(CromfordMetricSchema),
  cromfordTakeaway: z.string(),
  cromfordSource: z.string(),
  // Features
  features: z.array(FeatureSchema),
  // Properties of interest
  propertiesOfInterest: z.array(PropertyOfInterestConfigSchema),
  // Links
  homeSearchUrl: z.string().optional(),
  sellReferenceLinks: z.array(z.object({ url: z.string(), label: z.string().optional() })).optional(),
});

export type BuySellDashboardConfig = z.infer<typeof BuySellDashboardConfigSchema>;

// --- Validation helper ---

type DashboardType = "sell" | "buyer" | "buysell";

const schemaMap = {
  sell: SellDashboardConfigSchema,
  buyer: BuyerDashboardConfigSchema,
  buysell: BuySellDashboardConfigSchema,
} as const;

/**
 * Validate a dashboard config against its Zod schema.
 * Returns the typed, validated result or throws with Zod error details.
 */
export function validateConfig(config: unknown, type: DashboardType) {
  const schema = schemaMap[type];
  const result = schema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid ${type} dashboard config: ${details}`);
  }

  return result.data;
}
