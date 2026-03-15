# Domain Pitfalls

**Domain:** Real estate dashboard platform -- adding Supabase + R2 + admin wizard to existing Next.js 14 / Cloudflare Workers app
**Researched:** 2026-03-15

## Critical Pitfalls

Mistakes that cause rewrites, data exposure, or blocked deployments.

### Pitfall 1: Supabase SSR Package + Cloudflare Workers Compatibility

**What goes wrong:** The `@supabase/ssr` package (required for Next.js App Router server-side auth) can throw "dynamic require of stream is not supported" errors on Cloudflare Workers. The underlying issue is that `@supabase/ssr` pulls in Node.js modules (`stream`, `crypto`) that are not natively available in the Workers runtime.

**Why it happens:** OpenNext compiles Next.js for Cloudflare Workers, which uses V8 isolates, not Node.js. The `nodejs_compat_v2` flag (already in wrangler.toml) polyfills many Node APIs but not all. Supabase's SSR cookie handling code paths can trigger imports that fail at runtime even if they compile fine.

**Consequences:** Auth breaks in production while working perfectly in `next dev`. Middleware that refreshes tokens crashes, leaving users unable to authenticate. Because the error only surfaces on Cloudflare (not local dev), it can ship to staging before being caught.

**Prevention:**
- Test every Supabase auth flow on `wrangler dev` (not just `next dev`) before considering it working.
- Pin `@supabase/ssr` to a version verified against Cloudflare Workers. As of early 2026, v0.5.x works with `nodejs_compat_v2`.
- Update `compatibility_date` in wrangler.toml to at least `2025-05-05` (currently set to `2024-09-23`) to get `FinalizationRegistry` and other APIs that newer Supabase versions depend on.
- If `@supabase/ssr` fails, fall back to using `@supabase/supabase-js` directly with manual cookie handling via `createClient` with a custom `auth.storage` adapter.

**Detection:** Runtime errors in Cloudflare Workers logs containing "dynamic require", "stream is not supported", or "process is not defined". Auth working locally but failing on staging deploy.

**Phase:** Auth migration phase -- must be validated before building any protected routes.

---

### Pitfall 2: RLS Enabled but No Policies = Silent Empty Results

**What goes wrong:** You enable Row Level Security on Supabase tables (as you should), but forget to create policies, or create policies that don't match your auth setup. Every query returns zero rows with no error. The dashboard library page shows "No dashboards" even though the database has data.

**Why it happens:** RLS with no matching policy is a deny-by-default. Supabase returns an empty array, not an error. During development you may test with the Supabase SQL editor (which runs as `postgres` superuser and bypasses RLS entirely), see data, and assume everything works. Then the app sees nothing.

**Consequences:** Team members can't see any dashboards. Worse: if you add a `SELECT true` policy to "fix" it, you've made all data publicly readable through the Supabase REST API (including the anon key that's in your client-side code). In January 2025, 170+ apps built with Lovable were found to have exposed databases (CVE-2025-48757) from exactly this pattern.

**Prevention:**
- Write RLS policies as part of the same migration that creates each table. Never create a table without its policies.
- For this project's model (team CRUD, public SELECT on published): create a `service_role` policy for team operations (verified via JWT role claim) and a `SELECT` policy on dashboards filtered by `status = 'published'` for anon access.
- Test RLS by querying through the Supabase client SDK with both authenticated and unauthenticated tokens. Never rely on the SQL editor for RLS testing.
- Add an explicit `auth.uid() IS NOT NULL` check in team policies -- `auth.uid()` returns `null` for unauthenticated requests, which can cause unexpected matches.

**Detection:** Dashboard library showing empty when data exists. Supabase logs showing successful queries with 0 rows returned.

**Phase:** Database schema phase -- policies must be written alongside table creation, not deferred.

---

### Pitfall 3: Next.js 14 Support Dropped by OpenNext Q1 2026

**What goes wrong:** OpenNext is dropping Next.js 14 support in Q1 2026. The project already uses `--dangerouslyUseUnsupportedNextVersion` in deploy scripts, which bypasses version checks. A future OpenNext update could break the build entirely, or introduce subtle runtime bugs that the bypass flag masks.

**Why it happens:** OpenNext tracks Next.js mainline (currently 16). Next.js 14 has been EOL since late 2025. The `--dangerouslyUseUnsupportedNextVersion` flag suppresses the warning but doesn't guarantee compatibility.

**Consequences:** A routine `npm update` of `@opennextjs/cloudflare` breaks the entire deploy pipeline. Or worse: deploys succeed but runtime behavior is wrong (middleware not executing, server components rendering incorrectly).

**Prevention:**
- Pin `@opennextjs/cloudflare` to the last version that officially supports Next.js 14 (likely 1.x).
- Plan a Next.js 15 upgrade as a separate milestone before or during the platform build. Next.js 15 is the minimum supported version going forward.
- If staying on Next.js 14, freeze the OpenNext version and accept you won't get Cloudflare platform updates.

**Detection:** Build warnings about unsupported versions. Deploy script already using `--dangerouslyUseUnsupportedNextVersion` (this IS the warning sign -- it's already happening).

**Phase:** Foundation phase -- decide on Next.js version strategy before building new features on a potentially unstable base.

---

### Pitfall 4: R2 Public Bucket Exposes All Dashboard Files

**What goes wrong:** You enable R2 public access for serving dashboards at `/d/{slug}`, but this makes the entire bucket contents listable/accessible. Draft dashboards, archived dashboards, and any uploaded client files (PDFs, CSVs with PII) stored in the same bucket become publicly accessible.

**Why it happens:** R2 public access is bucket-wide, not prefix-scoped. If you store published HTML, draft HTML, and uploaded source files in the same bucket, enabling public access exposes everything.

**Consequences:** Client personal information (names, addresses, financial data from tax records) exposed via direct R2 URLs. Draft dashboards with incomplete or incorrect data visible to anyone who guesses the URL pattern.

**Prevention:**
- Use two separate R2 buckets: one public bucket for published dashboard HTML only, one private bucket for uploads and drafts.
- Alternatively, use a single private bucket and serve published dashboards through a Cloudflare Worker that checks the slug against the database `status = 'published'` before proxying the R2 object. This adds a tiny latency but gives full access control.
- Never store source files (PDFs, CSVs) in the public bucket.
- Use unpredictable slugs (not sequential IDs) even for published dashboards.

**Detection:** Try accessing `https://your-r2-domain/` directly -- if you see a file listing or can guess paths to non-published files, you have a problem.

**Phase:** Publish pipeline phase -- bucket architecture must be decided before any R2 integration code is written.

---

### Pitfall 5: Supabase Auth Cookie vs. Existing Cookie Auth Collision

**What goes wrong:** The current middleware checks for a `dashboard-auth` cookie with value `"authenticated"`. When Supabase Auth is introduced, it sets its own cookies (`sb-<ref>-auth-token`). If the migration is partial -- some routes check the old cookie, others check Supabase -- users get randomly logged out or see auth errors depending on which route they hit.

**Why it happens:** Incremental migration where both auth systems coexist. The middleware is the single chokepoint, but route handlers may independently check auth state. Supabase's token refresh (which happens in middleware via `getUser()`) can clear or conflict with the legacy cookie.

**Consequences:** Team members get logged out mid-wizard. Generated dashboards fail to save because the API route checks Supabase auth but the user only has the old cookie. The bug is intermittent because it depends on token expiry timing.

**Prevention:**
- Do a clean cutover, not a gradual migration. In a single phase:
  1. Add Supabase Auth client setup
  2. Replace middleware cookie check with `supabase.auth.getUser()`
  3. Remove the old `/api/login` route and `dashboard-auth` cookie
  4. Add a Supabase login page
- The team is 3 people. A clean cutover is simpler than maintaining two auth systems even briefly.
- Use `supabase.auth.getUser()` (not `getSession()`) in middleware -- `getSession()` reads from cookies without server-side validation and can be spoofed.

**Detection:** Auth errors that only happen after ~1 hour (when Supabase tokens expire and try to refresh). Users reporting "sometimes logged out" behavior.

**Phase:** Auth migration phase -- must be atomic, not incremental.

---

## Moderate Pitfalls

### Pitfall 6: Cloudflare Workers I/O Object Reuse Across Requests

**What goes wrong:** Database clients (including Supabase client instances) created in one request handler cannot be reused in a different request's handler on Cloudflare Workers. Module-level Supabase client singletons fail silently or throw cryptic errors.

**Why it happens:** Cloudflare Workers use V8 isolates where I/O objects (sockets, fetch controllers) are scoped to a single request. A Supabase client created at module scope during one request becomes invalid for the next request.

**Prevention:**
- Create a new Supabase client instance per request. Use a utility function like `createServerClient()` called inside each route handler or server component, never at module level.
- This aligns with Supabase's recommended SSR pattern where the client is created fresh with each request's cookies.

**Detection:** Intermittent "fetch failed" or "connection reset" errors that only appear under load or after the Worker has been warm for a while. Works fine on first request after cold start.

**Phase:** Database integration phase -- establish the client creation pattern in the first route, enforce it everywhere.

---

### Pitfall 7: 788KB Template HTML Exceeds Supabase Row/Column Limits

**What goes wrong:** The rendered dashboard HTML (~788KB per template with embedded fonts) is stored in a Supabase `text` column or passed through the Supabase REST API. PostgREST has a default response size limit, and inserting very large text values can hit Supabase's 8MB request body limit or cause timeouts.

**Why it happens:** The templates embed base64-encoded fonts inline, making each rendered HTML file ~788KB. Storing this in a database column is technically possible but wasteful and slow.

**Prevention:**
- Do NOT store rendered HTML in Supabase. Store only the structured data (config JSON, metadata, status) in Supabase. Rendered HTML goes directly to R2.
- The render pipeline should be: read config from Supabase -> inject into template -> upload HTML to R2. Supabase never touches the full HTML.
- Store the R2 object key in Supabase for lookup.

**Detection:** Slow dashboard save operations (>5 seconds). PostgREST timeout errors on insert/update.

**Phase:** Publish pipeline phase -- data model must separate config (Supabase) from rendered output (R2).

---

### Pitfall 8: Wizard State Lost on Browser Refresh

**What goes wrong:** A 6-step wizard with client info, property details, market data, and comp review holds significant state. If the user refreshes the browser mid-wizard (or their Cloudflare Workers request times out during a long Claude API call), all progress is lost.

**Why it happens:** Client-side state (React state, Zustand store) does not survive page refresh. The existing app already has this problem (monolithic page.tsx with all state in one component), and a multi-step wizard makes it worse because there's more data to lose.

**Consequences:** Team member spends 10 minutes entering data, reviewing comps, and tweaking values. Browser refresh or accidental navigation = start over. This is the #1 UX frustration for admin tools.

**Prevention:**
- Save wizard state to Supabase as a draft after each step completion (not just at final publish). Each step's "Next" button should persist the current step's data.
- Use Zustand with a persistence middleware that writes to `sessionStorage` as a fast fallback, but treat Supabase as the source of truth.
- Show a "Resume draft" option on the dashboard library page for incomplete wizards.
- Debounce auto-save for text fields to avoid excessive writes.

**Detection:** User complaints about lost work. High rate of abandoned draft dashboards (started but never published).

**Phase:** Wizard UI phase -- draft persistence must be designed into the wizard from step 1, not bolted on later.

---

### Pitfall 9: R2 Custom Domain Routing Does Not Serve index.html Automatically

**What goes wrong:** You set up R2 with a custom domain to serve dashboards at `dashboards.liveazco.com/d/{slug}`, but R2 has no built-in routing logic. A request to `/d/smith-family` does not automatically resolve to the `d/smith-family/index.html` object or a `d/smith-family.html` object.

**Why it happens:** R2 is object storage, not a web server. Unlike Cloudflare Pages or S3 static website hosting, R2 does not have "index document" routing.

**Prevention:**
- Option A: Store files with the exact path as the object key (e.g., `d/smith-family` as the key, with `Content-Type: text/html`). Requests to that path serve the file directly.
- Option B (recommended for this project): Use a Cloudflare Worker as the R2 frontend. The Worker receives requests to `/d/{slug}`, fetches the corresponding object from R2, and returns it with proper headers. This also lets you check publish status and add cache headers.
- Do NOT rely on R2 public bucket + custom domain alone for the URL routing pattern described in PROJECT.md.

**Detection:** 404 errors when accessing dashboard URLs. URLs working with `.html` extension but not without.

**Phase:** Publish pipeline phase -- the R2 serving architecture must be designed before implementing the publish flow.

---

### Pitfall 10: Supabase Auth Token Refresh Race in Middleware

**What goes wrong:** Supabase Auth tokens expire after 1 hour by default. The middleware must call `supabase.auth.getUser()` to refresh the token and set updated cookies on both the request (for server components) and response (for the browser). If this is implemented incorrectly, the refresh token gets consumed but the new access token isn't propagated, leading to auth failure on the next request.

**Why it happens:** The Next.js middleware must coordinate cookies across the incoming request, the supabase client, and the outgoing response. The official Supabase SSR docs have had documented bugs where `response.cookies.setAll()` didn't exist on the `ResponseCookies` type, leading developers to skip the response cookie step.

**Prevention:**
- Follow the exact middleware pattern from Supabase's current Next.js SSR guide (as of early 2026). The key steps are:
  1. Create supabase client in middleware with cookie get/set/remove handlers
  2. Call `getUser()` (this refreshes the token)
  3. Copy all supabase cookies to both `request.cookies` and `response.cookies`
  4. Return the response with updated cookies
- Test by setting a short token expiry (e.g., 5 minutes) during development to trigger refresh flows frequently.
- Never use `getSession()` in middleware -- it reads cookies without validating them server-side.

**Detection:** Users getting logged out exactly ~1 hour after login. Auth working in development (where you refresh the page and re-login frequently) but failing in production.

**Phase:** Auth migration phase -- the middleware pattern must be correct from day one.

---

## Minor Pitfalls

### Pitfall 11: Cloudflare Workers 128MB Memory Limit with Large Templates

**What goes wrong:** Rendering a dashboard involves loading the 788KB template, parsing the config JSON, performing string replacement, and holding the result in memory. If multiple dashboard renders happen concurrently (e.g., team member publishes while another generates), memory usage can spike near the 128MB V8 isolate limit.

**Prevention:** Process one dashboard render at a time per request. Do not attempt parallel renders. For the project's scale (20-50 dashboards, 3 users), this is not a real bottleneck -- but do not optimize by parallelizing renders.

**Detection:** "Exceeded memory limit" errors in Cloudflare Workers logs.

**Phase:** Publish pipeline phase.

---

### Pitfall 12: Slug Collision on R2 Overwrites Published Dashboard

**What goes wrong:** Two dashboards get the same slug, and publishing the second one overwrites the first on R2. The first client's permanent URL now shows the wrong dashboard.

**Prevention:** Enforce slug uniqueness at the database level (unique constraint on `slug` column). Generate slugs deterministically from client name + address, and add a numeric suffix on collision. Lock the slug after first publish (as noted in PROJECT.md requirements).

**Detection:** Client reports seeing someone else's information on their dashboard URL.

**Phase:** Database schema phase -- unique constraint must be in the initial migration.

---

### Pitfall 13: Missing CORS on R2 for Preview Iframe

**What goes wrong:** The admin wizard includes a preview iframe that loads the rendered dashboard HTML from R2. If the R2 bucket or serving Worker doesn't set CORS headers, the iframe loads but JavaScript interactions (if any) and certain CSS resources may be blocked.

**Prevention:** If serving via a Worker (recommended), add `Access-Control-Allow-Origin` headers for the admin app's domain. If using R2 public bucket directly, configure CORS via `wrangler r2 bucket cors set`.

**Detection:** Preview iframe shows broken styling or blank content in the admin wizard.

**Phase:** Publish pipeline phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Foundation / Infra | Next.js 14 EOL + OpenNext dropping support (#3) | Pin OpenNext version or plan Next.js 15 upgrade |
| Database Schema | RLS silent failures (#2), slug collision (#12) | Write policies with migrations, unique constraints from day 1 |
| Auth Migration | Cookie collision (#5), token refresh race (#10), Workers compat (#1) | Atomic cutover, test on wrangler dev, follow exact SSR middleware pattern |
| Admin Wizard | State lost on refresh (#8) | Draft persistence to Supabase after each step |
| Publish Pipeline | R2 public bucket exposure (#4), R2 routing (#9), template in DB (#7) | Separate buckets, Worker-fronted R2, config in DB / HTML in R2 |
| Cloudflare Runtime | I/O reuse (#6), memory limits (#11) | Per-request client creation, no parallel renders |

## Sources

- [Supabase SSR + Cloudflare Workers issue #37592](https://github.com/supabase/supabase/issues/37592) -- `@supabase/ssr` dynamic require errors
- [Supabase + Cloudflare Workers integration docs](https://supabase.com/partners/integrations/cloudflare-workers) -- official compatibility guidance
- [OpenNext Cloudflare known issues](https://opennext.js.org/cloudflare/known-issues) -- FinalizationRegistry, version support timeline
- [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) -- policy patterns and testing
- [CVE-2025-48757 / Supabase RLS exposure](https://dev.to/fabio_a26a4e58d4163919a53/supabase-security-the-hidden-dangers-of-rls-and-how-to-audit-your-api-29e9) -- 170+ apps with exposed databases
- [Supabase Next.js SSR auth setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- middleware token refresh pattern
- [R2 public buckets documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/) -- custom domain setup and limitations
- [R2 static hosting limitations](https://community.cloudflare.com/t/hosting-static-websites-on-r2/633020) -- no index.html routing
- [Supabase Auth troubleshooting for Next.js](https://supabase.com/docs/guides/troubleshooting/how-do-you-troubleshoot-nextjs---supabase-auth-issues-riMCZV) -- getUser vs getSession
- [OpenNext Cloudflare deployment guide](https://opennext.js.org/cloudflare) -- version support and compatibility flags

---

*Pitfalls audit: 2026-03-15*
