# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**Anthropic Claude API (Primary AI Engine):**
- Purpose: Powers all content generation, document extraction, CSV analysis, web research, and dashboard editing
- Client: Custom fetch-based wrapper (no SDK) at `src/lib/claude-api.ts`
- Endpoint: `https://api.anthropic.com/v1/messages`
- API Version: `2023-06-01`
- Auth: `ANTHROPIC_API_KEY` env var, sent via `x-api-key` header
- Retry: Built-in 3-attempt exponential backoff for 429 rate limits
- Models used:
  - `claude-sonnet-4-20250514` - Default for most operations (CSV analysis, MLS extraction, tax records, Cromford, sell content, web research, edits)
  - `claude-opus-4-6` - Buyer dashboard content and buy/sell content (requires more nuanced neighborhood/school research)
- Capabilities used:
  - Text messages (standard prompting)
  - Image input (base64) - Cromford screenshot extraction via `askClaudeWithImages()`
  - PDF input (base64) - MLS PDF and tax records extraction via `askClaudeWithPDF()`
  - Web search tool (`web_search_20250305`) - City research and subdivision lookup via `askClaudeWithWebSearch()`
  - Tool use (structured tool calling interface defined but web search is the primary tool)

**Claude API Call Sites:**

| Caller | File | Model | Purpose |
|--------|------|-------|---------|
| CSV Analysis | `src/lib/csv-engine.ts` | sonnet | Parse ARMLS CSV, score comps, compute market metrics |
| MLS Extraction | `src/app/api/dashboard/generate/route.ts` | sonnet | Extract property details from MLS PDF |
| Tax Records | `src/app/api/dashboard/generate/route.ts` | sonnet | Extract purchase price, loan data, refinances from tax PDF |
| Cromford | `src/app/api/dashboard/generate/route.ts` | sonnet | Extract market metrics from Cromford screenshots |
| Web Research | `src/app/api/dashboard/generate/route.ts` | sonnet + web search | Find city developments, infrastructure projects |
| Content Generation | `src/app/api/dashboard/generate/route.ts` | sonnet | Generate narratives, upgrades, resources for houseversary |
| Sell Content | `src/app/api/dashboard/generate/route.ts` | sonnet | Pricing strategy, competition, marketing plan |
| Buyer Content | `src/app/api/dashboard/generate/route.ts` | opus | Neighborhoods, schools, timelines |
| Buy/Sell Content | `src/app/api/dashboard/generate/route.ts` | opus | Combined sell + buyer analysis |
| Subdivision Lookup | `src/app/api/clients/subdivision/route.ts` | sonnet + web search | Find official subdivision/plat name from county assessor |
| Dashboard Edit | `src/app/api/dashboard/edit/route.ts` | sonnet | Apply natural language edits to dashboard config |
| Continue (Phase 2) | `src/app/api/dashboard/generate/continue/route.ts` | sonnet/opus | Same as generate but with user-approved comps |

**Google Sheets (Client Data Source):**
- Purpose: Read-only client roster for the admin dashboard picker
- Client: Direct fetch to public CSV export URL
- URL: `https://docs.google.com/spreadsheets/d/1yHa34k7Mo6qnpPzlppU1biksGJY6Pdjp4CiTFoP1xjA/export?format=csv&gid=0`
- Auth: None (sheet is publicly accessible via export URL)
- Caching: In-memory cache with 5-minute TTL (`src/app/api/clients/route.ts`)
- Parser: PapaParse for CSV parsing
- Data: Client names, addresses, closing dates, tenure tags, existing dashboard URLs

## Data Storage

**Databases:**
- None. The application is stateless. No database.

**File Storage:**
- No persistent file storage. All files (CSV, PDF, images) are uploaded per-request via FormData, processed in memory, and discarded.
- Generated dashboards are returned as HTML strings in SSE responses. The client handles download/save.

**Caching:**
- In-memory only: Client list from Google Sheets cached for 5 minutes in `src/app/api/clients/route.ts` (module-level variables `cachedClients`, `cacheTimestamp`)
- No Redis, no Cloudflare KV, no external cache

## Authentication & Identity

**Auth Provider:** Custom password-based authentication
- Implementation: Simple shared password via `SITE_PASSWORD` env var
- Login endpoint: `POST /api/login` (`src/app/api/login/route.ts`)
- Session: HTTP-only cookie `dashboard-auth` set to `"authenticated"`, 30-day expiry, SameSite=lax
- Middleware: `src/middleware.ts` checks cookie on all routes except `/login`, `/api/login`, static assets, and `.html` files
- No user accounts, no roles, no OAuth, no JWT

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, Datadog, or similar.

**Logs:**
- `console.log` / `console.warn` / `console.error` throughout server-side code
- Key logged events: CSV analysis results, loan estimation calculations, comp score overrides, tax record extraction details
- Log destination: Cloudflare Workers logs (viewable via `wrangler tail`)

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers (serverless edge)
- Three environments defined in `wrangler.toml`:
  - Production: `dashboard-generator`
  - Staging: `dashboard-generator-staging` (URL: `https://dashboard-generator-staging.josh-hogan-account.workers.dev`)
  - Dev: `dashboard-generator-dev` (URL: `https://dashboard-generator-dev.josh-hogan-account.workers.dev`)

**CI Pipeline:**
- None. No GitHub Actions, no automated CI.
- Deploys are manual via `npm run deploy` / `npm run deploy:staging` / `npm run deploy:dev`

**Build Pipeline:**
- OpenNext (`@opennextjs/cloudflare`) compiles Next.js app to Cloudflare Workers format
- Output: `.open-next/worker.js` (main worker) + `.open-next/assets/` (static files)
- Wrangler uploads worker + assets to Cloudflare

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Anthropic API key for all Claude API calls
- `SITE_PASSWORD` - Shared password for admin login

**Secrets location:**
- Local: `.env.local` (gitignored)
- Production: Cloudflare Workers secrets (set via `wrangler secret put`)
- Template: `.env.local.example`

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Server-Sent Events (SSE)

The generation pipeline uses SSE for real-time progress updates to the client.

**SSE Endpoints:**
- `POST /api/dashboard/generate` - Phase 1: Parse inputs, analyze CSV, extract MLS/tax/Cromford, pause at comp review
- `POST /api/dashboard/generate/continue` - Phase 2: Resume after user comp approval, generate content, assemble HTML

**SSE Event Format:**
```typescript
{ step: GenerationStepName, progress: number, message?: string, html?: string, comps?: CompSale[], ... }
```

**Steps:** `extracting_mls` -> `parsing_csv` -> `review_comps` (pause) -> `reading_cromford` -> `reading_tax_records` -> `researching` -> `generating_content` -> `assembling` -> `complete`

**Timeout:** `maxDuration = 300` (5 minutes) on generate routes, `maxDuration = 120` (2 minutes) on edit route

## External Data Sources (Non-API)

**ARMLS/FlexMLS CSV Exports:**
- Manually exported by the agent from ARMLS MLS system
- Uploaded via the admin UI as a file
- Parsed by custom CSV engine (`src/lib/csv-engine.ts`) with Latin-1 encoding
- Column-trimmed to ~25 key fields before sending to Claude

**MLS PDF Listings:**
- Manually exported from ARMLS
- Uploaded as PDF, sent to Claude for structured extraction

**County Tax Records PDF:**
- Manually downloaded from county assessor websites (e.g., mcassessor.maricopa.gov)
- Uploaded as PDF, sent to Claude to extract purchase history and loan data

**Cromford Report Screenshots:**
- Screenshots from The Cromford Report (real estate analytics)
- Uploaded as images (PNG/JPG), sent to Claude for metric extraction

---

*Integration audit: 2026-03-15*
