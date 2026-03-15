---
phase: 02-admin-ui
plan: 03
subsystem: ui
tags: [react, wizard, forms, pdf-extraction, claude-api, supabase]

requires:
  - phase: 02-admin-ui/02
    provides: "Wizard shell, step navigation, useWizardState hook"
  - phase: 01-foundation/03
    provides: "extractMLSData() function with Claude structured output"
provides:
  - "StepClientInfo component for wizard step 2 (client + property/buyer data entry)"
  - "StepPropertyExtraction component for wizard step 3 (MLS PDF upload + Claude extraction)"
  - "POST /api/dashboard/extract-mls API route for PDF extraction"
  - "Extended PATCH /api/dashboard/[id] to support nested sell_data/buy_data upsert"
  - "Pure generateSlug function in slug-utils.ts for client-side use"
affects: [02-admin-ui/04, 02-admin-ui/05]

tech-stack:
  added: []
  patterns: ["Nested data upsert via single PATCH endpoint", "Client-safe slug generation module"]

key-files:
  created:
    - src/components/wizard/StepClientInfo.tsx
    - src/components/wizard/StepPropertyExtraction.tsx
    - src/app/api/dashboard/extract-mls/route.ts
    - src/lib/slug-utils.ts
  modified:
    - src/app/api/dashboard/[id]/route.ts
    - src/hooks/useWizardState.ts
    - src/lib/slug.ts
    - src/app/dashboard/[id]/wizard/page.tsx

key-decisions:
  - "Extended PATCH API to handle sell_data/buy_data as nested objects rather than separate endpoints"
  - "Extracted generateSlug to slug-utils.ts to avoid server-only import chain in client components"
  - "Buyer type skips step 3 entirely by advancing from step 2 to step 4"
  - "MLS extraction API returns 200 with null data on failure for graceful client-side fallback"

patterns-established:
  - "Nested data save: PATCH /api/dashboard/[id] accepts sell_data and buy_data as nested objects"
  - "Client-safe utilities: pure functions in separate modules from server-only code"

requirements-completed: [WIZD-02, WIZD-03, WIZD-04, WIZD-05, WIZD-06, WIZD-07]

duration: 6min
completed: 2026-03-15
---

# Phase 02 Plan 03: Wizard Steps 2-3 Summary

**Client info entry with conditional property/buyer fields and MLS PDF upload with Claude extraction for editable property data**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-15T23:10:21Z
- **Completed:** 2026-03-15T23:16:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Step 2 collects client names, email, agent selection plus conditional property fields (sell/buysell) or buyer search criteria (buyer/buysell)
- Step 3 provides drag-and-drop MLS PDF upload with Claude AI extraction that populates editable form fields
- Extraction failure gracefully falls back to empty manual entry with warning message
- Buyer dashboards skip step 3 entirely, advancing directly from step 2 to step 4
- All data saves to Supabase through extended PATCH endpoint supporting nested sell_data/buy_data

## Task Commits

Each task was committed atomically:

1. **Task 1: StepClientInfo -- client details + conditional property/buyer fields** - `f90f3b5` (feat)
2. **Task 2: StepPropertyExtraction -- MLS PDF upload with Claude extraction** - `18d3e0a` (feat)

## Files Created/Modified
- `src/components/wizard/StepClientInfo.tsx` - Step 2: client info + conditional property/buyer fields
- `src/components/wizard/StepPropertyExtraction.tsx` - Step 3: MLS PDF upload with extraction + editable fields
- `src/app/api/dashboard/extract-mls/route.ts` - API route for MLS PDF extraction via Claude
- `src/lib/slug-utils.ts` - Pure generateSlug function safe for client-side import
- `src/app/api/dashboard/[id]/route.ts` - Extended PATCH to support nested sell_data/buy_data upsert
- `src/hooks/useWizardState.ts` - Updated saveDashboardFields to pass sell_data/buy_data through
- `src/lib/slug.ts` - Refactored to re-export from slug-utils, keeping server-only findAvailableSlug
- `src/app/dashboard/[id]/wizard/page.tsx` - Replaced step 2-3 placeholders with real components

## Decisions Made
- Extended the existing PATCH `/api/dashboard/[id]` to handle sell_data and buy_data as nested objects rather than creating separate endpoints -- keeps the API surface small and allows atomic saves of dashboard + related data
- Extracted `generateSlug` to a separate `slug-utils.ts` module because the original `slug.ts` has a top-level import of `supabase/server` which uses `cookies()` and cannot be imported in client components
- MLS extraction API route returns HTTP 200 with `{ data: null, error: "..." }` on failure instead of an error status, allowing the UI to gracefully fall back to manual entry without error handling complexity
- Buyer type skip logic is handled in StepClientInfo (navigates to step 4) rather than in the wizard shell, keeping step definitions simple

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Separated generateSlug from server-only slug.ts**
- **Found during:** Task 1 (StepClientInfo)
- **Issue:** `slug.ts` imports `@/lib/supabase/server` at top level which uses Next.js `cookies()` -- cannot be bundled into client components
- **Fix:** Created `slug-utils.ts` with the pure `generateSlug` function; updated `slug.ts` to re-export from it
- **Files modified:** `src/lib/slug-utils.ts` (created), `src/lib/slug.ts` (modified)
- **Verification:** TypeScript check passes, no import chain errors
- **Committed in:** f90f3b5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary module separation for client-side compatibility. No scope creep.

## Issues Encountered
- Pre-existing build failure from `@anthropic-ai/sdk` zod import error (`toJSONSchema` not exported) -- not related to this plan's changes, verified by stash-test. Used `tsc --noEmit` for type checking instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Steps 2 and 3 are complete and wired into the wizard
- Step 4 (StepMarketData) already exists from prior work
- Steps 5 (Preview) and 6 (Publish) remain as placeholders for future plans

---
*Phase: 02-admin-ui*
*Completed: 2026-03-15*
