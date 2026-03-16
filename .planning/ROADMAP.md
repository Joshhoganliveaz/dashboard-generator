# Roadmap: Live Dashboard Platform

## Overview

Transform the existing stateless dashboard generator into a persistent platform where the Live AZ Co team creates, manages, and publishes client dashboards through a guided wizard. The build starts with database and auth infrastructure, layers the admin UI on top, adds the publish-to-CDN pipeline, then completes all dashboard types with properties of interest. Each phase delivers a working increment: first the team can log in and data persists, then they can create dashboards through a wizard, then dashboards go live at permanent URLs, then all three dashboard types are fully supported.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Supabase auth, database schema with RLS, and engine fixes (completed 2026-03-15)
- [x] **Phase 2: Admin UI** - Dashboard library home screen and 6-step wizard with sell dashboard generation (completed 2026-03-15)
- [ ] **Phase 3: Publish Pipeline** - Render HTML from DB, publish to R2, permanent URLs, status lifecycle
- [ ] **Phase 4: Full Dashboard Types** - Buyer and buy/sell dashboard support with properties of interest

## Phase Details

### Phase 1: Foundation
**Goal**: Team members can securely log in and all dashboard data persists in Supabase with correct access control, while the generation engine is hardened for reliability
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, PERS-01, PERS-02, PERS-03, PERS-04, PERS-05, PERS-06, PERS-07, ENGN-01, ENGN-02, ENGN-03, ENGN-04, ENGN-05, ENGN-06, ENGN-07
**Success Criteria** (what must be TRUE):
  1. Team member can log in with email/password at the login page and stays logged in across browser refreshes
  2. Unauthenticated visitors are redirected to login; legacy SITE_PASSWORD auth no longer works
  3. Dashboard, sell_data, buy_data, and properties_of_interest tables exist with RLS policies that allow team CRUD and public SELECT on published records
  4. Claude API calls use structured output with 16K+ max_tokens and exponential backoff retry; CSV parsing uses Papaparse with deterministic scoring
  5. Auth and database work correctly when deployed to Cloudflare Workers via wrangler dev (not only in next dev)
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Supabase auth: client utilities, middleware, login page, legacy auth removal
- [ ] 01-02-PLAN.md — Database schema: 4 tables with RLS, TypeScript types, CRUD helpers
- [ ] 01-03-PLAN.md — Engine hardening: Claude SDK + structured output, Papaparse CSV, Zod validation

### Phase 2: Admin UI
**Goal**: Team members can browse all dashboards in a library view and create new sell dashboards through a guided 6-step wizard that saves progress automatically
**Depends on**: Phase 1
**Requirements**: LIBR-01, LIBR-02, LIBR-03, LIBR-04, LIBR-05, WIZD-01, WIZD-02, WIZD-03, WIZD-04, WIZD-05, WIZD-06, WIZD-07, WIZD-08, WIZD-09, WIZD-10, WIZD-11, WIZD-12, WIZD-13, WIZD-14, WIZD-15, WIZD-16, WIZD-17, SLUG-01, SLUG-02, SLUG-03, SLUG-04, SLUG-05, STAT-01
**Success Criteria** (what must be TRUE):
  1. Team member sees all dashboards as filterable cards on the home screen (filter by type and status)
  2. Team member can start a new dashboard and progress through all 6 wizard steps, with data auto-saving to Supabase at each step transition
  3. Team member can upload an MLS PDF and review/correct extracted fields; can upload ARMLS CSV and review ranked comps with toggle on/off
  4. Team member can navigate back to previous wizard steps without losing data, and can resume a draft from the library
  5. SSE streaming shows progress during generation; if Claude fails, deterministic results appear with placeholder text
**Plans**: TBD

Plans:
- [ ] 02-01-PLAN.md — Dashboard library: home screen with filterable dashboard cards
- [x] 02-02-PLAN.md — Wizard framework: type selection, wizard shell, step navigation, auto-save hook
- [ ] 02-03-PLAN.md — Client info + property data wizard steps
- [ ] 02-04-PLAN.md — Market analysis wizard step with CSV upload and comp review
- [ ] 02-05-PLAN.md — Preview, edit, and publish wizard steps

### Phase 3: Publish Pipeline
**Goal**: Team members can publish dashboards to permanent Cloudflare R2 URLs and manage the draft/published/archived lifecycle
**Depends on**: Phase 2
**Requirements**: PUBL-01, PUBL-02, PUBL-03, PUBL-04, PUBL-05, PUBL-06, STAT-02, STAT-03, STAT-04
**Success Criteria** (what must be TRUE):
  1. Team member clicks publish and the dashboard appears at /d/{slug} as static HTML within seconds
  2. Re-publishing updates the same URL with new content; the slug never changes after first publish
  3. Team member can download rendered HTML for Lofty upload; shareable URL is displayed for easy copying
  4. Team member can archive a dashboard (URL returns 404) and un-archive it (re-publish restores the URL)
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — R2 infrastructure, publish rendering pipeline, public serving route, download endpoint
- [ ] 03-02-PLAN.md — StepPublish UI wiring (publish/download/archive buttons, URL copy), archive API, status lifecycle

### Phase 4: Full Dashboard Types
**Goal**: All three dashboard types (sell, buyer, buy/sell) render correctly with full content, and team members can manage properties of interest for buyer dashboards
**Depends on**: Phase 3
**Requirements**: TYPE-01, TYPE-02, TYPE-03, TYPE-04, PROP-01, PROP-02, PROP-03, PROP-04
**Success Criteria** (what must be TRUE):
  1. Sell dashboard renders with 4 tabs (Your Home, Market, Listing Plan, Team) including listing status badge
  2. Buyer dashboard renders with 4 tabs (Your Search, Neighborhoods, Properties, Team) populated from search criteria
  3. Buy/sell dashboard renders with 5 tabs combining sell and buyer data linked to one dashboard record
  4. Team member can add, remove, and annotate properties of interest that display on buyer and buy/sell dashboards
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Tab structure alignment, listing status badge, template tab renames
- [ ] 04-02-PLAN.md — Properties of interest in publish pipeline and template rendering

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-03-15 |
| 2. Admin UI | 5/5 | Complete   | 2026-03-15 |
| 3. Publish Pipeline | 1/2 | In Progress | - |
| 4. Full Dashboard Types | 1/2 | In Progress|  |
