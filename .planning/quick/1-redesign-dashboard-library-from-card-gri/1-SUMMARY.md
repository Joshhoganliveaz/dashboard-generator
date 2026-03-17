---
phase: quick
plan: 1
subsystem: admin-ui
tags: [library, table, sort, delete, ui]
dependency_graph:
  requires: []
  provides: [sortable-dashboard-table, delete-dashboard-api]
  affects: [dashboard-library-page]
tech_stack:
  added: []
  patterns: [sortable-table, optimistic-delete, exported-sort-function]
key_files:
  created: []
  modified:
    - src/components/library/DashboardLibrary.tsx
    - src/lib/supabase/db.ts
    - src/app/api/dashboard/[id]/route.ts
    - src/__tests__/library.test.ts
  deleted:
    - src/components/library/DashboardCard.tsx
decisions:
  - Exported sortDashboards function for testability rather than testing via DOM
  - Used window.confirm for delete confirmation (lightweight, no modal component needed)
  - Check published_at instead of status=published for R2 cleanup (covers edge case of re-drafted dashboards)
metrics:
  duration: 333s
  completed: 2026-03-17
  tasks: 2/2
---

# Quick Task 1: Redesign Dashboard Library from Card Grid to Sortable Table

Replaced card grid with a sortable table showing Client, Slug, Type, Status, Updated, and Actions columns. Added DELETE API endpoint with R2 cleanup and inline delete with confirmation.

## Task Summary

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add deleteDashboard DB function and DELETE API endpoint | e716170 | Added `deleteDashboard()` in db.ts (deletes child rows first), DELETE handler in route.ts with R2 cleanup |
| 2 | Replace card grid with sortable table and add delete action | 08a63af | Rewrote DashboardLibrary as sortable table, added Edit/Delete row actions, deleted DashboardCard.tsx, added 6 sort tests |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript: No new errors in modified files (pre-existing errors in unrelated generate routes)
- Tests: 18/18 pass (9 filter + 6 sort + 3 data shape)
- DELETE endpoint: Cleans up R2 HTML for published dashboards, cascades child row deletion

## Self-Check: PASSED
