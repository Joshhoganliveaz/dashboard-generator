---
phase: 3
slug: publish-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
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
| 03-01-01 | 01 | 1 | PUBL-01 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PUBL-02 | integration | `npx vitest run src/__tests__/publish-route.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | PUBL-03 | unit | `npx vitest run src/lib/__tests__/r2.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | PUBL-04 | unit | `npx vitest run src/__tests__/download.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | PUBL-05 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 1 | PUBL-06 | manual | Manual UI verification | N/A | ⬜ pending |
| 03-02-01 | 02 | 1 | STAT-02 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | STAT-03 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | STAT-04 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/publish.test.ts` — stubs for PUBL-01, PUBL-05, STAT-02, STAT-03, STAT-04
- [ ] `src/lib/__tests__/r2.test.ts` — stubs for PUBL-03 (R2 mock verifying put/get/delete)
- [ ] `src/__tests__/publish-route.test.ts` — stubs for PUBL-02 (mock route handler)
- [ ] `src/__tests__/download.test.ts` — stubs for PUBL-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shareable URL displayed after publish with copy button | PUBL-06 | UI interaction with clipboard API | 1. Publish a dashboard 2. Verify URL is shown 3. Click copy button 4. Paste to verify URL copied |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
