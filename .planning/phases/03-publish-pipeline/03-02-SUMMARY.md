---
phase: 03-publish-pipeline
plan: 02
subsystem: ui, api
tags: [publish-ui, wizard, archive, slug-lock, status-lifecycle]

# Dependency graph
requires:
  - phase: 03-publish-pipeline
    plan: 01
    provides: R2 helpers, publish/download API routes, public serving route
provides:
  - Functional Publish/Re-Publish/Un-Archive button in wizard step 6
  - Shareable URL display with copy-to-clipboard
  - Download HTML button
  - Archive button with confirmation dialog
  - Dynamic status badges (Draft/Published/Archived)
  - Archive API route (POST /api/dashboard/{id}/archive)
  - Slug locking after first publish
affects: []
---

# Summary: Wire Publish Pipeline into Wizard UI

## What was built

Connected the server-side publish pipeline (R2 storage, HTML rendering) to the wizard interface. Step 6 (Publish) now provides a complete publish lifecycle:

- **Publish button** with dynamic labels: "Publish Dashboard" (draft), "Re-Publish Dashboard" (published), "Un-Archive & Publish" (archived)
- **Shareable URL banner** with clickable link, Copy URL button (clipboard API with feedback), and external link icon
- **Download HTML** opens the download endpoint in a new tab
- **Archive button** with confirmation dialog — deletes R2 file, sets status to "archived"
- **Status badges** in review summary: amber (Draft), green (Published), gray (Archived)
- **Slug locking** after first publish to prevent broken URLs
- **Archive API route** validates dashboard is published, deletes R2 HTML, updates DB

## Key files

### Created
- `src/app/api/dashboard/[id]/archive/route.ts` — Archive endpoint

### Modified
- `src/components/wizard/StepPublish.tsx` — Full publish UI with all actions
- `src/app/api/dashboard/[id]/route.ts` — Added published_at to allowed PATCH fields
- `src/components/library/DashboardCard.tsx` — Status badge support
- `src/lib/r2.ts` — Local R2 type interfaces (avoids @cloudflare/workers-types global pollution)

## Verification

End-to-end testing on staging (dashboard-generator-staging.josh-hogan-account.workers.dev):

| Test | Result |
|------|--------|
| Publish Dashboard (draft → published) | ✓ |
| Shareable URL displayed with Copy URL | ✓ |
| Public URL serves rendered dashboard | ✓ |
| Button changes to Re-Publish | ✓ |
| Archive with confirmation dialog | ✓ |
| Public URL returns 404 after archive | ✓ |
| Slug locked after first publish | ✓ |
| Un-Archive & Publish restores dashboard | ✓ |
| Public URL returns 200 after un-archive | ✓ |
| Library status badge shows Published | ✓ |

## Self-Check: PASSED

All done criteria met. Full publish lifecycle verified on staging with R2 integration.
