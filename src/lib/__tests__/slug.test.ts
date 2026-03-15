import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateSlug, findAvailableSlug } from "../slug";

// Use vi.hoisted so the mock factory can reference these
const { queryResults, mockSupabase, resetIndex } = vi.hoisted(() => {
  const queryResults: { slug: string }[][] = [];
  let queryCallIndex = 0;

  function createMockQuery(data: { slug: string }[] = []) {
    const result = { data, error: null };
    return {
      then: (resolve: (v: unknown) => void) => resolve(result),
      neq: vi.fn().mockReturnValue({
        then: (resolve: (v: unknown) => void) => resolve(result),
      }),
    };
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          const data = queryResults[queryCallIndex] || [];
          queryCallIndex++;
          return createMockQuery(data);
        }),
      }),
    }),
  };

  function resetIndex() {
    queryCallIndex = 0;
  }

  // Allow pushing to queryResults from tests
  return { queryResults, mockSupabase, resetIndex, createMockQuery };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

describe("generateSlug", () => {
  it("generates slug from client name and address", () => {
    expect(generateSlug("John Smith", "123 Main St")).toBe(
      "john-smith-123-main-st"
    );
  });

  it("strips special characters", () => {
    expect(generateSlug("O'Brien & Co")).toBe("obrien-co");
  });

  it("truncates to 80 chars max", () => {
    const longName = "A".repeat(50);
    const longAddress = "B".repeat(50);
    const slug = generateSlug(longName, longAddress);
    expect(slug.length).toBeLessThanOrEqual(80);
  });

  it("works with only clientNames (no address)", () => {
    expect(generateSlug("Jane Doe")).toBe("jane-doe");
  });

  it("produces only lowercase letters, numbers, and hyphens", () => {
    const slug = generateSlug("John & Jane O'Brien!!", "456 Oak Ave #2B");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("collapses multiple hyphens into one", () => {
    const slug = generateSlug("Test   User", "  123   Main  ");
    expect(slug).not.toContain("--");
  });

  it("trims leading and trailing hyphens", () => {
    const slug = generateSlug("  Test  ", "  Street  ");
    expect(slug).not.toMatch(/^-/);
    expect(slug).not.toMatch(/-$/);
  });
});

describe("findAvailableSlug", () => {
  beforeEach(() => {
    resetIndex();
    queryResults.length = 0;
    vi.clearAllMocks();

    // Re-setup mock chain
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          const idx = queryResults.length > 0 ? queryResults.shift() : [];
          const result = { data: idx, error: null };
          return {
            then: (resolve: (v: unknown) => void) => resolve(result),
            neq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(result),
            }),
          };
        }),
      }),
    });
  });

  it("returns base slug when no collision exists", async () => {
    queryResults.push([]);
    const result = await findAvailableSlug("john-smith");
    expect(result).toBe("john-smith");
  });

  it('returns "slug-2" when "slug" exists', async () => {
    queryResults.push([{ slug: "john-smith" }]);
    queryResults.push([]);
    const result = await findAvailableSlug("john-smith");
    expect(result).toBe("john-smith-2");
  });

  it('returns "slug-3" when "slug" and "slug-2" exist', async () => {
    queryResults.push([{ slug: "john-smith" }]);
    queryResults.push([{ slug: "john-smith-2" }]);
    queryResults.push([]);
    const result = await findAvailableSlug("john-smith");
    expect(result).toBe("john-smith-3");
  });

  it("passes excludeId to skip own slug in collision check", async () => {
    const neqSpy = vi.fn().mockReturnValue({
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null }),
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: neqSpy,
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: [], error: null }),
        }),
      }),
    });

    await findAvailableSlug("john-smith", "dashboard-123");
    expect(neqSpy).toHaveBeenCalledWith("id", "dashboard-123");
  });
});
