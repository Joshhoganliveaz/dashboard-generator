# Live Dashboard Platform

## What This Is

A hybrid live dashboard platform for the Live AZ Co real estate team. Team members use a guided admin wizard (Next.js 14 + Supabase) to create and manage seller, buyer, and buy/sell client dashboards. Client-facing dashboards are polished static HTML (existing templates with CONFIG injection) published to permanent Cloudflare R2 URLs. Updates re-render and redeploy — same URL, new content.

## Core Value

The team can create, update, and publish client dashboards through a guided wizard without touching code, and clients always see the latest version at a permanent URL.

## Requirements

### Validated

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
- ✓ Supabase Auth with SSR middleware (email/password, session persistence, RLS) — v1.0
- ✓ 4-table Supabase schema (dashboards, sell_data, buy_data, properties_of_interest) with RLS — v1.0
- ✓ Claude SDK structured output with 16K+ max_tokens and exponential backoff — v1.0
- ✓ Papaparse CSV parsing with deterministic comp scoring — v1.0
- ✓ Dashboard library with filterable card grid (type + status filters) — v1.0
- ✓ 6-step wizard with auto-save (type → client → property → market → preview → publish) — v1.0
- ✓ MLS PDF extraction via Claude structured output with editable field review — v1.0
- ✓ CSV comp scoring with SSE streaming and toggle-able comp review panel — v1.0
- ✓ R2 publish pipeline: render HTML from DB → upload → permanent /d/{slug} URL — v1.0
- ✓ HTML download for Lofty upload — v1.0
- ✓ Draft/published/archived status lifecycle with archive/un-archive flow — v1.0
- ✓ Slug auto-generation with collision detection, locked after first publish — v1.0
- ✓ All 3 dashboard types with correct tab structures and listing status badge — v1.0
- ✓ Properties of interest CRUD with rendering on buyer/buysell dashboards — v1.0
- ✓ Buyer wizard flow with search criteria (skips property extraction step) — v1.0
- ✓ Buy/sell dashboard linking both sell_data and buy_data to one record — v1.0

### Active

- [ ] Cromford Report screenshot extraction via Claude vision
- [ ] Dashboard generation history / versioning
- [ ] View count or basic analytics on published dashboards

### Out of Scope

- Houseversary template — separate system at ~/Projects/Dashboard Template/
- Batch/bulk dashboard generation — not needed for 20-50 active dashboards
- Client-side authentication — clients don't log in, dashboards are public URLs
- Real-time collaboration — single agent edits at a time
- Mobile app — web-only platform
- Self-serve team account creation — Josh provisions manually via Supabase

## Context

- **Shipped:** v1.0 on 2026-03-15 — 5 phases, 13 plans, 105 commits, 13,763 lines TypeScript
- **Stack:** Next.js 14 (App Router), Supabase (Auth + DB + RLS), Cloudflare Workers (OpenNext), R2 (static hosting)
- **Team:** 3 agents (Josh, Jacqui, Robyn) creating dashboards for Phoenix-area real estate clients
- **Volume:** 20-50 active dashboards at any time
- **Test suite:** 127 tests across 14 files, all passing
- **Deploy:** `npm run deploy:staging` / `npm run promote` — manual, git push does not deploy
- **Known tech debt:** `createDashboard` orphaned export in db.ts, incomplete SUMMARY frontmatter in phase 03-02, Workers deployment needs human verification

## Constraints

- **Stack:** Next.js 14 (App Router) + Supabase + Cloudflare (Workers/R2) — must build on existing codebase
- **Templates:** Existing HTML templates are kept as-is — CONFIG injection pattern is validated and working
- **Auth:** Supabase Auth email/password — Josh provisions accounts, no self-serve
- **AI budget:** ~$1-3 per dashboard creation via Claude API — minimize API calls, maximize deterministic logic
- **Deploy:** Maintain staging/production Cloudflare split with manual deploys

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid static+admin architecture | Client dashboards stay fast/reliable as static HTML; admin gets dynamic Supabase-backed UI | ✓ Good |
| R2 for dashboard hosting | Static file serve at /d/{slug}, no server rendering per client request, ~1-3s publish | ✓ Good |
| Supabase over Prisma/PostgreSQL | Auth + RLS + real-time built in, free tier handles 20-50 dashboards easily | ✓ Good |
| Defer Cromford extraction | Rarely used by team — not worth the complexity for v1 | ✓ Good |
| Keep existing templates unchanged | Templates are large but working — CONFIG injection pattern is proven | ✓ Good |
| All 3 dashboard types required for v1 | Team needs seller + buyer + buy/sell before switching from current workflow | ✓ Good |
| JSONB columns for nested data | Comps, metrics, narratives stored as JSONB — simpler than normalized tables for 20-50 dashboards | ✓ Good |
| @supabase/ssr three-client pattern | Browser/server/middleware clients per Supabase docs — clean SSR auth | ✓ Good |
| URL search params for wizard steps | ?step=N routing instead of nested routes — simpler, preserves state | ✓ Good |
| Browser Supabase client for creation | Wizard creates via browser client directly — RLS handles auth, simpler than API route | ✓ Good |
| Select-then-insert/update vs ON CONFLICT | Supabase RLS compatibility required this pattern over upsert | ✓ Good |
| R2 keys match URL path | d/{slug}.html format — direct mapping between key and public URL | ✓ Good |
| Stream R2 body directly | Avoid buffering large templates (~788KB) in memory | ✓ Good |

---
*Last updated: 2026-03-16 after v1.0 milestone*
