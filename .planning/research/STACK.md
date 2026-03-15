# Technology Stack: v1.1 Additions

**Project:** Live Dashboard Platform (v1.1 milestone)
**Researched:** 2026-03-15
**Scope:** New dependencies for Supabase persistence, R2 dashboard hosting, and admin wizard UI. Does NOT re-document existing stack (see `.planning/codebase/STACK.md`).

---

## Recommended Additions

### Supabase (Auth + Database + RLS)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@supabase/supabase-js` | ^2.99.0 | Database client, auth, RLS | The standard Supabase JS client. v2 is stable and actively maintained. Works with Cloudflare Workers via `nodejs_compat_v2` flag (already enabled in wrangler.toml). | HIGH |
| `@supabase/ssr` | ^0.9.0 | Server-side auth for Next.js App Router | Official package for SSR auth. Creates separate clients for server components, client components, and middleware. Replaces deprecated `@supabase/auth-helpers-nextjs`. | HIGH |

**Architecture:** Two Supabase client utilities in `src/lib/supabase/`:
- `client.ts` -- Browser client for client components (uses `createBrowserClient`)
- `server.ts` -- Server client for route handlers, server components, server actions (uses `createServerClient` with cookie adapter)
- `middleware.ts` -- Auth session refresh in Next.js middleware (critical for token refresh on every request)

**Auth model:** Email/password only. Josh provisions accounts via Supabase dashboard. No self-serve signup, no OAuth. Supabase Auth free tier handles 50K MAUs -- 3 team members is trivially within limits.

**RLS policies:** Two roles matter:
- `authenticated` (team) -- Full CRUD on all tables
- `anon` (public) -- SELECT on published dashboards only (for potential future API use; client dashboards are static HTML on R2, not queried live)

**Edge runtime note:** `@supabase/supabase-js` v2.52+ emits a `process.versions` warning during Next.js builds when used in middleware. This is cosmetic only -- the code is guarded and does not execute at runtime. Safe to ignore. The `nodejs_compat_v2` flag in wrangler.toml provides the Node.js APIs Supabase needs in the Workers runtime.

### Cloudflare R2 (Dashboard HTML Storage)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| R2 Workers Binding | N/A (Cloudflare native) | Store and serve published dashboard HTML | App already runs on Cloudflare Workers. Use the native R2 binding (`env.DASHBOARD_BUCKET`) -- zero additional dependencies, no S3 SDK needed, no presigned URLs. Direct `put()` and `get()` from route handlers. | HIGH |
| R2 Public Bucket + Custom Domain | N/A (Cloudflare config) | Serve dashboards at permanent URLs | R2 custom domain (e.g., `dashboards.liveazco.com`) provides read-only public access to published HTML. Backed by Cloudflare CDN cache automatically. | HIGH |

**Why NOT `@aws-sdk/client-s3`:** The app runs ON Cloudflare Workers. The R2 Workers binding is faster (no network hop), simpler (no credentials), and free (no egress). The S3 API is only needed when accessing R2 from outside Cloudflare.

**wrangler.toml addition:**
```toml
[[r2_buckets]]
binding = "DASHBOARD_BUCKET"
bucket_name = "dashboards-production"

[env.staging.r2_buckets]
binding = "DASHBOARD_BUCKET"
bucket_name = "dashboards-staging"
```

**Publish flow:**
1. Render dashboard HTML from DB data + template
2. `env.DASHBOARD_BUCKET.put('d/{slug}/index.html', html, { httpMetadata: { contentType: 'text/html' } })`
3. Dashboard live at `https://dashboards.liveazco.com/d/{slug}/index.html`

**Accessing the binding in Next.js on OpenNext:** Use `getCloudflareContext()` from `@opennextjs/cloudflare` to access `env.DASHBOARD_BUCKET` in route handlers. This is documented in the OpenNext Cloudflare bindings docs.

### Wizard UI (Multi-Step Form)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `react-hook-form` | ^7.69.0 | Form state and validation per wizard step | Industry standard for React forms. Uncontrolled inputs = performant with many fields. Integrates with Zod for schema validation. Works with the existing Zustand store pattern (push validated step data to Zustand on step completion). | HIGH |
| `zod` | ^4.3.0 | Schema validation for each wizard step | Type-safe validation with TypeScript inference. v4 is stable (released July 2025). Generates TypeScript types from schemas -- single source of truth for form shapes and DB insert types. | HIGH |
| `@hookform/resolvers` | ^5.2.0 | Connects Zod schemas to react-hook-form | Official bridge package. v5.2+ supports Zod v4 natively. | HIGH |

**Why NOT a wizard library (react-multistep, etc.):** The wizard is 6 steps with complex, domain-specific behavior (PDF upload, CSV parsing, Claude API calls, comp review). A wizard library adds abstraction without value. Build a simple `WizardShell` component with step state in Zustand -- each step is a standalone form validated by its own Zod schema.

**Pattern: Zustand + react-hook-form integration:**
- Each wizard step is a react-hook-form instance with a step-specific Zod schema
- On "Next", validated data is pushed to the Zustand wizard store
- Zustand persists wizard state (enables draft saving, browser refresh recovery)
- On final step, Zustand state is submitted to API route for DB insert
- DO NOT sync react-hook-form and Zustand on every keystroke -- only on step transitions

**Why NOT formik:** react-hook-form is lighter, faster (uncontrolled inputs), and has better TypeScript support. Formik's v3 has been in limbo for years.

### Database Schema Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `supabase` (CLI) | latest | Local dev, migrations, type generation | `supabase db diff` generates migration SQL. `supabase gen types typescript` generates TypeScript types from your schema. Run locally, commit migration files. | HIGH |

**Why NOT Prisma:** The project uses Supabase with RLS policies. Prisma cannot manage RLS policies, and adding Prisma on top of Supabase creates two sources of truth for the schema. Use Supabase migrations (raw SQL) + generated TypeScript types. The team is 1 developer -- Prisma's abstraction layer adds complexity without proportional value at this scale.

**Why NOT Drizzle:** Same reasoning. At 4-5 tables with simple CRUD, raw Supabase client queries with generated types are sufficient. An ORM is overhead, not leverage.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Database | Supabase (Postgres + Auth + RLS) | Cloudflare D1 | D1 is SQLite, lacks built-in auth/RLS. Would need to build auth from scratch. Supabase is explicitly in project constraints. |
| Database | Supabase (Postgres + Auth + RLS) | PlanetScale / Neon | No built-in auth. Supabase bundles auth + DB + RLS in one service. |
| File storage | R2 Workers Binding | S3 SDK (`@aws-sdk/client-s3`) | App runs on Workers -- binding is direct, faster, and needs no credentials. S3 SDK adds ~500KB and network hop. |
| File storage | R2 Workers Binding | Supabase Storage | Adds latency (Supabase region vs Cloudflare edge). R2 is co-located with the Worker. Simpler for serving public HTML. |
| Form library | react-hook-form | Formik | Formik v3 stalled. RHF is faster (uncontrolled), better TS support, larger ecosystem. |
| Validation | Zod v4 | Yup | Zod has superior TypeScript inference. Yup's types are bolted on. |
| Validation | Zod v4 | Zod v3 | v4 is stable, better performance, cleaner API. No reason to start on v3 in a new integration. |
| Wizard UI | Custom WizardShell + Zustand | react-multistep / rhf-wizard | 6-step wizard with PDF upload, Claude API, comp review is too domain-specific for a generic library. Custom is simpler. |
| ORM | None (Supabase client) | Prisma | Cannot manage RLS. Two schema sources of truth. Overkill for 4-5 tables. |
| ORM | None (Supabase client) | Drizzle | Nice but unnecessary -- Supabase client + generated types covers the use case. |
| Auth | Supabase Auth | NextAuth/Auth.js | Already using Supabase -- adding another auth layer is redundant and harder to integrate with RLS. |
| Auth | Supabase Auth | Clerk | Paid service. Supabase Auth free tier is more than sufficient for 3 users. |

---

## Installation

```bash
# Supabase (database + auth + SSR)
npm install @supabase/supabase-js @supabase/ssr

# Form management + validation
npm install react-hook-form zod @hookform/resolvers

# Supabase CLI (dev dependency for migrations + type generation)
npm install -D supabase
```

**No R2 dependency to install** -- accessed via Cloudflare Workers binding (already in runtime).

### Environment Variables to Add

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only, for admin operations
```

**Cloudflare secrets** (set via `wrangler secret put`):
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Version Compatibility Matrix

| Package | Version | React 18 | Next.js 14 | CF Workers | Notes |
|---------|---------|----------|------------|------------|-------|
| @supabase/supabase-js | ^2.99.0 | Yes | Yes | Yes (with nodejs_compat_v2) | Build warning re: process.versions is cosmetic |
| @supabase/ssr | ^0.9.0 | Yes | Yes | Yes | Framework-agnostic cookie adapter |
| react-hook-form | ^7.69.0 | Yes | Yes | N/A (client) | Client-side only |
| zod | ^4.3.0 | N/A | Yes | Yes | Used in both client validation and server route handlers |
| @hookform/resolvers | ^5.2.0 | Yes | Yes | N/A (client) | Supports Zod v4 natively since 5.2.0 |

---

## New File Structure

```
src/
  lib/
    supabase/
      client.ts          # createBrowserClient for client components
      server.ts          # createServerClient for server/route handlers
      middleware.ts       # Session refresh logic (used by src/middleware.ts)
      types.ts           # Generated types (from `supabase gen types typescript`)
    wizard/
      schemas/           # Zod schemas per wizard step
        step-type.ts
        step-client.ts
        step-property.ts
        step-market.ts
        step-review.ts
        step-publish.ts
      store.ts           # Zustand wizard state store
  middleware.ts           # Next.js middleware (auth session refresh)
supabase/
  migrations/            # SQL migration files
  config.toml            # Supabase local dev config
```

---

## Sources

- [@supabase/supabase-js on npm](https://www.npmjs.com/package/@supabase/supabase-js) -- v2.99.1 current
- [@supabase/ssr on npm](https://www.npmjs.com/package/@supabase/ssr) -- v0.9.0 current
- [Supabase SSR setup for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) -- official docs
- [Supabase + Cloudflare Workers integration](https://supabase.com/partners/integrations/cloudflare-workers) -- official
- [supabase-js edge runtime issue #1552](https://github.com/supabase/supabase-js/issues/1552) -- process.versions warning context
- [OpenNext Cloudflare bindings](https://opennext.js.org/cloudflare/bindings) -- accessing R2 from Next.js on Workers
- [R2 Workers API usage](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) -- binding configuration
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) -- custom domain setup
- [react-hook-form on npm](https://www.npmjs.com/package/react-hook-form) -- v7.69.0 current
- [zod on npm](https://www.npmjs.com/package/zod) -- v4.3.6 current
- [@hookform/resolvers on npm](https://www.npmjs.com/package/@hookform/resolvers) -- v5.2.2 current, Zod v4 support
- [RHF + Zustand multi-step pattern](https://github.com/orgs/react-hook-form/discussions/6382) -- community pattern
- [Cloudflare Workers Supabase docs](https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/) -- official integration guide
