---
phase: quick-4
plan: 1
subsystem: ui, api
tags: [claude-api, pdf-extraction, monsoon, amortization, loan-classifier, pmms-rates]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: wizard infrastructure, claude-api.ts, loan-estimator.ts
provides:
  - Tax record PDF extraction via Claude API (/api/dashboard/extract-tax)
  - Monsoon parser with extraction prompt and original loan lookup
  - PMMS monthly rate lookup table (Jan 2010 - Feb 2026)
  - Loan classifier with 60% refi threshold and rate annotation
  - TaxRecordUpload component with loan selection UI
  - Loan data fields flowing through sell_data to published config
affects: [sell-dashboard, buysell-dashboard, loan-estimator]

# Tech tracking
tech-stack:
  added: []
  patterns: [tax-record-extraction, loan-classification, pmms-rate-lookup]

key-files:
  created:
    - src/app/api/dashboard/extract-tax/route.ts
    - src/lib/tax-record-parser.ts
    - src/lib/historical-rates.ts
    - src/lib/loan-classifier.ts
    - src/components/wizard/TaxRecordUpload.tsx
  modified:
    - src/lib/types.ts
    - src/lib/supabase/types.ts
    - src/lib/schemas/dashboard.ts
    - src/lib/publish.ts
    - src/components/wizard/StepClientInfo.tsx

key-decisions:
  - "Used plain Date math instead of date-fns (not in project dependencies) for loan classifier"
  - "PMMS monthly rates stored separately from quarterly rates in loan-estimator.ts for finer granularity"
  - "Default fallback rate set to 0.0665 (6.65%) for dates outside PMMS table"

patterns-established:
  - "Tax record extraction pattern: PDF upload -> Claude API -> JSON parse -> loan classification -> UI selection -> apply to form"

requirements-completed: [QUICK-4]

# Metrics
duration: 8min
completed: 2026-03-17
---

# Quick Task 4: Tax Record Upload Summary

**Monsoon tax record PDF extraction with loan classification, PMMS rate annotation, and auto-populated loan payoff via amortization in the sell dashboard wizard**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-17T16:45:03Z
- **Completed:** 2026-03-17T16:53:31Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Built complete tax record extraction pipeline: PDF upload -> Claude extraction -> structured MonsoonExtraction data
- Ported loan classifier with 60% refi threshold and PMMS monthly rate annotation from homeowner-journey-map
- Created TaxRecordUpload component with two-phase workflow: upload then review/select/apply
- Wired loan data (loanAmount, interestRate, refiDetected, secondLienAmount, loanOriginationHistory) through SellData, Zod schemas, and publish.ts to published dashboard config

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tax record extraction backend** - `abf9215` (feat)
2. **Task 2: Create TaxRecordUpload component and wire into StepClientInfo** - `214263c` (feat)

## Files Created/Modified
- `src/app/api/dashboard/extract-tax/route.ts` - API endpoint accepting tax PDF, extracting via Claude, returning MonsoonExtraction
- `src/lib/tax-record-parser.ts` - Monsoon extraction prompt builder and findOriginalLoanAmount helper
- `src/lib/historical-rates.ts` - PMMS monthly rate lookup table (Jan 2010 - Feb 2026) with getHistoricalRate
- `src/lib/loan-classifier.ts` - classifyLoans (60% threshold) and annotateLoansWithRates functions
- `src/components/wizard/TaxRecordUpload.tsx` - Self-contained upload/extract/select/apply component
- `src/lib/types.ts` - Added LoanOrigination, DeedHistoryEntry, MonsoonExtraction types; added loan fields to SellDashboardConfig and BuySellDashboardConfig
- `src/lib/supabase/types.ts` - Added loan fields to SellData interface
- `src/lib/schemas/dashboard.ts` - Added optional loan fields to sell and buysell Zod schemas
- `src/lib/publish.ts` - Mapped new loan fields from SellData to published config (sell + buysell)
- `src/components/wizard/StepClientInfo.tsx` - Integrated TaxRecordUpload, added loan state, wired handleNext

## Decisions Made
- Used plain Date math instead of date-fns for the loan classifier since date-fns is not a project dependency
- Kept PMMS monthly rates in a separate file from the quarterly rates in loan-estimator.ts -- the monthly granularity is needed for loan-level rate annotation while quarterly is used for amortization estimation
- Default fallback rate of 0.0665 for dates outside the PMMS table (slightly higher than the 0.065 used in homeowner-journey-map, reflecting current market rates)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Uses the existing ANTHROPIC_API_KEY environment variable already configured for the project.

## Next Phase Readiness
- Tax record extraction is fully functional for sell and buysell dashboards
- The loan data fields are stored in sell_data and flow through to published dashboard config
- Future work could consume loanAmount/interestRate/refiDetected/secondLienAmount in the published sell template's loan estimator section

---
*Quick Task: 4*
*Completed: 2026-03-17*
