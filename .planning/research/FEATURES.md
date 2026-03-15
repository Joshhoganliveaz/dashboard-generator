# Feature Landscape

**Domain:** Real estate client dashboard platform with admin wizard, persistent dashboards, and publish-to-URL
**Researched:** 2026-03-15
**Overall confidence:** HIGH (well-scoped internal tool with clear existing codebase)

## Table Stakes

Features the 3-agent team expects from day one. Missing any of these means agents fall back to the current no-persistence workflow.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-step admin wizard** | Agents need guided input flow, not a single overwhelming form. Current page.tsx is 822 lines of monolithic form. Steps: type -> client info -> property/market data -> review -> publish. | Medium | 6 steps per PROJECT.md. Keep under 10 steps (wizard best practice). Progress indicator required. |
| **Dashboard persistence (Supabase)** | The #1 pain point: dashboards currently vanish after browser close. Must save all config data, generation state, and dashboard metadata to Supabase. | High | Tables: dashboards, sell_data, buy_data, properties_of_interest. RLS for team CRUD + public SELECT on published. |
| **Dashboard library / home screen** | Agents need to see all their dashboards at a glance -- cards with client name, type, status, last updated. Currently there is zero history. | Medium | Filtering by status (draft/published/archived) and type (sell/buyer/buysell). Sort by recency. Search by client name. |
| **Draft / Published / Archived status** | Standard CMS lifecycle. Agents need to save incomplete work (draft), go live (published), and clean up old ones (archived). | Low | Three states with clear transitions: draft->published, published->archived, archived->draft. Archived removes from R2. |
| **Publish to permanent URL** | Clients expect a link they can bookmark and revisit. Agents currently download HTML and email it -- fragile and un-updatable. | Medium | Render HTML from DB config -> upload to Cloudflare R2 -> serve at /d/{slug}. Slug locked after first publish. |
| **Update-in-place (re-publish)** | Agents frequently need to fix a typo, update a comp, or refresh market data. Currently must regenerate from scratch. | Medium | Re-enter wizard at any step, edit data, re-publish to same URL. Same slug, new content. Client sees latest version. |
| **All 3 dashboard types** | Team needs sell + buyer + buy/sell before switching workflows. Per PROJECT.md this is a v1 requirement. | High | Sell is most mature. Buyer content generation (neighborhoods, schools, market snapshot) needs Claude + structured output. Buy/sell links both sell_data and buy_data to one dashboard. |
| **PDF extraction with editable review** | Agents upload MLS PDFs and tax records. Claude extracts data. Agents must be able to review and correct before generation proceeds. | Low | Already exists as comp review panel. Extend to all extracted fields (not just comps). Show extracted values in editable form fields. |
| **Comp review panel** | Human-in-the-loop for comparable sales selection is validated and essential. Agents remove bad comps, reorder, verify adjustments. | Low | Already exists and works. Preserve current UX. Just wire to new wizard step. |
| **SSE progress streaming** | Generation takes 30-90 seconds. Without progress feedback agents assume it is broken. | Low | Already exists. Preserve current step names and streaming protocol. |
| **HTML export / download** | Some agents want a local copy to email or print. Not every client interaction needs a URL. | Low | Already exists. Same render pipeline produces both R2 upload and downloadable file. |
| **Supabase Auth (team login)** | Replaces insecure static cookie auth. Agents log in with email/password. Josh provisions accounts. | Low | Email/password auth. No self-serve signup. No social login. Just 3 users. |
| **Natural language edit flow** | Agents type "change the header to say..." and Claude modifies the config. Already validated and loved by the team. | Low | Already exists. Extract config -> Claude edit -> re-inject -> re-publish. |

## Differentiators

Features that make this platform notably better than Cloud CMA, Compass One, or manual HTML delivery. Not expected, but create real competitive advantage for a small team.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI-powered content generation** | Claude writes SB7-framed narrative content, neighborhood insights, and market analysis. No other small-team CMA tool does this. | Already built | The 46K-line prompt library is the core IP. Preserve and improve, do not rebuild. |
| **Slug auto-generation with collision handling** | Clean, memorable URLs like /d/smith-family-1234-e-oak-st instead of UUIDs. Professional touch that agents share with pride. | Low | Generate from client name + street address. Check for collisions. Lock after first publish. |
| **Properties of interest CRUD** | Buyer dashboards can include flagged homes with agent notes (why this home, what to know). Compass One does something similar but requires their ecosystem. | Medium | Separate table linked to dashboard. Add/remove/reorder in wizard. Agent notes per property. Display on buyer/buysell dashboards. |
| **Deterministic comp scoring** | The CSV engine scores comps with transparent, adjustable criteria -- not a black box. Agents understand and trust the selections. | Already built | GLA, bath, pool adjustments with clear formulas. Preserve deterministic approach. |
| **Loan estimator with historical rates** | Estimates current mortgage balance from tax records using Freddie Mac PMMS historical data. No manual entry needed in most cases. | Already built | Amortization math + rate lookup. Refinance chain classification. Display equity estimates. |
| **Dashboard versioning / generation history** | Track when a dashboard was generated, re-generated, edited. Useful for compliance and "what did we send the client last month?" | Low | Timestamp log per dashboard. Store previous configs (or at minimum, last-published config). Not full version control. |

## Anti-Features

Features to deliberately NOT build. Each one has been considered and rejected for clear reasons.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Client login / authentication** | Clients do not log in. Dashboards are public URLs shared by the agent. Adding auth creates friction with zero value for 20-50 dashboards. | Public URLs. Security through obscurity (slug is hard to guess). No sensitive financial data exposed -- just market analysis. |
| **Real-time collaboration** | 3 agents, each working on their own clients. Concurrent editing would add massive complexity (CRDTs, conflict resolution) for near-zero benefit. | Single agent edits at a time. If someone else has it open, they see stale data until refresh. |
| **Batch / bulk generation** | 20-50 active dashboards. Nobody needs to generate 50 at once. Batch mode adds queue management, error handling complexity. | One-at-a-time generation. The wizard flow is inherently single-dashboard. |
| **Mobile app** | Agents create dashboards at their desk, not on their phone. Clients view dashboards on mobile via responsive HTML (already works). | Responsive admin UI for tablet-sized screens at most. Mobile client dashboard viewing is already handled by template CSS. |
| **Self-serve team account creation** | 3 users. Josh provisions in Supabase. An onboarding flow would be over-engineered. | Josh adds users manually via Supabase dashboard or a simple admin SQL call. |
| **Cromford screenshot extraction** | Rarely used by the team. Complex OCR-like pipeline for marginal value. | Defer to v2+. If needed, agent can manually enter the 2-3 relevant Cromford metrics. |
| **Template editor / custom templates** | The 3 HTML templates are validated, branded, and working. A visual editor would be an enormous undertaking (think: Webflow) with no ROI for 3 templates. | Templates stay as HTML files in the codebase. Design changes go through a developer. |
| **Notification system (email/SMS to clients)** | Agents handle client communication through their existing channels (phone, email, text). An in-app notification system adds complexity without fitting the workflow. | Agent copies the dashboard URL and sends it however they normally communicate with clients. |
| **Analytics / view tracking on client dashboards** | Tempting to know "did the client open it?" but adds tracking scripts, privacy concerns, and complexity for minimal actionable insight. | If ever needed, use a simple Cloudflare Analytics rule on /d/* paths. Do not build custom tracking. |
| **Scheduling / auto-publish** | No use case for "publish this dashboard at 9am Tuesday." Agents publish when the dashboard is ready. | Immediate publish only. |

## Feature Dependencies

```
Supabase Auth ─────────────────────────> All authenticated features
  │
  v
Dashboard Persistence (Supabase) ─────> Dashboard Library
  │                                       │
  │                                       v
  │                                     Filtering / Search
  │
  ├─────────────────────────────────────> Draft/Published/Archived Status
  │                                       │
  │                                       v
  ├─────> Publish to URL (R2) ──────────> Update-in-Place (re-publish)
  │         │                               │
  │         v                               v
  │       Slug Generation ──────────────> Slug Locking (after first publish)
  │
  ├─────> Admin Wizard ─────────────────> All wizard steps
  │         │
  │         ├── Step 1: Dashboard Type
  │         ├── Step 2: Client Info
  │         ├── Step 3: Property/Market Data (file uploads, PDF extraction)
  │         ├── Step 4: Comp Review (sell/buysell only)
  │         ├── Step 5: Content Review/Edit
  │         └── Step 6: Publish
  │
  ├─────> Sell Dashboard Type ──────────> (most mature, build first)
  ├─────> Buyer Dashboard Type ─────────> Properties of Interest CRUD
  └─────> Buy/Sell Dashboard Type ──────> Requires both Sell + Buyer working

Properties of Interest CRUD ────────────> Buyer and Buy/Sell dashboards
```

## MVP Recommendation

**Prioritize (Phase 1 -- Foundation):**
1. Supabase Auth (replaces insecure cookie auth, gates everything else)
2. Dashboard persistence with Supabase tables
3. Dashboard library home screen with status filtering
4. Draft/Published/Archived lifecycle

**Prioritize (Phase 2 -- Admin Wizard + Publish):**
5. Multi-step admin wizard (refactor existing form into steps)
6. Sell dashboard generation through wizard (most mature type)
7. Publish to R2 with slug generation
8. Update-in-place re-publish flow

**Prioritize (Phase 3 -- Full Dashboard Types):**
9. Buyer dashboard generation with content improvements
10. Buy/sell combined dashboard support
11. Properties of interest CRUD

**Defer:**
- Dashboard versioning/history: Nice-to-have, not blocking any workflow. Add after core flow is solid.
- Cromford extraction: Team rarely uses it. Manual entry covers edge cases.
- Template visual editor: Zero ROI for a 3-person team with 3 templates.

## Sources

- [Compass One client dashboard launch](https://investors.compass.com/news/news-details/2025/Compass-Launches-Compass-One-The-Industrys-First-Ever-All-in-One-Client-Dashboard-Connecting-Compass-Agents-to-Their-Clients-In-Real-Time/default.aspx) -- Compass's approach to agent-client dashboard transparency
- [Cloud CMA by Lone Wolf](https://www.lwolf.com/engage/cma) -- Industry-standard CMA report generation tool
- [Multi-step form best practices](https://www.webstacks.com/blog/multi-step-form) -- Wizard UX patterns (progress bar, under 10 steps, back/forward navigation)
- [Andrew Coyle - How to Design a Form Wizard](https://www.andrewcoyle.com/blog/how-to-design-a-form-wizard) -- When wizards work well vs when they do not
- [Drupal Editorial Workflow](https://www.drupal.org/docs/8/core/modules/workflows/overview) -- Draft/Published/Archived content lifecycle patterns
- [CMA report features clients expect](https://theclose.com/best-cma-software-for-realtors/) -- Table stakes for CMA report platforms
- Existing codebase analysis: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`
- Project requirements: `.planning/PROJECT.md`
