---
phase: 01-foundation
plan: 01
subsystem: auth
tags: [supabase, ssr, jwt, middleware, next.js, cloudflare-workers]

# Dependency graph
requires: []
provides:
  - "Supabase browser client (createBrowserClient wrapper)"
  - "Supabase server client (createServerClient with cookie store)"
  - "Supabase middleware client (cookie propagation for Workers)"
  - "Auth middleware redirecting unauthenticated users to /login"
  - "Email/password login page using signInWithPassword"
affects: [02-foundation, 03-foundation, admin-ui, publish-pipeline]

# Tech tracking
tech-stack:
  added: ["@supabase/supabase-js ^2.49", "@supabase/ssr ^0.6"]
  patterns: ["Supabase SSR three-client pattern (browser/server/middleware)", "getClaims() over getSession() for JWT validation", "Cookie propagation to both request and response for Cloudflare Workers"]

key-files:
  created:
    - "src/lib/supabase/client.ts"
    - "src/lib/supabase/server.ts"
    - "src/lib/supabase/middleware.ts"
    - "src/__tests__/middleware.test.ts"
    - "src/__tests__/legacy-auth-removed.test.ts"
    - "src/lib/__tests__/supabase-auth.test.ts"
  modified:
    - "src/middleware.ts"
    - "src/app/login/page.tsx"
    - ".env.local.example"
    - "package.json"

key-decisions:
  - "Used @supabase/ssr three-client pattern per research recommendation"
  - "getClaims() for JWT validation instead of getSession() (security: revalidates JWT)"
  - "Middleware helper returns {supabase, response} tuple for clean caller API"
  - "Account provisioning via Supabase dashboard (no sign-up flow in app)"

patterns-established:
  - "Supabase client import convention: import { createClient } from @/lib/supabase/{context}"
  - "Public route allowlist in middleware: /login, /_next, /favicon, /d/*, *.html"
  - "TDD workflow: RED (failing tests) -> GREEN (implementation) -> commit both"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 1 Plan 1: Supabase Auth Migration Summary

**Supabase email/password auth replacing legacy SITE_PASSWORD cookie auth, with SSR middleware using getClaims() JWT validation and three-client pattern for browser/server/middleware contexts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T17:52:33Z
- **Completed:** 2026-03-15T17:56:35Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Installed @supabase/supabase-js and @supabase/ssr with three client utilities (browser, server, middleware)
- Replaced middleware to use Supabase getClaims() for auth with public route allowlist including /d/* for published dashboards
- Rewrote login page with email + password fields using signInWithPassword
- Deleted legacy /api/login route and removed all SITE_PASSWORD and dashboard-auth references
- All 12 new auth tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Supabase deps and create client utilities** - `0a7f542` (feat)
2. **Task 2 RED: Add failing auth tests** - `b6d9035` (test)
3. **Task 2 GREEN: Replace middleware, login page, delete legacy auth** - `e0c401e` (feat)

## Files Created/Modified
- `src/lib/supabase/client.ts` - Browser Supabase client using createBrowserClient
- `src/lib/supabase/server.ts` - Server Supabase client using createServerClient with cookie store
- `src/lib/supabase/middleware.ts` - Middleware client with cookie propagation for request + response
- `src/middleware.ts` - Auth middleware using getClaims() with public route allowlist
- `src/app/login/page.tsx` - Email + password login form using signInWithPassword
- `src/app/api/login/route.ts` - DELETED (legacy SITE_PASSWORD auth)
- `.env.local.example` - Updated: added Supabase vars, removed SITE_PASSWORD
- `package.json` - Added @supabase/supabase-js and @supabase/ssr
- `src/__tests__/middleware.test.ts` - Middleware auth redirect tests
- `src/__tests__/legacy-auth-removed.test.ts` - Legacy auth removal verification tests
- `src/lib/__tests__/supabase-auth.test.ts` - Supabase client and signInWithPassword tests

## Decisions Made
- Used @supabase/ssr three-client pattern as recommended by research (not deprecated auth-helpers)
- getClaims() for all JWT validation (getSession() does not revalidate JWT signature)
- Middleware helper returns `{supabase, response}` tuple rather than inlining Supabase client creation in middleware.ts -- cleaner separation of concerns
- No sign-up flow in app; Josh provisions accounts via Supabase dashboard (AUTH-04)
- Used --legacy-peer-deps for npm install due to peer dep conflict with @opennextjs/cloudflare

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm peer dependency conflict with @opennextjs/cloudflare**
- **Found during:** Task 1
- **Issue:** npm install failed due to peer dependency conflict between @supabase packages and @opennextjs/cloudflare
- **Fix:** Used `--legacy-peer-deps` flag to resolve
- **Files modified:** package.json, package-lock.json
- **Verification:** Packages installed successfully, TypeScript compiles
- **Committed in:** 0a7f542

**2. [Rule 3 - Blocking] Stale .next/types reference to deleted api/login route**
- **Found during:** Task 2
- **Issue:** TypeScript found import error in `.next/types/app/api/login/route.ts` after deleting the source file
- **Fix:** Removed stale `.next/types/app/api/login/` directory (build cache artifact)
- **Files modified:** .next/types/ (build cache, not committed)
- **Verification:** tsc --noEmit passes for all new/modified source files

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes were necessary for build/install to succeed. No scope creep.

## Issues Encountered
- Pre-existing test failures in `claude-api.test.ts` (invalid API key, missing exports) and `config-validation.test.ts` (missing module) -- these are out of scope for this plan and pre-date our changes.

## User Setup Required

Before the auth system works, Josh needs to:
1. Create a Supabase project at https://supabase.com
2. Copy the project URL and anon/publishable key to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...`
3. Create team member accounts in Supabase Dashboard > Authentication > Users

## Next Phase Readiness
- Auth foundation complete -- all three client utilities ready for database operations (Phase 1 Plan 2)
- Middleware pattern established for Cloudflare Workers cookie propagation
- Public route `/d/*` allowlisted for published dashboard access (Phase 3)
- Pre-existing test failures in claude-api and config-validation tests need to be addressed in engine hardening plans

## Self-Check: PASSED

All 10 created/modified files verified present. Legacy route.ts confirmed deleted. All 3 commit hashes verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-15*
