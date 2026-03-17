---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/dashboard/extract-tax/route.ts
  - src/lib/tax-record-parser.ts
  - src/lib/historical-rates.ts
  - src/lib/loan-classifier.ts
  - src/components/wizard/TaxRecordUpload.tsx
  - src/components/wizard/StepClientInfo.tsx
  - src/lib/supabase/types.ts
  - src/lib/types.ts
  - src/lib/schemas/dashboard.ts
  - src/lib/publish.ts
autonomous: true
requirements: [QUICK-4]
must_haves:
  truths:
    - "Admin can upload a Monsoon tax record PDF in StepClientInfo and see extracted loan origination history"
    - "Admin can select which loan is primary, mark HELOCs, and override auto-filled interest rates"
    - "Extracted loan data (loan_amount, interest_rate, refi_detected, second_lien_amount) persists to sell_data and flows into published dashboard config"
    - "Loan payoff field auto-populates from tax record extraction using amortization estimate"
  artifacts:
    - path: "src/app/api/dashboard/extract-tax/route.ts"
      provides: "API endpoint for Monsoon PDF extraction via Claude"
    - path: "src/lib/tax-record-parser.ts"
      provides: "Extraction prompt builder and types for Monsoon tax records"
    - path: "src/lib/historical-rates.ts"
      provides: "PMMS monthly rate lookup table (Jan 2010 - Feb 2026)"
    - path: "src/lib/loan-classifier.ts"
      provides: "Loan classification (primary/refi/HELOC) using 60% threshold"
    - path: "src/components/wizard/TaxRecordUpload.tsx"
      provides: "Self-contained upload + extract + select UI component"
  key_links:
    - from: "src/components/wizard/TaxRecordUpload.tsx"
      to: "/api/dashboard/extract-tax"
      via: "fetch POST with FormData"
    - from: "src/components/wizard/TaxRecordUpload.tsx"
      to: "src/components/wizard/StepClientInfo.tsx"
      via: "onExtracted callback props flowing loan data up"
    - from: "src/lib/publish.ts"
      to: "src/lib/supabase/types.ts"
      via: "SellData loan fields mapped to SellDashboardConfig"
---

<objective>
Add Monsoon tax record PDF upload to the sell dashboard wizard's StepClientInfo, porting the extraction + loan classification system from the homeowner-journey-map project. When an admin uploads a tax record, Claude extracts deed history and loan origination records. The admin then selects which loan is primary, marks HELOCs, and can override auto-filled PMMS interest rates. The extracted data auto-populates loan_payoff (via amortization estimate) and stores richer loan details (loan_amount, interest_rate, refi_detected, second_lien_amount) on sell_data for the loan estimator section of the published dashboard.

Purpose: Eliminates manual loan data entry and provides accurate loan balance estimates from public records.
Output: New API route, parser/classifier libs, upload component, and updated types/schemas.
</objective>

<execution_context>
@/Users/joshuahogan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/joshuahogan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/wizard/StepClientInfo.tsx
@src/lib/supabase/types.ts
@src/lib/types.ts
@src/lib/schemas/dashboard.ts
@src/lib/publish.ts
@src/lib/loan-estimator.ts
@src/app/api/dashboard/generate/route.ts

<interfaces>
<!-- Reference implementation from homeowner-journey-map to port -->
<!-- Executor should adapt these patterns to dashboard-generator's conventions -->

From homeowner-journey-map src/lib/monsoon-parser.ts:
```typescript
export interface DeedHistoryEntry {
  saleDate: string; buyer: string; seller: string;
  salePrice: number; downPayment: number; mortgageAmount: number; financing: string;
}
export interface MonsoonExtraction {
  address: string; city: string; state: string; zip: string;
  livingArea: number; yearBuilt: number; lotSqft: number; stories: number;
  pool: boolean; poolSqft: number; garage: number;
  deedHistory: DeedHistoryEntry[];
  loanOriginationHistory: LoanOrigination[];
}
export function buildMonsoonExtractionPrompt(): string; // returns extraction prompt
export function findOriginalLoanAmount(extraction: MonsoonExtraction, ownerName: string): number | null;
```

From homeowner-journey-map src/lib/loan-classifier.ts:
```typescript
export interface ClassifiedLoans {
  originalLoan: LoanOrigination | null;
  currentPrimary: LoanOrigination | null;
  secondLiens: LoanOrigination[];
  secondLienTotal: number;
  refiDetected: boolean;
  lookupRate: number;
}
export function classifyLoans(loans: LoanOrigination[], purchaseDate: string | null): ClassifiedLoans;
export function annotateLoansWithRates(loans: LoanOrigination[]): LoanOrigination[];
```

From homeowner-journey-map src/lib/types.ts:
```typescript
export interface LoanOrigination {
  date: string; amount: number; lender: string; financeType: string; assumedRate?: number;
}
```

From dashboard-generator existing patterns:
```typescript
// src/lib/claude-api.ts - already has askClaudeWithPDF used by extract-mls route
export function askClaudeWithPDF(prompt: string, pdfBase64: string, opts?: { maxTokens?: number }): Promise<string>;

// src/lib/loan-estimator.ts - already has estimateCurrentBalance used in generate pipeline
export function estimateCurrentBalance(loanAmount: number, loanDate: string, refinances?: Refinance[], purchasePrice?: number): LoanEstimate;
```

From dashboard-generator src/lib/supabase/types.ts (SellData - needs new fields):
```typescript
export interface SellData {
  // existing fields...
  loan_payoff?: number | null;
  // NEW fields needed:
  // loan_amount?: number | null;
  // interest_rate?: number | null;
  // refi_detected?: boolean | null;
  // second_lien_amount?: number | null;
  // loan_origination_history?: LoanOrigination[] | null;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create tax record extraction backend (API route + parser + classifier + rates)</name>
  <files>
    src/app/api/dashboard/extract-tax/route.ts
    src/lib/tax-record-parser.ts
    src/lib/historical-rates.ts
    src/lib/loan-classifier.ts
    src/lib/types.ts
  </files>
  <action>
Port the backend extraction and classification system from homeowner-journey-map, adapting to dashboard-generator conventions:

1. **`src/lib/types.ts`** -- Add `LoanOrigination` interface near the top (before `CompSale`):
   ```typescript
   export interface LoanOrigination {
     date: string;
     amount: number;
     lender: string;
     financeType: string;
     assumedRate?: number;
   }
   ```
   Also add `DeedHistoryEntry` and `MonsoonExtraction` interfaces (from reference `monsoon-parser.ts`). Add `LoanOrigination` to the imports used by other types.

2. **`src/lib/tax-record-parser.ts`** -- Port from homeowner-journey-map's `monsoon-parser.ts`:
   - Copy `buildMonsoonExtractionPrompt()` exactly (the Claude prompt for Monsoon PDFs).
   - Copy `findOriginalLoanAmount()` function.
   - Export the types (or import from types.ts if already defined there).

3. **`src/lib/historical-rates.ts`** -- Port the PMMS monthly lookup table from homeowner-journey-map's `historical-rates.ts`:
   - Copy the full `PMMS_MONTHLY` record (Jan 2010 - Feb 2026, stored as decimals like 0.0510).
   - Copy `getHistoricalRate(dateStr: string): number` function.
   - Fallback should return 0.0665 (current-ish rate) for dates outside the table.
   - NOTE: This is a SEPARATE file from the existing `loan-estimator.ts` which has quarterly rates as percentages. The monthly table is more granular and used for loan classification annotation.

4. **`src/lib/loan-classifier.ts`** -- Port from homeowner-journey-map:
   - Copy `ClassifiedLoans` interface.
   - Copy `classifyLoans(loans, purchaseDate)` function (60% threshold, 60-day purchase window).
   - Copy `annotateLoansWithRates(loans)` function.
   - Import `getHistoricalRate` from `./historical-rates`.
   - Import `LoanOrigination` from `./types`.
   - The fallback default rate for empty loans should be 0.0665.

5. **`src/app/api/dashboard/extract-tax/route.ts`** -- Create a new API route modeled on the existing `extract-mls/route.ts` pattern:
   - Accept POST with FormData containing a `taxPdf` field (File).
   - Convert PDF to base64, call `askClaudeWithPDF` from `@/lib/claude-api` with the prompt from `buildMonsoonExtractionPrompt()`.
   - Parse the JSON response using the same `parseJSONFromClaude` pattern (extract JSON from possible markdown fences or prose wrapping). Inline the parser helper or import from a shared util -- check if `parseJSONFromClaude` is exported from the generate route; if not, inline a copy.
   - Return `{ success: true, data: MonsoonExtraction }` on success.
   - Return `{ success: false, error: string }` with 400/500 status on failure.
   - Use `claude-sonnet-4-6` model (same as reference), maxTokens 4096.
  </action>
  <verify>
    <automated>cd /Users/joshuahogan/Projects/dashboard-generator && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - LoanOrigination, DeedHistoryEntry, MonsoonExtraction types exported from types.ts
    - tax-record-parser.ts exports buildMonsoonExtractionPrompt and findOriginalLoanAmount
    - historical-rates.ts exports PMMS_MONTHLY lookup and getHistoricalRate
    - loan-classifier.ts exports classifyLoans and annotateLoansWithRates
    - extract-tax API route accepts PDF, returns structured MonsoonExtraction
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Create TaxRecordUpload component and wire into StepClientInfo with updated types</name>
  <files>
    src/components/wizard/TaxRecordUpload.tsx
    src/components/wizard/StepClientInfo.tsx
    src/lib/supabase/types.ts
    src/lib/types.ts
    src/lib/schemas/dashboard.ts
    src/lib/publish.ts
  </files>
  <action>
Create the tax record upload UI and wire the full data flow from upload through to published dashboard:

1. **`src/lib/supabase/types.ts`** -- Add new optional fields to `SellData` interface (after `loan_payoff`):
   ```typescript
   loan_amount?: number | null;
   interest_rate?: number | null;
   refi_detected?: boolean | null;
   second_lien_amount?: number | null;
   loan_origination_history?: { date: string; amount: number; lender: string; financeType: string; assumedRate?: number }[] | null;
   ```

2. **`src/lib/types.ts`** -- Add new optional fields to `SellDashboardConfig` (after `loanPayoff`):
   ```typescript
   loanAmount?: number;
   interestRate?: number;
   refiDetected?: boolean;
   secondLienAmount?: number;
   ```
   Do the same for `BuySellDashboardConfig` (after `loanPayoff`).

3. **`src/lib/schemas/dashboard.ts`** -- Add optional fields to `SellDashboardConfigSchema` (after `loanPayoff`):
   ```typescript
   loanAmount: z.number().optional(),
   interestRate: z.number().optional(),
   refiDetected: z.boolean().optional(),
   secondLienAmount: z.number().optional(),
   ```
   Do the same for `BuySellDashboardConfigSchema`.

4. **`src/lib/publish.ts`** -- In the sell config builder function, after the `loanPayoff` mapping line, add:
   ```typescript
   loanAmount: sd?.loan_amount ?? undefined,
   interestRate: sd?.interest_rate ?? undefined,
   refiDetected: sd?.refi_detected ?? undefined,
   secondLienAmount: sd?.second_lien_amount ?? undefined,
   ```
   Do the same for the buysell config builder.

5. **`src/components/wizard/TaxRecordUpload.tsx`** -- Create a self-contained component ported from homeowner-journey-map's `MonsoonUpload.tsx`, adapted to dashboard-generator's design system:
   - Props interface:
     ```typescript
     interface TaxRecordUploadProps {
       onExtracted: (data: {
         loanPayoff: number;
         loanAmount: number;
         interestRate: number;
         refiDetected: boolean;
         secondLienAmount: number;
         loanOriginationHistory: LoanOrigination[];
       }) => void;
       purchaseDate?: string | null;
       estimatedSalePrice?: number | null;
     }
     ```
   - Two-phase workflow (same as reference):
     - Phase 1: Upload PDF, call `/api/dashboard/extract-tax`, show loading state "Extracting tax record data..."
     - Phase 2: Show extracted loan history with controls:
       - Each loan row shows: date, amount, rate (editable inline input), lender
       - Radio/button to "Set as Primary" for each loan
       - Checkbox to mark as "HELOC" for non-primary loans
       - Auto-classifies using `classifyLoans` from `@/lib/loan-classifier` on extraction
       - PMMS rates auto-filled via `annotateLoansWithRates`
       - "Apply" button calls `onExtracted` with computed values
       - "Discard" button resets
   - On Apply:
     - Use the existing `estimateCurrentBalance` from `@/lib/loan-estimator` with the selected primary loan's amount/date and any refinance chain to compute `loanPayoff`.
     - `loanAmount` = selected primary loan amount
     - `interestRate` = selected primary loan's assumedRate (PMMS decimal, e.g. 0.0510)
     - `refiDetected` = true if selected primary is not the earliest loan
     - `secondLienAmount` = sum of HELOC-checked loan amounts
     - `loanOriginationHistory` = full annotated loan array
   - Style with the same Tailwind classes used in StepClientInfo (terra, sand, slate, sage colors, rounded-lg borders, text-sm). Use Upload, FileText, CheckCircle2, AlertCircle icons from lucide-react (already imported in StepClientInfo).

6. **`src/components/wizard/StepClientInfo.tsx`** -- Wire TaxRecordUpload into the wizard:
   - Import TaxRecordUpload component.
   - Add new state variables for the loan detail fields (or store them to pass in handleNext):
     ```typescript
     const [loanAmount, setLoanAmount] = useState<number | null>(sellData?.loan_amount ?? null);
     const [interestRate, setInterestRate] = useState<number | null>(sellData?.interest_rate ?? null);
     const [refiDetected, setRefiDetected] = useState<boolean | null>(sellData?.refi_detected ?? null);
     const [secondLienAmount, setSecondLienAmount] = useState<number | null>(sellData?.second_lien_amount ?? null);
     const [loanOriginationHistory, setLoanOriginationHistory] = useState(sellData?.loan_origination_history ?? null);
     ```
   - Place `<TaxRecordUpload />` INSIDE the existing "Document Upload" fieldset, AFTER the MLS PDF upload zone (after the extraction error block, around line 387). Add a small label/separator like "Tax Records (optional)" so it's visually distinct from the MLS upload.
   - Wire `onExtracted` callback to update all loan state:
     ```typescript
     onExtracted={(data) => {
       setLoanPayoff(data.loanPayoff.toString());
       setLoanAmount(data.loanAmount);
       setInterestRate(data.interestRate);
       setRefiDetected(data.refiDetected);
       setSecondLienAmount(data.secondLienAmount);
       setLoanOriginationHistory(data.loanOriginationHistory);
     }}
     ```
   - Pass `purchaseDate` and `estimatedSalePrice` props from current state.
   - In `handleNext`, add the new fields to the `sell_data` object being built (after `loan_payoff`):
     ```typescript
     loan_amount: loanAmount,
     interest_rate: interestRate,
     refi_detected: refiDetected,
     second_lien_amount: secondLienAmount,
     loan_origination_history: loanOriginationHistory,
     ```
   - Add the new state variables to the handleNext useCallback dependency array.
  </action>
  <verify>
    <automated>cd /Users/joshuahogan/Projects/dashboard-generator && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - TaxRecordUpload.tsx renders upload zone, extraction preview with loan selection, and Apply/Discard controls
    - StepClientInfo shows tax record upload below MLS upload in Document Upload fieldset
    - Extracted loan data flows into sell_data with new fields (loan_amount, interest_rate, refi_detected, second_lien_amount, loan_origination_history)
    - Loan payoff auto-populates from amortization estimate when tax record is applied
    - New fields defined in SellData (supabase types), SellDashboardConfig (types.ts), Zod schema, and publish.ts mapping
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm run build` succeeds (Next.js build)
3. Manual test flow: Start dev server, create a new sell dashboard, upload an MLS PDF, then upload a Monsoon tax record PDF in the same Document Upload section. Verify:
   - Extraction shows loan origination history with dates, amounts, rates, lenders
   - Can toggle primary loan, mark HELOCs, edit rates inline
   - Apply populates the Loan Payoff field and stores loan details
   - Navigate to next step and back -- loan data persists
</verification>

<success_criteria>
- Tax record upload appears in StepClientInfo below MLS upload for sell/buysell dashboards
- Monsoon PDF extraction returns structured loan origination history via Claude
- Loan classifier auto-selects primary and marks HELOCs using 60% threshold
- PMMS rates auto-fill from monthly lookup table, admin can override
- Apply writes loanPayoff (amortization estimate), loanAmount, interestRate, refiDetected, secondLienAmount to sell_data
- All new fields flow through to published dashboard config via publish.ts
- TypeScript builds cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/4-add-tax-records-upload-to-client-info-wi/4-SUMMARY.md`
</output>
