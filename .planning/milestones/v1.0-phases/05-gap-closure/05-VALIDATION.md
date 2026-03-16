---
phase: 5
slug: gap-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | WIZD-10 | unit | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "upsertSellData"` | ✅ Partial | ⬜ pending |
| 05-01-02 | 01 | 1 | WIZD-11 | unit | Same as WIZD-10 (same code path) | ✅ Partial | ⬜ pending |
| 05-01-03 | 01 | 1 | PERS-06 | manual-only | N/A (RLS policy already exists) | N/A | ⬜ pending |
| 05-01-04 | 01 | 1 | WIZD-16 | manual-only | N/A (navigation in browser) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Public dashboards render with complete market data | PERS-06 | RLS policy verification requires live Supabase | 1. Publish a sell dashboard 2. Open published URL in incognito 3. Verify market data sections render |
| Buyer Back button navigates to step 2 | WIZD-16 | Next.js client navigation cannot be tested in Vitest node env | 1. Open buyer wizard 2. Navigate to step 4 3. Click Back 4. Verify lands on step 2 without redirect loop |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
