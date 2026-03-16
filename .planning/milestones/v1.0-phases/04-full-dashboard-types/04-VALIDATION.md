---
phase: 4
slug: full-dashboard-types
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest) |
| **Config file** | vitest.config.ts |
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
| 04-01-01 | 01 | 1 | TYPE-01 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "sell"` | Partial | ⬜ pending |
| 04-01-02 | 01 | 1 | TYPE-04 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "listingStatus"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | TYPE-02 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "buyer"` | Partial | ⬜ pending |
| 04-01-04 | 01 | 1 | TYPE-03 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "buysell"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | PROP-01 | unit | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "properties"` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | PROP-02 | unit | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "properties"` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | PROP-03 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "properties"` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 1 | PROP-04 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "photo"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/publish.test.ts` — add tests for listing status mapping, buysell config building, POI injection
- [ ] `src/lib/__tests__/supabase-db.test.ts` — add tests for properties of interest CRUD

*Existing infrastructure covers framework and config; only test stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab visual rendering | TYPE-01, TYPE-02, TYPE-03 | HTML templates render in browser, not testable via unit | Open published dashboard URL, verify correct tabs appear with content |
| Listing status badge styling | TYPE-04 | Visual CSS badge appearance | Publish sell dashboard with listing_status set, verify badge renders |
| Photo URL renders in template | PROP-04 | Image loading in browser context | Add POI with photo_url, publish, verify image renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
