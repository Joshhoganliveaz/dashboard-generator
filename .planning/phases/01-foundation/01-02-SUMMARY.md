---
phase: 01-foundation
plan: 02
subsystem: database
tags: [supabase, postgresql, rls, crud, typescript, vitest]

# Dependency graph
requires:
  - phase: 01-foundation/01
    provides: "Supabase server client (createServerClient) for DB operations"
provides:
  - "Supabase schema with 4 tables: dashboards, sell_data, buy_data, properties_of_interest"
  - "RLS policies: team CRUD (authenticated) and public SELECT on published records (anon)"
  - "TypeScript types matching all table columns (Dashboard, SellData, BuyData, PropertyOfInterest)"
  - "CRUD helper module: createDashboard, getDashboard, listDashboards, updateDashboard, upsertSellData, upsertBuyData"
affects: [admin-ui, publish-pipeline, full-dashboard-types]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Per-request Supabase client creation in CRUD helpers (no module-level singleton)", "JSONB columns for flexible nested data (comps, market_metrics, neighborhoods)", "RLS with sub-select pattern for child table public access"]

key-files:
  created:
    - "supabase/schema.sql"
    - "src/lib/supabase/types.ts"
    - "src/lib/supabase/db.ts"
    - "src/lib/__tests__/supabase-db.test.ts"
  modified: []

key-decisions:
  - "JSONB columns for comps, market_metrics, and other nested data rather than normalized tables"
  - "CASCADE delete on dashboard_id foreign keys so deleting a dashboard removes associated data"
  - "updated_at trigger function shared across dashboards, sell_data, and buy_data tables"
  - "Supabase project created manually via dashboard (no Supabase CLI / local dev)"

patterns-established:
  - "DB helper pattern: each function creates fresh Supabase client via createClient() from ./server"
  - "Type exports from src/lib/supabase/types.ts for all table interfaces"
  - "Schema SQL lives in supabase/schema.sql for manual execution in Supabase SQL Editor"

requirements-completed: [PERS-01, PERS-02, PERS-03, PERS-04, PERS-05, PERS-06, PERS-07]

# Metrics
duration: N/A (split across sessions with human-action checkpoint)
completed: 2026-03-15
---

# Phase 1 Plan 2: Database Schema Summary

**4-table Supabase schema with RLS policies for team CRUD and public read, TypeScript types mirroring all columns, and CRUD helper module using per-request server client**

## Performance

- **Duration:** Split across sessions (TDD tasks + human-action checkpoint for Supabase setup)
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Created full SQL schema with dashboards, sell_data, buy_data, and properties_of_interest tables including constraints, defaults, and updated_at triggers
- Defined TypeScript interfaces matching all table columns with JSONB fields typed to their actual shapes (CompSale[], MarketMetrics, etc.)
- Built 6 CRUD helper functions (createDashboard, getDashboard, listDashboards, updateDashboard, upsertSellData, upsertBuyData) with per-request client creation
- Supabase project provisioned, schema executed, team account created, env vars configured

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing tests for Supabase CRUD helpers** - `7de8c30` (test)
2. **Task 1 GREEN: Add schema, types, and CRUD helpers** - `175a51d` (feat)
3. **Task 2: Supabase project setup** - Manual (human-action checkpoint)

## Files Created/Modified
- `supabase/schema.sql` - Full schema: 4 tables, RLS policies, updated_at triggers, CHECK constraints
- `src/lib/supabase/types.ts` - TypeScript interfaces: Dashboard, SellData, BuyData, PropertyOfInterest, DashboardType, DashboardStatus, DashboardWithData
- `src/lib/supabase/db.ts` - CRUD helpers importing createClient from ./server for all DB operations
- `src/lib/__tests__/supabase-db.test.ts` - 7 tests covering all CRUD operations with mocked Supabase client
- `.env.local` - Added NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (not committed)

## Decisions Made
- Used JSONB columns for nested data (comps, market_metrics, neighborhoods, etc.) rather than fully normalized tables -- matches the existing in-memory data shapes and avoids complex joins for dashboard rendering
- CASCADE delete on all foreign keys to dashboard_id -- deleting a dashboard cleans up all associated data automatically
- Shared updated_at trigger function across all tables with timestamps
- Schema executed manually in Supabase SQL Editor rather than using Supabase CLI migrations -- simpler for a 3-person team

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

User completed all setup during Task 2 checkpoint:
1. Created Supabase project
2. Ran schema.sql in SQL Editor (4 tables created)
3. Created team member account in Authentication
4. Added env vars to .env.local

## Next Phase Readiness
- All 4 tables exist in Supabase with correct RLS policies
- CRUD helpers ready for wizard integration in Phase 2
- TypeScript types available for import throughout the application
- Server client from Plan 01 is used by CRUD helpers for authenticated operations

## Self-Check: PASSED

All 4 created files verified. Both commit hashes (7de8c30, 175a51d) verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-15*
