---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/template-sell.html
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "Comparable sales section no longer shows median sold price or median $/SF stats"
    - "Pricing strategy section no longer shows value range beneath recommended list price"
    - "Pricing strategy replaces narrative paragraph with infographic-style metric cards"
  artifacts:
    - path: "src/lib/template-sell.html"
      provides: "Updated seller dashboard template"
      contains: "pricing-infographic"
  key_links:
    - from: "pricing infographic cards"
      to: "MARKET_METRICS data"
      via: "JS string concatenation"
      pattern: "MARKET_METRICS\\.(saleToListRatio|avgDom|priceTrend)"
---

<objective>
Update the seller dashboard template to clean up the comparable sales summary stats and replace the pricing strategy narrative with an infographic layout.

Purpose: Make the pricing strategy section more scannable and visually engaging for homeowners, and remove redundant median stats from comps section.
Output: Updated template-sell.html with three targeted changes.
</objective>

<execution_context>
@/Users/joshuahogan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/joshuahogan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/template-sell.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove median stats from comparable sales and value range from pricing</name>
  <files>src/lib/template-sell.html</files>
  <action>
Two surgical removals in template-sell.html:

1. **Comparable Sales summary stats (around lines 531-533):** Remove the two `prop-stat` divs for "Median Sold Price" (`MARKET_METRICS.medianSoldPrice`) and "Median $/SF" (`MARKET_METRICS.medianPpsf`). Keep "Avg Days on Market" and "Derived Value Range" stats intact. The `prop-summary` container div stays with its remaining 2 stats.

2. **Pricing Strategy value range (line 625):** Remove the line that renders the `.range` div:
   ```
   priceBody += '<div class="range">' + fmtK(MARKET_METRICS.derivedRange.low) + ' ... value range</div>';
   ```
   Keep the `.value-display` container, the "Recommended List Price" label, and the `.big` price display. Only remove the range line.

Do NOT remove any CSS classes (`.range`, `.narrative-box`, etc.) -- they may be used elsewhere or in other templates.
  </action>
  <verify>
    <automated>grep -n "medianSoldPrice\|medianPpsf" src/lib/template-sell.html | grep -v "var \|default\|//\|marketMetrics" | wc -l | tr -d ' ' | grep -q "^0$" && echo "PASS: median stats removed from display" || echo "FAIL: median stats still displayed"</automated>
  </verify>
  <done>Comparable sales section shows only "Avg Days on Market" and "Derived Value Range" stats. Pricing strategy shows recommended list price without value range beneath it.</done>
</task>

<task type="auto">
  <name>Task 2: Replace pricing narrative with infographic-style metric cards</name>
  <files>src/lib/template-sell.html</files>
  <action>
Replace the narrative-box line (line 627):
```
priceBody += '<div class="narrative-box">' + CONFIG.pricingStrategy + '</div>';
```

And the market trend callout block (lines 630-634) with a single infographic grid that presents the same data points visually. Replace BOTH blocks with this new infographic section:

**Add CSS** (add to the existing style block, after the `.narrative-box` rule around line 138):
```css
.pricing-infographic{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.pricing-stat-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center}
.pricing-stat-icon{font-size:22px;margin-bottom:6px}
.pricing-stat-value{font-size:20px;font-weight:800;color:var(--terra);margin-bottom:4px}
.pricing-stat-label{font-size:11px;font-weight:600;color:var(--slate-light);text-transform:uppercase;letter-spacing:.5px}
.pricing-stat-sub{font-size:11px;color:var(--neutral);margin-top:4px}
@media(max-width:600px){.pricing-infographic{grid-template-columns:1fr}}
```

**Replace the narrative-box + callout with this JS** (between the value-display closing and the `t2 += section(...)` line):

Build a `pricing-infographic` div with these cards:

Card 1 - Market Trend:
- Icon: trend arrow (use unicode up-arrow for rising, down-arrow for falling, right-arrow for stable)
- Value: capitalize priceTrendDirection ("Rising", "Falling", "Stable")
- Label: "MARKET TREND"
- Sub: MARKET_METRICS.priceTrendDetail

Card 2 - Sale-to-List Ratio:
- Icon: handshake or target emoji (use unicode)
- Value: fmtPct(MARKET_METRICS.saleToListRatio)
- Label: "SALE-TO-LIST RATIO"
- Sub: ratio > 0.99 ? "Sellers getting full ask" : ratio > 0.97 ? "Slight negotiation typical" : "Buyer-friendly negotiations"

Card 3 - Days on Market:
- Icon: calendar emoji (use unicode)
- Value: MARKET_METRICS.avgDom + " days"
- Label: "AVG DAYS ON MARKET"
- Sub: avgDom <= 14 ? "Fast-moving market" : avgDom <= 30 ? "Healthy absorption" : "Extended market times"

Card 4 - Comps Analyzed:
- Icon: chart/graph emoji (use unicode)
- Value: MARKET_METRICS.compsUsedForValue
- Label: "COMPS ANALYZED"
- Sub: "Within " + MARKET_METRICS.analysisPeriodMonths + " month window"

Card 5 - Total Sales:
- Icon: house emoji (use unicode)
- Value: MARKET_METRICS.totalSalesInPeriod
- Label: "AREA SALES"
- Sub: MARKET_METRICS.subdivisionSalesCount + " in subdivision"

Card 6 - Price per SF:
- Icon: ruler emoji (use unicode)
- Value: "$" + MARKET_METRICS.avgPpsf
- Label: "AVG PRICE/SF"
- Sub: "$" + MARKET_METRICS.ppsfRange.low + " - $" + MARKET_METRICS.ppsfRange.high + " range"

Use the `pricing-infographic` grid class (3 cols desktop, 1 col mobile). Each card uses `pricing-stat-card` class. The trend card should have a colored left border: green for rising, amber for falling, blue for stable (use inline style `border-left:3px solid {color}`).

Keep the CONFIG.pricingStrategy text but move it BELOW the infographic as a smaller, secondary context line:
```
priceBody += '<div style="font-size:12px;color:var(--neutral);line-height:1.7;margin-bottom:16px;padding:0 4px">' + CONFIG.pricingStrategy + '</div>';
```
  </action>
  <verify>
    <automated>grep -c "pricing-infographic" src/lib/template-sell.html | grep -q "[1-9]" && grep -c "pricing-stat-card" src/lib/template-sell.html | grep -q "[1-9]" && echo "PASS: infographic layout present" || echo "FAIL: infographic not found"</automated>
  </verify>
  <done>Pricing strategy section shows 6 metric cards in a responsive grid (3-col desktop, 1-col mobile) with icons, values, labels, and contextual subtexts. Narrative text appears below as secondary context. Old narrative-box and callout blocks are removed.</done>
</task>

</tasks>

<verification>
1. Open a seller dashboard in browser (use staging or local dev)
2. Navigate to Market tab
3. Comparable Sales section: confirm only "Avg Days on Market" and "Derived Value Range" stats appear (no median sold price or median $/SF)
4. Pricing Strategy section: confirm recommended list price displays WITHOUT value range below it
5. Pricing Strategy section: confirm 6 infographic cards render in a grid with icons, values, and labels
6. Resize browser to mobile width: confirm cards stack to single column
7. Confirm narrative text appears below the infographic cards in smaller, muted styling
</verification>

<success_criteria>
- Median Sold Price and Median $/SF removed from comparable sales summary stats
- Value range removed from beneath recommended list price
- Pricing strategy narrative replaced with 6-card infographic grid
- Narrative text preserved as secondary context below infographic
- Responsive layout works on mobile (1-col) and desktop (3-col)
- No JavaScript errors in console
</success_criteria>

<output>
After completion, create `.planning/quick/2-seller-dashboard-remove-median-stats-fro/2-SUMMARY.md`
</output>
