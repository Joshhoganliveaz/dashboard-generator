---
phase: 2
slug: admin-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SLUG-01 | unit | `npx vitest run src/lib/__tests__/slug.test.ts -t "generates slug"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SLUG-02 | unit | `npx vitest run src/lib/__tests__/slug.test.ts -t "valid characters"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | SLUG-03 | unit | `npx vitest run src/lib/__tests__/slug.test.ts -t "collision"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | LIBR-01 | unit | `npx vitest run src/__tests__/library.test.ts -t "renders cards"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | LIBR-03 | unit | `npx vitest run src/__tests__/library.test.ts -t "type filter"` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | LIBR-04 | unit | `npx vitest run src/__tests__/library.test.ts -t "status filter"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | WIZD-01 | unit | `npx vitest run src/__tests__/wizard.test.ts -t "creates draft"` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | WIZD-17 | unit | `npx vitest run src/__tests__/wizard.test.ts -t "auto-save"` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | WIZD-16 | manual | N/A - browser interaction | N/A | ⬜ pending |
| 02-03-04 | 03 | 2 | STAT-01 | unit | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "draft status"` | ✅ partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/slug.test.ts` — stubs for SLUG-01, SLUG-02, SLUG-03
- [ ] `src/__tests__/library.test.ts` — stubs for LIBR-01, LIBR-03, LIBR-04 (filter logic tests)
- [ ] `src/__tests__/wizard.test.ts` — stubs for WIZD-01, WIZD-17 (auto-save logic tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Back navigation preserves data | WIZD-16 | Requires browser interaction and multi-step state | 1. Start wizard, fill step 2. 2. Advance to step 3. 3. Click back to step 2. 4. Verify all step 2 data is intact. |
| MLS PDF upload + extraction | WIZD-05, WIZD-06 | Requires file upload and Claude API call | 1. Upload sample MLS PDF. 2. Verify extracted fields appear. 3. Edit one field, verify it saves. |
| CSV comp review toggle | WIZD-08, WIZD-09 | Requires file upload and comp panel interaction | 1. Upload ARMLS CSV. 2. Verify ranked comps appear. 3. Toggle a comp off, verify it's excluded. |
| SSE streaming progress | WIZD-15 | Requires active Claude API call | 1. Trigger generation. 2. Verify progress updates stream in real-time. |
| Preview iframe + edit | WIZD-12, WIZD-13 | Requires rendered HTML and Claude edit pipeline | 1. Complete generation. 2. Verify preview shows in iframe. 3. Type NL edit instruction, verify dashboard updates. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
