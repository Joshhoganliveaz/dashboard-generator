import { describe, it, expect, vi } from "vitest";

// Mock the @supabase/ssr module
const mockCreateBrowserClient = vi.fn(() => ({
  auth: {
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => mockCreateBrowserClient(...args),
}));

describe("Supabase browser client", () => {
  it("createBrowserClient receives correct env vars", async () => {
    // Set env vars for the test
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";

    const { createClient } = await import("@/lib/supabase/client");
    createClient();

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key"
    );
  });

  it("signInWithPassword is callable with email and password", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    await supabase.auth.signInWithPassword({
      email: "josh@liveazco.com",
      password: "securepassword",
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "josh@liveazco.com",
      password: "securepassword",
    });
  });
});
