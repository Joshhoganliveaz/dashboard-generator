# Live Dashboard Platform

## What This Is

A hybrid live dashboard platform for the Live AZ Co real estate team. Team members use a guided admin wizard (Next.js + Supabase) to create and manage seller, buyer, and buy/sell client dashboards. Client-facing dashboards are polished static HTML (existing templates with CONFIG injection) deployed to permanent Cloudflare URLs. Updates re-render and redeploy — same URL, new content.

## Core Value

The team can create, update, and publish client dashboards through a guided wizard without touching code, and clients always see the latest version at a permanent URL.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — inherited from existing codebase. -->

- ✓ HTML dashboard templates for sell, buyer, and buysell types — existing
- ✓ CONFIG injection / template engine with marker-based replacement — existing
- ✓ CSV analysis engine with deterministic comp scoring and adjustments — existing
- ✓ Claude API integration for PDF extraction, content generation, and web research — existing
- ✓ Two-phase generation pipeline with human-in-the-loop comp review — existing
- ✓ SSE streaming progress updates during generation — existing
- ✓ Natural language dashboard edit flow (extract config → Claude edit → re-inject) — existing
- ✓ Loan estimator with historical rate lookup and amortization math — existing
- ✓ TypeScript type system for all dashboard config shapes — existing
- ✓ Cloudflare Workers deployment with staging/production split — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Supabase-backed data persistence (dashboards, sell_data, buy_data, properties_of_interest tables)
- [ ] Supabase Auth for team login (replaces SITE_PASSWORD cookie auth)
- [ ] Dashboard library home screen showing all dashboards as cards with filtering
- [ ] 6-step admin wizard flow (type → client info → property details → market data → review/edit → publish)
- [ ] Draft/published/archived status system
- [ ] Publish flow: render HTML from DB → upload to Cloudflare R2 → permanent URL at /d/{slug}
- [ ] HTML export/download from same render pipeline
- [ ] Properties of interest CRUD (add/remove flagged homes with agent notes)
- [ ] PDF extraction via Claude structured output with editable field review
- [ ] CSV engine improvements (Papaparse for parsing, more deterministic scoring)
- [ ] Claude API fixes (increase max_tokens, structured output, better retry logic)
- [ ] Dashboard update flow: re-enter wizard, edit any data, re-publish to same URL
- [ ] Buy/sell dashboard support: both sell_data and buy_data linked to one dashboard
- [ ] Buyer content generation: neighborhoods, school districts, market snapshot from search criteria
- [ ] Slug auto-generation with collision handling, locked after first publish
- [ ] RLS policies: team CRUD all tables, public SELECT on published dashboards
- [ ] Archive/un-archive flow with R2 file cleanup

### Out of Scope

<!-- Explicit boundaries. -->

- Cromford screenshot extraction — rarely used, defer to v2
- Houseversary template — separate system at ~/Projects/Dashboard Template/
- Batch/bulk dashboard generation — not needed for 20-50 active dashboards
- Client-side authentication — clients don't log in, dashboards are public URLs
- Real-time collaboration — single agent edits at a time
- Mobile app — web-only platform
- Self-serve team account creation — Josh provisions manually via Supabase

## Context

- **Existing codebase:** Next.js 14 App Router, deployed to Cloudflare Workers via OpenNext adapter. Single-page admin form with two-phase SSE generation pipeline. ~46K lines of Claude prompts.
- **Team:** 3 agents (Josh, Jacqui, Robyn) creating dashboards for Phoenix-area real estate clients.
- **Volume:** 20-50 active dashboards at any time. No performance/scale concerns.
- **Current pain points:** No persistent storage (regenerate from scratch), no update-in-place, buyer content generation is unreliable, Claude API max_tokens too low.
- **Templates:** 4 HTML templates exist (sell, buyer, buysell, houseversary). Houseversary will be removed from this app. The remaining 3 are large self-contained HTML files (~788KB) with CONFIG injection markers.
- **Deploy workflow:** Git push does NOT deploy. Must run `npm run deploy` or `npm run deploy:staging` manually. Staging and production are separate Cloudflare Workers.

## Constraints

- **Stack:** Next.js 14 (App Router) + Supabase + Cloudflare (Pages/R2/Workers) — must build on existing codebase
- **Templates:** Existing HTML templates are kept as-is — CONFIG injection pattern is validated and working
- **Auth:** Supabase Auth email/password — Josh provisions accounts, no self-serve
- **AI budget:** ~$1-3 per dashboard creation via Claude API — minimize API calls, maximize deterministic logic
- **Deploy:** Maintain staging/production Cloudflare split with manual deploys

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid static+admin architecture | Client dashboards stay fast/reliable as static HTML; admin gets dynamic Supabase-backed UI | — Pending |
| R2 for dashboard hosting | Static file serve at /d/{slug}, no server rendering per client request, ~1-3s publish | — Pending |
| Supabase over Prisma/PostgreSQL | Auth + RLS + real-time built in, free tier handles 20-50 dashboards easily | — Pending |
| Defer Cromford extraction | Rarely used by team — not worth the complexity for v1 | — Pending |
| Keep existing templates unchanged | Templates are large but working — CONFIG injection pattern is proven | — Pending |
| All 3 dashboard types required for v1 | Team needs seller + buyer + buy/sell before switching from current workflow | — Pending |

---
*Last updated: 2026-03-15 after initialization*
