# Phase 1: Foundation - Research

**Researched:** 2026-03-15
**Domain:** Supabase Auth/DB + Claude API structured output + CSV engine hardening on Cloudflare Workers
**Confidence:** HIGH

## Summary

Phase 1 transforms the existing stateless dashboard generator into a persistent, authenticated platform. Three distinct workstreams converge: (1) Supabase Auth replaces the legacy SITE_PASSWORD cookie auth, (2) Supabase Postgres tables with RLS policies store all dashboard data, and (3) the generation engine is hardened with structured Claude API output, Papaparse-based CSV parsing, and deterministic scoring.

The highest-risk integration is Supabase SSR auth running on Cloudflare Workers via the @opennextjs/cloudflare adapter. The project already deploys to Cloudflare Workers with `nodejs_compat_v2` -- Supabase's HTTP-based client (PostgREST) is fully compatible with this environment since it uses `fetch()` rather than direct database connections. The `@supabase/ssr` package handles cookie-based session management and works with Next.js middleware for token refresh.

**Primary recommendation:** Install `@supabase/supabase-js` + `@supabase/ssr`, create browser/server client utilities, replace the cookie-based middleware with Supabase auth middleware, create 4 tables with RLS, and refactor `claude-api.ts` to use structured outputs with `output_config.format` (no beta header needed -- GA on Sonnet 4.5+).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Team member can log in with email and password via Supabase Auth | Supabase SSR + Next.js App Router pattern with `@supabase/ssr` createBrowserClient/createServerClient |
| AUTH-02 | Team member session persists across browser refresh | Cookie-based session via `@supabase/ssr` middleware token refresh |
| AUTH-03 | Unauthenticated users are redirected to login page | Supabase middleware pattern using `getClaims()` validation |
| AUTH-04 | Josh can provision new team accounts via Supabase dashboard | Built-in Supabase Auth dashboard -- no code needed, just document the process |
| AUTH-05 | Legacy cookie-based auth (SITE_PASSWORD) is fully removed | Remove `SITE_PASSWORD` env var, delete old `/api/login` route, update middleware |
| PERS-01 | Dashboard metadata stored in Supabase | `dashboards` table with slug, type, status, client names, agent, timestamps |
| PERS-02 | Sell dashboard data stored in Supabase | `sell_data` table with FK to dashboards, JSONB columns for comps/metrics/narratives |
| PERS-03 | Buyer dashboard data stored in Supabase | `buy_data` table with FK to dashboards, JSONB columns for neighborhoods/schools/criteria |
| PERS-04 | Buy/sell dashboards link both sell_data and buy_data | One dashboard record with both `sell_data` and `buy_data` rows via FK |
| PERS-05 | RLS policies allow team members to CRUD all tables | `auth.role() = 'authenticated'` policy for all operations |
| PERS-06 | RLS policies allow public SELECT on published dashboards | `anon` SELECT policy with `WHERE status = 'published'` condition |
| PERS-07 | Dashboard data saves immediately as draft when created | Insert on wizard step 1, upsert on subsequent steps |
| ENGN-01 | Claude API max_tokens increased to 16K+ | Change `maxTokens` default from 4096 to 16384 in `claude-api.ts` |
| ENGN-02 | Claude API uses structured output for extraction | Use `output_config.format` with JSON schema (GA, no beta header needed) |
| ENGN-03 | Claude API retry logic uses exponential backoff | Existing retry logic is close but needs improvement for 5xx and timeout errors |
| ENGN-04 | CSV parsing uses Papaparse instead of custom parser | Papaparse 5.5.3 already installed; replace hand-rolled `parseCSVLine()` and `trimCSVColumns()` |
| ENGN-05 | Comp scoring and metric calculation are fully deterministic | `computeMatchScore()` already deterministic; refactor `runFullAnalysis()` to not rely on Claude for scoring |
| ENGN-06 | Claude's role reduced to narrative generation + comp validation | Separate deterministic pipeline from Claude calls in csv-engine.ts |
| ENGN-07 | CONFIG validated against TypeScript types before template injection | `validateDashboardConfig()` exists; extend to cover SellDashboardConfig and BuyerDashboardConfig |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.49 | Supabase client for auth + DB | Official client, HTTP-based (no pg connections), works on edge/Workers |
| @supabase/ssr | ^0.6 | Cookie-based SSR auth for Next.js | Official SSR adapter, handles token refresh in middleware |
| papaparse | 5.5.3 | CSV parsing | Already installed; robust, handles edge cases (quoted fields, delimiters) |
| next | ^14.2 | App Router framework | Already in use, deployed via @opennextjs/cloudflare |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | ^0.39 | Official Anthropic SDK | For structured outputs with `output_config.format` and Zod integration |
| zod | ^3.23 | Schema validation | Define JSON schemas for Claude structured output + config validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @supabase/ssr | supabase-js only (client-side) | SSR package handles middleware token refresh -- essential for server components |
| @anthropic-ai/sdk | Raw fetch (current approach) | SDK provides `messages.parse()` with Zod + automatic structured output; raw fetch requires manual schema passing |
| zod | Manual JSON validation (current) | Zod provides type inference + runtime validation in one declaration; current `validateDashboardConfig()` is verbose and error-prone |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk zod
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # createBrowserClient wrapper
│   │   ├── server.ts          # createServerClient wrapper (for Server Components)
│   │   ├── middleware.ts      # Supabase auth middleware helper
│   │   └── types.ts           # Generated Supabase types (from supabase gen types)
│   ├── claude-api.ts          # Refactored: use @anthropic-ai/sdk with structured output
│   ├── csv-engine.ts          # Refactored: Papaparse parsing, deterministic scoring
│   ├── schemas/
│   │   ├── mls-extraction.ts  # Zod schema for MLS PDF extraction
│   │   └── dashboard.ts       # Zod schemas for dashboard config validation
│   └── types.ts               # Existing types (keep, augment with Supabase-generated types)
├── middleware.ts               # Replace cookie check with Supabase auth
└── app/
    ├── login/page.tsx          # Refactored: email+password via Supabase Auth
    ├── api/login/route.ts      # DELETE: replaced by Supabase Auth
    └── ...
```

### Pattern 1: Supabase Client Creation (Next.js App Router)

**What:** Three client utilities -- browser, server, and middleware -- each adapting cookie handling for their context.

**When to use:** Every Supabase interaction.

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can be called from Server Component -- swallow error
          }
        },
      },
    }
  );
}
```

```typescript
// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/d/") || // published dashboards
    pathname.endsWith(".html")
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getClaims() not getSession() for security
  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### Pattern 2: Supabase Database Schema with RLS

**What:** Four tables storing dashboard metadata and type-specific data, with RLS policies for team CRUD and public read on published dashboards.

```sql
-- dashboards table
CREATE TABLE dashboards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sell', 'buyer', 'buysell')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  client_names TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  agent_key TEXT NOT NULL DEFAULT 'josh_jacqui',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- sell_data table
CREATE TABLE sell_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE NOT NULL,
  address TEXT,
  city_state_zip TEXT,
  subdivision TEXT,
  community_name TEXT,
  beds INTEGER,
  baths NUMERIC,
  sqft INTEGER,
  lot_sqft INTEGER,
  year_built INTEGER,
  pool BOOLEAN DEFAULT false,
  stories INTEGER DEFAULT 1,
  estimated_sale_price NUMERIC,
  loan_payoff NUMERIC,
  comps JSONB DEFAULT '[]',
  market_metrics JSONB DEFAULT '{}',
  property_highlights JSONB DEFAULT '[]',
  pricing_strategy TEXT,
  competition JSONB DEFAULT '[]',
  market_snapshot JSONB DEFAULT '[]',
  prep_items JSONB DEFAULT '[]',
  marketing_plan JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  features JSONB DEFAULT '[]',
  upgrades JSONB DEFAULT '[]',
  cromford_metrics JSONB DEFAULT '[]',
  cromford_takeaway TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- buy_data table
CREATE TABLE buy_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE NOT NULL,
  target_areas TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  beds_min INTEGER,
  baths_min INTEGER,
  must_haves JSONB DEFAULT '[]',
  school_preference TEXT,
  neighborhoods JSONB DEFAULT '[]',
  school_districts JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  market_snapshot JSONB DEFAULT '[]',
  home_search_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- properties_of_interest table
CREATE TABLE properties_of_interest (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE NOT NULL,
  address TEXT NOT NULL,
  price NUMERIC,
  listing_url TEXT,
  photo_url TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sell_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE buy_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties_of_interest ENABLE ROW LEVEL SECURITY;

-- Team members (authenticated) can do everything
CREATE POLICY "Team CRUD" ON dashboards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team CRUD" ON sell_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team CRUD" ON buy_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team CRUD" ON properties_of_interest FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public can read published dashboards and their associated data
CREATE POLICY "Public read published" ON dashboards FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "Public read published sell_data" ON sell_data FOR SELECT TO anon
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE status = 'published'));

CREATE POLICY "Public read published buy_data" ON buy_data FOR SELECT TO anon
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE status = 'published'));

CREATE POLICY "Public read published properties" ON properties_of_interest FOR SELECT TO anon
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE status = 'published'));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dashboards_updated_at BEFORE UPDATE ON dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sell_data_updated_at BEFORE UPDATE ON sell_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER buy_data_updated_at BEFORE UPDATE ON buy_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Pattern 3: Claude Structured Output with Anthropic SDK

**What:** Use the official SDK with `output_config.format` for guaranteed JSON schema compliance.

```typescript
// src/lib/claude-api.ts (refactored)
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// MLS extraction schema
const MLSExtractionSchema = z.object({
  beds: z.number(),
  baths: z.number(),
  sqft: z.number(),
  yearBuilt: z.number(),
  pool: z.boolean(),
  stories: z.number(),
  lotSqft: z.number(),
  address: z.string(),
  subdivision: z.string(),
  features: z.array(z.object({ title: z.string(), desc: z.string() })),
});

export async function extractMLSData(pdfBase64: string) {
  const response = await client.messages.parse({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16384,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
        { type: "text", text: "Extract property data from this MLS listing PDF." },
      ],
    }],
    output_config: { format: zodOutputFormat(MLSExtractionSchema) },
  });

  return response.parsed_output;
}

// Generic call with retry
export async function callClaudeWithRetry<T extends z.ZodType>(
  messages: Anthropic.MessageParam[],
  schema: T,
  options: { system?: string; maxTokens?: number } = {}
): Promise<z.infer<T>> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(Math.pow(2, attempt) * 1000 + Math.random() * 500, 30000);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const response = await client.messages.parse({
        model: "claude-sonnet-4-20250514",
        max_tokens: options.maxTokens ?? 16384,
        system: options.system,
        messages,
        output_config: { format: zodOutputFormat(schema) },
      });
      return response.parsed_output;
    } catch (err) {
      lastError = err as Error;
      const status = (err as { status?: number }).status;
      // Retry on rate limit (429) and server errors (5xx)
      if (status === 429 || (status && status >= 500)) continue;
      throw err;
    }
  }
  throw lastError ?? new Error("Claude API call failed after retries");
}
```

### Pattern 4: Deterministic CSV Pipeline with Papaparse

**What:** Replace hand-rolled CSV parsing with Papaparse, keep scoring fully deterministic.

```typescript
import Papa from "papaparse";

interface ARMLSRow {
  "House Number": string;
  "Street Name": string;
  "Sold Price": string;
  "Approx SQFT": string;
  "# Bedrooms": string;
  "Total Bathrooms": string;
  "Year Built": string;
  "Exterior Stories": string;
  "Close of Escrow Date": string;
  "Days on Market": string;
  "Subdivision": string;
  "Private Pool Y/N": string;
  "Status": string;
  [key: string]: string;
}

function parseCSV(csvText: string): ARMLSRow[] {
  const result = Papa.parse<ARMLSRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep all values as strings for consistent handling
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    console.warn("CSV parse warnings:", result.errors.slice(0, 5));
  }

  // Filter to closed sales only
  return result.data.filter((row) => (row.Status ?? "").trim().toUpperCase() === "C");
}
```

### Anti-Patterns to Avoid
- **Using `getSession()` in server code:** Always use `getClaims()` for auth validation in middleware and server components -- `getSession()` does not revalidate the JWT.
- **Creating Supabase client at module level:** Server clients must be created per-request to access request-specific cookies. Only `createBrowserClient` is a singleton.
- **Storing large blobs in Supabase:** Comps arrays and metrics go in JSONB columns, not separate normalized tables. With 20-50 dashboards, JSONB is simpler and fast enough.
- **Mixing Claude and deterministic logic:** Keep scoring/metrics 100% deterministic in TypeScript. Claude generates narratives and validates -- never calculates scores.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom `parseCSVLine()` function | Papaparse | Handles quoted fields, embedded commas, newlines in values, encoding issues |
| Auth session management | Cookie-based SITE_PASSWORD check | @supabase/ssr | Token refresh, JWT validation, PKCE flow, secure cookie handling |
| JSON schema validation | Manual `validateDashboardConfig()` | Zod schemas | Type inference + runtime validation in one declaration; composable |
| Claude response parsing | `parseJSONFromClaude()` with regex | Anthropic SDK structured output | Guaranteed schema compliance via constrained decoding; no parsing errors |
| Database migrations | Raw SQL scripts | Supabase dashboard + SQL editor | Version control via Supabase migrations; RLS policy testing in dashboard |
| Exponential backoff | Simple `Math.pow(2, attempt)` | SDK built-in + jitter | Needs jitter to prevent thundering herd; needs 5xx retry too |

**Key insight:** The current codebase has 4 hand-rolled solutions (CSV parsing, JSON extraction from Claude, auth, config validation) that each have subtle edge-case bugs. Replacing them with standard libraries eliminates entire categories of errors.

## Common Pitfalls

### Pitfall 1: Supabase SSR Middleware Cookie Propagation
**What goes wrong:** Auth works in `next dev` but breaks on Cloudflare Workers because cookie changes from middleware aren't propagated correctly.
**Why it happens:** The `@opennextjs/cloudflare` adapter handles request/response differently than the standard Next.js server. Cookie `setAll` in middleware must write to both the request (for downstream server components) AND the response (for the browser).
**How to avoid:** Follow the exact middleware pattern from Supabase docs. Test with `wrangler dev` early and often, not only `next dev`.
**Warning signs:** Login works but session is lost on navigation; infinite redirect loops to /login.

### Pitfall 2: RLS Policies Blocking All Access
**What goes wrong:** Tables created with RLS enabled but no policies = zero data returned.
**Why it happens:** PostgreSQL RLS denies all access by default when enabled. Must create explicit ALLOW policies.
**How to avoid:** Always create policies immediately after enabling RLS. Test with both authenticated and anon roles in Supabase SQL editor.
**Warning signs:** Queries return empty arrays with no error.

### Pitfall 3: Supabase publishable key vs service role key
**What goes wrong:** Using the service role key in client-side code exposes full database access. Using the publishable key in API routes means RLS applies (which is correct, but may confuse during development).
**Why it happens:** Two keys serve different purposes. The publishable key (anon) respects RLS. The service role key bypasses RLS entirely.
**How to avoid:** Only use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key) in all client and server code. RLS policies handle access control. Reserve service role key for admin scripts only.
**Warning signs:** API calls return different data than expected; auth seems to not apply.

### Pitfall 4: Claude Structured Output Model Compatibility
**What goes wrong:** Structured outputs with `output_config.format` fail or return errors.
**Why it happens:** Must use a supported model. The current codebase uses `claude-sonnet-4-20250514` which supports structured output.
**How to avoid:** Stick with `claude-sonnet-4-20250514` or newer. The feature is GA on Sonnet 4.5+.
**Warning signs:** API errors mentioning `output_config` or `output_format`.

### Pitfall 5: Papaparse on Cloudflare Workers
**What goes wrong:** Import errors or runtime failures when Papaparse runs in Workers.
**Why it happens:** Papaparse has optional Node.js-specific code paths (fs, streams). The Workers environment with `nodejs_compat_v2` may not fully support these.
**How to avoid:** Use Papaparse only for in-memory string parsing (no file streaming, no Worker threads). Test CSV parsing with `wrangler dev` early. If Papaparse fails on Workers, the fallback is to use it only on the client side and send parsed data to the server.
**Warning signs:** Build or runtime errors referencing `fs` or `stream` modules.

### Pitfall 6: JSONB Column Size with Large Comp Arrays
**What goes wrong:** Very large CSV files produce 100+ comps, creating JSONB payloads that slow queries.
**Why it happens:** Storing raw comp arrays without size limits.
**How to avoid:** Cap stored comps at top 30 by match score. The full list is ephemeral during generation only.
**Warning signs:** Slow dashboard load times, large row sizes in Supabase dashboard.

## Code Examples

### Login Page with Supabase Auth
```typescript
// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  // ... render form with email + password fields
}
```

### Server Component Auth Check
```typescript
// In any server component or API route
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims) {
    redirect("/login");
  }

  // Fetch data -- RLS automatically scopes to authenticated user
  const { data: dashboards } = await supabase
    .from("dashboards")
    .select("*")
    .order("updated_at", { ascending: false });

  // ... render
}
```

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...  # anon key
ANTHROPIC_API_KEY=sk-ant-...
# SITE_PASSWORD removed -- no longer used
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers is deprecated; ssr is the replacement |
| `supabase.auth.getSession()` in server | `supabase.auth.getClaims()` | Late 2025 | getClaims() validates JWT signature; getSession() does not revalidate |
| `output_format` (beta header) | `output_config.format` (GA) | Early 2026 | Structured outputs are GA on Sonnet 4.5+; no beta header needed |
| Claude tool_use for extraction | `output_config.format` JSON mode | 2025-2026 | JSON mode is simpler for extraction (no fake tool call); strict tool_use is for actual tools |
| Custom CSV parser | Papaparse | Ongoing | Papaparse handles all RFC 4180 edge cases; custom parsers miss quoted newlines |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr` -- do not install
- `supabase.auth.getSession()` in server code: Security risk -- always use `getClaims()`
- `output_format` parameter: Deprecated in favor of `output_config.format`
- `anthropic-beta: structured-outputs-2025-11-13` header: No longer needed, feature is GA

## Open Questions

1. **Anthropic SDK compatibility with Cloudflare Workers**
   - What we know: The SDK uses `fetch()` internally, which is available in Workers
   - What's unclear: Whether the SDK has any Node.js-specific dependencies that break on Workers
   - Recommendation: Test early with `wrangler dev`. If SDK fails, keep raw `fetch()` approach with manual schema in `output_config.format` (no SDK dependency needed)

2. **Supabase type generation**
   - What we know: `supabase gen types typescript` generates types from the database schema
   - What's unclear: Whether to use generated types or keep existing hand-written types
   - Recommendation: Generate types for DB operations; keep existing types for template CONFIG objects (they're separate concerns)

3. **Migration from existing data**
   - What we know: Current app is stateless -- no data to migrate
   - What's unclear: Whether any test data exists that needs preservation
   - Recommendation: Clean slate -- create tables from scratch in Supabase

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Supabase signInWithPassword succeeds | integration | `npx vitest run src/lib/__tests__/supabase-auth.test.ts -t "sign in"` | No -- Wave 0 |
| AUTH-03 | Middleware redirects unauthenticated | unit | `npx vitest run src/__tests__/middleware.test.ts` | No -- Wave 0 |
| AUTH-05 | Legacy SITE_PASSWORD route removed | unit | `npx vitest run src/__tests__/legacy-auth-removed.test.ts` | No -- Wave 0 |
| PERS-01 | Dashboard CRUD operations | integration | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "dashboard"` | No -- Wave 0 |
| PERS-05 | RLS allows authenticated CRUD | manual-only | Test in Supabase SQL editor with different roles | N/A |
| PERS-06 | RLS allows anon SELECT published | manual-only | Test in Supabase SQL editor with anon role | N/A |
| ENGN-01 | max_tokens is 16384 | unit | `npx vitest run src/lib/__tests__/claude-api.test.ts -t "max_tokens"` | No -- Wave 0 |
| ENGN-02 | Structured output uses output_config | unit | `npx vitest run src/lib/__tests__/claude-api.test.ts -t "structured"` | No -- Wave 0 |
| ENGN-03 | Retry handles 429 and 5xx | unit | `npx vitest run src/lib/__tests__/claude-api.test.ts -t "retry"` | No -- Wave 0 |
| ENGN-04 | CSV parsed by Papaparse | unit | `npx vitest run src/lib/__tests__/csv-engine.test.ts -t "papaparse"` | Partial (file exists but needs new tests) |
| ENGN-05 | Scoring is deterministic | unit | `npx vitest run src/lib/__tests__/csv-engine.test.ts -t "score"` | Partial (file exists) |
| ENGN-07 | Config validation covers all types | unit | `npx vitest run src/lib/__tests__/config-validation.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/supabase-auth.test.ts` -- covers AUTH-01, AUTH-02, AUTH-03
- [ ] `src/__tests__/middleware.test.ts` -- covers AUTH-03, AUTH-05
- [ ] `src/lib/__tests__/supabase-db.test.ts` -- covers PERS-01 through PERS-04, PERS-07
- [ ] `src/lib/__tests__/claude-api.test.ts` -- update existing or create new for ENGN-01, ENGN-02, ENGN-03
- [ ] `src/lib/__tests__/config-validation.test.ts` -- covers ENGN-07
- [ ] Existing `csv-engine.test.ts` needs new test cases for Papaparse migration (ENGN-04)

## Sources

### Primary (HIGH confidence)
- [Supabase SSR docs](https://supabase.com/docs/guides/auth/server-side/nextjs) -- Next.js setup, middleware pattern, getClaims()
- [Supabase creating SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- createBrowserClient/createServerClient API
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- Policy syntax, enable/disable, role-based patterns
- [Claude Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- output_config.format, Zod integration, GA status
- [Claude Tool Use docs](https://platform.claude.com/docs/en/build-with-claude/tool-use) -- tool_use for extraction pattern
- [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare) -- Next.js 14+ compatibility, nodejs_compat_v2

### Secondary (MEDIUM confidence)
- [Supabase + Cloudflare Workers integration](https://supabase.com/partners/integrations/cloudflare-workers) -- HTTP-based client works on edge
- [Cloudflare community: Papaparse in Workers](https://community.cloudflare.com/t/how-to-use-papaparse-or-streaming-csv-workers-to-convert-csv-to-json/443163) -- Potential import issues flagged

### Tertiary (LOW confidence)
- Anthropic SDK Cloudflare Workers compatibility -- needs validation with `wrangler dev`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Supabase SSR + Next.js 14 is well-documented official pattern
- Architecture: HIGH -- DB schema follows standard Supabase patterns; engine refactor is straightforward
- Pitfalls: HIGH -- Supabase SSR + Workers is known risk area; documented from official sources
- Claude structured output: HIGH -- feature is GA, official docs confirm API format
- Papaparse on Workers: MEDIUM -- community reports suggest possible issues; needs early validation

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable ecosystem, 30-day validity)
