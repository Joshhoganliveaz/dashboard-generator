import type { CompSale, MarketMetrics, PrepItem, CromfordMetric, Feature, NeighborhoodCard, SchoolDistrict } from "@/lib/types";

// ---- Enums ----

export type DashboardType = "sell" | "buyer" | "buysell";
export type DashboardStatus = "draft" | "published" | "archived";

// ---- Table Types ----

export interface Dashboard {
  id: string;
  slug: string;
  type: DashboardType;
  status: DashboardStatus;
  client_names: string;
  full_name?: string | null;
  email?: string | null;
  agent_key: string;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  created_by?: string | null;
}

export interface SellData {
  id: string;
  dashboard_id: string;
  address?: string | null;
  city_state_zip?: string | null;
  subdivision?: string | null;
  community_name?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lot_sqft?: number | null;
  year_built?: number | null;
  pool?: boolean | null;
  stories?: number | null;
  estimated_sale_price?: number | null;
  listing_broker_pct?: number | null;
  loan_payoff?: number | null;
  loan_amount?: number | null;
  interest_rate?: number | null;
  refi_detected?: boolean | null;
  second_lien_amount?: number | null;
  loan_origination_history?: { date: string; amount: number; lender: string; financeType: string; assumedRate?: number }[] | null;
  comps: CompSale[];
  market_metrics: MarketMetrics | Record<string, never>;
  property_highlights: string[];
  pricing_strategy?: string | null;
  competition_link?: string | null;
  market_snapshot: { label: string; value: string }[];
  prep_items: PrepItem[];
  marketing_plan: string[];
  timeline: { phase: string; dates: string; items: string[] }[];
  features: Feature[];
  upgrades: { name: string; value: string }[];
  cromford_metrics: CromfordMetric[];
  cromford_takeaway?: string | null;
  listing_status?: "pre-listing" | "active" | "pending" | "closed" | null;
  created_at: string;
  updated_at: string;
}

export interface BuyData {
  id: string;
  dashboard_id: string;
  target_areas?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  beds_min?: number | null;
  baths_min?: number | null;
  must_haves: string[];
  school_preference?: string | null;
  neighborhoods: NeighborhoodCard[];
  school_districts: SchoolDistrict[];
  timeline: { phase: string; title: string; items: string[] }[];
  market_snapshot: { label: string; value: string }[];
  home_search_url?: string | null;
  competition_link?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyOfInterest {
  id: string;
  dashboard_id: string;
  address: string;
  price?: number | null;
  listing_url?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  sort_order: number;
  created_at: string;
}

// ---- Composite Types ----

export interface DashboardWithData extends Dashboard {
  sell_data?: SellData | null;
  buy_data?: BuyData | null;
}
