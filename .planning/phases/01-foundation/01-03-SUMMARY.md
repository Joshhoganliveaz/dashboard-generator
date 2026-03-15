---
phase: 01-foundation
plan: 03
subsystem: engine
tags: [anthropic-sdk, zod, papaparse, structured-output, retry, csv-parsing]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: existing claude-api.ts and csv-engine.ts modules
provides:
  - Anthropic SDK-based Claude API with structured output (callClaudeWithRetry, extractMLSData)
  - Zod validation schemas for all dashboard config types (sell, buyer, buysell)
  - Papaparse-based CSV parsing replacing hand-rolled parser
  - Deterministic calculateMetrics() pure function
affects: [02-admin-ui, 03-publish-pipeline, 04-full-dashboard-types]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk", "zod (schemas)"]
  patterns: ["structured output via zodOutputFormat + messages.parse", "exponential backoff with jitter on 429/5xx", "3-phase pipeline: deterministic parse -> Claude narratives -> deterministic overrides"]

key-files:
  created:
    - src/lib/schemas/mls-extraction.ts
    - src/lib/schemas/dashboard.ts
    - src/lib/__tests__/claude-api.test.ts
    - src/lib/__tests__/config-validation.test.ts
  modified:
    - src/lib/claude-api.ts
    - src/lib/csv-engine.ts
    - src/lib/__tests__/csv-engine.test.ts

key-decisions:
  - "Used @anthropic-ai/sdk with messages.parse() for structured output instead of raw fetch + JSON parsing"
  - "Kept backward-compatible function signatures (askClaude, callClaude, etc.) while adding new SDK-based functions"
  - "Renamed trimCSVColumns to parseCSV using Papaparse internally; deleted parseCSVLine entirely"
  - "Extracted calculateMetrics() as exported pure function for deterministic metric computation"

patterns-established:
  - "Structured extraction: use callClaudeWithRetry + zodOutputFormat for typed Claude responses"
  - "Config validation: use validateConfig(config, type) for runtime Zod validation of dashboard configs"
  - "CSV pipeline: parse with Papa.parse, filter deterministically, send to Claude only for narratives"

requirements-completed: [ENGN-01, ENGN-02, ENGN-03, ENGN-04, ENGN-05, ENGN-06, ENGN-07]

# Metrics
duration: 12min
completed: 2026-03-15
---

# Phase 1 Plan 3: Engine Hardening Summary

**Anthropic SDK with structured output + retry, Papaparse CSV parsing, and Zod config validation schemas for all dashboard types**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-15T17:52:49Z
- **Completed:** 2026-03-15T18:04:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Replaced raw fetch with @anthropic-ai/sdk, raising default max_tokens from 4096 to 16384
- Added callClaudeWithRetry with exponential backoff + jitter on 429/5xx, and extractMLSData with Zod-guaranteed structured output
- Created Zod validation schemas for Sell, Buyer, and BuySell dashboard configs with validateConfig() helper
- Migrated CSV parsing from hand-rolled parseCSVLine to Papaparse (Papa.parse with header:true, skipEmptyLines:true)
- Clarified 3-phase pipeline in csv-engine: deterministic parse/filter, Claude narratives, deterministic score/metric overrides
- All 83 tests pass across 10 test files (28 new tests added)

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor Claude API to SDK with structured output and retry** - `6a9d47e` (feat)
2. **Task 2: Migrate CSV parsing to Papaparse and separate deterministic scoring** - `5b46ecd` (feat)

## Files Created/Modified
- `src/lib/claude-api.ts` - Refactored to use @anthropic-ai/sdk with callClaudeWithRetry, extractMLSData, 16K max_tokens default
- `src/lib/csv-engine.ts` - Replaced parseCSVLine with Papa.parse, extracted calculateMetrics(), 3-phase pipeline
- `src/lib/schemas/mls-extraction.ts` - Zod schema for MLS PDF extraction (beds, baths, sqft, yearBuilt, pool, etc.)
- `src/lib/schemas/dashboard.ts` - Zod schemas for Sell, Buyer, BuySell dashboard configs + validateConfig()
- `src/lib/__tests__/claude-api.test.ts` - 8 tests: max_tokens default, retry on 429/5xx, no retry on 400, backoff, structured output, backward compat
- `src/lib/__tests__/config-validation.test.ts` - 7 tests: sell/buyer schema validation, missing field errors, validateConfig()
- `src/lib/__tests__/csv-engine.test.ts` - 7 new tests added: Papaparse parsing, quoted fields, deterministic scoring, Claude separation

## Decisions Made
- Used @anthropic-ai/sdk with `messages.parse()` for structured output instead of raw fetch + manual JSON parsing -- provides guaranteed schema compliance
- Kept all existing function signatures backward-compatible; new functions are additions, not replacements
- Used `any` casts for SDK params to avoid overly strict type narrowing with the SDK's complex union types (pre-existing pattern)
- Renamed `trimCSVColumns` to `parseCSV` to reflect its new role as the single CSV entry point using Papaparse

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @anthropic-ai/sdk with --legacy-peer-deps**
- **Found during:** Task 1 (SDK installation)
- **Issue:** npm install failed due to peer dependency conflicts with existing packages
- **Fix:** Used `npm install @anthropic-ai/sdk --legacy-peer-deps`
- **Files modified:** package.json, package-lock.json
- **Verification:** SDK imports and mocks work correctly in tests
- **Committed in:** 6a9d47e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- peer dep flag needed for installation only. No scope creep.

## Issues Encountered
- Fake timers (vi.useFakeTimers) did not advance correctly with the SDK's setTimeout-based retry delays; switched to real timers with increased test timeout for the backoff test

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Claude API module ready for structured MLS extraction in admin wizard
- Zod schemas ready for config validation in the generation pipeline
- CSV engine hardened with Papaparse for reliable comp parsing
- All existing consumers of askClaude/callClaude unaffected by refactoring

---
*Phase: 01-foundation*
*Completed: 2026-03-15*
