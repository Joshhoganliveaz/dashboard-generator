---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/library/DashboardLibrary.tsx
  - src/components/library/DashboardCard.tsx
  - src/app/api/dashboard/[id]/route.ts
  - src/lib/supabase/db.ts
  - src/__tests__/library.test.ts
autonomous: true
requirements: [QUICK-01]
must_haves:
  truths:
    - "Dashboards display in a sortable table with columns: Client, Slug, Type, Status, Updated"
    - "Clicking a column header sorts the table by that column (asc/desc toggle)"
    - "Each row has Edit and Delete action buttons"
    - "Edit navigates to /dashboard/{id}/wizard"
    - "Delete removes the dashboard after confirmation and updates the list"
    - "Existing type/status filter pills still work"
  artifacts:
    - path: "src/components/library/DashboardLibrary.tsx"
      provides: "Table layout with sortable columns, delete handler with confirmation"
    - path: "src/components/library/DashboardCard.tsx"
      provides: "Renamed to DashboardRow.tsx or repurposed as table row component"
    - path: "src/app/api/dashboard/[id]/route.ts"
      provides: "DELETE handler for removing dashboards"
    - path: "src/lib/supabase/db.ts"
      provides: "deleteDashboard function"
  key_links:
    - from: "src/components/library/DashboardLibrary.tsx"
      to: "/api/dashboard/[id]"
      via: "fetch DELETE on delete button click"
      pattern: "fetch.*DELETE"
---

<objective>
Replace the dashboard library card grid with a sortable table view that shows Client, Slug, Type, Status, and Updated columns. Add Edit (link to wizard) and Delete (with confirmation + API call) action buttons per row. Keep existing filter pills intact.

Purpose: Table view is more scannable for a growing library of dashboards. Edit/delete actions give quick management without navigating into each dashboard.
Output: Fully functional sortable table with inline actions replacing the card grid.
</objective>

<execution_context>
@/Users/joshuahogan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/joshuahogan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/library/DashboardLibrary.tsx
@src/components/library/DashboardCard.tsx
@src/components/library/LibraryFilters.tsx
@src/app/page.tsx
@src/lib/supabase/types.ts
@src/lib/supabase/db.ts
@src/app/api/dashboard/[id]/route.ts
@src/app/api/dashboard/[id]/archive/route.ts
@src/__tests__/library.test.ts

<interfaces>
From src/lib/supabase/types.ts:
```typescript
export type DashboardType = "sell" | "buyer" | "buysell";
export type DashboardStatus = "draft" | "published" | "archived";
export interface Dashboard {
  id: string;
  slug: string;
  type: DashboardType;
  status: DashboardStatus;
  client_names: string;
  full_name?: string | null;
  email?: string | null;
  agent_key: string;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  created_by?: string | null;
}
```

From src/lib/supabase/db.ts (existing exports):
```typescript
export async function listDashboards(): Promise<Dashboard[]>;
export async function getDashboard(id: string): Promise<DashboardWithData>;
export async function updateDashboard(id: string, updates: Record<string, unknown>): Promise<Dashboard>;
```

From src/app/api/dashboard/[id]/archive/route.ts (pattern for delete):
```typescript
// Uses getDashboard, deleteDashboardHtml from r2, updateDashboard
// Pattern: fetch dashboard, perform cleanup, update/delete, return JSON
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add deleteDashboard DB function and DELETE API endpoint</name>
  <files>src/lib/supabase/db.ts, src/app/api/dashboard/[id]/route.ts</files>
  <action>
1. In `src/lib/supabase/db.ts`, add a `deleteDashboard` function after the existing `updateDashboard`. It should:
   - Accept `id: string`
   - Delete from `sell_data` where `dashboard_id = id` (child rows first)
   - Delete from `buy_data` where `dashboard_id = id`
   - Delete from `properties_of_interest` where `dashboard_id = id`
   - Delete from `dashboards` where `id = id`
   - Use the existing `supabase` client pattern from the file
   - Throw on error (matching existing pattern)

2. In `src/app/api/dashboard/[id]/route.ts`, add a `DELETE` handler (alongside existing GET and PATCH):
   - Import `deleteDashboard` from db and `deleteDashboardHtml` from `@/lib/r2`
   - Fetch dashboard first with `getDashboard(id)` to verify it exists
   - If dashboard was published, call `deleteDashboardHtml(dashboard.slug)` to clean up R2
   - Call `deleteDashboard(id)`
   - Return `NextResponse.json({ deleted: true })`
   - Handle not-found with 404, other errors with 500 (same pattern as existing GET handler)
  </action>
  <verify>
    <automated>cd /Users/joshuahogan/Projects/dashboard-generator && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>DELETE /api/dashboard/[id] endpoint exists, deleteDashboard function exported from db.ts, TypeScript compiles without errors</done>
</task>

<task type="auto">
  <name>Task 2: Replace card grid with sortable table and add delete action</name>
  <files>src/components/library/DashboardLibrary.tsx, src/components/library/DashboardCard.tsx, src/__tests__/library.test.ts</files>
  <action>
1. **Rewrite `DashboardLibrary.tsx`** to render a table instead of a card grid:
   - Add `sortKey` state (type: `keyof Dashboard`, default `"updated_at"`) and `sortDir` state (`"asc" | "desc"`, default `"desc"`)
   - Add sort logic in useMemo after the existing filter logic: sort filtered results by `sortKey`/`sortDir`. For string fields use `localeCompare`, for dates compare with `new Date().getTime()`
   - Render a `<table>` with `<thead>` containing clickable column headers for: Client Name, Slug, Type, Status, Updated, Actions
   - Clicking a header toggles sort: if same column, flip direction; if different column, set asc
   - Show a small arrow indicator (ChevronUp/ChevronDown from lucide-react) on the active sort column
   - Each row renders: `client_names`, `slug` (truncated with `truncate` class, max-w-[200px]), type badge, status badge, relative date, and two action buttons
   - **Edit button**: `<Link href={/dashboard/${d.id}/wizard}>` with Pencil icon from lucide-react, styled as a small ghost button
   - **Delete button**: Trash2 icon from lucide-react, red hover state. On click, show `window.confirm("Delete dashboard for {client_names}? This cannot be undone.")`. If confirmed, call `fetch(/api/dashboard/${d.id}, { method: "DELETE" })`, then remove dashboard from local state using a `dashboards` state variable initialized from props (change from props-only to `useState(dashboards)` pattern so the list updates without full page reload)
   - Keep the existing `LibraryFilters` component and "New Dashboard" button exactly as-is above the table
   - Table styling: `w-full`, white background, rounded-xl with overflow-hidden, border border-sand-pale. Header row: `bg-sand-pale/50 text-left text-sm font-medium text-slate-light`. Body rows: `hover:bg-cream/50 border-t border-sand-pale`. Use existing project color classes (terra, sage, sand, slate, cream)
   - Move the TYPE_BADGE and STATUS_BADGE maps from DashboardCard.tsx into DashboardLibrary.tsx (or a shared constant). Also move the `relativeDate` helper function
   - Keep the empty state as-is (shown when filtered list is empty)
   - Stop importing DashboardCard

2. **Delete or repurpose `DashboardCard.tsx`**: Since it is no longer imported, delete its contents and replace with a comment redirecting to DashboardLibrary.tsx, OR simply leave it unused. Prefer deleting the file entirely with a note in the commit.

3. **Update `src/__tests__/library.test.ts`**: Add a test for the sort logic:
   - Extract or replicate the sort function
   - Test sorting by `client_names` asc/desc
   - Test sorting by `updated_at` asc/desc
   - Test that sort + filter work together
   - Keep all existing filter tests passing
  </action>
  <verify>
    <automated>cd /Users/joshuahogan/Projects/dashboard-generator && npx vitest run src/__tests__/library.test.ts 2>&1 && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Card grid is replaced by a sortable table. Columns are clickable to sort. Each row has Edit (links to wizard) and Delete (with confirm dialog, calls API, removes from list) buttons. All filter and sort tests pass. TypeScript compiles cleanly.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with zero errors
2. `npx vitest run src/__tests__/library.test.ts` all tests pass (filter + sort)
3. Visual: navigating to `/` shows table view with all columns, sorting works, delete removes row
</verification>

<success_criteria>
- Dashboard library page shows a table (not cards) with columns: Client, Slug, Type, Status, Updated, Actions
- Clicking column headers sorts ascending/descending with visual indicator
- Edit button navigates to `/dashboard/{id}/wizard`
- Delete button shows confirmation dialog, calls DELETE API, removes row from table without page reload
- Existing type and status filter pills continue to work
- No TypeScript errors, all tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/1-redesign-dashboard-library-from-card-gri/1-SUMMARY.md`
</output>
