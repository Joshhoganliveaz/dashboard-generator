---
status: resolved
trigger: "Property details (beds, baths, sqft, address, city_state_zip) from Step 2 of the Dashboard Wizard are not being saved to the sell_data table."
created: 2026-03-17T00:00:00Z
updated: 2026-03-17T00:00:00Z
---

## Current Focus

hypothesis: getDashboard returns sell_data as an array (one-to-many join) but code expects a single object. No UNIQUE constraint on sell_data.dashboard_id.
test: Fix getDashboard to unwrap the array, OR add array-to-object normalization
expecting: After fix, sell_data fields will be accessible as object properties
next_action: Apply fix in db.ts getDashboard function

## Symptoms

expected: When filling out Step 2 (Client Info) with property details (beds=4, baths=2.5, sqft=1920, etc.), values should be saved to sell_data and appear in Step 5 preview.
actual: Preview shows "null" for address, 0/0 for beds/baths, 0 for sqft. Est. sale price uses 0 sqft.
errors: No console errors. Save appears to succeed (wizard advances).
reproduction: Go to /dashboard/new, select Sell, fill Step 2, upload CSV, go to Preview - property snapshot shows null/0.
started: May have always been broken.

## Eliminated

## Evidence

- timestamp: 2026-03-17T00:01:00Z
  checked: Full data flow from StepClientInfo -> useWizardState -> API PATCH -> db.ts -> Supabase
  found: The save path (upsertSellData) directly inserts/updates sell_data table - this works correctly.
  implication: Data IS being saved to the database.

- timestamp: 2026-03-17T00:02:00Z
  checked: getDashboard query in db.ts uses .select("*, sell_data(*), buy_data(*)")
  found: sell_data.dashboard_id has NO UNIQUE constraint (schema.sql line 27). Supabase PostgREST treats this as a one-to-many relationship and returns sell_data as an ARRAY, not a single object.
  implication: When getDashboard result is used as DashboardWithData, sell_data is actually an array like [{...}], but code accesses it as sell_data?.address (which is undefined on an array).

- timestamp: 2026-03-17T00:03:00Z
  checked: StepMarketData.tsx lines 52-59 and 129-141
  found: Both SubjectProperty construction and handleAnalyze read from dashboard.sell_data?.beds, dashboard.sell_data?.address etc. If sell_data is an array, all these return undefined, falling back to 0/null.
  implication: This directly explains the symptoms: preview shows 0/0 beds/baths, 0 sqft, null address.

## Resolution

root_cause: getDashboard() uses a Supabase join query `.select("*, sell_data(*), buy_data(*)")`. Because sell_data.dashboard_id has no UNIQUE constraint, Supabase PostgREST treats this as a one-to-many relationship and returns sell_data as an ARRAY (e.g. `[{address: "...", beds: 4}]`) instead of a single object. The code then accesses `dashboard.sell_data?.address` on an array, which returns undefined. This causes all property fields to appear as null/0 in downstream steps (StepMarketData, StepPreview).
fix: |
  1. Added array-to-object normalization in getDashboard() (db.ts) - unwraps sell_data[0] and buy_data[0] from arrays to single objects
  2. Added .select() to updateDashboard() which was missing it (secondary bug)
  3. Added UNIQUE constraint on dashboard_id in schema.sql for both sell_data and buy_data tables (long-term fix for the Supabase relationship type)
verification: |
  TypeScript compilation passes for db.ts. User confirmed end-to-end fix:
  - Est. Sale Price: $578k (was $357k with 0 sqft)
  - Property Snapshot: "2252 S Estrella Cir / Saratoga Lakes / Mesa, AZ 85202" (was "null")
  - Beds/Baths: 4/2.5 (was 0/0), Sq Ft: 1,920 (was 0)
  - Comp scores improved from 4-28 range to 64-74 range (scoring engine now has actual property details)
files_changed:
  - src/lib/supabase/db.ts
  - supabase/schema.sql
