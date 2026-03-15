# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**
- Library modules: `kebab-case.ts` (e.g., `csv-engine.ts`, `claude-api.ts`, `loan-estimator.ts`, `comp-adjustments.ts`)
- React components: `PascalCase.tsx` (e.g., `ClientPicker.tsx`, `CompReviewPanel.tsx`)
- Custom hooks: `camelCase.ts` prefixed with `use` (e.g., `useClients.ts`, `useGenerateDashboard.ts`)
- Type declaration files: `kebab-case.d.ts` (e.g., `html.d.ts`)
- Test files: `kebab-case.test.ts` inside `__tests__/` directory
- API routes: `route.ts` inside App Router directory structure

**Functions:**
- Use `camelCase` for all functions: `runFullAnalysis`, `validateDashboardConfig`, `computeMatchScore`
- React components use `PascalCase`: `ClientPicker`, `CompReviewPanel`, `HomePage`
- Private/internal helpers use `camelCase` without export: `parseCSVLine`, `compactFeatures`, `trimCSVColumns`
- Prefix custom hooks with `use`: `useClients`, `useGenerateDashboard`

**Variables:**
- Use `camelCase` for local variables and state: `csvResult`, `templateType`, `purchasePrice`
- Constants use `UPPER_SNAKE_CASE`: `KEEP_COLUMNS`, `CASH_OUT_THRESHOLD`, `HISTORICAL_RATES`, `INITIAL_STATE`
- Constant arrays/objects at module scope: `AGENT_OPTIONS`, `TEMPLATE_OPTIONS`, `STEP_LABELS`
- Boolean state variables are named descriptively: `isGenerating`, `isEditing`, `subdivisionLoading`

**Types:**
- Interfaces: `PascalCase` (e.g., `CompSale`, `MarketMetrics`, `DashboardConfig`, `LoanEstimate`)
- Type aliases: `PascalCase` (e.g., `TemplateType`, `AnalysisLens`, `GenerationStepName`)
- Union string literals for enums: `"rising" | "stable" | "declining"`, `"houseversary" | "sell" | "buyer" | "buysell"`

## Code Style

**Formatting:**
- No ESLint or Prettier configuration at project level
- Use double quotes for strings consistently across the codebase
- 2-space indentation
- Semicolons at end of statements
- Trailing commas in multi-line arrays and objects

**Linting:**
- TypeScript strict mode enabled in `tsconfig.json`
- No standalone linter configured; rely on TypeScript compiler for type checking
- `@ts-ignore` used sparingly and only with comment explaining why (see `src/lib/template-loader.ts` lines 1-8 for HTML imports)

## Import Organization

**Order:**
1. External packages (React, Next.js, lucide-react)
2. Internal absolute imports using `@/` alias (`@/lib/`, `@/hooks/`, `@/components/`)
3. Relative imports for same-directory files
4. Type-only imports use `import type { ... }`

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json` and `vitest.config.ts`)

**Examples from `src/app/page.tsx`:**
```typescript
import { useState, useRef, useMemo, useEffect } from "react";
import { Upload, FileText, Image } from "lucide-react";
import { useGenerateDashboard } from "@/hooks/useGenerateDashboard";
import ClientPicker from "@/components/ClientPicker";
import { TEMPLATE_REGISTRY } from "@/lib/template-registry";
import type { TemplateType } from "@/lib/template-registry";
import type { SubjectProperty } from "@/lib/types";
```

**Type imports convention:**
- Use `import type` for type-only imports: `import type { CompSale, MarketMetrics } from "./types"`
- Combine type and value imports from same module when both are needed

## Error Handling

**Patterns:**
- **Graceful degradation with warnings:** When a pipeline step fails, log the error, push a warning message, and continue with defaults. Do not throw unless the failure is fatal. See `src/app/api/dashboard/generate/route.ts` tax records extraction:
  ```typescript
  try {
    const taxResponse = await askClaudeWithPDF(...);
    // process
  } catch (err) {
    console.error("Tax records extraction failed, continuing:", err);
  }
  ```
- **Validation with safe defaults:** Use `validateDashboardConfig()` to coerce any missing/malformed data to safe zero/empty defaults rather than throwing. See `src/lib/types.ts` lines 373-462.
- **API retry with exponential backoff:** Claude API calls retry 3 times with `Math.pow(2, attempt) * 1000` ms delay on 429 errors. See `src/lib/claude-api.ts` lines 54-89.
- **Empty result pattern for failures:** Functions like `runFullAnalysis()` return a valid empty result with warnings array rather than throwing. See `src/lib/csv-engine.ts` `emptyResult()` function.
- **Abort controller for cancellation:** Both `generate()` and `applyEdit()` use `AbortController` refs, check `AbortError` name, and early-return on cancel. See `src/hooks/useGenerateDashboard.ts`.

**Error type casting:**
- Use `(err as Error).message` pattern throughout (no custom error classes)

## Logging

**Framework:** `console.log`, `console.warn`, `console.error` (no logging library)

**Patterns:**
- `console.log` for informational pipeline progress: `"CSV analysis: N comps, derivedValue=$X"`
- `console.warn` for non-fatal issues: `"CSV column trim: no matching columns found"`
- `console.error` for caught exceptions: `"Claude CSV analysis failed:", err`
- Server-side logs include data context (variable values, counts) for debugging

## Comments

**When to Comment:**
- JSDoc `/** ... */` on exported functions with purpose and parameter descriptions. See `src/lib/loan-estimator.ts`, `src/lib/comp-adjustments.ts`.
- Inline `//` comments for non-obvious business logic (e.g., match score rubric, GLA adjustment rates, refi classification thresholds)
- `// --- Section Name ---` dividers to separate logical sections within files. Used extensively in `src/lib/csv-engine.ts` and `src/app/page.tsx`.
- Step comments in pipeline: `// === STEP 1: Extract from MLS PDF ===`

**JSDoc/TSDoc:**
- Used on key exported functions and interfaces
- Not used on React components or internal helpers

## Function Design

**Size:**
- Library functions are focused and single-purpose (e.g., `getHistoricalRate`, `balanceAtMonth`, `parseBaths`)
- Pipeline orchestrator functions (`buildHouseversaryConfig`, `buildSellConfig`) are larger but follow a linear step-by-step flow
- Main page component `HomePage()` is large (~700 lines) with helper components (`Input`, `FileDropZone`) defined at bottom of same file

**Parameters:**
- Prefer object parameters for functions with 3+ arguments
- Use TypeScript intersection types for extending parameter shapes: `SubjectProperty & { subdivision: string; communityName: string; ... }`
- Optional parameters use `?` syntax or default values

**Return Values:**
- Return typed objects, not tuples
- Use `Promise<T>` for async functions
- Return empty/default objects on failure rather than null (see `emptyResult()` pattern)

## Module Design

**Exports:**
- Named exports for all functions and types (no default exports from library modules)
- Default exports only for React page/component files: `export default function HomePage()`, `export default function ClientPicker()`
- Re-export types when consumed across module boundaries: `export type { ClientRecord }` in `src/hooks/useClients.ts`

**Barrel Files:**
- Not used. Import directly from specific files.

## React Patterns

**State Management:**
- `useState` for local component state
- Custom hooks (`useGenerateDashboard`, `useClients`) encapsulate fetch + state logic
- No global state library (no Zustand, Redux, Context)
- `useRef` for DOM refs and mutable values that survive re-renders (abort controllers, cached data)

**Component Pattern:**
- `"use client"` directive at top of all client components and hooks
- Server components for layout only (`src/app/layout.tsx`)
- Small reusable components defined in same file as parent (e.g., `Input`, `FileDropZone` in `page.tsx`)
- Larger reusable components in `src/components/` directory

**Tailwind CSS:**
- Utility-first with custom theme colors defined in `tailwind.config.ts`
- Custom colors: `cream`, `terra` (with light/dark variants), `sage` (with dark/light), `sand` (with light/pale), `slate` (with light)
- Conditional classes via template literals: `` `text-left p-4 rounded-lg border-2 ${isActive ? "border-terra" : "border-sand-pale"}` ``
- Use `className` prop for styling, no CSS modules or styled-components

**Data Flow:**
- SSE (Server-Sent Events) for streaming generation progress from API to client
- `FormData` for file uploads
- JSON in SSE `data:` payloads for structured progress updates

## API Route Conventions

**Location:** `src/app/api/` following Next.js App Router conventions

**Pattern:**
- Export named HTTP methods: `export async function POST(request: Request)`
- Return `NextResponse.json()` for JSON responses
- Return `new Response(stream, { headers })` for SSE streams
- Parse `FormData` for file uploads, JSON for structured data
- Set `export const maxDuration = 300` for long-running routes

**SSE Helper:**
```typescript
function sendSSE(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}
```

## Authentication

**Pattern:** Simple cookie-based password auth
- Middleware at `src/middleware.ts` checks `dashboard-auth` cookie
- Login route at `src/app/api/login/route.ts`
- Allows `/login`, `/api/login`, `/_next`, `/favicon`, `.html` without auth

---

*Convention analysis: 2026-03-15*
