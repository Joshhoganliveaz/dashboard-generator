import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the Supabase middleware client
const mockGetClaims = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({
  createClient: (request: NextRequest) => {
    mockCreateClient(request);
    return {
      supabase: {
        auth: {
          getClaims: mockGetClaims,
        },
      },
      response: {
        status: 200,
        headers: new Headers(),
      },
    };
  },
}));

// Must import middleware AFTER setting up the mock
const { middleware } = await import("@/middleware");

function createRequest(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}

describe("Auth Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated requests to /login", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { message: "No session" } });

    const response = await middleware(createRequest("/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("allows authenticated requests through", async () => {
    mockGetClaims.mockResolvedValue({ data: { sub: "user-123" }, error: null });

    const response = await middleware(createRequest("/"));
    expect(response.status).toBe(200);
  });

  it("allows /login without auth", async () => {
    const response = await middleware(createRequest("/login"));
    // Should not call getClaims for public routes
    expect(mockGetClaims).not.toHaveBeenCalled();
  });

  it("allows /_next paths without auth", async () => {
    const response = await middleware(createRequest("/_next/static/chunk.js"));
    expect(mockGetClaims).not.toHaveBeenCalled();
  });

  it("allows /d/ (published dashboards) without auth", async () => {
    const response = await middleware(createRequest("/d/some-slug"));
    expect(mockGetClaims).not.toHaveBeenCalled();
  });

  it("allows .html files without auth", async () => {
    const response = await middleware(createRequest("/dashboard.html"));
    expect(mockGetClaims).not.toHaveBeenCalled();
  });

  it("allows /favicon paths without auth", async () => {
    const response = await middleware(createRequest("/favicon.ico"));
    expect(mockGetClaims).not.toHaveBeenCalled();
  });
});
