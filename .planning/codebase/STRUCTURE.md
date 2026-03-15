# Codebase Structure

**Analysis Date:** 2026-03-15

## Directory Layout

```
dashboard-generator/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── clients/
│   │   │   │   ├── route.ts              # GET - Google Sheet client list
│   │   │   │   └── subdivision/
│   │   │   │       └── route.ts          # POST - Claude web search for subdivision
│   │   │   ├── dashboard/
│   │   │   │   ├── edit/
│   │   │   │   │   └── route.ts          # POST - Claude-powered config edit
│   │   │   │   └── generate/
│   │   │   │       ├── route.ts          # POST - Phase 1 (CSV, MLS, tax records)
│   │   │   │       └── continue/
│   │   │   │           └── route.ts      # POST - Phase 2 (Cromford, research, content, assembly)
│   │   │   └── login/
│   │   │       └── route.ts              # POST - Password auth
│   │   ├── login/
│   │   │   └── page.tsx                  # Login page
│   │   ├── globals.css                   # Tailwind imports + custom theme
│   │   ├── layout.tsx                    # Root layout (fonts, metadata)
│   │   └── page.tsx                      # Main admin UI (35K lines, single-page app)
│   ├── components/
│   │   ├── ClientPicker.tsx              # Client selection dropdown with month filter
│   │   └── CompReviewPanel.tsx           # Comp review/approval UI between Phase 1 & 2
│   ├── hooks/
│   │   ├── useClients.ts                 # Fetch + cache client list from API
│   │   └── useGenerateDashboard.ts       # Generation state machine + SSE consumer
│   ├── lib/
│   │   ├── __tests__/
│   │   │   ├── fixtures/                 # Test CSV data files
│   │   │   ├── csv-engine.test.ts        # CSV parsing + comp analysis tests
│   │   │   ├── generate-pipeline.test.ts # End-to-end pipeline tests
│   │   │   ├── loan-estimator.test.ts    # Amortization + refi chain tests
│   │   │   └── template-engine.test.ts   # Config serialization + injection tests
│   │   ├── claude-api.ts                 # Anthropic API wrapper (text, PDF, image, web search)
│   │   ├── claude-prompts.ts             # All prompt templates (~47K)
│   │   ├── comp-adjustments.ts           # GLA/bath/pool comp price adjustments
│   │   ├── csv-analysis-skill.md         # Skill doc for CSV analysis approach
│   │   ├── csv-engine.ts                 # ARMLS CSV parsing + market analysis
│   │   ├── loan-estimator.ts             # Mortgage amortization + historical rates
│   │   ├── template-buyer.html           # Buyer dashboard HTML template (~48K)
│   │   ├── template-buysell.html         # Buy/Sell dashboard HTML template (~64K)
│   │   ├── template-engine.ts            # Config injection + render bug scanning
│   │   ├── template-houseversary.html    # Houseversary dashboard HTML template (~789K)
│   │   ├── template-loader.ts            # Webpack raw import + template map
│   │   ├── template-registry.ts          # Template type definitions + file requirements
│   │   ├── template-sell.html            # Sell dashboard HTML template (~56K)
│   │   ├── template.html                 # Legacy template (superseded by template-houseversary.html)
│   │   └── types.ts                      # All TypeScript interfaces + validation
│   └── middleware.ts                     # Auth middleware (cookie check)
├── scripts/
│   ├── generate-test-dashboard.ts        # CLI script to generate test dashboard
│   └── validate-dashboard.ts             # CLI script to validate dashboard HTML
├── public/                               # Static assets
├── docs/                                 # Planning docs and specs
│   └── superpowers/specs/                # Feature specifications
├── .planning/                            # GSD planning documents
│   ├── codebase/                         # Codebase analysis (this file)
│   └── phases/                           # Phase plans and summaries
├── next.config.js                        # Next.js config (HTML raw import rule)
├── wrangler.toml                         # Cloudflare Workers deployment config
├── tsconfig.json                         # TypeScript config
├── package.json                          # Dependencies and scripts
└── tailwind.config.ts                    # Tailwind theme (branding colors)
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Single admin page, login page, 5 API route handlers
- Key files: `page.tsx` is the main UI (~35K lines, contains form, upload, preview, download)

**`src/app/api/`:**
- Purpose: Server-side route handlers that orchestrate the generation pipeline
- Contains: Dashboard generation (Phase 1 + Phase 2), edit, client data, login
- Key files: `dashboard/generate/route.ts` (Phase 1), `dashboard/generate/continue/route.ts` (Phase 2)

**`src/components/`:**
- Purpose: Reusable React components extracted from the main page
- Contains: `ClientPicker.tsx` (client selection), `CompReviewPanel.tsx` (comp approval)
- Note: Only 2 components -- most UI lives in `page.tsx`

**`src/hooks/`:**
- Purpose: Custom React hooks for data fetching and generation state management
- Contains: `useClients.ts` (client list), `useGenerateDashboard.ts` (generation state machine + SSE)

**`src/lib/`:**
- Purpose: All business logic, AI integration, templates, and types
- Contains: Claude API wrapper, prompt library, CSV engine, loan estimator, comp adjustments, template system, type definitions
- Key files: `csv-engine.ts` (market analysis), `claude-prompts.ts` (all prompts), `template-engine.ts` (config injection)

**`src/lib/__tests__/`:**
- Purpose: Unit and integration tests
- Contains: Tests for CSV engine, template engine, loan estimator, and full pipeline
- Test runner: Vitest

**`src/lib/__tests__/fixtures/`:**
- Purpose: Test data files (CSV samples)

**`scripts/`:**
- Purpose: CLI utilities for testing and validation
- Contains: `generate-test-dashboard.ts` (generate test dashboard), `validate-dashboard.ts` (validate HTML output)

**`docs/superpowers/specs/`:**
- Purpose: Feature specifications
- Contains: Spec documents for planned features

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Contains: Roadmap, state, phase plans, codebase analysis

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Main admin UI (form, upload, preview, download)
- `src/app/layout.tsx`: Root layout (fonts, metadata, body class)
- `src/middleware.ts`: Auth middleware for all routes

**Configuration:**
- `next.config.js`: Webpack rule for HTML raw imports, papaparse externalization
- `wrangler.toml`: Cloudflare Workers deployment config (staging + production)
- `tsconfig.json`: TypeScript config with `@/` path alias to `src/`
- `tailwind.config.ts`: Brand colors and custom theme

**Core Logic:**
- `src/lib/csv-engine.ts`: ARMLS CSV parsing, comp scoring, market metrics computation
- `src/lib/comp-adjustments.ts`: GLA/bath/pool adjustments for comparable sales valuation
- `src/lib/loan-estimator.ts`: Mortgage amortization with historical rate lookup
- `src/lib/claude-api.ts`: Anthropic API wrapper with retry logic
- `src/lib/claude-prompts.ts`: All prompt templates for MLS extraction, tax records, Cromford, content generation, editing

**Template System:**
- `src/lib/template-registry.ts`: Template type definitions, required/optional files, pipeline steps
- `src/lib/template-engine.ts`: Config serialization, marker-based injection, render bug scanning
- `src/lib/template-loader.ts`: Webpack raw import map for HTML templates
- `src/lib/template-houseversary.html`: Houseversary template (~789K, largest)
- `src/lib/template-sell.html`: Sell dashboard template (~56K)
- `src/lib/template-buyer.html`: Buyer dashboard template (~48K)
- `src/lib/template-buysell.html`: Buy/Sell dashboard template (~64K)

**Types:**
- `src/lib/types.ts`: All TypeScript interfaces (`DashboardConfig`, `SellDashboardConfig`, `BuyerDashboardConfig`, `BuySellDashboardConfig`, `CompSale`, `MarketMetrics`, etc.)

**Testing:**
- `src/lib/__tests__/csv-engine.test.ts`: CSV parsing and comp analysis
- `src/lib/__tests__/template-engine.test.ts`: Config serialization and injection
- `src/lib/__tests__/loan-estimator.test.ts`: Amortization and refi chain
- `src/lib/__tests__/generate-pipeline.test.ts`: Full pipeline integration tests

## Naming Conventions

**Files:**
- `kebab-case.ts` for all source files: `csv-engine.ts`, `claude-api.ts`, `loan-estimator.ts`
- `kebab-case.tsx` for React components: `page.tsx`, `layout.tsx`
- `PascalCase.tsx` for extracted components: `ClientPicker.tsx`, `CompReviewPanel.tsx`
- `camelCase.ts` for hooks: `useClients.ts`, `useGenerateDashboard.ts`
- `template-{type}.html` for HTML templates: `template-sell.html`, `template-buyer.html`
- `{name}.test.ts` for tests, co-located in `__tests__/` directory

**Directories:**
- `kebab-case` for all directories: `comp-review`, `dashboard-auth`
- Next.js App Router convention: `api/` for route handlers, nested folders for URL paths

**Functions:**
- `camelCase` for all functions: `runFullAnalysis()`, `estimateCurrentBalance()`, `injectConfig()`
- `build{Type}Config()` pattern for template-specific config builders
- `askClaude*()` pattern for Claude API convenience wrappers

**Types:**
- `PascalCase` for interfaces: `DashboardConfig`, `CompSale`, `MarketMetrics`
- `PascalCase` for type aliases: `TemplateType`, `AnalysisLens`, `AnyDashboardConfig`

**Constants:**
- `UPPER_SNAKE_CASE` for module-level constants: `TEMPLATE_REGISTRY`, `HISTORICAL_RATES`, `CACHE_TTL`
- `UPPER_SNAKE_CASE` for prompt constants: `MLS_EXTRACTION_PROMPT`, `TAX_RECORDS_EXTRACTION_PROMPT`

## Where to Add New Code

**New Template Type:**
1. Add type to `TemplateType` union in `src/lib/template-registry.ts`
2. Add config entry to `TEMPLATE_REGISTRY` with required files, pipeline steps, lens
3. Create HTML template file `src/lib/template-{name}.html` with CONFIG markers
4. Add import to `src/lib/template-loader.ts`
5. Add TypeScript config interface to `src/lib/types.ts`
6. Add content generation prompt to `src/lib/claude-prompts.ts`
7. Add `build{Name}Config()` function to both `src/app/api/dashboard/generate/route.ts` and `src/app/api/dashboard/generate/continue/route.ts`
8. Add template option to `TEMPLATE_OPTIONS` array in `src/app/page.tsx`

**New API Route:**
- Create `src/app/api/{path}/route.ts` following Next.js App Router convention
- Export `GET`, `POST`, etc. async functions
- Use `NextResponse.json()` for responses

**New React Component:**
- Create `src/components/PascalCaseName.tsx`
- Use `"use client"` directive for interactive components
- Import in `src/app/page.tsx`

**New Hook:**
- Create `src/hooks/useCamelCase.ts`
- Follow `useClients.ts` pattern for data fetching hooks
- Follow `useGenerateDashboard.ts` pattern for complex state machines

**New Utility/Library:**
- Create `src/lib/kebab-case.ts`
- Add tests in `src/lib/__tests__/kebab-case.test.ts`
- Add test fixtures in `src/lib/__tests__/fixtures/` if needed

**New Test:**
- Add to `src/lib/__tests__/{module}.test.ts`
- Run with `npm test` (Vitest)

## Special Directories

**`public/`:**
- Purpose: Static assets served at root URL
- Generated: No
- Committed: Yes

**`out/`:**
- Purpose: Next.js static export output
- Generated: Yes
- Committed: No (gitignored)

**`.open-next/`:**
- Purpose: OpenNext build output for Cloudflare Workers
- Generated: Yes (by `npx @opennextjs/cloudflare build`)
- Committed: No

**`.planning/`:**
- Purpose: GSD planning documents, roadmaps, phase plans
- Generated: By Claude agents
- Committed: Yes

**`docs/superpowers/specs/`:**
- Purpose: Feature specifications written during brainstorming
- Generated: By Claude agents
- Committed: Yes

---

*Structure analysis: 2026-03-15*
