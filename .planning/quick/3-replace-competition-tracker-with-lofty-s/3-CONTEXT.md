# Quick Task 3: Replace competition tracker with Lofty search link - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Task Boundary

Replace the AI-generated competition tracker section on dashboards with a Lofty search link that agents provide during dashboard creation. The link shows active homes in the client's area.

</domain>

<decisions>
## Implementation Decisions

### Link Input Method
- Add a new "Competition Link" URL field to the dashboard creation wizard, near other property fields
- Agent pastes a Lofty search URL during dashboard creation

### Display Design
- CTA button style: prominent branded button "View Active Homes in Your Area" that opens in new tab
- Section header "YOUR LOCAL COMPETITION" with brief context text above the button
- Clean, simple — no table, no AI-generated listings

### Scope
- Apply to BOTH seller and buyer dashboard types
- Seller: replaces existing competition tracker section
- Buyer: add new competition link section

</decisions>

<specifics>
## Specific Ideas

- Button opens in new tab (target="_blank")
- If no Lofty URL provided, hide the competition section entirely (optional field)
- Lofty is the CRM/IDX platform used by the team

</specifics>
