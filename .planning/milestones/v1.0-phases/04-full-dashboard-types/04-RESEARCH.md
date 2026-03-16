# Phase 4: Full Dashboard Types - Research

**Researched:** 2026-03-15
**Domain:** HTML template rendering, tab-based dashboard UI, properties of interest CRUD
**Confidence:** HIGH

## Summary

Phase 4 completes the three dashboard types (sell, buyer, buy/sell) so they render correctly with full content across all tabs, adds a listing status badge to sell dashboards, and ensures properties of interest display on buyer and buy/sell dashboards. The majority of the infrastructure already exists: all three HTML templates are built with tab structures and render functions, the Supabase `properties_of_interest` table and CRUD API are implemented, and the wizard's StepPreview already supports adding/removing properties of interest for buyer/buysell types.

The primary work falls into two categories: (1) reconciling the current template tab names/content with the requirements specification, and (2) wiring properties of interest into the published HTML templates and the publish pipeline. A secondary piece is adding the listing status badge (Pre-Listing/Active/Pending/Closed) to sell dashboards, which requires a new field in both the SellData schema and the sell template.

**Primary recommendation:** Update the three HTML templates to match the required tab structures, add `listingStatus` field to sell_data and SellDashboardConfig, inject properties of interest into the CONFIG at publish time, and render them in a "Properties" tab on buyer/buysell templates.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TYPE-01 | Sell dashboard renders with 4 tabs: Your Home, Market, Listing Plan, Team | Sell template already has these exact 4 tabs -- verify content completeness |
| TYPE-02 | Buyer dashboard renders with 4 tabs: Your Search, Neighborhoods, Properties, Team | Current buyer template has: Home Search, Neighborhoods & Schools, Timeline, Team -- needs tab rename and Properties tab addition |
| TYPE-03 | Buy/sell dashboard renders with 5 tabs: Sell Side, Buy Side, Strategy, Properties, Team | Current buysell template has: Home Search, Selling, Schools, Strategy, Team -- needs tab renames and Properties tab addition |
| TYPE-04 | Sell dashboard shows listing status badge (Pre-Listing/Active/Pending/Closed) | No `listingStatus` field exists anywhere yet -- needs new field in SellData, schema, CONFIG, and template rendering |
| PROP-01 | Team member can add a property of interest with address, price, listing URL, and notes | API route and StepPreview UI already implement this fully |
| PROP-02 | Team member can remove a property of interest | API route and StepPreview UI already implement this fully |
| PROP-03 | Properties of interest display on buyer and buy/sell dashboards | Properties are managed in wizard but NOT injected into published HTML templates -- need publish pipeline + template changes |
| PROP-04 | Optional photo URL for each property (external link, no upload) | DB schema and API already support photo_url field -- template rendering needs it |
</phase_requirements>

## Standard Stack

### Core (already in use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14.2.x | App Router framework | Already deployed on Cloudflare Workers via OpenNext |
| Supabase | 2.99.x | Database + auth | Already stores dashboards, sell_data, buy_data, properties_of_interest |
| Zod | 3.22.x | Schema validation | Already validates SellDashboardConfig, BuyerDashboardConfig, BuySellDashboardConfig |
| Vitest | latest | Testing | Already configured, 12+ test files exist |

### No New Libraries Needed
This phase is template HTML + existing TypeScript changes. No new dependencies required.

## Architecture Patterns

### Existing Template Architecture
All three dashboard templates follow the same pattern:
1. Self-contained HTML file with inline CSS and JS
2. `var CONFIG = {...}` block injected by `template-engine.ts` between markers
3. A `render()` function that reads CONFIG and populates `tab-panel` divs via innerHTML
4. Tab switching via `showTab(id)` function tied to button onclick handlers
5. Section toggle state tracked in a global `S` object

### Template Tab Structure: Current vs Required

**Sell (template-sell.html) -- 823 lines:**
| Current Tab | Required Tab | Status |
|-------------|-------------|--------|
| Your Home | Your Home | MATCH |
| Market | Market | MATCH |
| Listing Plan | Listing Plan | MATCH |
| Team | Team | MATCH |

**Buyer (template-buyer.html) -- 705 lines:**
| Current Tab | Required Tab | Status |
|-------------|-------------|--------|
| Home Search | Your Search | RENAME |
| Neighborhoods & Schools | Neighborhoods | RENAME (schools stay in this tab) |
| Timeline | Properties | REPLACE (timeline content moves into Your Search or Neighborhoods) |
| Team | Team | MATCH |

**Buy/Sell (template-buysell.html) -- 959 lines:**
| Current Tab | Required Tab | Status |
|-------------|-------------|--------|
| Home Search | Sell Side | RENAME + content restructure |
| Selling | Buy Side | RENAME + content restructure |
| Schools | Strategy | RENAME |
| Strategy | Properties | RENAME |
| Team | Team | MATCH |

### Properties of Interest Data Flow

```
Wizard (StepPreview.tsx)
  -> POST /api/dashboard/[id]/properties  (already works)
  -> Supabase properties_of_interest table (already exists)

Publish Pipeline (needs changes):
  -> renderDashboardHtml() in publish.ts
  -> buildConfigFromDashboard() must fetch + include properties
  -> CONFIG.propertiesOfInterest = [{address, price, listing_url, photo_url, notes}]
  -> Template render() function reads CONFIG.propertiesOfInterest
  -> Renders cards in "Properties" tab panel
```

### Listing Status Badge Pattern

```
SellData.listing_status: "pre-listing" | "active" | "pending" | "closed"
  -> SellDashboardConfig.listingStatus
  -> CONFIG.listingStatus in template
  -> Badge rendered in header or Your Home tab top
  -> CSS classes: .status-badge.pre-listing, .status-badge.active, etc.
```

The sell template already has `.status-badge` CSS classes (.active, .uc, .drop) used for competition listings. These can be extended for listing status.

### Recommended File Changes

```
src/
  lib/
    supabase/types.ts          # Add listing_status to SellData
    types.ts                   # Add listingStatus to SellDashboardConfig
    schemas/dashboard.ts       # Add listingStatus to SellDashboardConfigSchema
    publish.ts                 # Fetch properties, add to CONFIG; add listingStatus mapping
    template-sell.html         # Add listing status badge rendering
    template-buyer.html        # Rename tabs, add Properties tab with POI rendering
    template-buysell.html      # Rename tabs, add Properties tab with POI rendering
  app/
    api/dashboard/[id]/route.ts  # Ensure PATCH handles listing_status
  components/
    wizard/StepClientInfo.tsx  # Add listing status selector for sell/buysell types
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Properties of Interest CRUD | New API routes | Existing `/api/dashboard/[id]/properties` route | Already implements GET, POST, DELETE with full validation |
| Properties of Interest UI | New component | Existing StepPreview.tsx sidebar | Already has add form, remove button, property list display |
| Config validation | Manual checks | Existing Zod schemas in `schemas/dashboard.ts` | Add new fields to existing schemas |
| Template injection | Custom HTML builder | Existing `injectConfig()` + `serializeValue()` | Handles JS literal serialization, HTML escaping, marker replacement |

## Common Pitfalls

### Pitfall 1: Template Tab ID Mismatch
**What goes wrong:** Renaming tab button text without updating the `showTab('id')` parameter and `id="tab-{id}"` on the panel div.
**Why it happens:** Tab switching uses string IDs that must match between button onclick and panel id attribute.
**How to avoid:** When renaming tabs, update all three: (1) button text, (2) `showTab('newid')` onclick, (3) `id="tab-newid"` on panel div.
**Warning signs:** Clicking a tab shows nothing or throws a JS error.

### Pitfall 2: Properties of Interest Not Available at Publish Time
**What goes wrong:** `buildConfigFromDashboard()` does not query the `properties_of_interest` table, so published HTML has no properties data.
**Why it happens:** The current publish pipeline only joins `sell_data` and `buy_data` via Supabase's `select("*, sell_data(*), buy_data(*)")`. Properties of interest are a separate table.
**How to avoid:** Either (a) extend `getDashboard()` to join `properties_of_interest(*)`, or (b) make a separate query in `buildConfigFromDashboard()`. Option (a) is cleaner.
**Warning signs:** Properties show in wizard preview but not in published dashboard.

### Pitfall 3: Listing Status Not Persisted
**What goes wrong:** Adding `listingStatus` to the CONFIG type but forgetting to add the `listing_status` column to the `sell_data` table in Supabase.
**Why it happens:** Schema changes require both TypeScript type updates AND Supabase migration.
**How to avoid:** Add column via Supabase dashboard or migration. Default to `'pre-listing'`.
**Warning signs:** Status always shows default value, updates don't persist.

### Pitfall 4: Buy/Sell Tab Content Misalignment
**What goes wrong:** The requirements specify different tab names/organization than what currently exists. Content from current tabs needs to be redistributed to new tab structure.
**Why it happens:** The buysell template was built with a different tab organization than the final requirements.
**How to avoid:** Map each section of the current render function to its new tab. Test that no content is lost in the reorganization.

### Pitfall 5: Properties of Interest Serialization
**What goes wrong:** Properties contain user-entered strings (notes, addresses) that may include quotes, backslashes, or HTML-unsafe characters.
**Why it happens:** CONFIG is serialized as a JS literal, not JSON.
**How to avoid:** `serializeValue()` in `template-engine.ts` already handles string escaping robustly (quotes, newlines, `</script>` tags). Use the existing serialization pipeline -- do not bypass it.

## Code Examples

### Current buildConfigFromDashboard Pattern (publish.ts)
```typescript
// Source: src/lib/publish.ts lines 37-161
export function buildConfigFromDashboard(dashboard: DashboardWithData): AnyDashboardConfig {
  // Maps DB snake_case fields to CONFIG camelCase
  // Uses null coalescing for safe defaults
  // Returns typed SellDashboardConfig | BuyerDashboardConfig | BuySellDashboardConfig
}
```

### Properties of Interest API (already implemented)
```typescript
// Source: src/app/api/dashboard/[id]/properties/route.ts
// GET: listPropertiesOfInterest(dashboardId)
// POST: addPropertyOfInterest(dashboardId, { address, price?, listing_url?, photo_url?, notes? })
// DELETE: removePropertyOfInterest(propertyId)
```

### Template Tab Rendering Pattern
```javascript
// Source: template-sell.html render() function
// Each tab builds HTML as a string, then assigns to the tab panel:
var t1 = ''; // Tab 1 content
t1 += '<div class="metrics">...</div>';
t1 += section('property', 'Property Snapshot', propBody);
document.getElementById('tab-home').innerHTML = t1;
```

### Adding Properties Tab to Buyer Template
```javascript
// Pattern for rendering properties of interest in a template tab:
var t3 = ''; // Properties tab
var pois = CONFIG.propertiesOfInterest || [];
if (pois.length === 0) {
  t3 += '<div style="text-align:center;padding:40px 20px;color:var(--neutral)">';
  t3 += '<div style="font-size:14px;font-weight:600">No Properties Selected Yet</div>';
  t3 += '<div style="font-size:12px;margin-top:4px">Your agent will add properties here as you explore options together.</div>';
  t3 += '</div>';
} else {
  for (var i = 0; i < pois.length; i++) {
    var p = pois[i];
    t3 += '<div class="nhood-card">'; // reuse existing card styles
    t3 += '<div style="font-weight:700;font-size:14px">' + p.address + '</div>';
    if (p.price) t3 += '<div style="font-size:16px;font-weight:800;color:var(--terra);margin-top:4px">' + fmt(p.price) + '</div>';
    if (p.photoUrl) t3 += '<img src="' + p.photoUrl + '" style="width:100%;border-radius:8px;margin:8px 0" alt="Property photo">';
    if (p.notes) t3 += '<div style="font-size:12px;color:var(--neutral);margin-top:6px;line-height:1.5">' + p.notes + '</div>';
    if (p.listingUrl) t3 += '<a href="' + p.listingUrl + '" target="_blank" style="display:inline-block;margin-top:8px;font-size:12px;color:var(--terra);font-weight:600">View Listing &rarr;</a>';
    t3 += '</div>';
  }
}
document.getElementById('tab-properties').innerHTML = t3;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Properties only in wizard | Properties in wizard + published HTML | Phase 4 | Clients see curated properties on their public dashboard |
| No listing status tracking | Status badge on sell dashboards | Phase 4 | Clear communication of where listing is in process |

## Open Questions

1. **Tab naming for buyer dashboard**
   - What we know: Requirements say "Your Search, Neighborhoods, Properties, Team" but current template has mortgage calculator, loan estimator, and school content
   - What's unclear: Does the Timeline tab content (buying process steps) merge into another tab or get dropped?
   - Recommendation: Merge timeline content into Your Search tab as a collapsible section. Schools stay in Neighborhoods tab.

2. **Buy/sell tab content redistribution**
   - What we know: Requirements say "Sell Side, Buy Side, Strategy, Properties, Team" but current template has sell content in "Selling" tab and buy content in "Home Search" tab
   - What's unclear: Exact mapping of current sections to new tab names
   - Recommendation: Rename Home Search -> Buy Side, Selling -> Sell Side, Schools -> merge into Buy Side, keep Strategy, add Properties tab. Content stays largely the same, tabs get relabeled.

3. **Listing status default and edit UI**
   - What we know: Need Pre-Listing/Active/Pending/Closed states
   - What's unclear: Where in the wizard does the agent set this? Does it update post-publish?
   - Recommendation: Add a dropdown in StepClientInfo for sell/buysell types. Default to "pre-listing". Editable via wizard re-entry.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest) |
| Config file | vitest.config.ts (inferred from package.json) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TYPE-01 | Sell dashboard has 4 correct tabs | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "sell"` | Partial (test exists, needs tab verification) |
| TYPE-02 | Buyer dashboard has 4 correct tabs | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "buyer"` | Partial |
| TYPE-03 | Buy/sell dashboard has 5 correct tabs | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "buysell"` | No |
| TYPE-04 | Sell dashboard listing status badge | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "listingStatus"` | No |
| PROP-01 | Add property of interest | unit | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "properties"` | No |
| PROP-02 | Remove property of interest | unit | `npx vitest run src/lib/__tests__/supabase-db.test.ts -t "properties"` | No |
| PROP-03 | Properties display in published HTML | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "properties"` | No |
| PROP-04 | Photo URL renders in template | unit | `npx vitest run src/lib/__tests__/publish.test.ts -t "photo"` | No |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/publish.test.ts` -- needs tests for properties of interest injection, listing status mapping, buysell config building with POI
- [ ] No template HTML unit tests exist (templates are self-contained HTML with vanilla JS) -- consider testing `buildConfigFromDashboard()` output shape instead

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/lib/types.ts`, `src/lib/schemas/dashboard.ts`, `src/lib/supabase/types.ts` -- complete type system for all dashboard configs
- Codebase inspection: `src/lib/publish.ts` -- publish pipeline showing buildConfigFromDashboard + renderDashboardHtml flow
- Codebase inspection: `src/lib/template-sell.html`, `template-buyer.html`, `template-buysell.html` -- current tab structures and render functions
- Codebase inspection: `src/app/api/dashboard/[id]/properties/route.ts` -- existing CRUD API for properties of interest
- Codebase inspection: `src/components/wizard/StepPreview.tsx` -- existing UI for managing properties of interest

### Secondary (MEDIUM confidence)
- Requirements mapping from `.planning/REQUIREMENTS.md` -- TYPE-01 through PROP-04 specifications

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, all existing code verified by inspection
- Architecture: HIGH - template injection pattern, DB schema, and API routes all inspected and understood
- Pitfalls: HIGH - identified through direct code reading of current implementation gaps

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable codebase, no external dependencies changing)
