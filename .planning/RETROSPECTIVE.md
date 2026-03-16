# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Live Dashboard Platform

**Shipped:** 2026-03-15
**Phases:** 5 | **Plans:** 13 | **Timeline:** 6 days (2026-03-10 to 2026-03-15)

### What Was Built
- Supabase Auth with SSR middleware replacing legacy SITE_PASSWORD cookie auth
- 4-table database schema with RLS policies for team CRUD and public SELECT
- Dashboard library with filterable card grid and 6-step wizard with auto-save
- MLS PDF extraction via Claude structured output with editable field review
- CSV comp scoring engine with SSE streaming and toggle-able comp review
- R2 publish pipeline with permanent /d/{slug} URLs and HTML download
- All 3 dashboard types (sell, buyer, buy/sell) with properties of interest
- Draft/published/archived status lifecycle with archive/un-archive

### What Worked
- Coarse phase granularity (5 phases for entire v1.0) kept planning overhead minimal
- TDD approach (failing tests first) caught integration issues early
- Reusing existing generation pipeline (useGenerateDashboard, CompReviewPanel) avoided rewrites
- JSONB columns for nested data simplified schema vs normalized tables
- Browser Supabase client for wizard creation leveraged RLS without extra API routes
- URL search params (?step=N) for wizard navigation was simpler than nested routes
- Phase 5 gap closure was fast because the audit precisely identified what was broken

### What Was Inefficient
- ROADMAP.md phase completion checkboxes got out of sync (Phases 3-5 not marked [x] in live roadmap)
- SUMMARY.md frontmatter for 03-02 had empty requirements_completed — bookkeeping missed during execution
- Phase 2 was very large (5 plans, 24 requirements) — could have been split for clearer tracking
- Nyquist validation was never completed for any phase — all 5 phases have draft VALIDATION.md

### Patterns Established
- `select-then-insert/update` pattern for Supabase RLS compatibility (no ON CONFLICT upsert)
- Three-client Supabase pattern (browser/server/middleware) for SSR auth
- R2 keys match URL path directly (d/{slug}.html)
- Stream R2 body to avoid buffering large templates
- MLS extraction returns 200 with null on failure for graceful client-side fallback

### Key Lessons
1. Gap closure phases are highly effective when preceded by a structured audit — Phase 5 took 7 minutes
2. JSONB columns work well at low scale (20-50 records) and dramatically simplify the schema
3. Bookkeeping (SUMMARY frontmatter, ROADMAP checkboxes) gets missed during fast execution — automate or verify
4. Existing code reuse (hooks, components, templates) should be the default assumption before building new

### Cost Observations
- Model mix: balanced profile throughout
- 13 plans executed with average ~5min per plan
- Total execution time: ~1 hour for full v1.0 build
- Notable: Coarse granularity + yolo mode = very fast iteration

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 6 days | 5 | Initial build — coarse granularity, yolo mode, TDD |

### Cumulative Quality

| Milestone | Tests | Coverage | Tech Debt Items |
|-----------|-------|----------|-----------------|
| v1.0 | 127 | — | 3 minor |

### Top Lessons (Verified Across Milestones)

1. Structured audits before milestone completion catch real issues (Phase 5 gap closure)
2. Reuse existing code before building new — hooks, components, templates
