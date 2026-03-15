# Codebase Concerns

**Analysis Date:** 2026-03-15

## Tech Debt

**Massive code duplication between generate and continue routes:**
- Issue: The two-phase generation pipeline (`route.ts` and `continue/route.ts`) duplicates nearly all builder functions (`buildHouseversaryConfig`, `buildSellConfig`, `buildBuyerConfig`, `buildBuySellConfig`), tax record extraction logic (loan swap heuristics), and helper functions. Changes to business logic must be made in both files or they drift.
- Files: `src/app/api/dashboard/generate/route.ts` (867 lines), `src/app/api/dashboard/generate/continue/route.ts` (718 lines)
- Impact: Bug fixes applied to one route but not the other. The `template.html` vs `template-houseversary.html` diff already shows this: `template-houseversary.html` has division-by-zero guards that `template.html` lacks (lines 252, 556-559).
- Fix approach: Extract shared builder functions into `src/lib/pipeline-builders.ts`. Each route calls the shared builders with its own inputs. The tax record extraction and loan swap logic should live in a shared `src/lib/tax-extraction.ts`.

**`parseJSONFromClaude` duplicated 3 times:**
- Issue: Identical JSON extraction function copy-pasted across three API route files.
- Files: `src/app/api/dashboard/generate/route.ts:20`, `src/app/api/dashboard/generate/continue/route.ts:20`, `src/app/api/dashboard/edit/route.ts:11`
- Impact: Any fix to JSON parsing (e.g., handling arrays, nested code fences) must be applied in 3 places.
- Fix approach: Move to `src/lib/claude-api.ts` as an exported utility. Also exists as `parseJSONResponse` in `src/lib/csv-engine.ts:121` (4th copy).

**`extractDomainLabel` duplicated:**
- Issue: Same URL label extraction function in both route files.
- Files: `src/app/api/dashboard/generate/route.ts:691`, `src/app/api/dashboard/generate/continue/route.ts:66`
- Impact: Minor, but contributes to overall code duplication pattern.
- Fix approach: Move to a shared utility file.

**Stale `template.html` file (788KB):**
- Issue: `src/lib/template.html` (788KB, 1237 lines) appears to be an older version of `src/lib/template-houseversary.html` (788KB, 1237 lines). They differ by only 4 lines — the houseversary version has division-by-zero guards the original lacks.
- Files: `src/lib/template.html`, `src/lib/template-houseversary.html`
- Impact: `template.html` is not referenced by `template-loader.ts` and appears dead. However, its presence is confusing and risks accidental use.
- Fix approach: Delete `src/lib/template.html` after confirming it is not imported anywhere.

**Monolithic page component (822 lines):**
- Issue: `src/app/page.tsx` contains the entire admin UI — form, file upload, progress, results, edit panel, and two inline component definitions (`Input` and `FileDropZone`). This is manageable but trending toward unmaintainable.
- Files: `src/app/page.tsx` (822 lines)
- Impact: Hard to test individual sections. All state lives in one component.
- Fix approach: Extract `Input` and `FileDropZone` to `src/components/`. Extract form sections (buyer fields, sell fields, settings) into dedicated components. Keep `page.tsx` as the orchestrator.

**Monolithic prompt file (1003 lines):**
- Issue: `src/lib/claude-prompts.ts` contains all Claude prompts in a single file. Each prompt is a long template literal function.
- Files: `src/lib/claude-prompts.ts` (1003 lines)
- Impact: Difficult to maintain or test individual prompts. Changes to one prompt risk accidentally breaking another through merge conflicts.
- Fix approach: Split into per-pipeline prompt files: `prompts/csv-analysis.ts`, `prompts/content-generation.ts`, `prompts/mls-extraction.ts`, etc.

## Known Bugs

**Division by zero in `template.html` (stale copy):**
- Symptoms: Dashboard renders `Infinity%` or `NaN` for appreciation when `purchasePrice` is 0 or missing.
- Files: `src/lib/template.html:556-559`
- Trigger: Generate a houseversary dashboard without tax records and no manually entered purchase price.
- Workaround: The active `template-houseversary.html` has guards. Delete the stale `template.html`.

## Security Considerations

**Auth cookie is a static string, not signed:**
- Risk: The auth cookie value is literally `"authenticated"` — anyone who knows this can forge the cookie manually without ever entering the password. There is no HMAC, no session ID, no server-side validation.
- Files: `src/app/api/login/route.ts:16`, `src/middleware.ts:19`
- Current mitigation: Cookie is `httpOnly` and `sameSite: lax`. The app is behind Cloudflare and intended for internal team use only.
- Recommendations: Sign the cookie with a secret (`HMAC(timestamp + userId, SECRET)`), or use a session token stored server-side. At minimum, set `secure: true` on the cookie for production.

**Google Sheet URL hardcoded with public access:**
- Risk: The client data Google Sheet is fetched via a hardcoded public export URL. Anyone who discovers this URL can download all client names, emails, and addresses.
- Files: `src/app/api/clients/route.ts:5`
- Current mitigation: None. The sheet URL is committed to source code.
- Recommendations: Use Google Sheets API with service account credentials instead of public URL. Store the sheet ID in an environment variable.

**No file size or type validation on uploads:**
- Risk: Users can upload arbitrarily large files (PDFs, CSVs, images). These are read into memory as `Buffer.from(await file.arrayBuffer())` and then base64-encoded, potentially doubling memory usage. A 50MB PDF would consume ~100MB of server memory.
- Files: `src/app/api/dashboard/generate/route.ts:109-110` (PDF), `src/app/api/dashboard/generate/route.ts:143` (CSV)
- Current mitigation: Cloudflare Workers has a 100MB request limit.
- Recommendations: Add explicit file size limits (e.g., 10MB for PDFs, 5MB for CSVs, 5MB per image). Validate MIME types server-side.

**No CSRF protection on API routes:**
- Risk: POST endpoints accept FormData and JSON without CSRF tokens. A malicious page could submit forms to the dashboard generator if the user is authenticated.
- Files: `src/app/api/dashboard/generate/route.ts`, `src/app/api/dashboard/edit/route.ts`
- Current mitigation: `sameSite: lax` cookie reduces but does not eliminate CSRF risk for POST requests.
- Recommendations: Add a CSRF token or use `sameSite: strict`.

## Performance Bottlenecks

**Multiple sequential Claude API calls per generation:**
- Problem: A single houseversary dashboard generation makes 3-5 sequential Claude API calls: MLS extraction, CSV analysis, tax records extraction, web research, content generation. Each call can take 10-30 seconds.
- Files: `src/app/api/dashboard/generate/route.ts:98-483`
- Cause: Steps are sequential because later steps depend on earlier results (e.g., content generation needs CSV analysis results). However, MLS extraction, tax records extraction, and Cromford extraction are independent and could run in parallel.
- Improvement path: Use `Promise.all()` for MLS + tax records + Cromford extraction (Step 1 + 2.5 + 3). This could save 20-40 seconds on a typical generation.

**Template HTML files are enormous (788KB each for houseversary):**
- Problem: The houseversary template HTML files are ~788KB each, containing embedded fonts (base64-encoded WOFF2 in `@font-face` declarations) and all CSS/JS inline.
- Files: `src/lib/template-houseversary.html` (788KB), `src/lib/template.html` (788KB)
- Cause: Base64-encoded fonts are embedded directly in the HTML for portability (dashboards must work as standalone files).
- Improvement path: This is a design tradeoff (portability vs size). Consider lazy-loading fonts from a CDN for the preview iframe, and only embedding for download.

**In-memory client cache on serverless:**
- Problem: Client list cache (`cachedClients`) uses module-level variables that reset on every cold start in Cloudflare Workers.
- Files: `src/app/api/clients/route.ts:42-44`
- Cause: Serverless platforms don't guarantee persistent module state between invocations.
- Improvement path: Use Cloudflare KV or cache API for persistent caching across cold starts.

## Fragile Areas

**Claude JSON parsing (hallucination sensitivity):**
- Files: `src/app/api/dashboard/generate/route.ts:20-41`, `src/lib/csv-engine.ts:121-142`
- Why fragile: The entire pipeline depends on Claude returning valid JSON matching specific schemas. The parsing functions attempt to extract JSON from markdown fences and prose, but nested JSON with unescaped characters, truncated responses (hitting maxTokens), or unexpected array-vs-object shapes can cause silent data loss (empty arrays from `Array.isArray` guards) or hard crashes.
- Safe modification: Always add `Array.isArray()` guards when reading arrays from Claude responses (already done in most places). Consider adding Zod schema validation for critical data shapes.
- Test coverage: `src/lib/__tests__/generate-pipeline.test.ts` covers the pipeline but uses mock Claude responses. No test covers malformed/truncated Claude output.

**CSV column detection (ARMLS format dependency):**
- Files: `src/lib/csv-engine.ts:393-405` (KEEP_COLUMNS set)
- Why fragile: The CSV engine hardcodes exact ARMLS column header names ("House Number", "Compass", "Street Name", etc.). Any change to the ARMLS export format (column rename, reorder, or new export version) silently drops all column matching — the `if (keepIndices.length === 0)` fallback truncates to 200 rows and sends the raw CSV to Claude.
- Safe modification: Add logging when column match rate is low. Consider fuzzy matching or a column alias map.
- Test coverage: `src/lib/__tests__/csv-engine.test.ts` (240 lines) covers happy path but not column name variations.

**Tax record loan swap heuristic:**
- Files: `src/app/api/dashboard/generate/route.ts:193-231`, `src/app/api/dashboard/generate/continue/route.ts:246-283`
- Why fragile: The heuristic that detects misclassified original loans (HELOC vs. purchase mortgage) uses thresholds (`< 50% LTV`, `> 6 months from purchase date`) that may not cover all edge cases. A misclassification leads to wildly incorrect equity calculations shown to clients.
- Safe modification: Always run through the comp review panel where the user can verify/override loan data. Never skip the review step.
- Test coverage: `src/lib/__tests__/loan-estimator.test.ts` (146 lines) covers amortization math but not the swap heuristic (which lives in the route files, not the library).

**Template CONFIG injection (string-based HTML manipulation):**
- Files: `src/lib/template-engine.ts:45-89`
- Why fragile: `injectConfig` uses `indexOf`/`lastIndexOf` to find `<!-- CONFIG_START -->` and `<!-- CONFIG_END -->` markers in HTML, then slices and replaces. If a template's markers are malformed, missing, or duplicated, the injection fails silently or corrupts the HTML.
- Safe modification: The existing test suite (`src/lib/__tests__/template-engine.test.ts`) covers happy path and edge cases well. Always verify markers exist before modifying templates.
- Test coverage: Good — 223 lines of tests in `src/lib/__tests__/template-engine.test.ts`.

## Scaling Limits

**Claude API rate limits:**
- Current capacity: Each dashboard generation makes 3-5 API calls. At ~$0.50-2.00 per generation (depending on template type and input sizes).
- Limit: Anthropic rate limits (requests per minute, tokens per minute) become a bottleneck at ~5-10 concurrent generations.
- Scaling path: Implement a generation queue. Cache common web research results. Consider batching the smaller extractions.

**Cloudflare Workers CPU limits:**
- Current capacity: Workers have a 30-second CPU time limit (paid plan). The `maxDuration: 300` setting extends wall-clock time but not CPU time.
- Limit: Large CSV parsing + multiple JSON serializations could approach CPU limits for complex dashboards.
- Scaling path: Move heavy processing (CSV analysis, template injection) to a Cloudflare Durable Object or external service if needed.

## Dependencies at Risk

**No dependency pinning in package.json:**
- Risk: All dependencies use caret ranges (`^14.2.0`, `^18.3.0`, etc.). A breaking minor/patch release of `next`, `react`, or `papaparse` could break the build without warning.
- Impact: Build failures in CI or deployment. Already using `--dangerouslyUseUnsupportedNextVersion` flag in deploy scripts, suggesting version compatibility has been an issue.
- Migration plan: Pin exact versions in `package.json` or rely on the lockfile. The `--dangerouslyUseUnsupportedNextVersion` flag in deploy scripts (`package.json:17-19`) should be investigated — it bypasses OpenNext's Next.js version check, which may cause runtime issues.

## Missing Critical Features

**No database or persistent storage:**
- Problem: Generated dashboards exist only in the browser (as in-memory HTML blobs). There is no server-side storage, no generation history, no ability to retrieve a previously generated dashboard.
- Blocks: Cannot build a client portal, cannot track which dashboards have been delivered, cannot A/B test templates.

**No input sanitization on Claude prompts:**
- Problem: User-provided text fields (client names, addresses, subdivision names) are interpolated directly into Claude prompts without sanitization. While this is not an XSS risk (the prompts go to Claude, not to a browser), it could cause prompt injection — a malicious or unusual input could alter Claude's behavior.
- Files: `src/lib/claude-prompts.ts` (all prompt functions)
- Blocks: Not a blocker, but a correctness concern for unusual inputs.

## Test Coverage Gaps

**No tests for API route handlers:**
- What's not tested: The POST handlers in `src/app/api/dashboard/generate/route.ts`, `src/app/api/dashboard/generate/continue/route.ts`, and `src/app/api/dashboard/edit/route.ts` have zero direct test coverage. They contain critical business logic (tax record processing, loan swap heuristic, template type routing).
- Files: `src/app/api/dashboard/generate/route.ts`, `src/app/api/dashboard/generate/continue/route.ts`, `src/app/api/dashboard/edit/route.ts`
- Risk: Regressions in the generation pipeline go undetected until manual testing.
- Priority: High

**No tests for comp-adjustments module:**
- What's not tested: The `adjustCompPrice` and `deriveValueFromComps` functions in `src/lib/comp-adjustments.ts` — which directly determine the estimated home value shown to clients — have no unit tests.
- Files: `src/lib/comp-adjustments.ts`
- Risk: Incorrect home valuations displayed to clients. The GLA adjustment formula, bathroom adjustment, and pool adjustment are all untested.
- Priority: High

**No integration/E2E tests:**
- What's not tested: The full generation pipeline from form submission through SSE streaming to HTML output. All existing tests are unit-level with mocked Claude responses.
- Files: No E2E test files exist.
- Risk: Integration issues between components (e.g., Phase 1 emitting data that Phase 2 cannot parse) are only caught during manual testing.
- Priority: Medium

**No tests for middleware auth:**
- What's not tested: The authentication middleware (`src/middleware.ts`) — cookie checking, redirect behavior, path exclusions.
- Files: `src/middleware.ts`
- Risk: Auth bypass bugs.
- Priority: Medium

---

*Concerns audit: 2026-03-15*
