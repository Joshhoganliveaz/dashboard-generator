# Project Research Summary

**Project:** Live Dashboard Platform (v1.1 milestone)
**Domain:** Real estate client dashboard platform with admin wizard, Supabase persistence, and publish-to-URL via Cloudflare R2
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

This project transforms an existing Next.js 14 dashboard generator -- currently a stateless, single-page tool that produces downloadable HTML files -- into a persistent platform where agents create dashboards through a guided wizard, save them to a database, and publish them as permanent URLs on a CDN. The existing generation pipeline (Claude AI content, PDF extraction, comp scoring, loan estimation) is mature and largely unchanged. The work is additive: Supabase for persistence and auth, Cloudflare R2 for static dashboard hosting, and a multi-step wizard UI to replace the monolithic form.

The recommended approach follows a "publish to CDN" architecture with three zones: a dynamic admin app (Next.js on Cloudflare Workers), a managed database (Supabase with RLS), and a static CDN layer (R2 public bucket for published dashboards). This separation keeps client-facing dashboards at CDN speed with zero server cost per view, while the admin side handles auth, AI generation, and CRUD. The stack additions are minimal -- Supabase client + SSR packages, react-hook-form + Zod for the wizard, and the native R2 Workers binding (zero new dependencies for file storage).

The primary risks are Cloudflare Workers compatibility with Supabase SSR (the `@supabase/ssr` package can fail at runtime on Workers despite compiling fine), the Next.js 14 EOL situation (OpenNext is dropping support, and the project already uses a `--dangerouslyUseUnsupportedNextVersion` flag), and RLS misconfiguration (silent empty results with no error). All three are mitigable: test auth flows on `wrangler dev` not just `next dev`, pin the OpenNext version or plan a Next.js 15 upgrade, and write RLS policies in the same migration as table creation. The auth migration must be atomic -- no gradual cutover from the existing cookie auth to Supabase Auth.

## Key Findings

### Recommended Stack

The existing stack (Next.js 14, React 18, Tailwind, Zustand, Cloudflare Workers via OpenNext) is unchanged. Three categories of additions are needed. See [STACK.md](STACK.md) for full rationale and version matrix.

**Core technologies:**
- **Supabase (`@supabase/supabase-js` + `@supabase/ssr`):** Database, auth, and RLS in one service. Email/password auth for 3 team members, no self-serve signup. Two client factories (browser + server) following the official SSR pattern.
- **Cloudflare R2 Workers Binding:** Native R2 binding for publishing dashboard HTML. Zero additional dependencies -- the app already runs on Cloudflare Workers. Public bucket with custom domain for CDN-speed client access.
- **react-hook-form + Zod v4:** Form state and schema validation for the 6-step wizard. Uncontrolled inputs for performance. Zod schemas are the single source of truth for form shapes and DB insert types.
- **No ORM:** Supabase client with generated TypeScript types is sufficient for 4-5 tables with simple CRUD. Prisma cannot manage RLS. Drizzle adds overhead without leverage at this scale.

**Critical version note:** `@supabase/ssr` must be tested against Cloudflare Workers runtime. Pin to a verified version. Update `compatibility_date` in wrangler.toml to at least `2025-05-05`.

### Expected Features

See [FEATURES.md](FEATURES.md) for full feature landscape with dependencies.

**Must have (table stakes):**
- Multi-step admin wizard (6 steps, replacing 822-line monolithic form)
- Dashboard persistence in Supabase (the #1 pain point -- dashboards currently vanish)
- Dashboard library home screen with status filtering and search
- Draft / Published / Archived lifecycle
- Publish to permanent URL on R2 with slug generation
- Update-in-place re-publish (same URL, new content)
- All 3 dashboard types: sell, buyer, buy/sell
- Supabase Auth replacing insecure cookie auth
- PDF extraction with editable review, comp review panel, SSE streaming, HTML export, natural language edit -- all already built

**Should have (differentiators):**
- AI-powered SB7 content generation (already built -- the core IP)
- Slug auto-generation with collision handling
- Properties of interest CRUD for buyer dashboards
- Dashboard versioning / generation history

**Defer (v2+):**
- Cromford screenshot extraction (rarely used, manual entry covers it)
- Template visual editor (zero ROI for 3 templates)
- Analytics / view tracking on client dashboards
- Client login / authentication (clients view public URLs)

### Architecture Approach

A three-zone "publish to CDN" architecture. The admin app (Zone 1) is the dynamic Next.js application handling wizard flows, AI generation, and team auth. Supabase (Zone 2) is the single source of truth for all dashboard configs and metadata. R2 (Zone 3) stores only published HTML -- a derived artifact that can always be regenerated from the database. Client dashboards never touch Next.js, Supabase, or any server. See [ARCHITECTURE.md](ARCHITECTURE.md) for component boundaries, data flows, and code patterns.

**Major components:**
1. **Wizard UI** -- Multi-step form with Zustand state + Zod validation per step, localStorage persistence for crash recovery
2. **Dashboard Library** -- Home screen listing all dashboards from Supabase with filtering by status/type
3. **Auth Layer** -- Supabase Auth middleware with token refresh, protecting all admin routes
4. **Generation Pipeline** -- Existing two-phase SSE pipeline (largely unchanged), refactored to save results to Supabase
5. **Publish Pipeline** -- New route handler: reads config from Supabase, renders HTML via existing template engine, uploads to R2
6. **R2 Public Bucket** -- Serves published dashboards at permanent URLs via CDN with zero server cost

**Key architectural decisions:**
- Config in Supabase (JSONB), HTML in R2. Never store 788KB rendered HTML in the database.
- Per-request Supabase client creation (Workers I/O objects cannot be reused across requests).
- Optimistic UI updates for admin actions (3 users, low volume -- no need for Supabase Realtime).

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for the full list (13 pitfalls across critical/moderate/minor).

1. **Supabase SSR + Cloudflare Workers compatibility** -- `@supabase/ssr` can throw runtime errors on Workers that don't appear in local dev. Test every auth flow on `wrangler dev`, pin package versions, update `compatibility_date`.
2. **RLS enabled with no/wrong policies = silent empty results** -- Write policies in the same migration as table creation. Test with SDK client, never rely on the SQL editor (which bypasses RLS as superuser).
3. **Next.js 14 EOL + OpenNext dropping support** -- The project already uses `--dangerouslyUseUnsupportedNextVersion`. Pin OpenNext version or plan Next.js 15 upgrade before building on an unstable base.
4. **R2 public bucket exposes all files** -- Use separate buckets for published HTML (public) and uploads/drafts (private). Never store source PDFs/CSVs in the public bucket.
5. **Auth cookie collision during migration** -- Do an atomic cutover from cookie auth to Supabase Auth. No gradual migration. The team is 3 people -- a clean switch is simpler and safer.

## Implications for Roadmap

Based on combined research, the build has clear dependency chains that dictate phase ordering. Six phases are suggested.

### Phase 1: Foundation (Auth + Database)
**Rationale:** Everything depends on auth and persistence. Auth gates every protected route. The database schema must exist before any feature can read or write data. This is Layer 0 in the dependency graph.
**Delivers:** Supabase project setup, auth middleware replacing cookie auth, database schema with RLS policies, Supabase client utilities (browser + server), login page.
**Addresses:** Supabase Auth (table stakes), dashboard persistence foundation, auth cookie replacement.
**Avoids:** Cookie collision pitfall (#5) via atomic cutover. RLS silent failure pitfall (#2) via policies-with-migrations. Workers compat pitfall (#1) via early `wrangler dev` testing.
**Decision required:** Next.js 14 vs 15 upgrade. Must be resolved at the start of this phase, not deferred. If staying on 14, pin OpenNext and accept frozen platform updates.

### Phase 2: Dashboard Library + Basic CRUD
**Rationale:** With auth and DB in place, the first visible improvement is a home screen showing all dashboards. This gives the team immediate value and validates the Supabase integration end-to-end before the wizard adds complexity.
**Delivers:** Dashboard library page with card view, status filtering (draft/published/archived), type filtering, search by client name, status transitions, manual dashboard creation (simplified, pre-wizard).
**Addresses:** Dashboard library (table stakes), draft/published/archived lifecycle (table stakes).
**Uses:** Supabase client queries, Zustand for UI state, optimistic UI pattern.

### Phase 3: Admin Wizard
**Rationale:** The wizard depends on the DB schema (to know what to collect) and benefits from the library page (to navigate to/from). This is the largest UI refactor -- breaking the 822-line monolithic form into 6 validated steps.
**Delivers:** 6-step wizard shell with Zustand + localStorage persistence, Zod schemas per step, react-hook-form integration, draft auto-save to Supabase on each step transition, "Resume draft" from library page.
**Addresses:** Multi-step admin wizard (table stakes), wizard state persistence.
**Avoids:** State-lost-on-refresh pitfall (#8) via draft persistence designed in from step 1.
**Uses:** react-hook-form, Zod v4, @hookform/resolvers.

### Phase 4: Generation Pipeline Refactor
**Rationale:** The existing two-phase SSE pipeline is mature and working. The refactor is narrow: instead of returning HTML to the browser, write the generated config and results to Supabase. The pipeline logic itself changes minimally.
**Delivers:** Generation triggered from wizard step 5, results saved to sell_data/buy_data tables, comp review panel wired into wizard flow, SSE streaming preserved.
**Addresses:** PDF extraction with editable review (table stakes), comp review panel (table stakes), SSE progress streaming (table stakes).
**Implements:** Generation pipeline component from architecture.

### Phase 5: R2 Publish Pipeline
**Rationale:** This is the capstone feature -- permanent URLs for client dashboards. It depends on generation (needs rendered HTML) and the DB (reads config to render). R2 bucket architecture must be decided before any code is written.
**Delivers:** Publish route handler (DB config -> template render -> R2 upload), slug generation with collision handling, R2 public bucket with custom domain, permanent dashboard URLs, archive (R2 delete).
**Addresses:** Publish to permanent URL (table stakes), update-in-place re-publish (table stakes), slug auto-generation (differentiator).
**Avoids:** R2 public exposure pitfall (#4) via separate public/private buckets. R2 routing pitfall (#9) via Worker-fronted serving or exact-path keys. Template-in-DB pitfall (#7) via config-in-Supabase/HTML-in-R2 separation.

### Phase 6: Full Dashboard Types + Properties of Interest
**Rationale:** With the complete pipeline working for sell dashboards, extend to buyer and buy/sell types. Buyer requires properties-of-interest CRUD. Buy/sell requires both sell and buyer data linked to one dashboard.
**Delivers:** Buyer dashboard generation through wizard, buy/sell combined dashboard support, properties of interest CRUD (add/remove/reorder with agent notes), natural language edit flow wired to persistent dashboards.
**Addresses:** All 3 dashboard types (table stakes), properties of interest (differentiator), natural language edit flow (table stakes).

### Phase Ordering Rationale

- **Auth before everything** because every subsequent feature needs protected routes and user identity for RLS.
- **Library before wizard** because seeing dashboards validates the DB integration and gives the team visible progress. It is also simpler to build and can be shipped faster.
- **Wizard before generation refactor** because the wizard defines the input interface that generation consumes.
- **Generation before publish** because publish needs rendered HTML, which comes from the generation pipeline.
- **Sell type first, then buyer/buysell** because sell is the most mature template and exercises the full pipeline. Buyer adds new content generation complexity. Buy/sell is a composition of both.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Foundation):** Supabase SSR + Cloudflare Workers compatibility is the highest-risk integration. Needs hands-on validation with `wrangler dev` before committing to the auth pattern. The Next.js version decision also needs assessment.
- **Phase 5 (R2 Publish):** R2 routing behavior (no automatic index.html resolution) and the custom domain setup need validation. May need a thin Worker to front the R2 bucket.
- **Phase 6 (Buyer Dashboards):** Buyer content generation (neighborhoods, schools, market snapshots) relies heavily on Claude structured output that may not be as battle-tested as the sell pipeline.

Phases with standard patterns (skip deep research):
- **Phase 2 (Dashboard Library):** Standard Supabase CRUD + list UI. Well-documented patterns.
- **Phase 3 (Admin Wizard):** Zustand + react-hook-form + Zod is the dominant pattern in the Next.js ecosystem. Extensive community examples.
- **Phase 4 (Generation Refactor):** The pipeline already works. The refactor is narrow (save to DB instead of return to browser).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended packages are stable, actively maintained, and verified against target runtimes. Version compatibility matrix is documented. |
| Features | HIGH | Well-scoped internal tool with clear existing codebase. Feature list derived from PROJECT.md requirements and existing functionality audit. |
| Architecture | HIGH | Three-zone pattern is straightforward. All integration points (Supabase on Workers, R2 binding, OpenNext context) have official documentation. |
| Pitfalls | HIGH | Sourced from official issue trackers, CVE reports, and Cloudflare/Supabase documentation. Phase-specific warnings are actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **Next.js 14 vs 15 decision:** Research identifies the risk but does not make the call. This must be decided in Phase 1 planning. Upgrading to 15 is safer long-term but adds scope. Staying on 14 with pinned OpenNext is viable short-term.
- **R2 serving architecture:** Two viable approaches (public bucket with exact-path keys vs. Worker-fronted R2). The right choice depends on whether clean URLs without `.html` extension are required. Needs validation during Phase 5 planning.
- **Supabase SSR version pinning:** The exact compatible version of `@supabase/ssr` for Cloudflare Workers needs hands-on testing. v0.5.x is reported working, but v0.9.x (latest) needs verification.
- **Buyer dashboard content quality:** The sell pipeline is battle-tested. Buyer content generation (neighborhoods, schools) may need prompt iteration that is hard to estimate upfront.

## Sources

### Primary (HIGH confidence)
- [Supabase SSR + Next.js official docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase + Cloudflare Workers integration](https://supabase.com/partners/integrations/cloudflare-workers)
- [R2 Workers API documentation](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
- [R2 public buckets documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [OpenNext Cloudflare bindings](https://opennext.js.org/cloudflare/bindings)
- [react-hook-form](https://www.npmjs.com/package/react-hook-form) v7.69.0, [Zod](https://www.npmjs.com/package/zod) v4.3.6
- [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Secondary (MEDIUM confidence)
- [CVE-2025-48757 / Supabase RLS exposure](https://dev.to/fabio_a26a4e58d4163919a53/supabase-security-the-hidden-dangers-of-rls-and-how-to-audit-your-api-29e9) -- 170+ apps with exposed databases
- [Supabase SSR + Cloudflare Workers issue #37592](https://github.com/supabase/supabase/issues/37592) -- dynamic require errors
- [R2 static hosting limitations](https://community.cloudflare.com/t/hosting-static-websites-on-r2/633020)
- [Multi-step form wizard patterns](https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps)

### Tertiary (LOW confidence)
- [RHF + Zustand multi-step discussion](https://github.com/orgs/react-hook-form/discussions/6382) -- community pattern, not official guidance
- `@supabase/ssr` v0.5.x Workers compatibility claim -- needs hands-on verification

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
