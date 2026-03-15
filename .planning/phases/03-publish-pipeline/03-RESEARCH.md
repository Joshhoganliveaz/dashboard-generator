# Phase 3: Publish Pipeline - Research

**Researched:** 2026-03-15
**Domain:** Cloudflare R2 publishing, Next.js route handlers, dashboard lifecycle management
**Confidence:** HIGH

## Summary

Phase 3 builds the publish pipeline that takes dashboard data from Supabase, renders it into static HTML using the existing template engine (`injectConfig`), uploads the HTML to Cloudflare R2, and serves it at `/d/{slug}`. The architecture is straightforward because all the building blocks already exist in the codebase: template loading (`getTemplateHtml`), CONFIG injection (`injectConfig`), Supabase data access (`getDashboard`), slug management, and the middleware already whitelists `/d/` as a public route.

The core new pieces are: (1) an R2 bucket binding in wrangler.toml, (2) a publish API route that renders HTML and uploads to R2, (3) a `/d/[slug]` route handler that fetches HTML from R2 and streams it back, (4) archive/un-archive status management that deletes/re-uploads R2 objects, and (5) an HTML download endpoint. Cloudflare R2 is accessed via Workers bindings using `getCloudflareContext()` from `@opennextjs/cloudflare`, which is already a project dependency.

**Primary recommendation:** Use a single R2 bucket (`dashboards`) with keys like `d/{slug}.html`. Publish API renders server-side using existing `getTemplateHtml` + `injectConfig`, uploads via `env.DASHBOARDS.put()`, and updates Supabase status. The `/d/[slug]` route fetches from R2 and returns the HTML with correct content-type.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUBL-01 | One-click publish renders HTML from DB config and uploads to Cloudflare R2 | Publish API route: load dashboard from Supabase, build CONFIG from DB data, call `injectConfig(getTemplateHtml(type), config)`, upload to R2 via binding |
| PUBL-02 | Published dashboard is accessible at /d/{slug} as static HTML | Dynamic route `/d/[slug]/route.ts` fetches from R2 bucket, returns Response with content-type text/html |
| PUBL-03 | Re-publishing overwrites the same R2 path -- URL never changes | R2 `put()` with same key overwrites. Slug is locked after first publish (SLUG-05 already implemented) |
| PUBL-04 | Team member can download rendered HTML file for Lofty upload | Render same HTML server-side, return with `Content-Disposition: attachment` header |
| PUBL-05 | Dashboard status updates to "published" with timestamp after publish | PATCH dashboard record: `{ status: 'published', published_at: new Date().toISOString() }` |
| PUBL-06 | Shareable URL is displayed after publish for easy copying | StepPublish UI update: show full URL with copy button after successful publish |
| STAT-02 | Publishing moves status to "published" | Same as PUBL-05 -- single Supabase update in publish API |
| STAT-03 | Team member can archive a published dashboard (R2 file deleted, URL returns 404) | Archive API: delete R2 object, update status to "archived" |
| STAT-04 | Team member can un-archive and re-publish a dashboard | Un-archive triggers the same publish flow: re-render HTML, upload to R2, set status back to "published" |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @opennextjs/cloudflare | ^1.0.0 | Access R2 bindings via `getCloudflareContext()` | Already installed; official way to access Cloudflare bindings from Next.js on Workers |
| wrangler | ^3.0.0 | R2 bucket creation and local dev with R2 | Already installed; manages Cloudflare Workers deployment |

### Existing (no new installs)
| Library | Purpose | Already Used In |
|---------|---------|-----------------|
| template-engine.ts | `injectConfig()` + `getTemplateHtml()` | Generation pipeline |
| supabase/db.ts | `getDashboard()`, `updateDashboard()` | All CRUD operations |
| supabase/server.ts | Server-side Supabase client | API routes |

### No New Dependencies Needed

The entire publish pipeline can be built with existing dependencies. R2 access is through Cloudflare Workers runtime bindings (no SDK to install).

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    api/
      dashboard/
        [id]/
          publish/route.ts     # POST: render + upload to R2 + update status
          archive/route.ts     # POST: delete from R2 + update status
          download/route.ts    # GET: render HTML + return as file download
    d/
      [slug]/
        route.ts               # GET: fetch from R2, return HTML
  lib/
    r2.ts                      # R2 helper: getR2Bucket(), putDashboard(), getDashboard(), deleteDashboard()
    publish.ts                 # renderDashboardHtml(): DB data -> CONFIG -> injected HTML
```

### Pattern 1: R2 Bucket Access via OpenNext
**What:** Use `getCloudflareContext()` to access the R2 binding from Next.js route handlers
**When to use:** Any server-side code that needs R2 access
**Example:**
```typescript
// Source: https://opennext.js.org/cloudflare/bindings
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();
  const bucket = env.DASHBOARDS as R2Bucket;
  await bucket.put("d/client-name.html", htmlContent, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });
}
```

### Pattern 2: Server-Side HTML Rendering
**What:** Build the full dashboard HTML from Supabase data without the browser
**When to use:** Publish and download flows
**Example:**
```typescript
// src/lib/publish.ts
import { getDashboard } from "@/lib/supabase/db";
import { getTemplateHtml } from "@/lib/template-loader";
import { injectConfig } from "@/lib/template-engine";
import type { DashboardWithData } from "@/lib/supabase/types";

export function buildConfigFromDashboard(dashboard: DashboardWithData): Record<string, unknown> {
  // Map Supabase data -> CONFIG object matching template expectations
  // This is the key mapping function
}

export async function renderDashboardHtml(dashboardId: string): Promise<string> {
  const dashboard = await getDashboard(dashboardId);
  const template = getTemplateHtml(dashboard.type);
  const config = buildConfigFromDashboard(dashboard);
  return injectConfig(template, config);
}
```

### Pattern 3: Public Route Serving R2 Content
**What:** A Next.js route handler at `/d/[slug]` that fetches HTML from R2 and returns it directly
**When to use:** Serving published dashboards to clients
**Example:**
```typescript
// src/app/d/[slug]/route.ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { env } = getCloudflareContext();
  const bucket = env.DASHBOARDS as R2Bucket;
  const object = await bucket.get(`d/${params.slug}.html`);

  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
```

### Pattern 4: Download as File Attachment
**What:** Same render pipeline but with Content-Disposition header for browser download
**When to use:** PUBL-04 -- Lofty upload requires a downloadable HTML file
**Example:**
```typescript
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const html = await renderDashboardHtml(params.id);
  const dashboard = await getDashboard(params.id);
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${dashboard.slug}.html"`,
    },
  });
}
```

### Anti-Patterns to Avoid
- **Storing HTML in Supabase:** R2 is purpose-built for static file serving. Supabase stores structured data, R2 stores rendered output.
- **Client-side rendering for publish:** The publish flow must be server-side to access R2 bindings. The client sends a POST, the server does all rendering.
- **Separate R2 bucket per environment:** Use the same bucket name but configure per-environment in wrangler.toml env sections. Or use a key prefix.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static file hosting | Custom file server or S3 | Cloudflare R2 with Workers binding | Zero egress fees, same-network latency from Workers, simple put/get/delete API |
| HTML rendering | New template system | Existing `injectConfig` + `getTemplateHtml` | Already proven in generation pipeline; same output |
| CONFIG building from DB | Re-implement from scratch | Extract pattern from existing generate pipeline | The wizard preview already produces this CONFIG; publish just needs to replicate from DB data |
| URL slug routing | Custom URL rewriting | Next.js dynamic route `[slug]` | Framework-native, already used for `[id]` routes |

## Common Pitfalls

### Pitfall 1: R2 Binding Not Available in Local Dev
**What goes wrong:** `getCloudflareContext()` throws because R2 binding is not available during `next dev`
**Why it happens:** R2 bindings only work in Cloudflare Workers runtime, not Node.js
**How to avoid:** Use `wrangler dev` for testing R2 flows, or add a graceful fallback that writes to local filesystem during development. Consider a conditional check: `if (process.env.NODE_ENV === 'development')` with a mock/local storage path.
**Warning signs:** "Cannot read properties of undefined (reading 'DASHBOARDS')" errors

### Pitfall 2: CONFIG Shape Mismatch Between Generate and Publish
**What goes wrong:** Published HTML looks different from wizard preview
**Why it happens:** The generate pipeline builds CONFIG from uploaded files + Claude output. The publish pipeline must build CONFIG from stored Supabase data. If the mapping function misses fields, the template renders incorrectly.
**How to avoid:** Extract CONFIG from the generated HTML during the wizard flow (using existing `extractConfig()`) and store it. On publish, use the stored CONFIG directly rather than re-deriving from structured DB fields.
**Warning signs:** Missing sections, NaN values, or broken layouts in published dashboards

### Pitfall 3: Large HTML Payloads
**What goes wrong:** Templates are ~788KB. R2 put/get handles this fine, but the Next.js route handler might hit memory issues if not streaming.
**Why it happens:** Reading entire HTML into memory as a string
**How to avoid:** R2 `get()` returns a `ReadableStream` body. Stream it directly in the Response rather than calling `.text()` first. For `put()`, strings up to 5GB are fine.
**Warning signs:** Slow response times or out-of-memory errors on Cloudflare Workers (128MB limit)

### Pitfall 4: Forgetting to Lock Slug on First Publish
**What goes wrong:** User publishes, then changes slug, breaking the URL
**Why it happens:** Slug is editable before first publish (SLUG-04), locked after (SLUG-05)
**How to avoid:** Already implemented in StepPublish -- `isPublished` check disables slug editing. Publish API should also enforce this server-side.
**Warning signs:** Slug changes after `published_at` is set

### Pitfall 5: R2 Bucket Per Environment
**What goes wrong:** Staging publishes to production R2 bucket, overwriting real dashboards
**Why it happens:** Same bucket name in all wrangler.toml environments
**How to avoid:** Use separate bucket names per environment (`dashboards-staging`, `dashboards-production`) or use a key prefix (`staging/d/slug.html`)
**Warning signs:** Published dashboards appearing/disappearing unexpectedly

## Code Examples

### wrangler.toml R2 Configuration
```toml
# Source: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
[[r2_buckets]]
binding = "DASHBOARDS"
bucket_name = "dashboards"

[env.staging]
name = "dashboard-generator-staging"
[[env.staging.r2_buckets]]
binding = "DASHBOARDS"
bucket_name = "dashboards-staging"

[env.staging.assets]
directory = ".open-next/assets"
binding = "ASSETS"
```

### R2 Helper Module
```typescript
// src/lib/r2.ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

function getBucket(): R2Bucket {
  const { env } = getCloudflareContext();
  return (env as Record<string, unknown>).DASHBOARDS as R2Bucket;
}

export async function uploadDashboardHtml(slug: string, html: string): Promise<void> {
  const bucket = getBucket();
  await bucket.put(`d/${slug}.html`, html, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });
}

export async function getDashboardHtml(slug: string): Promise<ReadableStream | null> {
  const bucket = getBucket();
  const object = await bucket.get(`d/${slug}.html`);
  return object?.body ?? null;
}

export async function deleteDashboardHtml(slug: string): Promise<void> {
  const bucket = getBucket();
  await bucket.delete(`d/${slug}.html`);
}
```

### Publish API Route
```typescript
// src/app/api/dashboard/[id]/publish/route.ts
import { renderDashboardHtml } from "@/lib/publish";
import { getDashboard, updateDashboard } from "@/lib/supabase/db";
import { uploadDashboardHtml } from "@/lib/r2";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const dashboard = await getDashboard(params.id);
  const html = await renderDashboardHtml(params.id);

  await uploadDashboardHtml(dashboard.slug, html);
  await updateDashboard(params.id, {
    status: "published",
    published_at: new Date().toISOString(),
  });

  return NextResponse.json({
    url: `/d/${dashboard.slug}`,
    slug: dashboard.slug,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| S3 + CloudFront for static hosting | R2 + Workers for zero-egress hosting | R2 GA Aug 2023 | No egress fees, same-origin with Workers, simpler config |
| Custom file upload via S3 SDK | R2 Workers bindings API | R2 Workers API GA 2023 | No SDK needed, direct `put`/`get`/`delete` from Worker code |
| Manual wrangler R2 CLI commands | R2 bindings in Worker code | Ongoing | Programmatic access from application code |

## Open Questions

1. **CONFIG Building Strategy**
   - What we know: The wizard generates HTML via the SSE pipeline using uploaded files + Claude. The generated HTML contains a CONFIG block that can be extracted with `extractConfig()`.
   - What's unclear: Should we store the CONFIG JSON separately in Supabase (alongside sell_data/buy_data), or re-derive it from structured data on each publish?
   - Recommendation: Store the last-generated HTML's CONFIG in a `generated_config` JSONB column on the dashboard or sell_data table. On publish, use this stored CONFIG. This avoids the complex mapping between Supabase fields and template CONFIG shapes, and guarantees publish output matches the preview the user approved.

2. **Where the generated HTML lives between preview and publish**
   - What we know: Currently, generated HTML lives only in client-side state (`useGenerateDashboard` hook). It is not persisted to Supabase.
   - What's unclear: When the user clicks "Publish" on StepPublish, the HTML from the preview step may no longer be in memory (if they refreshed the page).
   - Recommendation: Either (a) persist the generated HTML to Supabase as a `generated_html` text column (simplest, ~788KB per dashboard), or (b) store the CONFIG and re-render on publish. Option (a) is simpler and guarantees what-you-see-is-what-you-publish.

3. **R2 Bucket Creation**
   - What we know: The bucket must be created before it can be used.
   - Recommendation: Create buckets via `wrangler r2 bucket create dashboards` and `wrangler r2 bucket create dashboards-staging` as a one-time setup step.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUBL-01 | Render HTML from DB data and upload to R2 | unit | `npx vitest run src/lib/__tests__/publish.test.ts -x` | No -- Wave 0 |
| PUBL-02 | Serve published HTML at /d/{slug} | integration | `npx vitest run src/__tests__/publish-route.test.ts -x` | No -- Wave 0 |
| PUBL-03 | Re-publish overwrites same R2 key | unit | `npx vitest run src/lib/__tests__/r2.test.ts -x` | No -- Wave 0 |
| PUBL-04 | Download HTML as file | unit | `npx vitest run src/__tests__/download.test.ts -x` | No -- Wave 0 |
| PUBL-05 | Status updates to published with timestamp | unit | `npx vitest run src/lib/__tests__/publish.test.ts -x` | No -- Wave 0 |
| PUBL-06 | Shareable URL displayed after publish | manual-only | Manual UI verification | N/A |
| STAT-02 | Publishing moves status to published | unit | Covered by PUBL-05 test | No -- Wave 0 |
| STAT-03 | Archive deletes R2 file | unit | `npx vitest run src/lib/__tests__/publish.test.ts -x` | No -- Wave 0 |
| STAT-04 | Un-archive re-publishes | unit | `npx vitest run src/lib/__tests__/publish.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/publish.test.ts` -- covers PUBL-01, PUBL-05, STAT-02, STAT-03, STAT-04 (R2 and Supabase mocked)
- [ ] `src/lib/__tests__/r2.test.ts` -- covers PUBL-03 (R2 mock verifying put/get/delete)
- [ ] `src/__tests__/publish-route.test.ts` -- covers PUBL-02 (mock route handler)
- [ ] `src/__tests__/download.test.ts` -- covers PUBL-04

## Sources

### Primary (HIGH confidence)
- [Cloudflare R2 Workers API Usage](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) -- R2 binding config, put/get/delete API
- [Cloudflare R2 Workers API Reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) -- R2Object types, put options, httpMetadata
- [OpenNext Cloudflare Bindings](https://opennext.js.org/cloudflare/bindings) -- `getCloudflareContext()` API for accessing R2 from Next.js

### Secondary (MEDIUM confidence)
- [Cloudflare Workers R2 Tutorial](https://developers.cloudflare.com/workers/tutorials/upload-assets-with-r2/) -- Full tutorial on R2 upload/serve pattern
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) -- wrangler.toml R2 bucket syntax

### Codebase (HIGH confidence)
- `src/lib/template-engine.ts` -- `injectConfig()`, `extractConfig()`, `serializeValue()`
- `src/lib/template-loader.ts` -- `getTemplateHtml()` for all template types
- `src/lib/supabase/db.ts` -- `getDashboard()`, `updateDashboard()`
- `src/components/wizard/StepPublish.tsx` -- Existing publish step UI (placeholder buttons)
- `src/middleware.ts` -- Already whitelists `/d/` as public route
- `wrangler.toml` -- Current config (no R2 bindings yet, needs update)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, R2 API is well-documented
- Architecture: HIGH -- straightforward put/get/delete pattern, existing template engine handles rendering
- Pitfalls: HIGH -- based on codebase analysis and Cloudflare documentation
- CONFIG mapping: MEDIUM -- the exact shape mapping between Supabase data and template CONFIG needs implementation-time validation

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- Cloudflare R2 API is GA and unlikely to change)
