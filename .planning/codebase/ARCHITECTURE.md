# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Server-side AI pipeline with SSE streaming, fronted by a single-page React admin UI

**Key Characteristics:**
- Two-phase generation pipeline with human-in-the-loop comp review between phases
- Claude API orchestrates all AI work (PDF extraction, CSV analysis, content writing, web research)
- Self-contained HTML templates with injected CONFIG objects produce static, deliverable dashboards
- No database -- client data pulled from Google Sheets, dashboards are standalone HTML files

## Layers

**Presentation Layer (Admin UI):**
- Purpose: Form-based admin interface for agents to generate client dashboards
- Location: `src/app/page.tsx` (single page), `src/components/`, `src/hooks/`
- Contains: Form inputs, file uploads, SSE progress display, comp review panel, HTML preview/download
- Depends on: API routes via fetch, template registry for form logic
- Used by: Real estate agents (Josh, Jacqui, Robyn)

**API Layer (Route Handlers):**
- Purpose: Orchestrate the multi-step generation pipeline
- Location: `src/app/api/`
- Contains: SSE streaming endpoints, login, client data proxy, subdivision lookup
- Depends on: All `src/lib/` modules
- Used by: Presentation layer via fetch

**AI Integration Layer:**
- Purpose: Wrapper around Anthropic Claude API for all AI capabilities
- Location: `src/lib/claude-api.ts`
- Contains: Text, PDF, image, and web search Claude calls with retry logic
- Depends on: `ANTHROPIC_API_KEY` env var, Anthropic Messages API
- Used by: API route handlers, CSV engine

**Analysis Engine:**
- Purpose: Parse ARMLS CSV data, compute market metrics, score/select comparable sales
- Location: `src/lib/csv-engine.ts`, `src/lib/comp-adjustments.ts`
- Contains: CSV parsing, comp scoring, GLA/bath/pool adjustments, neighborhood stats, bedroom analysis
- Depends on: Claude API (for initial CSV analysis prompt), PapaParse
- Used by: Generation pipeline routes

**Financial Engine:**
- Purpose: Estimate current mortgage balance from tax record data
- Location: `src/lib/loan-estimator.ts`
- Contains: Amortization math, historical rate lookup (Freddie Mac PMMS), refinance chain classification
- Depends on: Nothing (pure computation)
- Used by: Generation pipeline routes

**Prompt Library:**
- Purpose: All Claude prompt templates for extraction and content generation
- Location: `src/lib/claude-prompts.ts` (46K+ lines)
- Contains: MLS extraction, tax records extraction, Cromford extraction, web research, content generation prompts for all 4 template types, edit prompt
- Depends on: Type definitions
- Used by: API route handlers

**Template System:**
- Purpose: Convert config objects into deliverable HTML dashboards
- Location: `src/lib/template-engine.ts`, `src/lib/template-loader.ts`, `src/lib/template-registry.ts`, `src/lib/template-*.html`
- Contains: Config serialization, marker-based injection, render bug scanning, template loading via webpack raw imports
- Depends on: HTML template files loaded as raw strings via `asset/source` webpack rule in `next.config.js`
- Used by: Generation and edit pipeline routes

**Type System:**
- Purpose: TypeScript interfaces for all data shapes
- Location: `src/lib/types.ts`
- Contains: `DashboardConfig`, `SellDashboardConfig`, `BuyerDashboardConfig`, `BuySellDashboardConfig`, `CompSale`, `MarketMetrics`, `SubjectProperty`, validation functions
- Used by: All layers

## Data Flow

**Dashboard Generation (Two-Phase Pipeline):**

1. Agent fills form with client info, uploads CSV + optional PDF/images on `src/app/page.tsx`
2. `useGenerateDashboard.generate()` POSTs FormData to `/api/dashboard/generate`
3. **Phase 1** (route: `src/app/api/dashboard/generate/route.ts`):
   - Extract property details from MLS PDF via Claude (`askClaudeWithPDF`)
   - Parse ARMLS CSV via `csv-engine.ts` (deterministic scoring + Claude analysis)
   - Extract purchase/loan data from tax records PDF via Claude
   - Estimate current loan balance via `loan-estimator.ts` amortization
   - SSE streams `review_comps` event with comps + cached Phase 1 data, then **closes stream**
4. Agent reviews comps in `CompReviewPanel.tsx`, can remove/reorder, verify loan data
5. `useGenerateDashboard.continueWithComps()` POSTs approved comps + cached data to `/api/dashboard/generate/continue`
6. **Phase 2** (route: `src/app/api/dashboard/generate/continue/route.ts`):
   - Read Cromford market screenshots via Claude (`askClaudeWithImages`)
   - Web research for city developments via Claude web search tool
   - Generate narrative content via Claude (template-specific prompt)
   - Recalculate market metrics from approved comps with `deriveValueFromComps()`
   - Build typed config object (e.g., `DashboardConfig`, `SellDashboardConfig`)
   - Inject config into HTML template via `injectConfig()` (marker-based replacement)
   - SSE streams `complete` event with final HTML
7. Agent previews HTML in iframe, can apply natural-language edits via `/api/dashboard/edit`
8. Agent downloads final HTML file

**Dashboard Edit Flow:**

1. Agent types edit instruction (e.g., "change the header to say Happy 5-Year Anniversary")
2. `useGenerateDashboard.applyEdit()` POSTs current HTML + instruction to `/api/dashboard/edit`
3. `src/app/api/dashboard/edit/route.ts`:
   - Extracts CONFIG from HTML via `extractConfig()` (uses `new Function()`)
   - Sends CONFIG JSON + instruction to Claude via `dashboardEditPrompt()`
   - Claude returns modified CONFIG JSON
   - Re-injects into fresh template via `injectConfig()`
4. Updated HTML returned to client, replaces preview

**Client Data Flow:**

1. `useClients` hook fetches `/api/clients` on mount
2. `/api/clients` route fetches Google Sheet CSV via public export URL
3. PapaParse parses CSV, maps to `ClientRecord[]`, caches in-memory for 5 minutes
4. `ClientPicker.tsx` component enables agent to select a client, auto-filling form fields

**Subdivision Lookup Flow:**

1. Agent selects client or enters address
2. `POST /api/clients/subdivision` with address + cityStateZip
3. Route uses `askClaudeWithWebSearch` to look up Maricopa County Assessor records
4. Returns `{subdivision, communityName}` to auto-fill form

**SSE Streaming Protocol:**

Events use `data: {JSON}\n\n` format. Step names defined in `src/lib/types.ts` as `GenerationStepName`:
- `parsing_csv` | `extracting_mls` | `reading_cromford` | `reading_tax_records` | `researching` | `generating_content` | `assembling` -- progress updates
- `review_comps` -- pauses pipeline, includes `comps`, `csvResult`, `mlsData`, `loanData`
- `warning` -- non-fatal issue (e.g., negative equity, web research failure)
- `complete` -- includes `html` payload
- `error` -- includes `message`

**State Management:**
- No global store. `useState` in `src/app/page.tsx` for form state
- `useGenerateDashboard` hook manages generation state machine (idle -> steps -> review_comps -> steps -> complete)
- Phase 1 cached data stored in `useRef` (not state) to avoid React batching races
- `FormData` stored in `useRef` for re-use in Phase 2

## Key Abstractions

**Template Registry:**
- Purpose: Defines per-template-type configuration (required files, pipeline steps, analysis lens)
- Location: `src/lib/template-registry.ts`
- Pattern: Static registry object `TEMPLATE_REGISTRY` keyed by `TemplateType`
- Template types: `houseversary`, `sell`, `buyer`, `buysell`

**AnalysisLens:**
- Purpose: Controls how CSV engine scores comps (homeowner vs listing vs buyer perspective)
- Values: `"homeowner"` (houseversary), `"listing"` (sell, buysell), `"buyer"` (buyer)
- Used by: `csv-engine.ts` `runFullAnalysis()` to adjust scoring criteria

**AnyDashboardConfig (Union Type):**
- Purpose: Type-safe union of all 4 dashboard config shapes
- Location: `src/lib/types.ts`
- Pattern: Discriminated union on `templateType` field
- Members: `DashboardConfig` | `SellDashboardConfig` | `BuyerDashboardConfig` | `BuySellDashboardConfig`

**HTML Template + CONFIG Injection:**
- Purpose: Templates are complete self-contained HTML files with a CONFIG placeholder
- Pattern: Templates contain `// === CONFIG` and `// === END CONFIG ===` markers. `injectConfig()` replaces the block between markers with serialized JS object literal
- The output is a single deliverable HTML file with all CSS/JS inline -- no external dependencies

**Builder Functions:**
- Purpose: Template-specific config assembly from Claude responses + computed data
- Location: `src/app/api/dashboard/generate/route.ts`, `src/app/api/dashboard/generate/continue/route.ts`
- Pattern: `buildHouseversaryConfig()`, `buildSellConfig()`, `buildBuyerConfig()`, `buildBuySellConfig()`
- Note: These functions are **duplicated** across both route files (Phase 1 and Phase 2)

## Entry Points

**Web Application:**
- Location: `src/app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Form UI, file upload, generation orchestration, preview, download

**Login:**
- Location: `src/app/login/page.tsx`
- Triggers: Unauthenticated access (middleware redirect)
- Responsibilities: Password entry, cookie-based auth

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request except static assets
- Responsibilities: Check `dashboard-auth` cookie, redirect to `/login` if missing

**API - Generate Phase 1:**
- Location: `src/app/api/dashboard/generate/route.ts`
- Triggers: POST from `useGenerateDashboard.generate()`
- Responsibilities: MLS extraction, CSV analysis, tax records, comp review pause

**API - Generate Phase 2:**
- Location: `src/app/api/dashboard/generate/continue/route.ts`
- Triggers: POST from `useGenerateDashboard.continueWithComps()`
- Responsibilities: Cromford, web research, content generation, template assembly

**API - Edit:**
- Location: `src/app/api/dashboard/edit/route.ts`
- Triggers: POST from `useGenerateDashboard.applyEdit()`
- Responsibilities: Extract config, Claude edit, re-inject

**API - Clients:**
- Location: `src/app/api/clients/route.ts`
- Triggers: GET from `useClients` hook
- Responsibilities: Fetch Google Sheet, parse, cache, return client list

**API - Subdivision Lookup:**
- Location: `src/app/api/clients/subdivision/route.ts`
- Triggers: POST when agent selects client
- Responsibilities: Claude web search for county assessor subdivision data

## Error Handling

**Strategy:** Graceful degradation with warnings. Non-critical steps (tax records, web research, Cromford) catch errors and continue. Critical steps (CSV with 0 comps) throw and surface via SSE error event.

**Patterns:**
- SSE `error` events propagate to UI via `useGenerateDashboard` state machine
- SSE `warning` events accumulate in `warnings[]` array, displayed but don't block generation
- Claude API has 3-attempt retry with exponential backoff for 429 rate limits (`src/lib/claude-api.ts`)
- `parseJSONFromClaude()` helper handles markdown fences, prose before/after JSON, and extracted `{...}` fallback -- duplicated in 3 route files
- `scanHtmlForRenderBugs()` catches NaN/Infinity/undefined in CONFIG and missing purchase data

## Cross-Cutting Concerns

**Authentication:** Cookie-based password auth. `SITE_PASSWORD` env var checked by `/api/login`. Middleware at `src/middleware.ts` protects all routes except `/login`, `/api/login`, and static assets.

**Logging:** `console.log` and `console.error` throughout server-side code. No structured logging framework.

**Validation:** `validateDashboardConfig()` in `src/lib/types.ts` provides safe defaults for the houseversary config type. Other config types rely on inline `Array.isArray()` guards and `Number()` coercion.

**Configuration:** Template-specific behavior controlled by `TEMPLATE_REGISTRY` in `src/lib/template-registry.ts`. `isFileRequired()` and `isFileRelevant()` gate file processing per template type.

---

*Architecture analysis: 2026-03-15*
