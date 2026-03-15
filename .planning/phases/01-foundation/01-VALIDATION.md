---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | integration | `npx vitest run src/lib/__tests__/supabase-auth.test.ts -t "sign in"` | No -- Wave 0 | pending |
| 1-01-02 | 01 | 1 | AUTH-03 | unit | `npx vitest run src/__tests__/middleware.test.ts` | No -- Wave 0 | pending |
| 1-01-03 | 01 | 1 | AUTH-05 | unit | `npx vitest run src/__tests__/legacy-auth-removed.test.ts` | No -- Wave 0 | pending |
| 1-02-01 | 02 | 1 | PERS-01 | integration | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "dashboard"` | No -- Wave 0 | pending |
| 1-02-02 | 02 | 1 | PERS-05 | manual-only | Test in Supabase SQL editor with different roles | N/A | pending |
| 1-02-03 | 02 | 1 | PERS-06 | manual-only | Test in Supabase SQL editor with anon role | N/A | pending |
| 1-03-01 | 03 | 2 | ENGN-01 | unit | `npx vitest run src/lib/__tests__/claude-api.test.ts -t "max_tokens"` | No -- Wave 0 | pending |
| 1-03-02 | 03 | 2 | ENGN-02 | unit | `npx vitest run src/lib/__tests__/claude-api.test.ts -t "structured"` | No -- Wave 0 | pending |
| 1-03-03 | 03 | 2 | ENGN-03 | unit | `npx vitest run src/lib/__tests__/claude-api.test.ts -t "retry"` | No -- Wave 0 | pending |
| 1-03-04 | 03 | 2 | ENGN-04 | unit | `npx vitest run src/lib/__tests__/csv-engine.test.ts -t "papaparse"` | Partial | pending |
| 1-03-05 | 03 | 2 | ENGN-05 | unit | `npx vitest run src/lib/__tests__/csv-engine.test.ts -t "score"` | Partial | pending |
| 1-03-06 | 03 | 2 | ENGN-07 | unit | `npx vitest run src/lib/__tests__/config-validation.test.ts` | No -- Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/supabase-auth.test.ts` — stubs for AUTH-01, AUTH-02, AUTH-03
- [ ] `src/__tests__/middleware.test.ts` — covers AUTH-03, AUTH-05
- [ ] `src/lib/__tests__/supabase-db.test.ts` — covers PERS-01 through PERS-04, PERS-07
- [ ] `src/lib/__tests__/claude-api.test.ts` — update/create for ENGN-01, ENGN-02, ENGN-03
- [ ] `src/lib/__tests__/config-validation.test.ts` — covers ENGN-07
- [ ] Existing `csv-engine.test.ts` needs new test cases for Papaparse migration (ENGN-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS allows authenticated CRUD | PERS-05 | Requires Supabase SQL editor with role switching | Test CRUD as authenticated role in SQL editor |
| RLS allows anon SELECT published | PERS-06 | Requires Supabase SQL editor with anon role | SELECT from tables as anon; verify only published rows returned |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
