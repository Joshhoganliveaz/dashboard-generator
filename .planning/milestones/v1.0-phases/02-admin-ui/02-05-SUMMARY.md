---
phase: 02-admin-ui
plan: 05
subsystem: ui
tags: [wizard, preview, iframe, slug, properties-of-interest, natural-language-edit]

# Dependency graph
requires:
  - phase: 02-04
    provides: "StepMarketData with CSV upload, comp review, and dashboard generation"
  - phase: 02-03
    provides: "StepClientInfo and StepPropertyExtraction wizard steps"
provides:
  - "StepPreview with iframe dashboard preview and NL editing via Claude"
  - "Properties of interest CRUD (list, add, remove) in db.ts and API route"
  - "StepPublish with slug editor, review summary, and save-and-return flow"
  - "Complete 6-step wizard flow from type selection through publish review"
affects: [03-publish-pipeline, 04-full-dashboard-types]

# Tech tracking
tech-stack:
  added: []
  patterns: ["iframe srcdoc for dashboard preview", "select-then-insert/update pattern for Supabase upserts"]

key-files:
  created:
    - src/components/wizard/StepPreview.tsx
    - src/components/wizard/StepPublish.tsx
    - src/app/api/dashboard/[id]/properties/route.ts
  modified:
    - src/lib/supabase/db.ts
    - src/components/wizard/StepClientInfo.tsx
    - src/app/dashboard/[id]/wizard/page.tsx

key-decisions:
  - "Used select-then-insert/update instead of ON CONFLICT upsert due to Supabase RLS compatibility"
  - "Merged PDF upload (StepPropertyExtraction) into StepClientInfo for better UX flow"
  - "Properties of interest API uses dedicated route under /api/dashboard/[id]/properties"

patterns-established:
  - "Select-then-insert/update: For Supabase tables where ON CONFLICT conflicts with RLS, use explicit select to check existence then insert or update"
  - "Iframe srcdoc: Dashboard preview renders generated HTML via iframe srcdoc attribute"

requirements-completed: [WIZD-12, WIZD-13, WIZD-14]

# Metrics
duration: 8min
completed: 2026-03-15
---

# Phase 2 Plan 5: Preview, Edit, and Publish Wizard Steps Summary

**StepPreview with iframe dashboard preview, NL editing via Claude, and properties of interest CRUD; StepPublish with slug editor and review summary completing the 6-step wizard**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T23:23:00Z
- **Completed:** 2026-03-15T23:31:12Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 6

## Accomplishments
- Full dashboard preview in iframe with NL editing panel that sends instructions to Claude for live HTML updates
- Properties of interest CRUD with Supabase persistence and dedicated API route
- Slug editor with validation, availability checking, and lock-after-publish behavior
- Review summary showing dashboard metadata before publish
- Complete 6-step wizard flow operational end-to-end

## Task Commits

Each task was committed atomically:

1. **Task 1: POI CRUD + StepPreview (iframe + edit + POI)** - `9448676` (feat)
2. **Task 2: StepPublish -- slug editor + review summary** - `832321d` (feat)
3. **Fix: ON CONFLICT + PDF upload merge** - `14083fd` (fix)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `src/components/wizard/StepPreview.tsx` - Step 5: iframe preview + NL edit panel + properties of interest management
- `src/components/wizard/StepPublish.tsx` - Step 6: slug editor + review summary + save-and-return
- `src/app/api/dashboard/[id]/properties/route.ts` - GET/POST/DELETE API for properties of interest
- `src/lib/supabase/db.ts` - Added listPropertiesOfInterest, addPropertyOfInterest, removePropertyOfInterest + fixed upsert pattern
- `src/components/wizard/StepClientInfo.tsx` - Merged PDF upload functionality from StepPropertyExtraction
- `src/app/dashboard/[id]/wizard/page.tsx` - Wired StepPreview and StepPublish into wizard routing

## Decisions Made
- Used select-then-insert/update instead of ON CONFLICT upsert -- Supabase RLS policies caused conflicts with the standard upsert pattern, so explicit existence checks were implemented
- Merged PDF upload (formerly StepPropertyExtraction) into StepClientInfo -- better UX with fewer steps for the user to navigate, reducing cognitive overhead
- Properties of interest API uses a dedicated route under /api/dashboard/[id]/properties rather than extending the existing dashboard API

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ON CONFLICT upsert failing with Supabase RLS**
- **Found during:** Task 1 (StepPreview + POI CRUD)
- **Issue:** Supabase RLS policies caused ON CONFLICT DO UPDATE to fail with permission errors
- **Fix:** Changed to select-then-insert/update pattern: check if record exists first, then insert or update accordingly
- **Files modified:** src/lib/supabase/db.ts
- **Verification:** Database operations succeed without errors
- **Committed in:** 14083fd

**2. [Rule 1 - Bug] PDF upload in wrong wizard step**
- **Found during:** Post-task review
- **Issue:** PDF upload was in a separate StepPropertyExtraction (step 3) but should be part of StepClientInfo (step 2) for better flow
- **Fix:** Merged StepPropertyExtraction functionality into StepClientInfo, adjusted wizard step routing
- **Files modified:** src/components/wizard/StepClientInfo.tsx, src/app/dashboard/[id]/wizard/page.tsx
- **Verification:** PDF upload accessible in step 2 client info form
- **Committed in:** 14083fd

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were necessary for correct wizard operation. No scope creep.

## Issues Encountered
- ON CONFLICT upsert incompatibility with Supabase RLS required a pattern change to select-then-insert/update. This is now an established pattern for this project.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete 6-step wizard flow is operational for sell dashboards
- Phase 2 is complete after this plan -- all admin UI requirements fulfilled
- Phase 3 (Publish Pipeline) can begin: slug infrastructure ready, publish button placeholder in place
- Properties of interest CRUD ready for Phase 4 buyer/buy-sell dashboard integration

## Self-Check: PASSED

All 6 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 02-admin-ui*
*Completed: 2026-03-15*
