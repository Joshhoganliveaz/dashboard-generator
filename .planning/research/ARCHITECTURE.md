# Architecture Patterns

**Domain:** Hybrid admin + static-hosting real estate dashboard platform
**Researched:** 2026-03-15
**Confidence:** HIGH (based on existing codebase analysis + official documentation)

## Current Architecture (Baseline)

The existing system is a single-page Next.js 14 App Router app deployed to Cloudflare Workers via OpenNext adapter. No database. No persistent storage. Cookie-based password auth (`SITE_PASSWORD`). Two-phase SSE generation pipeline with human-in-the-loop comp review. HTML dashboards are downloaded as files -- not hosted.

Key constraints inherited from the existing system:
- `wrangler.toml` already defines production, staging, and dev Workers environments
- `open-next.config.ts` uses the default Cloudflare config (no R2 or KV bindings yet)
- Templates are large (~788KB) self-contained HTML files with CONFIG injection markers
- The generation pipeline is already well-structured with clear phase boundaries
- Middleware is simple cookie-check auth that will be replaced by Supabase Auth

## Recommended Architecture

### High-Level: Three-Zone Design

```
Zone 1: Admin App (Next.js on Cloudflare Workers)
  - Wizard UI, dashboard library, team auth
  - Talks to: Supabase (data), Claude API (AI), Zone 3 (publish)

Zone 2: Supabase (Managed)
  - PostgreSQL (dashboards, sell_data, buy_data, properties_of_interest)
  - Auth (team email/password)
  - RLS (team CRUD, public read on published)

Zone 3: Static Dashboard CDN (Cloudflare R2 + public bucket)
  - Published HTML files at /d/{slug}
  - Served via R2 public bucket with custom domain
  - No server involvement for client views
```

This is a "publish to CDN" architecture -- the admin app generates and manages content, then pushes static artifacts to R2 for zero-server-cost client delivery. The client-facing dashboards never touch Next.js, Supabase, or any server at all.

### Component Boundaries

| Component | Responsibility | Communicates With | Runtime |
|-----------|---------------|-------------------|---------|
| **Wizard UI** | Multi-step form for dashboard creation/editing | Supabase (read/write data), API routes (generation) | Client (browser) |
| **Dashboard Library** | List/filter/manage all dashboards | Supabase (query dashboards table) | Client (browser) |
| **Auth Layer** | Team login, session management, route protection | Supabase Auth | Client + Middleware |
| **Generation Pipeline** | Two-phase SSE pipeline (existing, largely unchanged) | Claude API, CSV engine, loan estimator | Server (Workers) |
| **Publish Pipeline** | Render HTML from DB data, upload to R2 | Supabase (read config), R2 (write HTML), Template engine | Server (Workers) |
| **Supabase Client** | Data access layer for all DB operations | Supabase PostgreSQL via REST API | Client + Server |
| **R2 Public Bucket** | Serve published dashboards at permanent URLs | None (static file serving) | CDN edge |

### Why This Structure

**Separation of admin and client-facing concerns.** The admin app is a dynamic Next.js application with auth, wizards, and AI pipelines. Client dashboards are static HTML -- no auth, no server, no database queries. This keeps client dashboard loading at CDN speed (sub-100ms globally) and costs nothing per pageview.

**Supabase as the single source of truth.** Dashboard configs, client data, and metadata all live in Supabase. The HTML in R2 is a derived artifact -- it can always be regenerated from the database. This solves the current pain point of no persistent storage.

**R2 as a dumb file store.** R2 does not route, rewrite, or transform. It stores exactly one file per published dashboard: `d/{slug}/index.html`. The public bucket + custom domain handles serving.

## Data Flow

### Dashboard Creation (Wizard to Database)

```
1. Agent logs in via Supabase Auth (email/password)
2. Agent clicks "New Dashboard" --> Wizard Step 1 (type selection)
3. Wizard state managed in Zustand store (client-side, persisted to localStorage)
4. Each wizard step validates with Zod schema before allowing progression
5. Steps 1-4 collect structured data (type, client info, property details, market data)
6. Step 5 triggers generation pipeline:
   a. POST /api/dashboard/generate with wizard data
   b. Phase 1: PDF extraction + CSV analysis + loan estimation (SSE streaming)
   c. review_comps event pauses pipeline, agent reviews in wizard UI
   d. Agent approves comps --> POST /api/dashboard/generate/continue
   e. Phase 2: Content generation + template assembly (SSE streaming)
   f. complete event returns rendered HTML + assembled config
7. Config and metadata saved to Supabase (dashboards + sell_data/buy_data tables)
8. Dashboard status set to "draft"
```

### Dashboard Publishing (Database to R2)

```
1. Agent clicks "Publish" on a draft dashboard
2. POST /api/dashboard/publish with dashboard ID
3. Server reads dashboard config from Supabase
4. Template engine renders HTML from config (same injectConfig() as today)
5. R2 binding puts HTML to: d/{slug}/index.html
6. Supabase updated: status = "published", published_at = now(), slug locked
7. Client URL becomes: https://dashboards.liveazco.com/d/{slug}/index.html
   (or via R2 public bucket domain)
```

### Dashboard Update (Re-enter Wizard)

```
1. Agent clicks "Edit" on existing dashboard
2. Wizard pre-populated from Supabase data
3. Agent modifies any step, or re-runs generation
4. New config saved to Supabase
5. If dashboard was published: re-render HTML, re-upload to R2 (same slug/URL)
6. Client always sees latest version at the same permanent URL
```

### Static Dashboard Serving (Client View)

```
1. Client visits https://dashboards.liveazco.com/d/{slug}/index.html
2. Cloudflare R2 public bucket serves the static HTML file
3. No server, no auth, no database query
4. File is cached at Cloudflare edge (global CDN)
```

## Component Deep-Dives

### Supabase Integration with Cloudflare Workers

**Package:** `@supabase/supabase-js` + `@supabase/ssr`

**Client creation pattern for Next.js on Cloudflare:**

Two client factories are needed -- one for browser (client components), one for server (route handlers, server components, middleware).

```typescript
// src/lib/supabase/client.ts (browser)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts (server-side)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**Critical:** Use `getAll`/`setAll` (not `get`/`set`/`remove`). The old auth-helpers package is deprecated.

**Middleware for Supabase Auth:**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  // Refresh session (important for token refresh)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return supabaseResponse
}
```

**Cloudflare Workers compatibility:** Supabase client uses `fetch` internally, which Cloudflare Workers supports natively. No special adapter needed. The `@supabase/ssr` cookie handling works with Next.js middleware on Workers.

### R2 Binding for Publishing

**wrangler.toml addition:**

```toml
# Dashboard publish bucket
[[r2_buckets]]
binding = "DASHBOARD_BUCKET"
bucket_name = "dashboard-published"

[env.staging]
[[env.staging.r2_buckets]]
binding = "DASHBOARD_BUCKET"
bucket_name = "dashboard-published-staging"
```

**Accessing R2 from Next.js API routes on Cloudflare:**

The OpenNext adapter exposes Cloudflare bindings via `getCloudflareContext()`:

```typescript
// src/app/api/dashboard/publish/route.ts
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function POST(request: Request) {
  const { env } = await getCloudflareContext()
  const bucket = env.DASHBOARD_BUCKET as R2Bucket

  const html = renderDashboardHtml(config) // existing template engine
  await bucket.put(`d/${slug}/index.html`, html, {
    httpMetadata: { contentType: 'text/html; charset=utf-8' },
  })
}
```

**Public access:** Enable public bucket access in R2 dashboard settings. Connect a custom domain (e.g., `dashboards.liveazco.com`). Published dashboards become accessible at `https://dashboards.liveazco.com/d/{slug}/index.html`.

**Archive/cleanup:** `bucket.delete(`d/${slug}/index.html`)` removes the published file when archiving.

### Multi-Step Wizard State Management

**Use Zustand + Zod + React Hook Form.** This is the dominant pattern in the Next.js ecosystem for wizard flows, and the team already uses Zustand in the STR Analyzer project.

**Why not React Context?** Context causes re-renders of the entire wizard tree on any state change. With 6 steps and file uploads, this creates unnecessary re-renders. Zustand's selector pattern only re-renders components that read the changed slice.

**Why not URL state (searchParams)?** Dashboard creation data is too large and structured (nested objects, arrays of comps, file references). URL state works for simple filters, not for complex wizard data.

**Store structure:**

```typescript
// src/lib/wizard-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WizardState {
  currentStep: number
  dashboardType: 'sell' | 'buyer' | 'buysell' | null
  clientInfo: ClientInfo | null
  propertyDetails: PropertyDetails | null
  marketData: MarketData | null
  generatedConfig: AnyDashboardConfig | null
  generatedHtml: string | null

  // Actions
  setStep: (step: number) => void
  setDashboardType: (type: DashboardType) => void
  setClientInfo: (info: ClientInfo) => void
  // ... per-step setters
  reset: () => void
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      currentStep: 0,
      dashboardType: null,
      // ... initial state
      reset: () => set(initialState),
    }),
    { name: 'dashboard-wizard' } // localStorage key
  )
)
```

**Validation:** Each step has a Zod schema. The wizard "Next" button runs `schema.safeParse()` before allowing progression. React Hook Form's `zodResolver` handles per-field validation within each step.

**Persistence:** Zustand's `persist` middleware saves to localStorage automatically. If an agent navigates away mid-wizard, they return to where they left off. The `reset()` action clears state when starting a new dashboard or after successful publish.

### Database Schema (Supabase)

```sql
-- Core dashboard record
create table dashboards (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid references auth.users(id),
  type text not null check (type in ('sell', 'buyer', 'buysell')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  slug text unique,
  client_name text not null,
  client_email text,
  address text,
  city_state_zip text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz,
  archived_at timestamptz
);

-- Seller/listing data (linked to dashboard)
create table sell_data (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid references dashboards(id) on delete cascade,
  config jsonb not null, -- full SellDashboardConfig or sell portion of BuySellConfig
  comps jsonb,          -- approved CompSale[] array
  csv_result jsonb,     -- raw CSV analysis output
  mls_data jsonb,       -- extracted MLS PDF data
  loan_data jsonb,      -- loan estimation results
  created_at timestamptz default now()
);

-- Buyer data (linked to dashboard)
create table buy_data (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid references dashboards(id) on delete cascade,
  config jsonb not null, -- full BuyerDashboardConfig or buy portion of BuySellConfig
  search_criteria jsonb,
  neighborhoods jsonb,
  properties_of_interest jsonb, -- inline for simplicity
  created_at timestamptz default now()
);

-- Properties of interest (standalone CRUD)
create table properties_of_interest (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid references dashboards(id) on delete cascade,
  address text not null,
  mls_number text,
  price numeric,
  notes text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- RLS policies
alter table dashboards enable row level security;
create policy "team_crud" on dashboards for all using (auth.uid() is not null);
create policy "public_read_published" on dashboards for select using (status = 'published');
-- Similar for sell_data, buy_data, properties_of_interest
```

**Why JSONB for configs:** The dashboard config objects are deeply nested and vary by type. Normalizing them into relational tables would create 20+ tables for data that is always read/written as a unit. JSONB stores the typed config directly, and PostgreSQL can index/query into it if needed later.

### Publish Pipeline

The publish pipeline is a new API route that bridges the database and R2:

```
POST /api/dashboard/publish
  1. Read dashboard + sell_data/buy_data from Supabase
  2. Assemble typed config object from DB data
  3. Load template HTML (same template-loader.ts)
  4. Inject config (same injectConfig())
  5. Generate slug if first publish (auto from client name + address, collision check)
  6. PUT to R2 via Workers binding
  7. Update Supabase: status=published, published_at=now(), slug=slug
  8. Return { url, slug }
```

This reuses the existing template engine entirely. The only new code is the R2 upload and the slug generation/collision logic.

## Patterns to Follow

### Pattern 1: Server-Side Supabase in Route Handlers
**What:** Always use `createServerClient` in API routes and server components. Never import the browser client on the server.
**When:** Any data access from route handlers, server actions, or server components.
**Why:** Server client handles cookie refresh, RLS works with the authenticated user's session, and secrets stay server-side.

### Pattern 2: Optimistic UI with Supabase
**What:** Update local Zustand state immediately on user action, then sync to Supabase. Roll back on error.
**When:** Dashboard library actions (archive, status changes) and wizard step saves.
**Why:** The admin panel has 3 users on low-volume data. Optimistic updates make the UI feel instant without needing Supabase Realtime subscriptions.

### Pattern 3: Config as Source of Truth, HTML as Derived Artifact
**What:** The database stores the structured config. HTML in R2 is always re-renderable from the config.
**When:** Any dashboard update or publish operation.
**Why:** If templates change, all dashboards can be re-published. If R2 data is lost, it can be regenerated. The config is the valuable data; the HTML is disposable.

### Pattern 4: R2 via Workers Binding (Not S3 API)
**What:** Use the R2 Workers binding (`env.DASHBOARD_BUCKET`) rather than the S3-compatible API.
**When:** All R2 operations (put, get, delete) from API routes.
**Why:** Workers binding is zero-latency (same Cloudflare network), no authentication overhead, no additional SDK needed. The S3 API is for external access -- since the Next.js app runs on Workers, the binding is the correct path.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Supabase Client in Middleware for Data Queries
**What:** Using Supabase in middleware to fetch dashboard data or check permissions beyond auth.
**Why bad:** Middleware runs on every request. Supabase queries add latency to every navigation. Middleware should only refresh the auth token and redirect unauthenticated users.
**Instead:** Keep middleware auth-only. Do data fetching in server components or route handlers.

### Anti-Pattern 2: Storing HTML in Supabase
**What:** Putting the rendered 788KB HTML blobs in a PostgreSQL text column.
**Why bad:** PostgreSQL is not a file store. 50 dashboards x 788KB = ~40MB of large text fields that slow backups, complicate queries, and waste Supabase free tier storage.
**Instead:** Store the structured config in JSONB (~5-20KB). Store the rendered HTML in R2 (purpose-built for file storage).

### Anti-Pattern 3: Client-Side R2 Uploads
**What:** Using presigned URLs to upload HTML directly from the browser to R2.
**Why bad:** The publish operation needs server-side validation (auth check, slug collision, config assembly from DB). Splitting it client-side adds complexity for no benefit -- the HTML is generated server-side anyway.
**Instead:** Publish is a server-side route handler that reads from Supabase, renders HTML, and uploads to R2 in one atomic operation.

### Anti-Pattern 4: Separate Worker for R2 Serving
**What:** Creating a dedicated Cloudflare Worker to serve dashboard HTML from R2.
**Why bad:** R2 public buckets serve files directly via CDN with zero Workers invocations. A Worker intermediary adds latency and cost for no value.
**Instead:** Use R2 public bucket with a custom domain. Files at `d/{slug}/index.html` are served directly.

### Anti-Pattern 5: Wizard State in URL Search Params
**What:** Encoding wizard form data in the URL to persist between steps.
**Why bad:** Dashboard configs contain deeply nested objects, arrays of comps, and large text fields. URL encoding would hit length limits and create ugly/unshare-able URLs.
**Instead:** Zustand store with localStorage persistence. URL only tracks the current step number for navigation.

## Build Order (Dependencies)

The architecture has clear dependency chains that dictate build order:

```
Layer 0: Supabase Project Setup + Auth
  |
  +-- Layer 1: Database Schema + RLS
  |     |
  |     +-- Layer 2: Dashboard Library (read from DB)
  |     |     |
  |     +-- Layer 2: Wizard UI (write to DB)
  |           |
  |           +-- Layer 3: Generation Pipeline (refactor to save to DB)
  |                 |
  |                 +-- Layer 4: Publish Pipeline (DB -> R2)
  |                       |
  |                       +-- Layer 5: Update/Re-publish Flow
```

**Suggested phase mapping:**

1. **Foundation (Auth + DB):** Supabase project, auth replacement, database schema, RLS policies, Supabase client utilities. This unblocks everything else.

2. **Dashboard Library + Basic CRUD:** Home screen showing dashboards from DB, status management, slug generation. This gives the team a visible improvement immediately.

3. **Wizard UI:** 6-step wizard with Zustand state, Zod validation, pre-population from DB for edits. The existing single-page form is refactored into discrete steps.

4. **Generation Pipeline Refactor:** Existing two-phase pipeline adapted to read wizard state and write results to Supabase instead of returning HTML directly. The pipeline logic itself changes minimally.

5. **R2 Publish Pipeline:** Render from DB config, upload to R2, permanent URLs. This is the capstone -- it completes the "live dashboard" value proposition.

6. **Update/Re-publish + Properties of Interest:** Edit-in-place flow, re-publish to same URL, buyer-specific CRUD features.

**Why this order:**
- Auth must come first because every subsequent feature needs it
- DB schema must precede any feature that reads/writes data
- Wizard depends on DB schema (to know what to collect)
- Generation pipeline depends on wizard (as its input source)
- Publish depends on generation (needs rendered HTML)
- Update depends on all of the above being solid

## Scalability Considerations

| Concern | At 20 dashboards (now) | At 200 dashboards | At 2,000 dashboards |
|---------|------------------------|--------------------|--------------------|
| **DB queries** | No concern | Add indexes on status, slug | Consider pagination on library view |
| **R2 storage** | ~16MB (20 x 788KB) | ~160MB | ~1.6GB -- still trivially small for R2 |
| **Supabase free tier** | Well within limits | Still fine (500MB DB, 1GB storage) | May need Pro plan ($25/mo) |
| **Publish latency** | <2s per dashboard | Same | Same -- each publish is independent |
| **Auth sessions** | 3 users | Still 3 users | Maybe 5-10 users -- irrelevant |

This is a low-scale internal tool. Architecture decisions should optimize for developer speed and simplicity, not horizontal scaling.

## Sources

- [Supabase + Cloudflare Workers integration](https://supabase.com/partners/integrations/cloudflare-workers) - Official partnership docs
- [Cloudflare Workers Supabase guide](https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/) - Cloudflare official docs
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) - Cloudflare R2 docs
- [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) - Binding usage patterns
- [OpenNext Cloudflare bindings](https://opennext.js.org/cloudflare/bindings) - How to access R2/KV from Next.js on Workers
- [Supabase SSR client creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client) - `@supabase/ssr` getAll/setAll pattern
- [Supabase Next.js server-side auth](https://supabase.com/docs/guides/auth/server-side/nextjs) - Middleware pattern
- [Next.js on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) - OpenNext adapter docs
- [Multi-step form with Zustand + Zod](https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps) - Wizard state management pattern

---

*Architecture analysis: 2026-03-15*
