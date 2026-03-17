---
phase: quick-3
plan: 01
subsystem: dashboard-templates
tags: [competition, lofty, templates, wizard, types]
dependency_graph:
  requires: []
  provides: [competition-link-field, cta-button-templates]
  affects: [sell-dashboard, buyer-dashboard, buysell-dashboard, wizard-form, generation-pipeline]
tech_stack:
  added: []
  patterns: [cta-button-section, data-driven-section-visibility]
key_files:
  created: []
  modified:
    - src/lib/supabase/types.ts
    - src/lib/types.ts
    - src/lib/schemas/dashboard.ts
    - src/components/wizard/StepClientInfo.tsx
    - src/app/api/dashboard/generate/route.ts
    - src/app/api/dashboard/generate/continue/route.ts
    - src/lib/publish.ts
    - src/lib/claude-prompts.ts
    - src/lib/template-sell.html
    - src/lib/template-buyer.html
    - src/lib/template-buysell.html
    - src/lib/__tests__/config-validation.test.ts
    - src/lib/__tests__/publish.test.ts
decisions:
  - Removed CompetitionListing interface entirely rather than keeping as deprecated
  - Competition section visibility is purely data-driven (competitionLink present or not), not toggle-driven
  - Single competitionLink field shared across sell/buyer/buysell rather than separate fields per type
metrics:
  duration: 1011s
  completed: "2026-03-17"
  tasks_completed: 3
  tasks_total: 3
---

# Quick Task 3: Replace Competition Tracker with Lofty Search Link Summary

Replaced AI-generated competition listing cards with a Lofty search URL CTA button across all dashboard types, with a new Competition Link URL input in the wizard form.

## What Changed

### Data Model
- Removed `CompetitionListing` interface and `CompetitionListingSchema` from types and schemas
- Removed `competition: CompetitionListing[]` from `SellDashboardConfig` and `SellData`
- Removed `sellCompetition: CompetitionListing[]` from `BuySellDashboardConfig`
- Added `competitionLink?: string` to `SellDashboardConfig`, `BuyerDashboardConfig`, `BuySellDashboardConfig`
- Added `competition_link?: string | null` to `SellData` and `BuyData` Supabase types

### Wizard Form
- Added "Competition Link" fieldset with URL input visible for all dashboard types (sell, buyer, buysell)
- Field persists to `sell_data.competition_link` and/or `buy_data.competition_link` depending on dashboard type

### Generation Pipeline
- Both `route.ts` and `continue/route.ts` now pass `competitionLink` from `clientDetails` instead of parsing competition arrays from Claude responses
- `publish.ts` maps `competition_link` from DB to `competitionLink` in config for all three dashboard types
- Claude prompts no longer request competition listings (removed from JSON template and rules)

### Templates
- **Sell**: Replaced competition card loop with CTA button section ("View Active Homes in Your Area") when `CONFIG.competitionLink` is set; hidden when not set
- **Buyer**: Added new competition CTA section after school districts in the Neighborhoods tab
- **BuySell**: Replaced competition card loop with identical CTA button pattern; removed unused `.competition-card` CSS classes

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8385779 | Add competitionLink to types, schemas, wizard, pipeline, prompts |
| 2 | 305ddc4 | Replace competition sections in templates with CTA button |
| 3 | 1407d92 | Update test fixtures for competitionLink replacement |

## Verification

- TypeScript compiles cleanly (no new errors; pre-existing errors in propertiesOfInterest/listingStatus/supabase-auth unchanged)
- 132/133 tests pass (1 pre-existing failure in supabase-db mock unrelated to this change)
- Template validation script confirms CTA buttons present and old competition arrays removed in all 3 templates

## Self-Check: PASSED
