import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DashboardWithData, SellData, BuyData } from "../supabase/types";
import type { MarketMetrics, CompSale } from "../types";
import { SellDashboardConfigSchema } from "../schemas/dashboard";

// Mock dependencies
vi.mock("../supabase/db", () => ({
  getDashboard: vi.fn(),
}));

vi.mock("../template-loader", () => ({
  getTemplateHtml: vi.fn(),
}));

vi.mock("../template-engine", () => ({
  injectConfig: vi.fn(),
}));

import { getDashboard } from "../supabase/db";
import { getTemplateHtml } from "../template-loader";
import { injectConfig } from "../template-engine";
import { buildConfigFromDashboard, renderDashboardHtml } from "../publish";

const mockGetDashboard = vi.mocked(getDashboard);
const mockGetTemplateHtml = vi.mocked(getTemplateHtml);
const mockInjectConfig = vi.mocked(injectConfig);

const baseDashboard: Dashboard = {
  id: "abc-123",
  slug: "smith-family",
  type: "sell",
  status: "draft",
  client_names: "Smith Family",
  full_name: "John Smith",
  email: "john@example.com",
  agent_key: "josh_jacqui",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  published_at: null,
  created_by: null,
};

type Dashboard = DashboardWithData;

const sampleMetrics: MarketMetrics = {
  medianSoldPrice: 500000,
  medianPpsf: 250,
  avgPpsf: 245,
  ppsfRange: { low: 200, high: 300 },
  derivedValue: 525000,
  derivedRange: { low: 500000, high: 550000 },
  compsUsedForValue: 5,
  avgDom: 30,
  medianDom: 25,
  saleToListRatio: 0.98,
  priceTrendDirection: "stable",
  priceTrendDetail: "Prices steady over 6 months",
  totalSalesInPeriod: 45,
  subdivisionSalesCount: 12,
  earliestSale: "2025-06-01",
  latestSale: "2025-12-01",
  analysisPeriodMonths: 6,
};

const sampleComp: CompSale = {
  addr: "123 Main St",
  sub: "Sunset Hills",
  community: "Mesa",
  close: "2025-11-01",
  sp: 510000,
  sf: 2100,
  ppsf: 242.86,
  beds: "4",
  baths: "2.5",
  pool: "Yes",
  dom: "15",
  yearBuilt: 2005,
  stories: 1,
  matchScore: 85,
  note: "Similar size and condition",
};

const sellData: SellData = {
  id: "sell-1",
  dashboard_id: "abc-123",
  address: "456 Oak Ave",
  city_state_zip: "Mesa, AZ 85201",
  subdivision: "Sunset Hills",
  community_name: "Mesa",
  beds: 4,
  baths: 2.5,
  sqft: 2200,
  lot_sqft: 7500,
  year_built: 2003,
  pool: true,
  stories: 1,
  estimated_sale_price: 525000,
  loan_payoff: 200000,
  comps: [sampleComp],
  market_metrics: sampleMetrics,
  property_highlights: ["Updated kitchen", "Pool"],
  pricing_strategy: "Price at market value",
  competition: [
    { address: "789 Pine St", price: 530000, status: "Active", dom: 10, beds: "4", baths: "2", sqft: 2100, pool: "Yes", note: "Similar comp" },
  ],
  market_snapshot: [{ label: "Median Price", value: "$500,000" }],
  prep_items: [{ key: "paint", label: "Interior Paint", defaultCost: 2500, desc: "Fresh neutral colors" }],
  marketing_plan: ["Professional photos", "3D tour"],
  timeline: [{ phase: "Week 1", dates: "Jan 1-7", items: ["Photography", "Staging"] }],
  features: [{ title: "Kitchen", desc: "Granite counters, stainless appliances" }],
  upgrades: [{ name: "Kitchen Remodel", value: "$15,000" }],
  cromford_metrics: [{ label: "CMI", value: "120", arrow: "up", color: "green", ctx: "Seller's market" }],
  cromford_takeaway: "Strong seller's market",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

describe("publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildConfigFromDashboard", () => {
    it("maps sell dashboard data to CONFIG shape", () => {
      const dashboard: DashboardWithData = {
        ...baseDashboard,
        type: "sell",
        sell_data: sellData,
        buy_data: null,
      };

      const config = buildConfigFromDashboard(dashboard);

      // Check client fields
      expect(config.templateType).toBe("sell");
      expect(config.clientNames).toBe("Smith Family");
      expect(config.fullName).toBe("John Smith");
      expect(config.email).toBe("john@example.com");
      expect(config.agentKey).toBe("josh_jacqui");

      // Check property fields (sell config uses address, beds, etc.)
      expect((config as any).address).toBe("456 Oak Ave");
      expect((config as any).beds).toBe(4);
      expect((config as any).baths).toBe(2.5);
      expect((config as any).sqft).toBe(2200);

      // Check sell-specific fields
      expect((config as any).estimatedSalePrice).toBe(525000);
      expect((config as any).comps).toEqual([sampleComp]);
      expect((config as any).marketMetrics).toEqual(sampleMetrics);
    });

    it("sell config defaults listingStatus to pre-listing when null", () => {
      const dashboard: DashboardWithData = {
        ...baseDashboard,
        type: "sell",
        sell_data: { ...sellData, listing_status: null },
        buy_data: null,
      };

      const config = buildConfigFromDashboard(dashboard);
      expect((config as any).listingStatus).toBe("pre-listing");
    });

    it("sell config defaults listingStatus to pre-listing when undefined", () => {
      const noStatus = { ...sellData };
      delete (noStatus as any).listing_status;
      const dashboard: DashboardWithData = {
        ...baseDashboard,
        type: "sell",
        sell_data: noStatus,
        buy_data: null,
      };

      const config = buildConfigFromDashboard(dashboard);
      expect((config as any).listingStatus).toBe("pre-listing");
    });

    it("sell config maps listing_status correctly", () => {
      const dashboard: DashboardWithData = {
        ...baseDashboard,
        type: "sell",
        sell_data: { ...sellData, listing_status: "active" },
        buy_data: null,
      };

      const config = buildConfigFromDashboard(dashboard);
      expect((config as any).listingStatus).toBe("active");
    });

    it("buysell config includes sellListingStatus", () => {
      const buyData: BuyData = {
        id: "buy-1",
        dashboard_id: "abc-123",
        target_areas: "Mesa",
        budget_min: 400000,
        budget_max: 600000,
        beds_min: 3,
        baths_min: 2,
        must_haves: [],
        school_preference: "",
        neighborhoods: [],
        school_districts: [],
        timeline: [],
        market_snapshot: [],
        home_search_url: "",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      };

      const dashboard: DashboardWithData = {
        ...baseDashboard,
        type: "buysell",
        sell_data: { ...sellData, listing_status: null },
        buy_data: buyData,
      };

      const config = buildConfigFromDashboard(dashboard);
      expect(config.templateType).toBe("buysell");
      expect((config as any).sellListingStatus).toBe("pre-listing");
    });

    it("maps buyer dashboard data to CONFIG shape", () => {
      const buyData: BuyData = {
        id: "buy-1",
        dashboard_id: "abc-123",
        target_areas: "Mesa, Gilbert",
        budget_min: 400000,
        budget_max: 600000,
        beds_min: 3,
        baths_min: 2,
        must_haves: ["Pool", "Garage"],
        school_preference: "Gilbert Public Schools",
        neighborhoods: [],
        school_districts: [],
        timeline: [{ phase: "Month 1", title: "Pre-Approval", items: ["Get pre-approved"] }],
        market_snapshot: [{ label: "Median Price", value: "$450,000" }],
        home_search_url: "https://search.example.com",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      };

      const dashboard: DashboardWithData = {
        ...baseDashboard,
        type: "buyer",
        sell_data: null,
        buy_data: buyData,
      };

      const config = buildConfigFromDashboard(dashboard);

      expect(config.templateType).toBe("buyer");
      expect(config.clientNames).toBe("Smith Family");
      expect((config as any).targetAreas).toBe("Mesa, Gilbert");
      expect((config as any).budgetMin).toBe(400000);
      expect((config as any).budgetMax).toBe(600000);
      expect((config as any).mustHaves).toEqual(["Pool", "Garage"]);
    });
  });

  describe("SellDashboardConfigSchema listingStatus validation", () => {
    it("accepts valid listingStatus values", () => {
      const validStatuses = ["pre-listing", "active", "pending", "closed"];
      for (const status of validStatuses) {
        const result = SellDashboardConfigSchema.shape.listingStatus.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid listingStatus values", () => {
      const result = SellDashboardConfigSchema.shape.listingStatus.safeParse("unknown");
      expect(result.success).toBe(false);
    });
  });

  describe("renderDashboardHtml", () => {
    it("chains getDashboard, getTemplateHtml, and injectConfig", async () => {
      const dashboard: DashboardWithData = {
        ...baseDashboard,
        type: "sell",
        sell_data: sellData,
        buy_data: null,
      };

      mockGetDashboard.mockResolvedValue(dashboard);
      mockGetTemplateHtml.mockReturnValue("<html><!-- template --></html>");
      mockInjectConfig.mockReturnValue("<html><!-- injected --></html>");

      const result = await renderDashboardHtml("abc-123");

      expect(mockGetDashboard).toHaveBeenCalledWith("abc-123");
      expect(mockGetTemplateHtml).toHaveBeenCalledWith("sell");
      expect(mockInjectConfig).toHaveBeenCalledOnce();
      expect(result).toBe("<html><!-- injected --></html>");
    });

    it("uses correct template type for buyer dashboards", async () => {
      const dashboard: DashboardWithData = {
        ...baseDashboard,
        type: "buyer",
        sell_data: null,
        buy_data: null,
      };

      mockGetDashboard.mockResolvedValue(dashboard);
      mockGetTemplateHtml.mockReturnValue("<html></html>");
      mockInjectConfig.mockReturnValue("<html></html>");

      await renderDashboardHtml("abc-123");

      expect(mockGetTemplateHtml).toHaveBeenCalledWith("buyer");
    });
  });
});
