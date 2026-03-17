import { describe, it, expect } from "vitest";
import type { Dashboard, DashboardType, DashboardStatus } from "@/lib/supabase/types";
import { sortDashboards } from "@/components/library/DashboardLibrary";

// Test the filter logic directly (same logic as DashboardLibrary component)
function filterDashboards(
  dashboards: Dashboard[],
  typeFilter: DashboardType | null,
  statusFilter: DashboardStatus | null
): Dashboard[] {
  return dashboards.filter((d) => {
    if (typeFilter && d.type !== typeFilter) return false;
    if (statusFilter && d.status !== statusFilter) return false;
    return true;
  });
}

function makeDashboard(
  overrides: Partial<Dashboard> & { type: DashboardType; status: DashboardStatus; client_names: string }
): Dashboard {
  return {
    id: crypto.randomUUID(),
    slug: "test-slug",
    agent_key: "josh",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

const testDashboards: Dashboard[] = [
  makeDashboard({ client_names: "John Smith", type: "sell", status: "draft", slug: "john-smith-123-main", updated_at: "2026-03-10T00:00:00Z" }),
  makeDashboard({ client_names: "Jane Doe", type: "buyer", status: "published", slug: "jane-doe-buyer", updated_at: "2026-03-15T00:00:00Z" }),
  makeDashboard({ client_names: "Bob Wilson", type: "buysell", status: "draft", slug: "bob-wilson-456-oak", updated_at: "2026-03-12T00:00:00Z" }),
  makeDashboard({ client_names: "Alice Brown", type: "sell", status: "archived", slug: "alice-brown-789-elm", updated_at: "2026-03-01T00:00:00Z" }),
  makeDashboard({ client_names: "Charlie Davis", type: "buyer", status: "draft", slug: "charlie-davis-buyer", updated_at: "2026-03-14T00:00:00Z" }),
];

describe("DashboardLibrary filter logic", () => {
  it("shows all dashboards when no filters applied", () => {
    const result = filterDashboards(testDashboards, null, null);
    expect(result).toHaveLength(5);
  });

  it("filters by type=sell", () => {
    const result = filterDashboards(testDashboards, "sell", null);
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.type === "sell")).toBe(true);
  });

  it("filters by type=buyer", () => {
    const result = filterDashboards(testDashboards, "buyer", null);
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.type === "buyer")).toBe(true);
  });

  it("filters by type=buysell", () => {
    const result = filterDashboards(testDashboards, "buysell", null);
    expect(result).toHaveLength(1);
    expect(result[0].client_names).toBe("Bob Wilson");
  });

  it("filters by status=draft", () => {
    const result = filterDashboards(testDashboards, null, "draft");
    expect(result).toHaveLength(3);
    expect(result.every((d) => d.status === "draft")).toBe(true);
  });

  it("filters by status=published", () => {
    const result = filterDashboards(testDashboards, null, "published");
    expect(result).toHaveLength(1);
    expect(result[0].client_names).toBe("Jane Doe");
  });

  it("filters by status=archived", () => {
    const result = filterDashboards(testDashboards, null, "archived");
    expect(result).toHaveLength(1);
    expect(result[0].client_names).toBe("Alice Brown");
  });

  it("combines type and status filters", () => {
    const result = filterDashboards(testDashboards, "sell", "draft");
    expect(result).toHaveLength(1);
    expect(result[0].client_names).toBe("John Smith");
  });

  it("returns empty array when no matches", () => {
    const result = filterDashboards(testDashboards, "buysell", "published");
    expect(result).toHaveLength(0);
  });
});

describe("DashboardLibrary sort logic", () => {
  it("sorts by client_names ascending", () => {
    const result = sortDashboards(testDashboards, "client_names", "asc");
    expect(result.map((d) => d.client_names)).toEqual([
      "Alice Brown",
      "Bob Wilson",
      "Charlie Davis",
      "Jane Doe",
      "John Smith",
    ]);
  });

  it("sorts by client_names descending", () => {
    const result = sortDashboards(testDashboards, "client_names", "desc");
    expect(result.map((d) => d.client_names)).toEqual([
      "John Smith",
      "Jane Doe",
      "Charlie Davis",
      "Bob Wilson",
      "Alice Brown",
    ]);
  });

  it("sorts by updated_at ascending", () => {
    const result = sortDashboards(testDashboards, "updated_at", "asc");
    expect(result.map((d) => d.client_names)).toEqual([
      "Alice Brown",     // 2026-03-01
      "John Smith",      // 2026-03-10
      "Bob Wilson",      // 2026-03-12
      "Charlie Davis",   // 2026-03-14
      "Jane Doe",        // 2026-03-15
    ]);
  });

  it("sorts by updated_at descending", () => {
    const result = sortDashboards(testDashboards, "updated_at", "desc");
    expect(result.map((d) => d.client_names)).toEqual([
      "Jane Doe",        // 2026-03-15
      "Charlie Davis",   // 2026-03-14
      "Bob Wilson",      // 2026-03-12
      "John Smith",      // 2026-03-10
      "Alice Brown",     // 2026-03-01
    ]);
  });

  it("sorts by type ascending", () => {
    const result = sortDashboards(testDashboards, "type", "asc");
    // buyer, buyer, buysell, sell, sell
    expect(result.map((d) => d.type)).toEqual(["buyer", "buyer", "buysell", "sell", "sell"]);
  });

  it("sort + filter work together", () => {
    const filtered = filterDashboards(testDashboards, "sell", null);
    const sorted = sortDashboards(filtered, "client_names", "asc");
    expect(sorted).toHaveLength(2);
    expect(sorted[0].client_names).toBe("Alice Brown");
    expect(sorted[1].client_names).toBe("John Smith");
  });
});

describe("Dashboard data shape", () => {
  it("dashboard has required display fields", () => {
    const d = testDashboards[0];
    expect(d.client_names).toBeTruthy();
    expect(d.type).toBe("sell");
    expect(d.status).toBe("draft");
    expect(d.slug).toBeTruthy();
    expect(d.updated_at).toBeTruthy();
    expect(d.id).toBeTruthy();
  });

  it("type values are valid DashboardType", () => {
    const validTypes: DashboardType[] = ["sell", "buyer", "buysell"];
    testDashboards.forEach((d) => {
      expect(validTypes).toContain(d.type);
    });
  });

  it("status values are valid DashboardStatus", () => {
    const validStatuses: DashboardStatus[] = ["draft", "published", "archived"];
    testDashboards.forEach((d) => {
      expect(validStatuses).toContain(d.status);
    });
  });
});
