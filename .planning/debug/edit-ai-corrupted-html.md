---
status: awaiting_human_verify
trigger: "Could not read dashboard data. The HTML may be corrupted error in Edit with AI panel"
created: 2026-03-17T00:00:00Z
updated: 2026-03-17T00:00:00Z
---

## Current Focus

hypothesis: extractConfig uses new Function() which is blocked on Cloudflare Workers (no unsafe-eval flag). The fix is to make CONFIG output JSON-compatible and use JSON.parse instead.
test: Change serializeValue to quote object keys and extractConfig to use JSON.parse
expecting: Edit API will work on both local dev and Cloudflare Workers
next_action: Apply fix to template-engine.ts

## Symptoms

expected: User types edit instruction, Claude modifies CONFIG JSON, dashboard preview updates
actual: Error "Could not read dashboard data. The HTML may be corrupted" appears immediately
errors: "Could not read dashboard data. The HTML may be corrupted"
reproduction: Open any sell dashboard wizard at step 5 (preview), type any instruction in Edit with AI panel, submit
started: After recent template changes (commits ae7d047, 85b2e96, 84954f5, 2d1ea67)

## Eliminated

- hypothesis: CONFIG extraction regex doesn't match current template format
  evidence: Tested regex against template-sell.html and simulated injectConfig output -- matches correctly in all cases
  timestamp: 2026-03-17

- hypothesis: CONFIG data with special characters breaks regex
  evidence: Tested with realistic config containing &, $, semicolons in strings -- round-trip works fine
  timestamp: 2026-03-17

## Evidence

- timestamp: 2026-03-17
  checked: extractConfig regex against template and injectConfig output
  found: Regex matches correctly -- not the issue
  implication: Problem is not in regex pattern

- timestamp: 2026-03-17
  checked: wrangler.toml compatibility_flags
  found: Only nodejs_compat_v2 set, no unsafe-eval flag
  implication: new Function() in extractConfig will throw EvalError on Cloudflare Workers

- timestamp: 2026-03-17
  checked: Cloudflare Workers docs on eval/new Function
  found: new Function() requires unsafe-eval or allow_eval_during_startup flag, not enabled by nodejs_compat_v2
  implication: extractConfig always fails on deployed Workers environment

- timestamp: 2026-03-17
  checked: serializeValue output format
  found: Produces JS object literals with bare keys (unquoted), which is valid JS but not valid JSON
  implication: Can fix by quoting keys to make output JSON-compatible, then use JSON.parse instead of new Function()

## Resolution

root_cause: extractConfig() used new Function() to evaluate the CONFIG JS object literal, which is blocked on Cloudflare Workers (requires unsafe-eval flag not present in wrangler.toml). Additionally, serializeValue() escaped backticks as \` which is invalid in JSON strings.
fix: (1) Changed serializeValue to quote object keys, making output valid JSON. (2) Replaced new Function() with JSON.parse() in extractConfig. (3) Removed backtick escaping (invalid in JSON). (4) Updated scanHtmlForRenderBugs patterns to handle both quoted and unquoted key formats.
verification: All 19 template-engine + generate-pipeline tests pass. Manual round-trip test confirms injectConfig -> extractConfig works with JSON.parse.
files_changed:
  - src/lib/template-engine.ts
  - src/lib/__tests__/template-engine.test.ts
