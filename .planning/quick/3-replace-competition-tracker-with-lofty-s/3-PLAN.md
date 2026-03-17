---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/wizard/StepClientInfo.tsx
  - src/lib/supabase/types.ts
  - src/lib/types.ts
  - src/lib/schemas/dashboard.ts
  - src/lib/claude-prompts.ts
  - src/app/api/dashboard/generate/route.ts
  - src/app/api/dashboard/generate/continue/route.ts
  - src/lib/publish.ts
  - src/lib/template-sell.html
  - src/lib/template-buyer.html
  - src/lib/template-buysell.html
autonomous: true
requirements: [QUICK-3]
must_haves:
  truths:
    - "Wizard form has a Competition Link URL field for sell, buyer, and buysell dashboard types"
    - "Sell dashboard shows 'YOUR LOCAL COMPETITION' section with CTA button instead of AI-generated listing cards"
    - "Buyer dashboard shows 'YOUR LOCAL COMPETITION' section with CTA button when URL provided"
    - "BuySell dashboard shows competition CTA button instead of AI-generated listing cards"
    - "If no competition link URL is provided, the competition section is hidden entirely"
    - "Claude prompts no longer ask for competition listings"
  artifacts:
    - path: "src/components/wizard/StepClientInfo.tsx"
      provides: "Competition Link URL input field"
    - path: "src/lib/template-sell.html"
      provides: "CTA button competition section replacing AI listings"
    - path: "src/lib/template-buyer.html"
      provides: "New competition CTA section"
    - path: "src/lib/template-buysell.html"
      provides: "CTA button competition section replacing AI listings"
  key_links:
    - from: "src/components/wizard/StepClientInfo.tsx"
      to: "src/lib/supabase/types.ts"
      via: "competition_link field on SellData and BuyData"
      pattern: "competition_link"
    - from: "src/app/api/dashboard/generate/route.ts"
      to: "SellDashboardConfig/BuyerDashboardConfig"
      via: "competitionLink field passed to config"
      pattern: "competitionLink"
---

<objective>
Replace AI-generated competition tracker listings with a Lofty search link CTA button on all dashboard types (sell, buyer, buysell). Add a "Competition Link" URL input to the wizard form, display as a branded CTA button "View Active Homes in Your Area" when provided, and hide the section entirely when not provided. Remove competition-related content from Claude prompts.

Purpose: Agents paste a real Lofty search URL instead of relying on AI-fabricated competition listings, giving clients accurate, live data.
Output: Updated wizard form, templates, types, prompts, and generation pipeline.
</objective>

<execution_context>
@/Users/joshuahogan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/joshuahogan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/3-replace-competition-tracker-with-lofty-s/3-CONTEXT.md
@src/components/wizard/StepClientInfo.tsx
@src/lib/types.ts
@src/lib/supabase/types.ts
@src/lib/schemas/dashboard.ts
@src/lib/claude-prompts.ts
@src/app/api/dashboard/generate/route.ts
@src/app/api/dashboard/generate/continue/route.ts
@src/lib/publish.ts
@src/lib/template-sell.html
@src/lib/template-buyer.html
@src/lib/template-buysell.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add competitionLink field to types, schema, wizard form, and generation pipeline</name>
  <files>
    src/lib/supabase/types.ts
    src/lib/types.ts
    src/lib/schemas/dashboard.ts
    src/components/wizard/StepClientInfo.tsx
    src/app/api/dashboard/generate/route.ts
    src/app/api/dashboard/generate/continue/route.ts
    src/lib/publish.ts
    src/lib/claude-prompts.ts
  </files>
  <action>
**Data model changes:**

1. `src/lib/supabase/types.ts` — Add `competition_link?: string | null` to both `SellData` (line ~45 area, near `competition`) and `BuyData` (line ~73 area, near `home_search_url`).

2. `src/lib/types.ts` — Add `competitionLink?: string` to `SellDashboardConfig` (near line 213, after `referenceLinks`), `BuyerDashboardConfig` (near line 279, after `homeSearchUrl`), and `BuySellDashboardConfig` (near line 335, after `homeSearchUrl`). Remove the `CompetitionListing` interface (lines 151-161) and remove `competition: CompetitionListing[]` from `SellDashboardConfig` (line 200) and `sellCompetition: CompetitionListing[]` from `BuySellDashboardConfig`. Note: keep the `CompetitionListing` export if other files import it (check `src/lib/supabase/types.ts` imports it — update that import too if removing).

3. `src/lib/schemas/dashboard.ts` — In `SellDashboardConfigSchema`: remove `competition: z.array(CompetitionListingSchema)` (line 119), add `competitionLink: z.string().optional()`. In `BuyerDashboardConfigSchema`: add `competitionLink: z.string().optional()`. In `BuySellDashboardConfigSchema`: remove `sellCompetition: z.array(CompetitionListingSchema)` (line 247), add `competitionLink: z.string().optional()`. Remove the `CompetitionListingSchema` definition (lines 57-67) if no longer used. Keep the `CompetitionListing` import in supabase/types.ts or remove it — adjust accordingly.

**Wizard form changes:**

4. `src/components/wizard/StepClientInfo.tsx` — Add a `competitionLink` state variable initialized from `sellData?.competition_link || dashboard.buy_data?.competition_link || ""`. Show the field for ALL dashboard types (sell, buyer, buysell) — it should appear in a new fieldset or within an existing one, visible when `showSellFields || showBuyFields` (which covers all three types). Use a URL input field:
   ```
   <label>Competition Link</label>
   <input type="url" placeholder="https://... (Lofty search URL)" />
   <p class hint>Paste a Lofty search URL to show active homes in the client's area</p>
   ```
   In `handleNext`: include `competition_link: competitionLink.trim() || null` in both `sell_data` and `buy_data` updates as appropriate (sell/buysell -> sell_data, buyer/buysell -> buy_data). Add `competitionLink` to the useCallback dependency array.

**Generation pipeline changes:**

5. `src/app/api/dashboard/generate/route.ts`:
   - Add `competitionLink?: string` to the clientDetails type (line ~63 area).
   - In `buildSellConfig` (around line 694): replace `competition: Array.isArray(contentData.competition) ? contentData.competition : []` with `competitionLink: clientDetails.competitionLink || undefined`. Remove the `competition` field from the parsed contentData type (line 658).
   - In `buildBuyerConfig` (around line 779): add `competitionLink: clientDetails.competitionLink || undefined` to the return object.
   - In `buildBuySellConfig` (around line 864): replace `sellCompetition: ...` with `competitionLink: clientDetails.competitionLink || undefined`. Remove `sellCompetition` from parsed contentData type (line 832).

6. `src/app/api/dashboard/generate/continue/route.ts` — Same pattern: replace competition array with competitionLink string from clientDetails in the config objects. Find the competition-related lines (522, 557) and update similarly.

7. `src/lib/publish.ts` — Update the config building (lines 83, 154):
   - Line 83: replace `competition: sd?.competition ?? []` with `competitionLink: sd?.competition_link || undefined`
   - Line 154: replace `sellCompetition: sd?.competition ?? []` with `competitionLink: sd?.competition_link || undefined`
   - Also pass through `competitionLink` for buyer configs from `bd?.competition_link`.

**Claude prompt changes:**

8. `src/lib/claude-prompts.ts` — In `sellContentPrompt` (around line 769):
   - Remove the `"competition"` field from the JSON template entirely (lines 769-771).
   - Remove the "Competition:" rule (line 805).
   - Keep "Property highlights" rule but remove "vs. competition" from the end (line 808 -> "4-6 bullet points about what makes THIS home stand out").

   In `buySellContentPrompt` (around line 938):
   - Remove the `"sellCompetition"` field from the JSON template entirely.
   - Remove any competition-related rules.
  </action>
  <verify>
    <automated>cd /Users/joshuahogan/Projects/dashboard-generator && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>All TypeScript types compile cleanly. competitionLink field flows from wizard -> clientDetails -> generation pipeline -> template config. Competition arrays removed from types, schemas, prompts, and pipeline.</done>
</task>

<task type="auto">
  <name>Task 2: Replace competition sections in all three HTML templates with CTA button</name>
  <files>
    src/lib/template-sell.html
    src/lib/template-buyer.html
    src/lib/template-buysell.html
  </files>
  <action>
**Sell template** (`src/lib/template-sell.html`):

Replace the entire competition tracker block (lines 698-723) with a competition link CTA section. The new code should:
- Check `if (CONFIG.competitionLink)` (instead of checking `competition.length`)
- Build a section with header "YOUR LOCAL COMPETITION"
- Include brief context text: `<div style="font-size:12px;color:var(--neutral);line-height:1.6;margin-bottom:16px">See what homes are currently active and competing for buyers in your area.</div>`
- Include a prominent CTA button styled like the buyer template's home search button:
  ```javascript
  competeBody += '<div style="text-align:center"><a href="' + CONFIG.competitionLink + '" target="_blank" rel="noopener" style="display:inline-block;background:var(--terra);color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.3px">View Active Homes in Your Area \u2192</a></div>';
  ```
- Use the section() helper: `t2 += section('competition', 'Your Local Competition', competeBody);`
- If no competitionLink, do NOT render the section at all (hide entirely)
- Also update `sec_competition` in the CONFIG defaults (around line 364) — keep it as `true` since the section toggles on CONFIG.competitionLink presence, not on sec_ flag. Or remove it if the section visibility is purely data-driven.

**Buyer template** (`src/lib/template-buyer.html`):

Add a new competition link section. Find the appropriate location (after the home search URL CTA section or near it). Add:
- Check `if (CONFIG.competitionLink)`
- Same "YOUR LOCAL COMPETITION" section with context text and CTA button
- Use the same styling pattern as the existing `homeSearchUrl` CTA
- Insert using the `section()` helper if available in that template, or inline if the template uses a different pattern

**BuySell template** (`src/lib/template-buysell.html`):

Replace the competition tracker block (lines 731-752) with the same CTA button pattern:
- Check `if (CONFIG.competitionLink)` instead of `CONFIG.sellCompetition`
- Same section header "Your Local Competition" with context text and CTA button
- Remove the `.competition-card`, `.competition-addr`, `.competition-meta`, `.competition-stat`, `.competition-note` CSS classes from the style block (lines 164-168) since they are no longer used
- If no competitionLink, hide the section entirely
- Also remove `sec_sell_competition` from the defaults object (line 433) or keep and adapt

Also remove the competition-related CSS classes from `template-sell.html` if they exist (check for `.status-badge`, `.active`, `.uc`, `.drop` classes that were only used by competition cards).
  </action>
  <verify>
    <automated>cd /Users/joshuahogan/Projects/dashboard-generator && node -e "
const fs = require('fs');
const sell = fs.readFileSync('src/lib/template-sell.html','utf8');
const buy = fs.readFileSync('src/lib/template-buyer.html','utf8');
const bs = fs.readFileSync('src/lib/template-buysell.html','utf8');
const checks = [
  ['sell has competitionLink check', sell.includes('CONFIG.competitionLink')],
  ['sell has CTA button text', sell.includes('View Active Homes in Your Area')],
  ['sell no old competition array', !sell.includes('CONFIG.competition.length')],
  ['buyer has competitionLink check', buy.includes('CONFIG.competitionLink')],
  ['buyer has CTA button text', buy.includes('View Active Homes in Your Area')],
  ['buysell has competitionLink check', bs.includes('CONFIG.competitionLink')],
  ['buysell has CTA button text', bs.includes('View Active Homes in Your Area')],
  ['buysell no old sellCompetition loop', !bs.includes('sellCompetition')],
];
checks.forEach(([name, pass]) => console.log(pass ? 'PASS' : 'FAIL', name));
const fails = checks.filter(c => !c[1]);
if (fails.length) { process.exit(1); }
console.log('All template checks passed');
"</automated>
  </verify>
  <done>All three templates display "Your Local Competition" section with a branded CTA button linking to the Lofty search URL when competitionLink is provided, and hide the section entirely when not provided. AI-generated competition listing cards are completely removed.</done>
</task>

<task type="auto">
  <name>Task 3: Verify full TypeScript compilation and test suite</name>
  <files>
    src/lib/__tests__/config-validation.test.ts
    src/lib/__tests__/publish.test.ts
  </files>
  <action>
Run TypeScript compilation and existing tests. Fix any test failures caused by the removal of the `competition` / `sellCompetition` fields and `CompetitionListing` type:

1. `src/lib/__tests__/config-validation.test.ts` — Update test fixtures that include `competition: [...]` arrays. Replace with `competitionLink: "https://example.com/search"` or omit the field. Same for `sellCompetition`.

2. `src/lib/__tests__/publish.test.ts` — Update test fixtures similarly. Replace `competition: [...]` with the new `competition_link` field in mock SellData/BuyData objects.

3. Any other test files that reference `CompetitionListing` or `competition` arrays — update accordingly.

4. Run full `npm run build` to verify everything compiles for Cloudflare Workers deployment.
  </action>
  <verify>
    <automated>cd /Users/joshuahogan/Projects/dashboard-generator && npx tsc --noEmit && npm test -- --run 2>&1 | tail -20</automated>
  </verify>
  <done>TypeScript compiles cleanly, all tests pass, project is ready for deployment.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm test -- --run` passes all test suites
3. Template validation script confirms CTA buttons present and old competition arrays removed
4. `npm run build` succeeds (Cloudflare Workers compatible)
</verification>

<success_criteria>
- Wizard form shows "Competition Link" URL field for sell, buyer, and buysell dashboard types
- competitionLink flows through the entire pipeline: wizard -> DB -> generation -> template config
- All three templates render "Your Local Competition" CTA button when URL is provided
- All three templates hide the competition section when no URL is provided
- Claude prompts no longer request competition listings
- All TypeScript compiles, all tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/3-replace-competition-tracker-with-lofty-s/3-SUMMARY.md`
</output>
