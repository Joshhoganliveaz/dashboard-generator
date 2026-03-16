# Requirements: Live Dashboard Platform

**Defined:** 2026-03-15
**Core Value:** The team can create, update, and publish client dashboards through a guided wizard without touching code, and clients always see the latest version at a permanent URL.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: Team member can log in with email and password via Supabase Auth
- [x] **AUTH-02**: Team member session persists across browser refresh
- [x] **AUTH-03**: Unauthenticated users are redirected to login page
- [x] **AUTH-04**: Josh can provision new team accounts via Supabase dashboard
- [x] **AUTH-05**: Legacy cookie-based auth (SITE_PASSWORD) is fully removed

### Persistence

- [x] **PERS-01**: Dashboard metadata (slug, type, status, client names, agent) is stored in Supabase
- [x] **PERS-02**: Sell dashboard data (property details, comps, market metrics, narratives) is stored in Supabase
- [x] **PERS-03**: Buyer dashboard data (search criteria, neighborhoods, schools, timeline) is stored in Supabase
- [x] **PERS-04**: Buy/sell dashboards link both sell_data and buy_data to one dashboard record
- [x] **PERS-05**: RLS policies allow team members to CRUD all tables
- [x] **PERS-06**: RLS policies allow public users to SELECT published dashboards and associated data
- [x] **PERS-07**: Dashboard data saves immediately as draft when created in wizard

### Dashboard Library

- [x] **LIBR-01**: Team member sees all dashboards as cards on the home screen
- [x] **LIBR-02**: Each card shows client name, address/area, type badge, status badge, and last updated
- [x] **LIBR-03**: Team member can filter dashboards by type (sell/buyer/buysell)
- [x] **LIBR-04**: Team member can filter dashboards by status (draft/published/archived)
- [x] **LIBR-05**: Team member can click a dashboard card to re-enter the wizard with all data loaded

### Wizard

- [x] **WIZD-01**: Team member selects dashboard type (sell, buyer, buy/sell) in step 1
- [x] **WIZD-02**: Team member enters client info (names, email, agent assignment) in step 2
- [x] **WIZD-03**: For sell/buysell: team member enters property address and details in step 2
- [x] **WIZD-04**: For buyer: team member enters search criteria (areas, budget, beds/baths, must-haves) in step 2
- [x] **WIZD-05**: For sell/buysell: team member uploads MLS PDF and Claude extracts property data via structured output in step 3
- [x] **WIZD-06**: Extracted fields appear as editable inputs; team member can correct any value
- [x] **WIZD-07**: If PDF extraction fails, all fields appear as empty inputs with manual entry fallback
- [x] **WIZD-08**: For sell/buysell: team member uploads ARMLS CSV in step 4; deterministic engine scores comps
- [x] **WIZD-09**: Comp review panel shows all comps ranked by score; team member can toggle on/off
- [x] **WIZD-10**: Claude generates narrative content and validates comp selection in step 4
- [x] **WIZD-11**: If Claude narrative fails, deterministic results are shown with placeholder text
- [x] **WIZD-12**: Step 5 shows full dashboard preview in iframe with edit panel
- [x] **WIZD-13**: Team member can edit any value directly or give Claude natural language instructions
- [x] **WIZD-14**: Team member can add/remove properties of interest in step 5
- [x] **WIZD-15**: SSE streaming shows progress during generation steps
- [x] **WIZD-16**: Team member can navigate back to previous wizard steps without losing data
- [x] **WIZD-17**: Wizard saves progress to Supabase at each step transition

### Publishing

- [x] **PUBL-01**: One-click publish renders HTML from DB config and uploads to Cloudflare R2
- [x] **PUBL-02**: Published dashboard is accessible at /d/{slug} as static HTML
- [x] **PUBL-03**: Re-publishing overwrites the same R2 path — URL never changes
- [x] **PUBL-04**: Team member can download rendered HTML file for Lofty upload
- [x] **PUBL-05**: Dashboard status updates to "published" with timestamp after publish
- [x] **PUBL-06**: Shareable URL is displayed after publish for easy copying

### Status Lifecycle

- [x] **STAT-01**: New dashboards start as "draft"
- [x] **STAT-02**: Publishing moves status to "published"
- [x] **STAT-03**: Team member can archive a published dashboard (R2 file is deleted, URL returns 404)
- [x] **STAT-04**: Team member can un-archive and re-publish a dashboard

### Slug Management

- [x] **SLUG-01**: Slug is auto-generated from client names and address/area
- [x] **SLUG-02**: Slugs contain only lowercase letters, numbers, and hyphens
- [x] **SLUG-03**: Collision detection appends -2, -3, etc.
- [x] **SLUG-04**: Slug is editable before first publish
- [x] **SLUG-05**: Slug is locked after first publish to prevent broken URLs

### Dashboard Types

- [x] **TYPE-01**: Sell dashboard renders with 4 tabs: Your Home, Market, Listing Plan, Team
- [x] **TYPE-02**: Buyer dashboard renders with 4 tabs: Your Search, Neighborhoods, Properties, Team
- [x] **TYPE-03**: Buy/sell dashboard renders with 5 tabs: Sell Side, Buy Side, Strategy, Properties, Team
- [x] **TYPE-04**: Sell dashboard shows listing status badge (Pre-Listing/Active/Pending/Closed)

### Properties of Interest

- [x] **PROP-01**: Team member can add a property of interest with address, price, listing URL, and notes
- [x] **PROP-02**: Team member can remove a property of interest
- [x] **PROP-03**: Properties of interest display on buyer and buy/sell dashboards
- [x] **PROP-04**: Optional photo URL for each property (external link, no upload)

### Engine Fixes

- [x] **ENGN-01**: Claude API max_tokens increased to 16K+ for analysis calls
- [x] **ENGN-02**: Claude API uses structured output (tool_use with JSON schema) for extraction
- [x] **ENGN-03**: Claude API retry logic uses exponential backoff for rate limits
- [x] **ENGN-04**: CSV parsing uses Papaparse instead of custom parser
- [x] **ENGN-05**: Comp scoring and metric calculation are fully deterministic in TypeScript
- [x] **ENGN-06**: Claude's role in CSV pipeline reduced to narrative generation + comp validation
- [x] **ENGN-07**: CONFIG is validated against TypeScript types before template injection

## v2 Requirements

### Analytics

- **ANLT-01**: View count or basic analytics on published dashboards via Cloudflare Analytics

### Cromford

- **CROM-01**: Upload Cromford Report screenshots for Claude vision extraction
- **CROM-02**: Extracted Cromford metrics display on sell dashboard market tab

### Versioning

- **VERS-01**: Dashboard stores generation history with timestamps
- **VERS-02**: Team member can view previous versions of a dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Client login / authentication | Dashboards are public URLs; adding auth creates friction with zero value |
| Real-time collaboration | 3 agents, single-editor; CRDTs would be massive complexity for no benefit |
| Batch/bulk generation | 20-50 dashboards; one-at-a-time wizard flow is sufficient |
| Mobile app | Agents work at desks; client dashboards are already responsive HTML |
| Self-serve account creation | 3 users; Josh provisions manually via Supabase |
| Template visual editor | 3 templates maintained by developer; Webflow-like editor has zero ROI |
| Notification system | Agents communicate via existing channels (phone, email, text) |
| Scheduling / auto-publish | No use case; agents publish when ready |
| Houseversary template | Separate system at ~/Projects/Dashboard Template/ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| PERS-01 | Phase 1 | Complete |
| PERS-02 | Phase 1 | Complete |
| PERS-03 | Phase 1 | Complete |
| PERS-04 | Phase 1 | Complete |
| PERS-05 | Phase 1 | Complete |
| PERS-06 | Phase 5 | Complete |
| PERS-07 | Phase 1 | Complete |
| LIBR-01 | Phase 2 | Complete |
| LIBR-02 | Phase 2 | Complete |
| LIBR-03 | Phase 2 | Complete |
| LIBR-04 | Phase 2 | Complete |
| LIBR-05 | Phase 2 | Complete |
| WIZD-01 | Phase 2 | Complete |
| WIZD-02 | Phase 2 | Complete |
| WIZD-03 | Phase 2 | Complete |
| WIZD-04 | Phase 2 | Complete |
| WIZD-05 | Phase 2 | Complete |
| WIZD-06 | Phase 2 | Complete |
| WIZD-07 | Phase 2 | Complete |
| WIZD-08 | Phase 2 | Complete |
| WIZD-09 | Phase 2 | Complete |
| WIZD-10 | Phase 5 | Complete |
| WIZD-11 | Phase 5 | Complete |
| WIZD-12 | Phase 2 | Complete |
| WIZD-13 | Phase 2 | Complete |
| WIZD-14 | Phase 2 | Complete |
| WIZD-15 | Phase 2 | Complete |
| WIZD-16 | Phase 5 | Complete |
| WIZD-17 | Phase 2 | Complete |
| PUBL-01 | Phase 3 | Complete |
| PUBL-02 | Phase 3 | Complete |
| PUBL-03 | Phase 3 | Complete |
| PUBL-04 | Phase 3 | Complete |
| PUBL-05 | Phase 3 | Complete |
| PUBL-06 | Phase 3 | Complete |
| STAT-01 | Phase 2 | Complete |
| STAT-02 | Phase 3 | Complete |
| STAT-03 | Phase 3 | Complete |
| STAT-04 | Phase 3 | Complete |
| SLUG-01 | Phase 2 | Complete |
| SLUG-02 | Phase 2 | Complete |
| SLUG-03 | Phase 2 | Complete |
| SLUG-04 | Phase 2 | Complete |
| SLUG-05 | Phase 2 | Complete |
| TYPE-01 | Phase 4 | Complete |
| TYPE-02 | Phase 4 | Complete |
| TYPE-03 | Phase 4 | Complete |
| TYPE-04 | Phase 4 | Complete |
| PROP-01 | Phase 4 | Complete |
| PROP-02 | Phase 4 | Complete |
| PROP-03 | Phase 4 | Complete |
| PROP-04 | Phase 4 | Complete |
| ENGN-01 | Phase 1 | Complete |
| ENGN-02 | Phase 1 | Complete |
| ENGN-03 | Phase 1 | Complete |
| ENGN-04 | Phase 1 | Complete |
| ENGN-05 | Phase 1 | Complete |
| ENGN-06 | Phase 1 | Complete |
| ENGN-07 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 64 total
- Mapped to phases: 64
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
