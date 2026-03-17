---
phase: quick-5
plan: 1
subsystem: dashboard-templates
tags: [ux, net-sheet, slider, sell-template, buysell-template]
dependency_graph:
  requires: []
  provides: [debounced-slider, reordered-home-tab, loan-payoff-numinput]
  affects: [template-sell, template-buysell]
tech_stack:
  patterns: [requestAnimationFrame-debounce, numinput-with-note]
key_files:
  modified:
    - src/lib/template-sell.html
    - src/lib/template-buysell.html
decisions:
  - Kept CONFIG.loanPayoff as default since publish pipeline already computes amortized balance
metrics:
  duration: 2m 5s
  completed: "2026-03-17T18:05:38Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 5: Move Up Net Sheet Calculator & Improve Sale Price Slider

Net sheet calculator moved to top of Home tab, sale price sliders debounced with requestAnimationFrame on both templates, loan payoff converted from slider to number input with amortized default note.

## Changes Made

### Task 1: Sell Template Improvements (7e5f041)

Three changes to `src/lib/template-sell.html`:

1. **Reordered Home tab sections** -- Equity & Net Proceeds Calculator now renders above Property Snapshot so it is the first interactive section clients see
2. **Debounced sale price slider** -- Added `var _raf = 0` and replaced direct `render()` call in slider `oninput` with `cancelAnimationFrame(_raf); _raf = requestAnimationFrame(render)`. The displayed value label updates instantly via DOM query (`querySelector('.field-value').textContent = ...`) for immediate visual feedback while the full DOM rebuild is throttled to once per animation frame
3. **Converted loan payoff to number input** -- Replaced `slider('Loan Payoff', ...)` with `numInput('Loan Payoff', ...)` so users can type an exact dollar amount. Shows "Estimated from loan records" note when `CONFIG.loanAmount` exists (indicating tax record data was used during publish)

### Task 2: Buysell Template Slider Debounce (8525389)

Applied the same `requestAnimationFrame` debounce pattern to `src/lib/template-buysell.html`:
- Added `var _raf = 0` variable
- Replaced slider function with debounced version matching the sell template

This improves all sliders in the buysell template: Sale Price, Broker Fee, Seller Closing Costs, Purchase Price, Down Payment, Mortgage Rate, and Tax Rate.

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7e5f041 | Reorder sections, debounce slider, convert loan payoff to numInput |
| 2 | 8525389 | Debounce sale price slider in buysell template |

## Self-Check: PASSED

- template-sell.html: FOUND
- template-buysell.html: FOUND
- Commit 7e5f041: FOUND
- Commit 8525389: FOUND
