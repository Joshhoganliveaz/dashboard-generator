---
phase: 04-full-dashboard-types
plan: 01
subsystem: ui
tags: [templates, zod, supabase, listing-status, tabs]

# Dependency graph
requires:
  - phase: 03-publish-pipeline
    provides: template rendering pipeline, buildConfigFromDashboard, publish flow
provides:
  - Listing status field end-to-end (DB type, Zod schema, CONFIG type, publish mapping, template rendering, wizard UI)
  - Buyer template tab structure (Your Search, Neighborhoods, Properties, Team)
  - Buysell template tab structure (Sell Side, Buy Side, Strategy, Properties, Team)
  - Properties placeholder tab for buyer and buysell templates
affects: [04-full-dashboard-types]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status badge CSS pattern with per-status class names"
    - "Collapsible timeline section moved into search tab"
    - "Schools content merged into Buy Side tab for buysell"

key-files:
  created: []
  modified:
    - src/lib/supabase/types.ts
    - src/lib/types.ts
    - src/lib/schemas/dashboard.ts
    - src/lib/publish.ts
    - src/lib/template-sell.html
    - src/lib/template-buyer.html
    - src/lib/template-buysell.html
    - src/components/wizard/StepClientInfo.tsx
    - src/lib/__tests__/publish.test.ts
    - src/lib/__tests__/config-validation.test.ts

key-decisions:
  - "Listing status badge placed in header for sell template, inline at top of Sell Side tab for buysell"
  - "Timeline content moved into search tab as collapsible section rather than removed"
  - "Schools content merged into Buy Side tab for buysell template"

patterns-established:
  - "Status badge rendering: CSS classes status-pre-listing/active/pending/closed with statusMap/statusClassMap JS objects"

requirements-completed: [TYPE-01, TYPE-02, TYPE-03, TYPE-04]

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 04 Plan 01: Tab Structure and Listing Status Summary

**Listing status badge on sell dashboards with end-to-end field pipeline, buyer tabs renamed to Your Search/Neighborhoods/Properties/Team, buysell tabs renamed to Sell Side/Buy Side/Strategy/Properties/Team**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-16T02:40:37Z
- **Completed:** 2026-03-16T02:47:36Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added listing_status field end-to-end: Supabase type, TypeScript interface, Zod schema, publish mapping, template rendering, wizard UI dropdown
- Renamed buyer template tabs from Home Search/Neighborhoods & Schools/Timeline/Team to Your Search/Neighborhoods/Properties/Team
- Renamed buysell template tabs from Home Search/Selling/Schools/Strategy/Team to Sell Side/Buy Side/Strategy/Properties/Team
- Added listing status badge rendering to sell template header and buysell Sell Side tab
- Added 6 new test cases covering listing status mapping and schema validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add listing status field end-to-end and rename template tabs** - `5ed8713` (feat)
2. **Task 2: Add tests for listing status and tab structure verification** - `0e3cf1f` (test)
3. **Auto-fix: config-validation test fixture** - `8256f53` (fix)

## Files Created/Modified
- `src/lib/supabase/types.ts` - Added listing_status to SellData interface
- `src/lib/types.ts` - Added listingStatus to SellDashboardConfig, sellListingStatus to BuySellDashboardConfig
- `src/lib/schemas/dashboard.ts` - Added listingStatus/sellListingStatus enum to Zod schemas
- `src/lib/publish.ts` - Map listing_status in buildConfigFromDashboard for sell and buysell
- `src/lib/template-sell.html` - Added status badge CSS and rendering in header
- `src/lib/template-buyer.html` - Renamed tabs, moved timeline into search, added Properties placeholder
- `src/lib/template-buysell.html` - Renamed/reordered tabs, merged schools into Buy Side, added Properties placeholder, added sell listing status badge
- `src/components/wizard/StepClientInfo.tsx` - Added listing status dropdown for sell/buysell types
- `src/lib/__tests__/publish.test.ts` - Added 6 test cases for listing status mapping and validation
- `src/lib/__tests__/config-validation.test.ts` - Added listingStatus to test fixture

## Decisions Made
- Listing status badge placed in header area for sell template (visible on all tabs) vs inline in Sell Side tab for buysell template (contextual to sell content)
- Timeline content moved into search tab as collapsible section rather than being removed entirely -- preserves useful buying process information
- Schools content merged into Buy Side tab for buysell template to reduce tab count from 5+schools to 5 tabs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed config-validation test fixture missing listingStatus**
- **Found during:** Task 2 (test verification)
- **Issue:** Existing config-validation.test.ts had a validSellConfig fixture without the new required listingStatus field, causing schema validation to fail
- **Fix:** Added `listingStatus: "pre-listing"` to the test fixture
- **Files modified:** src/lib/__tests__/config-validation.test.ts
- **Verification:** All config-validation tests pass
- **Committed in:** 8256f53

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for test correctness after adding required field. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tab structures aligned with product spec for all three dashboard types
- Listing status field ready for use in wizard and template rendering
- Properties tab placeholder ready for Plan 02 to add POI rendering

---
*Phase: 04-full-dashboard-types*
*Completed: 2026-03-16*
