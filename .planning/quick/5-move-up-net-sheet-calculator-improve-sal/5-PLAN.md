---
phase: quick-5
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/template-sell.html
  - src/lib/template-buysell.html
autonomous: true
requirements: [QUICK-5]
must_haves:
  truths:
    - "Net sheet calculator section appears above Property Snapshot in the sell template Home tab"
    - "Sale price slider in sell template moves smoothly without UI jank on both templates"
    - "Loan payoff in sell template is a number input field, not a slider"
    - "Loan payoff defaults to amortized balance when loanAmount data is available in CONFIG"
  artifacts:
    - path: "src/lib/template-sell.html"
      provides: "Reordered sections, debounced slider, numInput for loan payoff with amortized default"
    - path: "src/lib/template-buysell.html"
      provides: "Debounced sale price slider for smoother interaction"
  key_links:
    - from: "template-sell.html slider oninput"
      to: "render()"
      via: "requestAnimationFrame debounce"
      pattern: "requestAnimationFrame"
    - from: "template-sell.html loanPayoff"
      to: "CONFIG.loanPayoff"
      via: "numInput with amortized default calculation"
      pattern: "numInput.*loanPayoff"
---

<objective>
Three improvements to the sell dashboard template (and slider fix to buysell):

1. Move the "Equity & Net Proceeds Calculator" section above "Property Snapshot" so it is the first section clients see in the Home tab
2. Improve sale price slider smoothness by debouncing the render call with requestAnimationFrame instead of re-rendering the entire DOM on every oninput event
3. Change loan payoff from a range slider to a number input, defaulting to an amortized balance calculated from CONFIG.loanAmount/interestRate when available (falling back to CONFIG.loanPayoff)

Purpose: Better UX for client-facing dashboards — the net sheet is the most important tool, slider jank hurts credibility, and amortized defaults are more accurate than manually-entered payoff amounts.
Output: Updated template-sell.html and template-buysell.html
</objective>

<execution_context>
@/Users/joshuahogan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/joshuahogan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/template-sell.html
@src/lib/template-buysell.html
@src/lib/loan-estimator.ts (reference for amortization math — inline a simplified version in the template)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move net sheet section up, debounce sliders, convert loan payoff to numInput with amortized default</name>
  <files>src/lib/template-sell.html</files>
  <action>
Three changes to template-sell.html:

**1. Reorder sections in Home tab (lines ~473-515):**
Move the "Equity & Net Proceeds Calculator" section block (lines 475-515, the `eqBody` block and `section('equity', ...)` call) ABOVE the "Property Snapshot" section (line 473, the `section('property', ...)` call). The equity/net proceeds calculator should be the first section rendered in `t1`.

**2. Debounce the sale price slider for smooth interaction:**
The current `slider()` function (line 225-227) uses `oninput="S.key=Number(this.value);render()"` which triggers a full DOM rebuild on every pixel of slider movement, causing jank.

Replace the slider function with a version that:
- Updates the displayed value label immediately (find the `.field-value` span in the same `.field` div and update its textContent) for instant visual feedback
- Debounces the full `render()` call using `requestAnimationFrame` so the DOM only rebuilds once per frame
- Add a module-level `var _raf = 0;` variable for the requestAnimationFrame ID

New slider function:
```javascript
function slider(label,key,min,max,step,prefix,suffix){
  return '<div class="field"><div class="field-label"><span>'+label+'</span><span class="field-value">'+(prefix||'')+S[key].toLocaleString()+(suffix||'')+'</span></div><input type="range" min="'+min+'" max="'+max+'" step="'+(step||1)+'" value="'+S[key]+'" oninput="S.'+key+'=Number(this.value);this.parentNode.querySelector(\'.field-value\').textContent=\''+(prefix||'')+'\'+Number(this.value).toLocaleString()+\''+(suffix||'')+'\';cancelAnimationFrame(_raf);_raf=requestAnimationFrame(render)"></div>';
}
```

Add `var _raf = 0;` near the top of the script section (after the utility functions, before the state).

**3. Change loan payoff from slider to numInput with amortized default:**
On line 484, replace:
```javascript
eqBody += slider('Loan Payoff', 'loanPayoff', 0, Math.round(CONFIG.estimatedSalePrice * 0.9), 5000, '$', '');
```
with:
```javascript
eqBody += numInput('Loan Payoff', 'loanPayoff', 0, Math.round(CONFIG.estimatedSalePrice * 0.9), CONFIG.loanAmount ? 'Estimated from loan records' : '');
```

Also add an amortized balance calculation to the initialization section (after `var S = {...}` and before the dynamic adjustment computation). When CONFIG has loanAmount data, compute the amortized balance and use it as the default instead of CONFIG.loanPayoff:

```javascript
// Amortized balance default: if loan data available, compute current balance
if (CONFIG.loanAmount && CONFIG.loanPayoff) {
  // Use CONFIG.loanPayoff as-is — it was already computed by the loan-estimator
  // during publish. The loanAmount field confirms the data source is tax records
  // rather than a manual estimate, so we trust loanPayoff is the amortized value.
  // No recalculation needed — just ensures the numInput shows the right default.
}
```

Wait — actually CONFIG.loanPayoff is already set to the amortized balance by the publish pipeline when tax records are uploaded (the loan-estimator runs during generate and the result is stored as loan_payoff). So the default is already correct. The key change is just converting from slider to numInput so users can type an exact number. Add the note text "Estimated from loan records" only when CONFIG.loanAmount exists (indicating tax record data was used).
  </action>
  <verify>
    <automated>cd /Users/joshuahogan/Projects/dashboard-generator && grep -c "numInput.*loanPayoff" src/lib/template-sell.html && grep -c "requestAnimationFrame" src/lib/template-sell.html && node -e "const fs=require('fs');const h=fs.readFileSync('src/lib/template-sell.html','utf8');const ei=h.indexOf(\"section('equity'\");const pi=h.indexOf(\"section('property'\");if(ei<pi){console.log('PASS: equity before property')}else{console.log('FAIL: equity not before property');process.exit(1)}"</automated>
  </verify>
  <done>
    - Net sheet calculator is the first section in the Home tab (above Property Snapshot)
    - Sale price slider updates the value label instantly and debounces render() via requestAnimationFrame
    - Loan payoff is a number input (not a slider) with "Estimated from loan records" note when tax data exists
  </done>
</task>

<task type="auto">
  <name>Task 2: Debounce sale price slider in buysell template</name>
  <files>src/lib/template-buysell.html</files>
  <action>
Apply the same slider debounce fix to template-buysell.html:

1. Add `var _raf = 0;` near the top of the script section (after utility functions, before state).

2. Replace the `slider()` function (line 230-231) with the debounced version:
```javascript
function slider(label,key,min,max,step,prefix,suffix){
  return '<div class="field"><div class="field-label"><span>'+label+'</span><span class="field-value">'+(prefix||'')+S[key].toLocaleString()+(suffix||'')+'</span></div><input type="range" min="'+min+'" max="'+max+'" step="'+(step||1)+'" value="'+S[key]+'" oninput="S.'+key+'=Number(this.value);this.parentNode.querySelector(\'.field-value\').textContent=\''+(prefix||'')+'\'+Number(this.value).toLocaleString()+\''+(suffix||'')+'\';cancelAnimationFrame(_raf);_raf=requestAnimationFrame(render)"></div>';
}
```

This affects the Sale Price slider, Broker Fee slider, Seller Closing Costs slider, Purchase Price slider, Down Payment slider, Mortgage Rate slider, and Tax Rate slider — all will get smooth interaction.

Note: The buysell template already uses `numInput` for Loan Payoff (line 647), so no change needed there.
  </action>
  <verify>
    <automated>cd /Users/joshuahogan/Projects/dashboard-generator && grep -c "requestAnimationFrame" src/lib/template-buysell.html && grep -c "_raf" src/lib/template-buysell.html</automated>
  </verify>
  <done>
    - All sliders in buysell template use requestAnimationFrame debouncing
    - Slider value labels update instantly during drag
    - Full render only fires once per animation frame
  </done>
</task>

</tasks>

<verification>
- Open a published sell dashboard and verify the net sheet calculator appears first in the Home tab
- Drag the sale price slider on both sell and buysell dashboards — should be smooth with no visible jank
- Verify loan payoff in sell template shows as a number input field, not a slider
- Verify the net proceeds calculation still works correctly after all changes
</verification>

<success_criteria>
- Net sheet calculator is the topmost section in the sell template Home tab
- Sale price sliders on both templates are smooth during continuous drag
- Loan payoff in sell template is a typeable number input with correct amortized default
- All calculations (net proceeds, equity, commissions) remain mathematically correct
</success_criteria>

<output>
After completion, create `.planning/quick/5-move-up-net-sheet-calculator-improve-sal/5-SUMMARY.md`
</output>
