# Phase 5: Gap Closure - Research

**Researched:** 2026-03-16
**Domain:** Supabase persistence, Next.js API routing, wizard navigation
**Confidence:** HIGH

## Summary

Phase 5 addresses four remaining v1.0 gaps identified by the milestone audit. All four issues are well-understood with clear root causes and straightforward fixes. No new libraries, patterns, or architectural changes are needed -- every fix uses existing code patterns already established in phases 1-4.

The critical gap is that `StepMarketData.tsx` PATCHes a non-existent `/api/dashboard/{id}/sell-data` route, causing generation results (comps, market metrics, pricing strategy, narratives) to silently 404. The existing `/api/dashboard/[id]/route.ts` PATCH handler already accepts `{ sell_data: {...} }` as a nested object -- the fix is a URL change and payload wrapper. The buyer navigation loop is a one-line fix. RLS policies for public SELECT already exist in the schema and work correctly -- PERS-06 becomes satisfied once data actually reaches the database.

**Primary recommendation:** Fix the PATCH URL in StepMarketData.tsx to use the existing dashboard API route with `{ sell_data: sellUpdates }` wrapper, fix buyer Back button to target step 2, clean up tech debt, and update REQUIREMENTS.md checkboxes.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WIZD-10 | Claude generates narrative content and validates comp selection in step 4 | Generation already works. Issue is persistence: PATCH fires to non-existent `/api/dashboard/{id}/sell-data`. Fix: change to `/api/dashboard/${dashboard.id}` with `{ sell_data: sellUpdates }` payload. Existing route handler at `src/app/api/dashboard/[id]/route.ts` lines 61-63 already handles `body.sell_data`. |
| WIZD-11 | If Claude narrative fails, deterministic results are shown with placeholder text | Same persistence fix as WIZD-10. The error/fallback UI already exists in StepMarketData.tsx (ErrorDisplay component, line 515). Deterministic results from csv-engine.ts are cached locally. The issue is only that they fail to persist to Supabase via the same broken route. |
| PERS-06 | RLS policies allow public users to SELECT published dashboards and associated data | RLS policies already exist and work (schema.sql lines 107-117). The gap is upstream: generation data never reaches sell_data table because of the broken PATCH route. Once WIZD-10 is fixed, PERS-06 is automatically satisfied. |
| WIZD-16 | Team member can navigate back to previous wizard steps without losing data | Buyer dashboard Back button on step 4 calls `goToStep(3)`, but wizard page.tsx case 3 immediately redirects to step 4 (line 121-123). Fix: change buyer Back target from `goToStep(3)` to `goToStep(2)`. Sell/buysell Back buttons also call `goToStep(3)` but should remain unchanged since sell dashboards use step 3 redirect to step 4 (which is the correct behavior for forward navigation after step 2+3 merge, but Back should still go to step 2). |
</phase_requirements>

## Standard Stack

### Core (already installed, no additions needed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js | 14 | App Router, API routes | Existing |
| Supabase | @supabase/ssr | DB persistence, RLS | Existing |
| Vitest | 4.0.18 | Test framework | Existing |

No new dependencies required. All fixes use existing patterns.

## Architecture Patterns

### Existing API Route Pattern (use this)
The existing PATCH handler at `src/app/api/dashboard/[id]/route.ts` accepts nested `sell_data` and `buy_data` objects:

```typescript
// Lines 61-63 of existing route.ts
if (body.sell_data && typeof body.sell_data === "object") {
  await upsertSellData(id, body.sell_data);
}
```

### Existing Wizard Save Pattern (use this)
The `useWizardState.saveDashboardFields` already wraps sell_data for the PATCH:

```typescript
// useWizardState.ts lines 79-82
if (updates.sell_data) {
  const { id: _id, dashboard_id: _did, created_at: _ca, updated_at: _ua, ...sellFields } = updates.sell_data;
  payload.sell_data = sellFields;
}
```

### Fix Pattern for WIZD-10/WIZD-11
Change StepMarketData.tsx line 97 from:
```typescript
// BROKEN: Route does not exist
fetch(`/api/dashboard/${dashboard.id}/sell-data`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(sellUpdates),
})
```
To:
```typescript
// FIXED: Use existing dashboard PATCH route with sell_data wrapper
fetch(`/api/dashboard/${dashboard.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sell_data: sellUpdates }),
})
```

### Fix Pattern for WIZD-16
In StepMarketData.tsx, the buyer Back button (line 215) calls `goToStep(3)`. The wizard page.tsx case 3 (lines 121-123) redirects to step 4, creating a loop.

Fix: Change buyer Back target to step 2 (StepClientInfo, which is the actual previous content step for buyers).

Additionally, the sell/buysell Back buttons (lines 347, 424) also call `goToStep(3)` which redirects to step 4. These should also be changed to `goToStep(2)` since step 3 was merged into step 2. Currently the sell Back button creates the same redirect loop for all dashboard types.

### Anti-Patterns to Avoid
- **Silent error swallowing:** The `.catch(() => {})` on line 101 hides the 404. Replace with meaningful error logging or at minimum a console.warn.
- **Creating new API routes for existing functionality:** The `/api/dashboard/[id]` PATCH already handles sell_data upsert. Do NOT create a new `/api/dashboard/[id]/sell-data` route.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sell data persistence | New API route | Existing `/api/dashboard/[id]` PATCH with `{ sell_data: ... }` | Route already exists, tested, handles upsert |
| RLS for public reads | New policies | Existing policies in schema.sql | Already deployed, just need data to reach the table |

## Common Pitfalls

### Pitfall 1: Creating a new /sell-data route
**What goes wrong:** Adding complexity for something already handled
**Why it happens:** The broken URL suggests a separate route was planned but never built
**How to avoid:** Use the existing PATCH route that already accepts `body.sell_data`

### Pitfall 2: Not testing the error/fallback path (WIZD-11)
**What goes wrong:** The deterministic fallback path also needs to persist data
**Why it happens:** Happy path testing only
**How to avoid:** Verify that when Claude generation fails, deterministic results from csv-engine still get saved. The ErrorDisplay already shows -- but the data path must also persist.

### Pitfall 3: Forgetting all three Back button locations
**What goes wrong:** Fixing only the buyer Back button, missing sell/buysell
**Why it happens:** The audit highlights buyer loop specifically
**How to avoid:** All three `goToStep(3)` calls in StepMarketData.tsx (lines 215, 347, 424) should change to `goToStep(2)` since step 3 no longer exists as a real step.

### Pitfall 4: Not updating REQUIREMENTS.md checkboxes
**What goes wrong:** Audit bookkeeping items remain unfixed
**Why it happens:** Focus on code fixes, forget doc updates
**How to avoid:** Update PUBL-06, STAT-03, STAT-04 checkboxes from `[ ]` to `[x]` as noted in the audit.

## Code Examples

### StepMarketData.tsx persistence fix (WIZD-10, WIZD-11)
```typescript
// Replace lines 96-103 in StepMarketData.tsx
if (Object.keys(sellUpdates).length > 0) {
  fetch(`/api/dashboard/${dashboard.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sell_data: sellUpdates }),
  }).catch((err) => {
    console.warn("Failed to persist generation results:", err);
  });
}
```

### Buyer Back button fix (WIZD-16)
```typescript
// Line 215: Buyer back button -- go to step 2 (StepClientInfo) not step 3 (redirects to 4)
onClick={() => goToStep(2)}

// Line 347: Sell/buysell idle back button -- same fix
onClick={() => goToStep(2)}

// Line 424: Error state back button -- same fix
onClick={() => goToStep(2)}
```

## Tech Debt Items (from audit)

The audit identified these additional items to clean up:

1. **`validBuyerConfig` test fixture** in `config-validation.test.ts` missing `propertiesOfInterest` -- causes 2 test failures. Already partially fixed (commit 84d3de6) but verify.
2. **`StepPropertyExtraction.tsx`** is orphaned dead code (merged into StepClientInfo). Can be deleted.
3. **`createDashboard` in `db.ts`** is exported but never imported. Can be removed or kept (minor).
4. **REQUIREMENTS.md checkboxes:** PUBL-06, STAT-03, STAT-04 should be `[x]` not `[ ]`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIZD-10 | Generation results persist to sell_data via PATCH | unit | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "upsertSellData"` | Partial (db test exists, no route integration test) |
| WIZD-11 | Deterministic fallback results also persist | unit | Same as WIZD-10 (same code path) | Partial |
| PERS-06 | Public SELECT on published dashboards works | manual-only | Verify via Supabase dashboard or `wrangler dev` | N/A (RLS policy already exists) |
| WIZD-16 | Buyer Back button navigates to step 2 | manual-only | Cannot test Next.js navigation in Vitest node env | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers persistence. The primary fixes are URL/parameter changes that are best verified by manual testing or existing unit tests. No new test files required, though the config-validation.test.ts fixture issue should be confirmed resolved.

## Open Questions

1. **Should `.catch(() => {})` become a proper error handler?**
   - What we know: The silent catch hides 404s (and any future errors)
   - Recommendation: Replace with `console.warn` at minimum. The persist is non-blocking (data is in the HTML already), but silent failures are bad practice.

2. **Should the error path (WIZD-11) persist deterministic results explicitly?**
   - What we know: When generation fails, `step === "error"` is set. The useEffect on line 62 only fires on `step === "complete"`. If generation partially succeeds (CSV parsed, comps scored) but Claude narrative fails, those deterministic results are in local state but not persisted.
   - Recommendation: Consider adding a persist path in the error handler too, using cached csvResult/mlsData. This is a "nice to have" beyond the minimum fix.

## Sources

### Primary (HIGH confidence)
- `src/components/wizard/StepMarketData.tsx` -- broken PATCH URL on line 97, buyer Back on line 215
- `src/app/api/dashboard/[id]/route.ts` -- existing PATCH handler accepts `body.sell_data` on line 61
- `src/app/dashboard/[id]/wizard/page.tsx` -- step 3 redirect on line 121-123
- `supabase/schema.sql` -- RLS policies on lines 107-117
- `.planning/v1.0-MILESTONE-AUDIT.md` -- gap definitions and fix recommendations

### Secondary (MEDIUM confidence)
- `src/hooks/useWizardState.ts` -- goToStep and saveDashboardFields patterns
- `src/hooks/useGenerateDashboard.ts` -- SSE flow, complete/error state handling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing code
- Architecture: HIGH - fixes use existing patterns, root causes fully understood
- Pitfalls: HIGH - audit provides specific line numbers and fix recommendations

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- fixes are internal code changes, no external dependencies)
