# Live Dashboard Platform — Design Spec

## Overview

Transform the dashboard-generator from a static HTML generator into a **hybrid live dashboard platform** for buyer and seller clients. The admin team uses a guided wizard to create and manage dashboards backed by Supabase. Client-facing dashboards remain polished static HTML (existing templates with CONFIG injection) deployed to permanent URLs. Updates re-render and redeploy — same URL, new content.

**Scope:** Seller, Buyer, and Buy/Sell dashboards only. Homeowner/houseversary dashboards are a separate system (`~/Projects/Dashboard Template/`).

## Problem Statement

The current dashboard-generator has three reliability issues:
1. **Claude API integration** — default max_tokens too low (4096), no streaming, web search tool malformed, rate limiting causes failures
2. **CSV parsing** — sends entire CSV + analysis prompt to Claude in one shot; quality inconsistent because Claude does too much at once
3. **Template rendering** — CONFIG injection relies on exact markers; 788KB templates have large surface area for bugs

Beyond reliability, the static HTML model doesn't support the actual workflow: dashboards are **living documents** that evolve throughout the client relationship. Search criteria change, listing status progresses, properties of interest are added. Every update currently requires regeneration and manual redeployment.

## Architecture

### Hybrid Approach

- **Admin side:** Next.js app with guided wizard UI. Data stored in Supabase.
- **Client side:** Existing HTML templates rendered with CONFIG injection from database. Deployed as static files to permanent URLs on Cloudflare.
- **Update flow:** Team edits data in admin → hits "Publish" → HTML re-rendered with updated CONFIG → same URL, new content (~3 seconds).

### Stack

| Component | Technology |
|---|---|
| Frontend + API | Next.js 14 (existing app, evolved) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Hosting | Cloudflare Pages (app) + R2 (file storage) |
| AI | Claude API (Sonnet) — minimal calls, maximize deterministic logic |
| Dashboard rendering | Existing HTML templates with CONFIG injection |
| Auth | Supabase Auth (team only — clients don't log in) |

### System Flow

```
Team (Admin Wizard) → Supabase (persistent data) → Render Engine (HTML template + CONFIG) → Cloudflare (permanent URL)
                                                                                           ↗
Client (Public URL) ────────────────────────────────────────────────────────────────────────┘
```

## Data Model (Supabase Tables)

### `dashboards`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| slug | text, unique | Auto-generated from client names + area, e.g. `brandon-nicole-mesa`. On collision, append `-2`, `-3`, etc. Editable by team before first publish. |
| type | text | `"sell"`, `"buyer"`, or `"buysell"` |
| status | text | `"draft"`, `"published"`, `"archived"`. Independent of listing_status — a dashboard can be published while listing is pre-listing. Archiving is manual, not automatic. |
| client_names | text | Display name — e.g., "Brandon & Nicole" |
| full_name | text | Legal/full name — e.g., "Brandon Newman & Nicole Savage" |
| client_email | text | |
| agent_key | text | `"josh_jacqui"`, `"robyn"`, etc. |
| created_by | uuid | FK to Supabase auth user |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| published_at | timestamptz | Last deploy timestamp |

### `sell_data`
| Column | Type | Notes |
|---|---|---|
| dashboard_id | uuid, FK (unique) | One-to-one with dashboards |
| address | text | |
| city_state_zip | text | |
| subdivision | text | |
| community_name | text | |
| beds | int | |
| baths | numeric | |
| sqft | int | |
| lot_sqft | int | |
| year_built | int | |
| pool | boolean | |
| stories | int | |
| purchase_price | int | |
| loan_payoff | int | |
| estimated_sale_price | int | |
| listing_status | text | `"pre-listing"`, `"active"`, `"pending"`, `"closed"`. Tracks the real-world listing stage. Independent of dashboard publish status. |
| comps | jsonb | Array of comp objects (matches existing CompSale type) |
| market_metrics | jsonb | Matches existing MarketMetrics type |
| cromford_data | jsonb | `{ metrics: CromfordMetric[], takeaway: string, source: string }` |
| pricing_strategy | text | |
| features | jsonb | Property feature cards (Feature[]) |
| property_highlights | jsonb | String array of key selling points |
| upgrades | jsonb | `{ name: string, value: string }[]` — seller improvements |
| competition | jsonb | Active/pending competing listings (CompetitionListing[]) |
| market_snapshot | jsonb | `{ label: string, value: string }[]` — summary stats |
| prep_items | jsonb | PrepItem[] — listing prep checklist |
| marketing_plan | jsonb | String array — marketing activities |
| timeline | jsonb | `{ phase: string, dates: string, items: string[] }[]` — listing timeline |

### `buy_data`
| Column | Type | Notes |
|---|---|---|
| dashboard_id | uuid, FK (unique) | One-to-one with dashboards |
| target_areas | text | |
| budget_min | int | |
| budget_max | int | |
| beds_min | int | |
| baths_min | int | |
| must_haves | text[] | |
| school_preference | text | |
| neighborhoods | jsonb | NeighborhoodCard[] — area recommendation cards |
| school_districts | jsonb | SchoolDistrict[] — district info with individual schools |
| timeline | jsonb | `{ phase: string, title: string, items: string[] }[]` — buyer journey |
| market_snapshot | jsonb | `{ label: string, value: string }[]` — area market stats |
| home_search_url | text | |

### Buy/Sell Dashboards
A buy/sell dashboard has **both** a `sell_data` row and a `buy_data` row linked to the same `dashboards` record. No separate `buysell_data` table — the buy/sell template reads from both. Additional buy/sell-specific fields:

| Column | Table | Type | Notes |
|---|---|---|---|
| strategy_options | buy_data | jsonb | `{ label: string, title: string, pros: string[], cons: string[] }[]` — sell-first vs. buy-first vs. simultaneous |
| strategy_timeline | buy_data | jsonb | `{ phase: string, title: string, items: string[] }[]` — coordination plan |

These live on `buy_data` since they only exist when there is a buy side. The template engine checks `dashboard.type === "buysell"` to know to render both sides + strategy tab.

### `properties_of_interest`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| dashboard_id | uuid, FK | Many-to-one |
| address | text | |
| price | int | |
| listing_url | text | |
| photo_url | text | Optional |
| notes | text | Agent notes |
| added_at | timestamptz | |

### RLS Policies
- Team members (authenticated via Supabase Auth) can CRUD all tables
- Public (unauthenticated) can SELECT dashboards with `status = 'published'` and their associated sell_data, buy_data, and properties_of_interest
- Initial auth: email/password for team members. Josh provisions accounts manually (invite-only). Migration from current `SITE_PASSWORD` env var approach.

## Admin UI

### Dashboard Library (Home Screen)

The first thing the team sees at `/admin`. Shows all dashboards as cards with:
- Client name and address/search area
- Dashboard type badge (Seller / Buyer / Buy-Sell) with color coding
- Status badge (Draft / Published / Archived)
- Last updated timestamp
- Edit / Continue link
- Filter by type dropdown
- "+ New Dashboard" button

### Wizard Flow (6 Steps)

#### Step 1: Dashboard Type
Pick: Seller, Buyer, or Buy/Sell. Controls which subsequent steps and fields appear. No API calls.

#### Step 2: Client Info
- Client names, full name, email, agent assignment
- For sell/buysell: property address, city/state/zip
- For buyer: target areas, budget range, beds/baths minimums, must-haves, school preferences
- Saves to Supabase as draft immediately

#### Step 3: Property Details (sell & buysell only)
- Upload MLS listing PDF and/or tax records PDF
- Claude API extracts property data using structured output (tool_use with JSON schema defining beds, baths, sqft, yearBuilt, pool, stories, lotSqft, purchasePrice, loanPayoff, features). 1 API call, ~5 seconds.
- **Fallback if API fails:** All fields are shown as empty text inputs. Agent fills them manually. A banner says "Auto-extraction unavailable — enter property details below." The wizard can proceed without AI.
- Extracted fields appear below for review with yellow highlight on AI-filled values
- All fields are editable regardless of extraction source
- Inline help explains what each file provides
- PDFs are uploaded to Cloudflare R2. Extraction results are cached by file hash — re-uploading the same PDF skips the API call.

#### Step 4: Market Data (sell & buysell only)
- Upload ARMLS CSV export
- Inline help explains how to pull the CSV from ARMLS/FlexMLS (step-by-step with screenshots)
- CSV engine runs: Papaparse for parsing, deterministic scoring/metric calculation in TypeScript
- Claude API generates narratives and validates comp selection (1-2 API calls, ~10-15 seconds)
- **Fallback if API fails:** Comps and metrics are shown from the deterministic engine. Narrative sections show placeholder text ("Market narrative will be generated — you can retry or write your own."). Agent can proceed, publish, and re-run narrative generation later.
- Comp review panel: all comps ranked by match score, toggle on/off, metrics update live
- Optional: upload Cromford Report screenshots (.png). Claude vision API (Sonnet) extracts market metrics into a structured `CromfordMetric[]` array (label, value, arrow direction, color, context). Produces a `cromfordTakeaway` summary paragraph and `cromfordSource` citation. If extraction fails, Cromford section is omitted from the dashboard.

#### Step 5: Review & Edit
- Full dashboard preview in iframe
- Content sections (narratives, outlook, upgrade recs) generated here
- Edit panel: change any value directly, or give Claude natural language instructions
- **Properties of interest:** Add/remove properties at this stage (optional — can also be added later during updates). Simple form: address, price, listing URL, notes.
- 1 API call for initial content generation; edits are optional additional calls

#### Step 6: Publish
- One-click publish → renders HTML template with CONFIG from DB → deploys to permanent URL
- Also shows "Download HTML" button for Lofty upload
- Dashboard status moves to "published"
- Shows the shareable URL to copy

### Updating a Dashboard

From the library, click any dashboard to re-enter the wizard with all data loaded. The agent can:
- Update search criteria (buy side)
- Update listing status (sell side)
- Add/remove properties of interest
- Re-run market data with a fresh CSV
- Edit any field
- Hit "Publish" to update the live URL

Draft/published status prevents clients from seeing half-updated data. Changes are saved as draft until explicitly published.

## Deployment Mechanism

### How "Publish" Works

When a team member clicks "Publish":

1. **Render:** Server-side API route reads all dashboard data from Supabase, assembles a CONFIG object matching the template's expected shape, and calls `injectConfig(templateHtml, config)` to produce a self-contained HTML file.
2. **Upload:** The rendered HTML file is uploaded to **Cloudflare R2** at the path `dashboards/{slug}/index.html`.
3. **Serve:** A Cloudflare Pages rewrite rule maps `/d/{slug}` to the R2 object. This is a static file serve — no server rendering on each client request.
4. **Update timestamp:** `dashboards.published_at` is updated in Supabase.

This approach means:
- Client-facing pages are pure static HTML — fast, reliable, no server dependency
- The Next.js app only serves the admin UI and API routes
- Publishing is a simple R2 PUT — takes ~1-3 seconds
- The same R2 path is overwritten on re-publish, so the URL never changes

### HTML Export

The same render step produces the HTML for download. The "Download HTML" button calls the same API route but returns the file as a download instead of uploading to R2.

## Client-Facing Dashboards

### URL Structure
`/d/{slug}` — e.g., `/d/brandon-nicole-mesa`

Served via Cloudflare R2 behind a rewrite rule. Each dashboard type has its own template with a specific tab structure:

### Seller Dashboard Tabs
1. **Your Home** — property details, estimated value, equity snapshot
2. **Market** — comps table, pricing strategy, market metrics, Cromford data
3. **Listing Plan** — prep timeline, marketing plan, net proceeds calculator
4. **Team** — agent info, credentials, contact CTA

Status badge visible: Pre-Listing / Active / Pending / Closed

### Buyer Dashboard Tabs
1. **Your Search** — criteria summary, budget, must-haves
2. **Neighborhoods** — area cards, school districts, commute info
3. **Properties** — properties of interest with agent notes
4. **Team** — agent info, credentials, contact CTA

### Buy/Sell Dashboard Tabs
1. **Sell Side** — current home value, comps, pricing
2. **Buy Side** — search criteria, neighborhoods, schools
3. **Strategy** — bridge options, timeline, coordination plan
4. **Properties** — properties of interest
5. **Team** — agent info, credentials, contact CTA

### Properties of Interest Section
Lightweight list of homes the agent has flagged as worth a closer look. Each entry shows:
- Address and price
- Link to listing
- Agent's notes
- Optional photo

Not a full CRM — just enough context for the client to know what's been flagged and why.

### HTML Export
An API endpoint renders the dashboard to a self-contained HTML file (same CONFIG injection as the deployed version) for download. This file can be uploaded to Lofty or shared directly.

## Engine Fixes

### Claude API
- Increase max_tokens to 16K+ for analysis calls
- Add streaming for long operations (SSE to the frontend for progress)
- Better retry logic with exponential backoff (already partially built)
- Use structured output (tool_use with JSON schema) instead of hoping for valid JSON in free text
- Fix web search tool format

### CSV Engine
- Use Papaparse for CSV parsing instead of custom parser
- Move comp scoring, metric calculation, filtering to deterministic TypeScript (already partially done)
- Claude's role reduced to: narrative generation + comp selection validation
- Pre-validate data before sending to Claude (check for required columns, data types)
- Keep the existing deterministic score override and comp adjustment logic

### Template Rendering
- Validate CONFIG against TypeScript types before injection
- Keep existing NaN/undefined/Infinity scanner
- Test templates with empty/minimal data — ensure graceful fallbacks
- Remove houseversary template from this app

### PDF Extraction
- Use structured output schema for MLS and tax record extraction
- Extracted values shown as editable fields (human in the loop)
- Cache extractions — don't re-run if same PDF uploaded

## What We Keep vs. What Changes

### Keep from existing codebase
- HTML dashboard templates (sell, buyer, buysell)
- CONFIG injection / template engine (`template-engine.ts`)
- CSV analysis engine + deterministic scoring (`csv-engine.ts`, `comp-adjustments.ts`)
- Claude API integration structure (`claude-api.ts` — with fixes)
- Type definitions (`types.ts` — extended)
- Design system (desert palette, fonts, component patterns)
- Template registry pattern (`template-registry.ts` — minus houseversary)

### Change / Add
- Supabase tables + RLS policies
- Admin wizard UI → guided 6-step flow (replaces current single-page form)
- Dashboard library home screen
- Properties of interest CRUD
- Publish flow (render from DB → deploy to URL)
- HTML export API endpoint
- Supabase Auth for team login
- Fix API reliability (max tokens, streaming, structured output)
- Fix CSV engine (Papaparse, more deterministic)
- Draft/published status system
- Remove houseversary template and batch mode

## Implementation Notes

### R2 + Pages Integration
The Cloudflare Pages rewrite rule is configured via a `_routes.json` or Pages Function at `/d/*` that reads from the R2 binding. The Next.js app routes (`/admin`, `/api`) are handled by the OpenNext adapter. Client-facing `/d/{slug}` requests bypass Next.js entirely and serve the static HTML from R2.

### Archival Behavior
When a dashboard is archived, the R2 HTML file is deleted and the URL returns a 404. If the dashboard is later un-archived and re-published, it is re-rendered and re-uploaded.

### Buyer Dashboard Content Generation
For pure buyer dashboards (no sell side), Step 2 collects search criteria. Between Step 2 and Step 5, an API call generates the `neighborhoods`, `school_districts`, `timeline`, and `market_snapshot` content from the target areas, budget, and preferences. This uses Claude + web search. If it fails, the agent can manually add neighborhood cards or proceed without them.

### Properties of Interest Photos
`photo_url` stores external URLs (MLS listing photos, Zillow/Redfin images). No photo upload to R2 — agents paste the listing URL and the photo URL from the listing. This keeps the flow simple.

### Slug Rules
Slugs may only contain lowercase letters, numbers, and hyphens. Validated on input. Once a dashboard is published, the slug is locked to prevent broken URLs. If a slug change is needed after publishing, the old R2 file is deleted and a new one created at the new path.

## Scale Considerations

- 20-50 active dashboards at any given time
- Supabase free tier handles this easily
- Cloudflare Pages/R2 for static hosting — effectively free at this scale
- Claude API cost: ~$1-3 per dashboard creation, negligible for updates
- No performance concerns at this volume
