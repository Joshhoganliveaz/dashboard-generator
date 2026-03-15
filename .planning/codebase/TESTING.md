# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`, `describe`, `it`, `vi`)

**Run Commands:**
```bash
npm test                 # Run all tests (vitest run)
npm run test:watch       # Watch mode (vitest)
```

## Test File Organization

**Location:**
- Co-located in `src/lib/__tests__/` directory alongside the `src/lib/` source files

**Naming:**
- `{module-name}.test.ts` matching the source file name
- e.g., `csv-engine.test.ts` tests `csv-engine.ts`

**Structure:**
```
src/lib/__tests__/
  csv-engine.test.ts          # Tests for CSV parsing + Claude analysis
  generate-pipeline.test.ts   # Integration tests for full pipeline assembly
  loan-estimator.test.ts      # Tests for mortgage amortization + refi classification
  template-engine.test.ts     # Tests for JS serialization + HTML injection
  fixtures/
    brandon-manifest.json     # Real client data for integration tests
    brandon-test.csv          # Real ARMLS CSV export for integration tests
    mock-claude-responses.ts  # Canned Claude API responses for all pipeline steps
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies at module level
vi.mock("../claude-api", () => ({
  askClaude: vi.fn(),
}));

// Import after mock declaration
import { askClaude } from "../claude-api";
const mockAskClaude = vi.mocked(askClaude);

// Reset mocks between tests
beforeEach(() => {
  mockAskClaude.mockReset();
});

describe("functionName", () => {
  it("describes the expected behavior", async () => {
    mockAskClaude.mockResolvedValue(JSON.stringify(mockResponse));
    const result = await functionUnderTest(input);
    expect(result.field).toBe(expectedValue);
  });
});
```

**Patterns:**
- `beforeEach` for mock reset (not `afterEach`)
- No `afterAll` or global teardown
- Assertions use specific matchers: `toBe`, `toEqual`, `toContain`, `toBeGreaterThan`, `toBeLessThan`, `toBeCloseTo`, `toHaveLength`, `toBeTruthy`, `not.toThrow`
- Test descriptions use plain language: `"calls Claude API and returns validated result"`, `"handles markdown-fenced JSON response"`

## Mocking

**Framework:** Vitest `vi.mock` and `vi.fn()`

**Patterns:**

**Module-level mock (primary pattern):**
```typescript
// Declare mock BEFORE importing the module that uses it
vi.mock("../claude-api", () => ({
  askClaude: vi.fn(),
}));

// Then import and type the mock
import { askClaude } from "../claude-api";
const mockAskClaude = vi.mocked(askClaude);
```

**Setting return values per test:**
```typescript
// For successful responses
mockAskClaude.mockResolvedValue(JSON.stringify(mockClaudeResponse));

// For error cases
mockAskClaude.mockRejectedValue(new Error("API rate limited"));
```

**Verifying calls:**
```typescript
expect(mockAskClaude).toHaveBeenCalledOnce();
expect(mockAskClaude).not.toHaveBeenCalled();
const prompt = mockAskClaude.mock.calls[0][0];
expect(prompt).toContain("expected text");
```

**What to Mock:**
- Claude API calls (`askClaude`, `askClaudeWithPDF`, `askClaudeWithImages`) -- always mock, never hit real API in tests
- All mocks go through `vi.mock("../claude-api", ...)` at module level

**What NOT to Mock:**
- Pure computation functions (`computeMatchScore`, `adjustCompPrice`, `deriveValueFromComps`, `estimateCurrentBalance`, `getHistoricalRate`)
- Validation functions (`validateDashboardConfig`)
- Serialization functions (`serializeValue`, `injectConfig`)
- These are tested directly with real inputs and expected outputs

## Fixtures and Factories

**Test Data:**

**Canned Claude responses** in `src/lib/__tests__/fixtures/mock-claude-responses.ts`:
```typescript
export const mockMLSExtraction = {
  beds: 4, baths: 2.5, sqft: 1920, yearBuilt: 1986,
  pool: true, stories: 1,
  features: [{ title: "Private Pool & Spa", desc: "..." }, ...],
};

export const mockCromfordData = { metrics: [...], takeaway: "...", source: "..." };
export const mockWebResearch = { developments: [...], infrastructure: [...], areaHighlights: [...] };
export const mockTaxRecordsExtraction = { purchasePrice: 585000, purchaseDate: "2022-03-14", ... };
export const mockContentGeneration = { headerTitle: "...", outlookNarrative: [...], ... };
```

**Real data fixtures:**
- `src/lib/__tests__/fixtures/brandon-manifest.json` -- real client manifest with all fields
- `src/lib/__tests__/fixtures/brandon-test.csv` -- real ARMLS CSV export

**Inline test data:**
- Small test objects defined directly in test files for unit tests
- Minimal CSV strings for CSV engine tests:
  ```typescript
  const testCSV = `House Number,Compass,Street Name,...\n2300,S,Estrella,Cir,...`;
  ```
- Full `DashboardConfig` objects for template engine tests (see `minimalConfig` in `template-engine.test.ts`)

**Location:**
- Fixture files: `src/lib/__tests__/fixtures/`
- Inline data: top of each test file

## Coverage

**Requirements:** Not enforced. No coverage thresholds configured.

**View Coverage:**
```bash
npx vitest run --coverage    # Not configured but can be run manually
```

## Test Types

**Unit Tests:**
- `template-engine.test.ts` -- Tests `serializeValue()` with primitives, strings, special characters, XSS prevention, emoji, edge cases (NaN, Infinity). Tests `injectConfig()` for marker injection, JS validity, round-trip correctness.
- `csv-engine.test.ts` -- Tests `runFullAnalysis()` with mocked Claude API: successful response, markdown-fenced JSON, API failure, empty CSV, invalid enum values, missing field coercion.
- `loan-estimator.test.ts` -- Tests `getHistoricalRate()` for known quarters, boundary dates. Tests `estimateCurrentBalance()` for known loans, fully paid loans, new loans, purchase context (LTV/down payment), refinance classification (cash-out vs rate-term), multi-refi chains, edge cases (small original loan + large refi).

**Integration Tests:**
- `generate-pipeline.test.ts` -- Tests the full assembly pipeline: CSV analysis + mock Claude data assembly + config validation + template injection. Verifies complete CONFIG round-trips correctly through HTML. Tests `validateDashboardConfig` with sparse input. Tests loan estimation with mock tax data integrated into pipeline.

**E2E Tests:**
- Not used. No Playwright, Cypress, or browser-based testing.

## Common Patterns

**Async Testing:**
```typescript
it("calls Claude API and returns validated result", async () => {
  mockAskClaude.mockResolvedValue(JSON.stringify(mockClaudeResponse));
  const result = await runFullAnalysis(csvBuffer, subject);
  expect(result.comps.length).toBe(2);
});
```

**Error Testing:**
```typescript
it("returns empty result with warning on Claude API failure", async () => {
  mockAskClaude.mockRejectedValue(new Error("API rate limited"));
  const result = await runFullAnalysis(csvBuffer, subject);
  expect(result.comps.length).toBe(0);
  expect(result.metadata.warnings[0]).toContain("Claude analysis failed");
});
```

**Throw Testing:**
```typescript
it("throws on missing markers", () => {
  expect(() => injectConfig("<html></html>", config)).toThrow("Could not find CONFIG markers");
});
```

**JS Validity Testing (unique to this codebase):**
```typescript
it("produces valid JS in the CONFIG section", () => {
  const result = injectConfig(template, config);
  const match = result.match(/var CONFIG = ([\s\S]*?);\n\/\/ ====/);
  expect(match).toBeTruthy();
  expect(() => new Function(`return ${match![1]}`)).not.toThrow();
});
```

**Round-trip Testing:**
```typescript
it("round-trips config data correctly", () => {
  const result = injectConfig(template, config);
  const match = result.match(/var CONFIG = ([\s\S]*?);\n\/\/ ====/);
  const parsed = new Function(`return ${match![1]}`)();
  expect(parsed.clientNames).toBe("Test Client");
  expect(parsed.purchasePrice).toBe(500000);
});
```

**Range Testing (for financial calculations):**
```typescript
it("estimates a reasonable balance for a known loan", () => {
  const result = estimateCurrentBalance(468000, "2022-03-14");
  expect(result.monthlyPayment).toBeGreaterThan(2000);
  expect(result.monthlyPayment).toBeLessThan(2500);
  expect(result.estimatedBalance).toBeLessThan(468000);
  expect(result.estimatedBalance).toBeGreaterThan(400000);
});
```

**Nested describe for related scenarios:**
```typescript
describe("estimateCurrentBalance", () => {
  it("estimates a reasonable balance for a known loan", () => { ... });
  it("returns 0 balance for fully paid loan", () => { ... });

  describe("purchase context", () => {
    it("calculates down payment and LTV from purchase price", () => { ... });
    it("handles high-LTV loans (FHA/VA)", () => { ... });
  });

  describe("refinance classification", () => {
    it("classifies a cash-out refi", () => { ... });
    it("classifies a rate-and-term refi", () => { ... });
    it("walks a chain of multiple refinances", () => { ... });
  });
});
```

## Vitest Configuration

**Config:** `vitest.config.ts`
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,       // describe/it/expect available without import
    environment: "node", // Not jsdom -- tests are server-side logic
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

**Key settings:**
- `globals: true` -- Vitest globals available without import (though test files still import from `"vitest"` explicitly)
- `environment: "node"` -- No DOM environment; all tested code is server-side library code
- Path alias `@` matches the project's `tsconfig.json` paths

## Test Coverage Gaps

**Untested areas:**
- API routes (`src/app/api/dashboard/generate/route.ts`, `src/app/api/clients/route.ts`, `src/app/api/login/route.ts`) -- no route handler tests
- React components (`ClientPicker.tsx`, `CompReviewPanel.tsx`, `page.tsx`) -- no component rendering tests
- Custom hooks (`useGenerateDashboard.ts`, `useClients.ts`) -- no hook tests
- SSE streaming logic in both API and client hook
- `src/lib/claude-prompts.ts` -- prompt construction not tested (large prompt templates)
- `src/lib/template-loader.ts` -- template loading not tested
- `src/lib/template-registry.ts` -- registry helpers not tested
- `src/lib/comp-adjustments.ts` -- `adjustCompPrice` and `deriveValueFromComps` not directly unit tested (tested indirectly via pipeline integration test)
- `src/middleware.ts` -- auth middleware not tested
- Edit flow (`/api/dashboard/edit/route.ts`) -- not tested

**What's well tested:**
- Core computation: loan estimation with all edge cases (12 tests)
- Template engine serialization and injection (11 tests)
- CSV analysis pipeline with Claude mock (6 tests)
- Full pipeline integration with real fixtures (5 tests)

---

*Testing analysis: 2026-03-15*
