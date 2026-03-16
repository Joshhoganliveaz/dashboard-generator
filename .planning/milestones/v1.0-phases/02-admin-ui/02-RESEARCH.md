# Phase 2: Admin UI - Research

**Researched:** 2026-03-15
**Domain:** Multi-step wizard UI, dashboard library CRUD, file upload processing, SSE streaming, auto-save patterns in Next.js 14 App Router
**Confidence:** HIGH

## Summary

Phase 2 transforms the existing single-page form (`src/app/page.tsx` -- 820 lines) into two distinct UI surfaces: a dashboard library home screen with filterable cards, and a 6-step wizard for creating/editing dashboards. The existing codebase already has all the backend pieces in place from Phase 1 -- Supabase CRUD functions (`db.ts`), typed interfaces (`supabase/types.ts`), the generation pipeline with SSE streaming (`useGenerateDashboard.ts`), and Claude API integration (`claude-api.ts`). Phase 2 is primarily a frontend restructuring that wires these existing backend capabilities into a proper multi-page admin flow.

The core technical challenge is managing wizard state across 6 steps with auto-save to Supabase at each transition, while reusing the existing two-phase generation pipeline (Phase 1: CSV/MLS extraction with comp review pause, Phase 2: content generation + template assembly). The existing `useGenerateDashboard` hook handles SSE consumption and comp review flow -- this needs to be integrated into wizard steps 3-5 rather than rewritten.

The slug management system (auto-generation, collision detection, pre-publish editing) is straightforward CRUD against the existing `dashboards` table. The `slug` column already exists in the schema.

**Primary recommendation:** Build the library page as a server component that calls `listDashboards()`, build the wizard as a client-side multi-step form with URL-based step tracking (`/dashboard/[id]/wizard?step=3`), auto-save via `updateDashboard()`/`upsertSellData()`/`upsertBuyData()` on step transitions, and integrate the existing generation pipeline hooks into wizard steps 3-4.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIBR-01 | Team member sees all dashboards as cards on the home screen | Server component calling `listDashboards()` from `db.ts`, render as card grid |
| LIBR-02 | Each card shows client name, address/area, type badge, status badge, and last updated | All fields available on `Dashboard` interface in `supabase/types.ts` |
| LIBR-03 | Team member can filter dashboards by type (sell/buyer/buysell) | Client-side filter on `dashboard.type` field, or URL search params |
| LIBR-04 | Team member can filter dashboards by status (draft/published/archived) | Client-side filter on `dashboard.status` field |
| LIBR-05 | Team member can click a dashboard card to re-enter the wizard with all data loaded | Navigate to `/dashboard/[id]/wizard`, load via `getDashboard(id)` |
| WIZD-01 | Team member selects dashboard type in step 1 | Reuse `TEMPLATE_REGISTRY` types (sell/buyer/buysell), exclude houseversary |
| WIZD-02 | Team member enters client info in step 2 | Form fields from existing `page.tsx` FormFields interface |
| WIZD-03 | For sell/buysell: team member enters property address and details in step 2 | Same fields as current form, conditional on dashboard type |
| WIZD-04 | For buyer: team member enters search criteria in step 2 | Buyer-specific fields already in current `page.tsx` |
| WIZD-05 | MLS PDF upload with Claude extraction in step 3 | Existing `askClaudeWithPDF()` + `MLSExtractionSchema` from Phase 1 |
| WIZD-06 | Extracted fields appear as editable inputs | Render `MLSExtraction` result as form inputs, allow override |
| WIZD-07 | If PDF extraction fails, all fields appear empty for manual entry | Catch extraction error, render empty form with same fields |
| WIZD-08 | ARMLS CSV upload in step 4; deterministic scoring | Existing `runFullAnalysis()` from `csv-engine.ts` |
| WIZD-09 | Comp review panel shows ranked comps with toggle on/off | Existing `CompReviewPanel` component, already built |
| WIZD-10 | Claude generates narrative content in step 4 | Existing Phase 2 generation pipeline via `/api/dashboard/generate/continue` |
| WIZD-11 | If Claude narrative fails, deterministic results shown with placeholder text | Existing fallback pattern in generation pipeline |
| WIZD-12 | Step 5 shows full dashboard preview in iframe with edit panel | Existing iframe preview + edit panel pattern from current `page.tsx` |
| WIZD-13 | Team member can edit values or give Claude NL instructions | Existing `applyEdit()` in `useGenerateDashboard` hook |
| WIZD-14 | Team member can add/remove properties of interest in step 5 | New CRUD UI against `properties_of_interest` table (schema exists in `supabase/types.ts`) |
| WIZD-15 | SSE streaming shows progress during generation | Existing SSE pattern in `useGenerateDashboard` + `sendSSE()` in API route |
| WIZD-16 | Team member can navigate back without losing data | Wizard state persisted to Supabase; back navigation reloads from DB |
| WIZD-17 | Wizard saves progress to Supabase at each step transition | Call `updateDashboard()`/`upsertSellData()`/`upsertBuyData()` on step change |
| SLUG-01 | Slug auto-generated from client names and address/area | Generate on step 2 completion: slugify `${clientNames}-${address}` |
| SLUG-02 | Slugs contain only lowercase letters, numbers, and hyphens | Regex: `text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')` |
| SLUG-03 | Collision detection appends -2, -3, etc. | Query `dashboards` table for existing slugs, increment suffix |
| SLUG-04 | Slug is editable before first publish | Editable input in wizard step 6 or settings, disabled when `published_at` is set |
| SLUG-05 | Slug is locked after first publish | Check `dashboard.published_at !== null` to determine lock state |
| STAT-01 | New dashboards start as "draft" | Already implemented in `createDashboard()` -- inserts with `status: 'draft'` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^14.2 | App Router with file-based routing | Already in use, wizard pages use dynamic routes |
| @supabase/supabase-js | ^2.99.1 | Database CRUD for dashboard data | Already installed, `db.ts` has all needed functions |
| @supabase/ssr | ^0.9.0 | Server-side auth + cookie handling | Already installed, used in middleware |
| lucide-react | ^0.468.0 | Icons for UI components | Already installed, used throughout existing UI |
| tailwindcss | ^3.4 | Styling | Already configured with custom brand colors |
| zod | existing | Schema validation | Already used for MLS extraction and dashboard config schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | ^0.78.0 | Claude API calls for extraction/generation | Already installed, used in generation pipeline |
| papaparse | ^5.4.1 | CSV parsing | Already installed, used in csv-engine.ts |

### No New Dependencies Needed

Phase 2 requires zero new npm packages. Everything needed is already installed from Phase 1. The work is purely UI restructuring and wiring existing backend functions into new page components.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── page.tsx                          # REPLACE: Library view (dashboard cards)
│   ├── login/page.tsx                    # KEEP: unchanged
│   ├── dashboard/
│   │   ├── new/page.tsx                  # Step 1: type selection, creates draft, redirects
│   │   └── [id]/
│   │       └── wizard/page.tsx           # Steps 2-6: wizard with ?step= query param
│   ├── api/
│   │   ├── dashboard/
│   │   │   ├── generate/route.ts         # KEEP: Phase 1 generation
│   │   │   ├── generate/continue/route.ts # KEEP: Phase 2 generation
│   │   │   └── edit/route.ts             # KEEP: NL edit
│   │   └── slug/
│   │       └── check/route.ts            # NEW: slug collision check
│   └── layout.tsx                        # KEEP: unchanged
├── components/
│   ├── CompReviewPanel.tsx               # KEEP: reuse in wizard step 4
│   ├── ClientPicker.tsx                  # KEEP: may reuse
│   ├── library/
│   │   ├── DashboardCard.tsx             # NEW: single dashboard card
│   │   └── LibraryFilters.tsx            # NEW: type/status filter bar
│   └── wizard/
│       ├── WizardShell.tsx               # NEW: step navigation chrome
│       ├── StepTypeSelect.tsx            # NEW: step 1 - dashboard type
│       ├── StepClientInfo.tsx            # NEW: step 2 - client/property details
│       ├── StepPropertyExtraction.tsx    # NEW: step 3 - MLS PDF upload + extraction
│       ├── StepMarketData.tsx            # NEW: step 4 - CSV + comp review + generation
│       ├── StepPreview.tsx               # NEW: step 5 - preview + edit + properties of interest
│       └── StepPublish.tsx               # NEW: step 6 - slug edit + publish (Phase 3 wires publish)
├── hooks/
│   ├── useGenerateDashboard.ts           # KEEP: reuse for SSE in wizard steps
│   └── useWizardState.ts                 # NEW: wizard state management + auto-save
└── lib/
    ├── slug.ts                           # NEW: slug generation + collision check
    └── supabase/
        └── db.ts                         # EXTEND: add properties_of_interest CRUD
```

### Pattern 1: Wizard State with Auto-Save

**What:** A custom hook that manages wizard step state, loads dashboard data from Supabase on mount, and saves to Supabase on step transitions.

**When to use:** The wizard page component.

```typescript
// src/hooks/useWizardState.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardWithData, DashboardType } from "@/lib/supabase/types";

interface WizardState {
  dashboard: DashboardWithData | null;
  currentStep: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export function useWizardState(dashboardId: string) {
  const [state, setState] = useState<WizardState>({
    dashboard: null,
    currentStep: 1,
    loading: true,
    saving: false,
    error: null,
  });

  // Load dashboard data on mount
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/dashboard/${dashboardId}`);
      const data = await res.json();
      setState(s => ({ ...s, dashboard: data, loading: false }));
    }
    load();
  }, [dashboardId]);

  // Save on step transition
  const goToStep = useCallback(async (step: number, data: Partial<DashboardWithData>) => {
    setState(s => ({ ...s, saving: true }));
    // Save current step data to Supabase
    await saveStepData(dashboardId, state.currentStep, data);
    setState(s => ({ ...s, currentStep: step, saving: false, dashboard: { ...s.dashboard!, ...data } }));
  }, [dashboardId, state.currentStep]);

  return { ...state, goToStep };
}
```

### Pattern 2: Library Page as Server Component with Client Filters

**What:** The home page fetches dashboards server-side, passes them to a client component that handles filtering.

**When to use:** The library/home page.

```typescript
// src/app/page.tsx (server component)
import { listDashboards } from "@/lib/supabase/db";
import { DashboardLibrary } from "@/components/library/DashboardLibrary";

export default async function LibraryPage() {
  const dashboards = await listDashboards();
  return <DashboardLibrary dashboards={dashboards} />;
}

// src/components/library/DashboardLibrary.tsx (client component)
"use client";
import { useState } from "react";
import type { Dashboard } from "@/lib/supabase/types";

export function DashboardLibrary({ dashboards }: { dashboards: Dashboard[] }) {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filtered = dashboards
    .filter(d => !typeFilter || d.type === typeFilter)
    .filter(d => !statusFilter || d.status === statusFilter);

  return (
    <>
      <FilterBar onTypeChange={setTypeFilter} onStatusChange={setStatusFilter} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(d => <DashboardCard key={d.id} dashboard={d} />)}
      </div>
    </>
  );
}
```

### Pattern 3: Wizard Step Navigation via URL Search Params

**What:** Use `?step=N` in the URL to track wizard position. This enables browser back/forward, bookmarkability, and persistence across refreshes.

**When to use:** The wizard page.

```typescript
// src/app/dashboard/[id]/wizard/page.tsx
"use client";
import { useSearchParams, useRouter } from "next/navigation";

export default function WizardPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const step = parseInt(searchParams.get("step") || "1");
  const router = useRouter();

  function goToStep(n: number) {
    // Save current data, then navigate
    router.push(`/dashboard/${params.id}/wizard?step=${n}`);
  }

  return (
    <WizardShell currentStep={step} onStepChange={goToStep}>
      {step === 1 && <StepTypeSelect />}
      {step === 2 && <StepClientInfo />}
      {step === 3 && <StepPropertyExtraction />}
      {step === 4 && <StepMarketData />}
      {step === 5 && <StepPreview />}
      {step === 6 && <StepPublish />}
    </WizardShell>
  );
}
```

### Pattern 4: Slug Generation and Collision Detection

**What:** Generate URL-safe slugs from client names + address, check for collisions server-side.

```typescript
// src/lib/slug.ts
export function generateSlug(clientNames: string, address?: string): string {
  const base = [clientNames, address].filter(Boolean).join(" ");
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80); // reasonable max length
}

// Collision check: query dashboards table for matching slugs
export async function findAvailableSlug(
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  const supabase = await createClient();
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data } = await supabase
      .from("dashboards")
      .select("id")
      .eq("slug", slug)
      .neq("id", excludeId || "")
      .limit(1);

    if (!data || data.length === 0) return slug;
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
}
```

### Pattern 5: Integrating Existing Generation Pipeline into Wizard

**What:** The existing `useGenerateDashboard` hook manages SSE streaming, comp review, and editing. In the wizard, steps 3-5 use this hook but with wizard-specific orchestration.

**When to use:** Wizard steps 3 (MLS extraction), 4 (CSV + generation), and 5 (preview + edit).

```typescript
// The existing hook returns:
// { step, message, progress, html, error, warnings, generate, cancel, reset,
//   applyEdit, continueWithComps, reviewComps, mlsDataCache, loanDataCache }
//
// In wizard step 4:
// 1. User uploads CSV -> call generate() with FormData
// 2. SSE streams progress -> show progress bar
// 3. When step === "review_comps" -> show CompReviewPanel
// 4. User approves comps -> call continueWithComps()
// 5. When step === "complete" -> save results to Supabase, advance to step 5
```

### Anti-Patterns to Avoid

- **Rewriting the generation pipeline:** The existing `useGenerateDashboard` hook and API routes work. Do not rebuild SSE streaming or comp review. Wire the existing hook into wizard steps.
- **Storing wizard state only in React state:** All wizard data must save to Supabase on step transitions. If the user closes the browser and returns, they should be able to resume from where they left off (WIZD-16, WIZD-17).
- **Making the library page a client component:** Use a server component for the initial data fetch, pass to client component for filtering. This avoids loading spinners on first paint.
- **Adding new npm dependencies for forms/wizards:** No form library or wizard library is needed. The wizard is 6 simple steps with basic React state. Libraries like react-hook-form add unnecessary complexity for this scale.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE streaming | Custom EventSource client | Existing `consumeSSEStream` in `useGenerateDashboard` | Already handles buffering, parsing, error states |
| Comp review UI | New comp toggle panel | Existing `CompReviewPanel` component | Already built with scoring display, toggles, loan override |
| CSV analysis | New analysis engine | Existing `runFullAnalysis()` in `csv-engine.ts` | Deterministic scoring pipeline already validated |
| MLS PDF extraction | New Claude prompt/schema | Existing `MLSExtractionSchema` + `askClaudeWithPDF()` | Structured output schema already defined and tested |
| Dashboard editing | New edit flow | Existing `applyEdit()` in hook + `/api/dashboard/edit` | NL edit pipeline already works |
| Slug sanitization | Complex slug library | Simple regex (3 lines) | Only need lowercase, numbers, hyphens |

**Key insight:** Phase 2 is 80% UI restructuring and 20% new functionality (slug management, auto-save, library view). Almost all backend logic already exists.

## Common Pitfalls

### Pitfall 1: Losing Generation Results When Saving to Supabase
**What goes wrong:** The generation pipeline produces an HTML blob and structured data. If you save only the HTML but not the underlying config data, the user cannot re-edit individual fields in the wizard.
**Why it happens:** The current `useGenerateDashboard` hook returns `html` as the final output, but the structured data (comps, metrics, narratives) is what needs to be saved to `sell_data`/`buy_data` tables.
**How to avoid:** After generation completes, extract the CONFIG object from the HTML (or better: capture it from the generation pipeline before template injection) and save it to the appropriate Supabase table.
**Warning signs:** User re-enters wizard and sees empty fields despite having generated a dashboard.

### Pitfall 2: Race Conditions in Auto-Save
**What goes wrong:** User clicks "Next" rapidly, triggering multiple concurrent saves that arrive out of order.
**Why it happens:** Supabase upserts are not serialized.
**How to avoid:** Use a save queue or debounce. Disable the "Next" button while saving (`saving` state). The `goToStep` callback should `await` the save before navigating.
**Warning signs:** Data from step 2 overwrites data entered in step 3.

### Pitfall 3: Wizard Step Validation vs. Auto-Save Conflict
**What goes wrong:** Auto-save triggers on partial data that fails Supabase constraints.
**Why it happens:** The wizard saves on every step transition, but some fields may be nullable only in draft state.
**How to avoid:** All columns in `sell_data` and `buy_data` are already nullable (Phase 1 schema design). Auto-save should use `upsertSellData()`/`upsertBuyData()` which handle partial data. Never validate completeness until publish.
**Warning signs:** Supabase errors on save when fields are empty.

### Pitfall 4: File Upload State Lost on Back Navigation
**What goes wrong:** User uploads MLS PDF in step 3, goes back to step 2, returns to step 3 -- file is gone.
**Why it happens:** File objects in React state are lost on unmount.
**How to avoid:** Two strategies: (a) Keep all wizard step components mounted but hidden (simpler), or (b) store file references in a ref/context that persists across step changes. Since MLS extraction results are saved to Supabase, the extracted data persists -- only the raw file reference is lost, which is acceptable since extraction already happened.
**Warning signs:** User has to re-upload files when navigating back and forth.

### Pitfall 5: Server Component + Client Component Boundary
**What goes wrong:** Trying to use hooks or event handlers in server components, or doing data fetching in client components unnecessarily.
**Why it happens:** Next.js App Router has strict server/client boundaries.
**How to avoid:** Library page: server component fetches data, passes to client component for interactivity. Wizard page: client component throughout (needs hooks, state, event handlers). Mark with `"use client"` at top.
**Warning signs:** Build errors about using `useState` in server components, or unnecessary loading spinners.

### Pitfall 6: Houseversary Type in Wizard
**What goes wrong:** The existing `TEMPLATE_REGISTRY` includes "houseversary" as a type, but the new wizard should only support sell/buyer/buysell.
**Why it happens:** The wizard replaces the single-page form for new dashboard types. Houseversary is a separate system.
**How to avoid:** Filter `TEMPLATE_REGISTRY` in the wizard to exclude houseversary. The old single-page form can remain accessible at a different route if needed, or be removed entirely.
**Warning signs:** Users see houseversary option in wizard, which is out of scope for the dashboard platform.

## Code Examples

### Dashboard Card Component
```typescript
// Source: derived from existing codebase patterns
import Link from "next/link";
import type { Dashboard } from "@/lib/supabase/types";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  sell: { label: "Sell", color: "bg-terra/10 text-terra" },
  buyer: { label: "Buyer", color: "bg-sage/10 text-sage" },
  buysell: { label: "Buy/Sell", color: "bg-sand/10 text-sand" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-slate/10 text-slate-light" },
  published: { label: "Published", color: "bg-sage/10 text-sage-dark" },
  archived: { label: "Archived", color: "bg-sand-pale text-slate-light" },
};

export function DashboardCard({ dashboard }: { dashboard: Dashboard }) {
  const type = TYPE_LABELS[dashboard.type];
  const status = STATUS_LABELS[dashboard.status];
  const updatedAt = new Date(dashboard.updated_at).toLocaleDateString();

  return (
    <Link
      href={`/dashboard/${dashboard.id}/wizard`}
      className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${type.color}`}>
          {type.label}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.color}`}>
          {status.label}
        </span>
      </div>
      <h3 className="font-display font-bold text-slate text-lg">{dashboard.client_names}</h3>
      <p className="text-sm text-slate-light mt-1">{dashboard.slug}</p>
      <p className="text-xs text-slate-light mt-2">Updated {updatedAt}</p>
    </Link>
  );
}
```

### Auto-Save on Step Transition
```typescript
// Pattern for saving wizard data on step change
async function handleNextStep(currentData: Record<string, unknown>) {
  setSaving(true);
  try {
    if (currentStep === 2) {
      // Save client info + property details
      await updateDashboard(dashboardId, {
        client_names: currentData.clientNames,
        full_name: currentData.fullName,
        email: currentData.email,
        agent_key: currentData.agentKey,
      });
      if (dashboardType === "sell" || dashboardType === "buysell") {
        await upsertSellData(dashboardId, {
          address: currentData.address,
          city_state_zip: currentData.cityStateZip,
          // ... other fields
        });
      }
    }
    // Navigate to next step
    router.push(`/dashboard/${dashboardId}/wizard?step=${currentStep + 1}`);
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setSaving(false);
  }
}
```

### Creating a New Dashboard (Step 1 Flow)
```typescript
// POST from step 1: create dashboard record, redirect to wizard
import { createDashboard } from "@/lib/supabase/db";
import { generateSlug, findAvailableSlug } from "@/lib/slug";

async function handleCreateDashboard(type: DashboardType) {
  // Create with minimal data -- slug is temporary, will be refined in step 2
  const tempSlug = `draft-${Date.now()}`;
  const dashboard = await createDashboard({
    type,
    client_names: "",
    slug: tempSlug,
  });
  // Navigate to wizard step 2
  router.push(`/dashboard/${dashboard.id}/wizard?step=2`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-page form with all fields | Multi-step wizard with auto-save | Phase 2 | Enables draft persistence, resume, step-by-step UX |
| Generate-and-download workflow | Library + wizard + future publish | Phase 2 | Dashboards become persistent objects, not one-shot outputs |
| File upload as primary input | File upload + DB-backed data entry | Phase 2 | Users can edit extracted data, return to modify later |
| No dashboard management | Filterable library with status tracking | Phase 2 | Team can see all dashboards, filter by type/status |

## Open Questions

1. **What happens to the existing single-page form?**
   - What we know: The current `page.tsx` handles houseversary, sell, buyer, and buysell types in one form
   - What's unclear: Whether houseversary generation should remain at its own route or be removed
   - Recommendation: Replace `page.tsx` with the library view. If houseversary is still needed, move the old form to `/legacy` or keep it as a separate route. The REQUIREMENTS.md does not include houseversary in the wizard flow.

2. **Should wizard use server actions or API routes for saves?**
   - What we know: Phase 1 established API route patterns for generation; `db.ts` functions use server-side Supabase client
   - What's unclear: Whether server actions (Next.js 14 feature) would be simpler than API routes for CRUD
   - Recommendation: Use server actions for simple CRUD (save step data) -- they avoid the boilerplate of API routes. Keep existing API routes for generation pipeline (SSE streaming requires them).

3. **Dashboard address display for buyer-only dashboards**
   - What we know: Buyer dashboards have no property address, they have `target_areas` instead
   - What's unclear: What to show on the library card where address would normally appear
   - Recommendation: Show `target_areas` or "Buyer Search" as fallback text on the card

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIBR-01 | Library renders dashboard cards | unit | `npx vitest run src/__tests__/library.test.ts -t "renders cards"` | No - Wave 0 |
| LIBR-03 | Type filter works | unit | `npx vitest run src/__tests__/library.test.ts -t "type filter"` | No - Wave 0 |
| LIBR-04 | Status filter works | unit | `npx vitest run src/__tests__/library.test.ts -t "status filter"` | No - Wave 0 |
| SLUG-01 | Slug auto-generated from names+address | unit | `npx vitest run src/lib/__tests__/slug.test.ts -t "generates slug"` | No - Wave 0 |
| SLUG-02 | Slugs contain only valid characters | unit | `npx vitest run src/lib/__tests__/slug.test.ts -t "valid characters"` | No - Wave 0 |
| SLUG-03 | Collision detection appends suffix | unit | `npx vitest run src/lib/__tests__/slug.test.ts -t "collision"` | No - Wave 0 |
| WIZD-01 | Type selection creates draft | unit | `npx vitest run src/__tests__/wizard.test.ts -t "creates draft"` | No - Wave 0 |
| WIZD-16 | Back navigation preserves data | manual-only | N/A - requires browser interaction | N/A |
| WIZD-17 | Step transition triggers save | unit | `npx vitest run src/__tests__/wizard.test.ts -t "auto-save"` | No - Wave 0 |
| STAT-01 | New dashboards start as draft | unit | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "draft status"` | Partial (existing test file) |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/slug.test.ts` -- covers SLUG-01, SLUG-02, SLUG-03
- [ ] `src/__tests__/library.test.ts` -- covers LIBR-01, LIBR-03, LIBR-04 (can test filter logic without DOM)
- [ ] `src/__tests__/wizard.test.ts` -- covers WIZD-01, WIZD-17 (test auto-save logic)

## Sources

### Primary (HIGH confidence)
- Project codebase analysis -- all source files read directly
- Phase 1 research (`01-RESEARCH.md`) -- established patterns for Supabase, Claude API, auth
- Existing `db.ts`, `types.ts`, `supabase/types.ts` -- confirmed CRUD functions and data shapes
- Existing `useGenerateDashboard.ts` -- confirmed SSE streaming and generation pipeline
- Existing `CompReviewPanel.tsx` -- confirmed comp review UI is reusable

### Secondary (MEDIUM confidence)
- Next.js 14 App Router documentation -- server/client component patterns, `useSearchParams`
- Supabase JS client documentation -- upsert behavior, RLS interaction

### Tertiary (LOW confidence)
- None -- all findings are based on direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use
- Architecture: HIGH -- patterns derived from existing codebase; this is restructuring, not greenfield
- Pitfalls: HIGH -- identified from analyzing existing code patterns and data flow
- Wizard flow: MEDIUM -- wizard step orchestration is new code, but integrates existing hooks

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- no dependency changes expected)
