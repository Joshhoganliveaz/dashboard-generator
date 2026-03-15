import { describe, it, expect } from "vitest";
import type { Dashboard, DashboardType, DashboardStatus } from "@/lib/supabase/types";

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
    id: overrides.id || crypto.randomUUID(),
    slug: overrides.slug || "test-slug",
    type: overrides.type,
    status: overrides.status,
    client_names: overrides.client_names,
    agent_key: overrides.agent_key || "josh",
    created_at: overrides.created_at || "2026-01-01T00:00:00Z",
    updated_at: overrides.updated_at || "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

const testDashboards: Dashboard[] = [
  makeDashboard({ client_names: "John Smith", type: "sell", status: "draft", slug: "john-smith-123-main" }),
  makeDashboard({ client_names: "Jane Doe", type: "buyer", status: "published", slug: "jane-doe-buyer" }),
  makeDashboard({ client_names: "Bob Wilson", type: "buysell", status: "draft", slug: "bob-wilson-456-oak" }),
  makeDashboard({ client_names: "Alice Brown", type: "sell", status: "archived", slug: "alice-brown-789-elm" }),
  makeDashboard({ client_names: "Charlie Davis", type: "buyer", status: "draft", slug: "charlie-davis-buyer" }),
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

describe("DashboardCard data", () => {
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
