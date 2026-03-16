import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase client mock ----
// vi.mock is hoisted, so we use vi.hoisted to create mock functions
// that are available at mock definition time.

const {
  mockSingle,
  mockMaybeSingle,
  mockOrder,
  mockEq,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockUpsert,
  mockFrom,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockOrder = vi.fn().mockReturnValue({ data: [], error: null });
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle });
  const mockSelect = vi.fn().mockReturnValue({ order: mockOrder, eq: mockEq });
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: mockSingle }),
  });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  const mockUpsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: mockSingle }),
  });
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    upsert: mockUpsert,
  });

  return { mockSingle, mockMaybeSingle, mockOrder, mockEq, mockSelect, mockInsert, mockUpdate, mockUpsert, mockFrom };
});

// Mock the server module's createClient
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

import {
  createDashboard,
  getDashboard,
  listDashboards,
  updateDashboard,
  upsertSellData,
  upsertBuyData,
} from "@/lib/supabase/db";

describe("Supabase DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup chained returns after clear
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      upsert: mockUpsert,
    });
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq });
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockSingle }),
    });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockSingle }),
    });
    mockEq.mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle });
    mockOrder.mockReturnValue({ data: [], error: null });
  });

  describe("createDashboard", () => {
    it("calls insert on dashboards table with status draft", async () => {
      const dashboard = {
        id: "abc-123",
        slug: "smith-family",
        type: "sell" as const,
        status: "draft" as const,
        client_names: "Smith Family",
        agent_key: "josh_jacqui",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockSingle.mockResolvedValueOnce({ data: dashboard, error: null });

      const result = await createDashboard({
        type: "sell",
        client_names: "Smith Family",
        slug: "smith-family",
      });

      expect(mockFrom).toHaveBeenCalledWith("dashboards");
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall).toMatchObject({
        type: "sell",
        client_names: "Smith Family",
        slug: "smith-family",
        status: "draft",
      });
      expect(result).toEqual(dashboard);
    });

    it("includes client_names, type, slug, and agent_key", async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: "x" }, error: null });

      await createDashboard({
        type: "buyer",
        client_names: "Jones Family",
        slug: "jones-family",
        agent_key: "custom_agent",
      });

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.client_names).toBe("Jones Family");
      expect(insertCall.type).toBe("buyer");
      expect(insertCall.slug).toBe("jones-family");
      expect(insertCall.agent_key).toBe("custom_agent");
    });

    it("throws on error", async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "duplicate slug" },
      });

      await expect(
        createDashboard({ type: "sell", client_names: "Test", slug: "dup" })
      ).rejects.toThrow("duplicate slug");
    });
  });

  describe("getDashboard", () => {
    it("calls select with eq filter on id", async () => {
      const dashboard = { id: "abc-123", slug: "test" };
      mockSingle.mockResolvedValueOnce({ data: dashboard, error: null });

      const result = await getDashboard("abc-123");

      expect(mockFrom).toHaveBeenCalledWith("dashboards");
      expect(mockSelect).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "abc-123");
      expect(result).toEqual(dashboard);
    });

    it("throws on error", async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "not found" },
      });

      await expect(getDashboard("bad-id")).rejects.toThrow("not found");
    });
  });

  describe("listDashboards", () => {
    it("calls select with order by updated_at desc", async () => {
      const dashboards = [{ id: "1" }, { id: "2" }];
      mockOrder.mockReturnValueOnce({ data: dashboards, error: null });

      const result = await listDashboards();

      expect(mockFrom).toHaveBeenCalledWith("dashboards");
      expect(mockSelect).toHaveBeenCalled();
      expect(mockOrder).toHaveBeenCalledWith("updated_at", { ascending: false });
      expect(result).toEqual(dashboards);
    });
  });

  describe("upsertSellData", () => {
    it("inserts into sell_data when row does not exist", async () => {
      // maybeSingle returns null (row doesn't exist)
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // insert().select().single() returns new row
      mockSingle.mockResolvedValueOnce({ data: { id: "sd-1" }, error: null });

      await upsertSellData("dash-1", { address: "123 Main St" });

      expect(mockFrom).toHaveBeenCalledWith("sell_data");
      expect(mockInsert).toHaveBeenCalledWith({ dashboard_id: "dash-1", address: "123 Main St" });
    });
  });

  describe("upsertBuyData", () => {
    it("inserts into buy_data when row does not exist", async () => {
      // maybeSingle returns null (row doesn't exist)
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // insert().select().single() returns new row
      mockSingle.mockResolvedValueOnce({ data: { id: "bd-1" }, error: null });

      await upsertBuyData("dash-1", { target_areas: "Scottsdale" });

      expect(mockFrom).toHaveBeenCalledWith("buy_data");
      expect(mockInsert).toHaveBeenCalledWith({ dashboard_id: "dash-1", target_areas: "Scottsdale" });
    });
  });

  describe("updateDashboard", () => {
    it("calls update with eq filter on id", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: "abc", status: "published" },
        error: null,
      });

      await updateDashboard("abc", { status: "published" });

      expect(mockFrom).toHaveBeenCalledWith("dashboards");
      expect(mockUpdate).toHaveBeenCalledWith({ status: "published" });
      expect(mockEq).toHaveBeenCalledWith("id", "abc");
    });
  });
});
