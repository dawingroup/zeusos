# ZeusOS — Claude Code Project Guide

## What this is

ZeusOS is a hard fork of DawinOS, repurposed as the internal operations platform for **Zeus Group**, an East African marketing consortium (5 sub-brands: Zeus The Agency, Zeus Digital, Labyrinth, Odd Gorilla, House of Zeus). Initial import is a verbatim copy of DawinOS at commit `80364790`; Phases 1–5 strip the construction/manufacturing modules and replace the Design Manager with a marketing-agency-shaped Campaign & Job Manager.

Source of truth for the work plan: `/Users/danielonzimai/.claude/plans/we-have-onboarded-a-lovely-planet.md`.

**Architecture model** (per Addendum v1.1): **shared commercial core + five sibling brands** with overlapping capabilities, plus a conflict firewall (Odd Gorilla) and shared services (Tier System, ECD Approval Ladder). The v1.0 `OrganizationKind = PARENT | SUBSIDIARY` enum is retained — sibling brands stay separate legal entities with their own GL and rate cards, so the inter-co invoicing machinery is unchanged. "Which entity delivers" is now a **routing decision**, not a fixed mapping.

**Reference docs:**
- Tech Spec v1.0 domain model + plan §14: [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md)
- Addendum v1.1 (sibling-brand reconciliation, plan §15): [`docs/ADDENDUM_V1_1.md`](docs/ADDENDUM_V1_1.md)
- Addendum v1.2 (human capital × intelligence layer, plan §16): [`docs/ADDENDUM_V1_2.md`](docs/ADDENDUM_V1_2.md)
- Phase 6 implementation playbook (plan §17): [`docs/PHASE_6_INTELLIGENCE_LAYER.md`](docs/PHASE_6_INTELLIGENCE_LAYER.md)
- Phase 4.1 procurement/finance handshake: [`docs/PHASE_4_1_HANDSHAKE.md`](docs/PHASE_4_1_HANDSHAKE.md)

## Build & Deploy

- **Stack:** Vite + React + TypeScript + Firebase (Firestore, Auth, Functions, Hosting, Storage)
- **Dev server:** `npm run dev` (port 3000)
- **Build:** `npx vite build`
- **Deploy:** `npx firebase deploy --only hosting --project zeusos`
- **Preview channel (staging):** `firebase hosting:channel:deploy preview-staging --project zeusos`

## Firebase

- **Project ID:** `zeusos`
- **Project number:** `746031933844`
- **Web App ID:** `1:746031933844:web:fa40998c6f63e0bed88781`
- **Storage bucket:** `zeusos.firebasestorage.app`
- **Firestore region:** `europe-west1` (Spark / free tier)
- **Production URL:** `https://os.zeustheagency.com` (custom domain — see `docs/CUSTOM_DOMAIN_SETUP.md` for DNS + Auth steps)
- **Default Firebase URL:** `https://zeusos.web.app` (still works — Firebase keeps both alive)
- `.firebaserc` already points at `zeusos`.

`.env` is gitignored and holds the Vite-side Firebase keys (see `.env.example`). The Firebase web API key is **safe to commit** in principle (security is enforced by Firestore Rules + Auth domain restrictions), but we keep it in `.env` per convention. Worktrees need their own `.env`:
```bash
cp /Users/danielonzimai/Developer/zeusos/.env "$PWD/.env"
```

## Branch protection

**Integration branch:** `main`. All PRs target `main`. (`phase-3e-delivery-workspace` was the integration branch earlier in the project — see [PR #11](https://github.com/dawingroup/zeusos/pull/11) — and has since been retired.)

Direct commits to integration branches are blocked by a `pre-commit` hook in `.githooks/pre-commit`. Protected branches: `main`, `master`.

**One-time setup per clone / worktree** (the hook lives in the tree but `core.hooksPath` is a local-only config):
```bash
git config core.hooksPath .githooks
```

**Workflow:** `git switch -c <feature-branch>` → commit → push → `gh pr create`.

**Dev-only auth bypass** (Phase 6.UI.0). For local browser verification of the sidebar / module surfaces without signing in:

```bash
# In .env (gitignored) — never commit, never deploy with this set.
VITE_DEV_BYPASS_AUTH=true
```

Synthesises a parent-org admin DawinUser with access to all 5 sub-brands. Email matches the super-user allow-list in [SubsidiaryDeliveryGuard](src/modules/delivery/components/SubsidiaryDeliveryGuard.tsx), so you can flip between PARENT and SUBSIDIARY views via the org-switcher chip. Gated on `import.meta.env.DEV` — Vite tree-shakes the bypass code path out of production builds. Wired into [`onAuthChange`](src/shared/services/firebase/auth.ts:97) so every `useAuth` hook honours it through one chokepoint.

**Emergency bypass** (use sparingly; explain why in the commit message):
```bash
ALLOW_DIRECT_COMMIT=1 git commit ...
```

To change the list of protected branches, edit the `PROTECTED_BRANCHES` array in `.githooks/pre-commit`.

## Phase status (Phase 4 complete; Phase 5 in flight; Phase 6 planned)

Last refreshed 2026-05-24. The plan in `/Users/danielonzimai/.claude/plans/we-have-onboarded-a-lovely-planet.md` is the source of truth — this is the working dashboard.

- ✅ **Phase 0** — Repo bootstrap, Firebase project (`zeusos`) wired, branch protection (`.githooks/pre-commit`), CI scaffolding
- ✅ **Phase 1.A–1.D** — DawinOS strip: design-manager, finishes, cutlist, inventory, manufacturing, construction, fulfillment, advisory subsidiary, three.js. Branding to Zeus palette.
- 🟡 **Phase 1.E** — `functions/index.js` legacy-exports sweep: 23 confirmed-dead exports removed (advisory, inventory-AI, design-AI, matflow, manufacturing/design triggers, QBO MO triggers). Source files left in place; follow-up sweep needed for `functions/src/tools/*` to unblock `firestore.rules` cleanup of `designProjects` / `designItems` / `materials` / `inventoryItems` / `finishLibrary` / `bom` blocks.
- ✅ **Phase 2** — 5 sub-brands + Zeus Group parent modelled as `OrganizationKind = PARENT | SUBSIDIARY`; module-roles registry; CRM seeded
- ✅ **Phase 3.A.5** — Domain re-model per Tech Spec v1.0 §14 (Commercial Gravity). 11 new top-level Firestore collections: `master_jobs`, `internal_work_orders`, `clients`, `msas`, `sows`, `change_orders`, `rate_cards`, `quotes`, `budget_holds`, `intercompany_invoices`, `client_invoices`, `domain_events`. See [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md).
- ✅ **Phase 3.B** — IWO state machine Cloud Functions in `functions/src/assignment/` (issue/accept/reject/start/postTime/postCost/submit/acceptInternal/requestRevision/close/cancel + handoff packet validation + idempotency keys + outbox)
- ✅ **Phase 3.C** — Pricing engine + Quote builder + RateCard versioning (`functions/src/pricing/`, `src/modules/pricing/`)
- ✅ **Phase 3.D** — Account-Management UI: Clients / MSAs / SOWs / ChangeOrders / MasterJobs / Review Queue / Intake (`src/modules/account-management/`)
- ✅ **Phase 3.E** — Subsidiary Delivery Workspace: IWO Inbox, IWO Workspace, burn meter, RouteToAMButton (`src/modules/delivery/`)
- ✅ **Phase 3.F** — Billing: ClientInvoice (UNIQUE per master_job), InterCompanyInvoice, GL adapter, FX rates (`src/modules/billing/`, `functions/src/billing/`)
- 🟡 **Phase 3.G** — Boundary tests: 40 Firestore-rules tests gating; Playwright lifecycle `continue-on-error: true` pending Phase 3.H test-id backfill across 3.D/3.E pages
- ✅ **Phase 4** — Module surfaces: Media Plans + Buys + Actuals + PCR; Production Kanban + Checklist + Shoot Days + Post Phases; Talent Roster + Contracts + Invoices + Influencers/Models; Asset Library DAM-lite
- ✅ **Phase 4.1** — Procurement ↔ Finance handshake. 4 domain events (`TalentInvoiceApproved`, `MediaSupplierInvoicePaid`, `PurchaseOrderRaised`, `JournalEntryPosted`) + 3 outbox-consumer CFns (`onTalentInvoiceApproved`, `onMediaSupplierInvoicePaid`, `postJournalEntryOnInvoicePaid`) all carry full bodies with idempotency + balance checks. Chart of accounts moved from hardcoded JS to `finance_config/chart_of_accounts` (CFn loader in `functions/src/finance/chartOfAccounts.js`) so finance can amend codes without a deploy; defaults stay compiled-in as a fallback. 21 real test bodies replace earlier doc-only scaffolds (`functions/__tests__/talent`, `__tests__/media`, `__tests__/finance`). See [`docs/PHASE_4_1_HANDSHAKE.md`](docs/PHASE_4_1_HANDSHAKE.md).
- 🟡 **Phase 5.A** — MCP server marketing rebuild (11 tool packs in `zeusos-mcp-server/src/tools/`); read tools live; write callables (`zeusos_create_brief`, `zeusos_advance_master_job_stage`) deferred to 5.A.2
- ❌ **Phase 5.B** — Executive Dashboard rebuild for Zeus (still DawinOS layout)
- ✅ **Phase 5.C** — Asset Library polish (thumbnails + share links + collections)
- 🟡 **Phase 5.D** — Time & Effort Tracking. MVP read surface ships at `/time` (`MyTimeThisWeekPage`): subscribes via collection-group query on `time_entries` (composite index `userId ASC, entryDate DESC` already in `firestore.indexes.json`); groups by IWO; week pager; deep-links to `/delivery/iwo/:id` where the existing posting form lives. Service module at `src/modules/time-tracking/services/time-tracking.service.ts` exports the date-math + grouping helpers (15 unit tests) plus the subscription factory; page has 6 render tests. Manifest gains a "My Time" entry in both PARENT and SUBSIDIARY heads. In-page posting added in a follow-up — `AddTimeEntryDialog` ("+ Add entry" on `/time`) with an IWO picker (select from this week's buckets, free-text fallback) calling `postTimeEntryFn`. Parent-org cross-brand team roll-up added at `/time/team` (`TeamTimePage`, `ParentOrgGuard`): collection-group query on `time_entries` by `entryDate` window (auto-indexed; parent-org reads all), `groupByUser` → per-person totals + IWO/entry counts + week pager. Depth pass added uid→display-name resolution (`user-directory.service.ts` reads `users/{uid}` profile docs with displayName→name→fullName→email→uid precedence; TeamTimePage shows names, not raw uids) + cost roll-up (`UserBucket.totalCostMinor` summed from `costMinor`; TeamTimePage shows per-person + total cost — parent-org-gated, so internal cost stays off the subsidiary surface). **Still out of scope**: brand-scoped team view for subsidiary leads (needs `subsidiaryOrgId` denormalised onto the time-entry doc, or fan-out per role-assignment org graph — both a data-model change).
- ❌ **Phase 5.E** — Client Portal rebrand (`customer-hub` carryover; no Zeus visual identity pass)
- 🟡 **Phase 5.F** — Production launch. Frontend GA4 wiring shipped: `src/shared/services/firebase/analytics.ts` auto-inits when `VITE_FIREBASE_MEASUREMENT_ID` + `VITE_ANALYTICS_ENABLED` are set; `onAuthChange` tags every session with the authenticated UID. Cloud Functions deploy unblocked (PR #104 + PR #105 stripped ~67 DawinOS-legacy exports causing trigger-kind-drift; 102 + 31 us-central1 + 6 europe-west1 drifted funcs deleted to clear the rollout). **Still pending manual Console work:** add `os.zeustheagency.com` to Firebase Hosting custom domains, set the matching DNS records at `zeustheagency.com`'s registrar, and add the domain to Firebase Auth's Authorized Domains list. See [`docs/CUSTOM_DOMAIN_SETUP.md`](docs/CUSTOM_DOMAIN_SETUP.md). Sentry DSN wiring is a separate follow-up.
- ❌ **Phase 5.G** — Onboarding session with Zeus team (gated by 5.F)
- 🟡 **Phase 6.UI.0** — Sidebar manifest + subsidiary-aware ordering. `src/core/navigation/manifest.ts` resolves `(OrganizationKind, SubsidiaryId)` → ordered NavItem list; `src/core/settings/brand-capabilities.ts` mirrors `BRAND_CAPABILITIES` from `functions/src/assignment/services/route-brand.service.js`. AppShell rewired off `resolveNav`; Odd Gorilla shows an "Isolated" badge on the org-switcher chip + a banner on the IWO Inbox. Zeus Group is now a selectable entry in the org-switcher (parent context). `/delivery/burn` swapped from `ComingSoonPage` to the live `BurnAndSlaPage` — cross-IWO burn-meter + SLA countdown roll-up with overheating/on-track filters; 19 component tests. `/reports` now serves `IwoHealthPage` (parent-org) — portfolio summary tiles (active, overheating, avg burn) + brand-grouped IWO health with the same overheating-first sort; 16 tests. Reports lives in `NAV_MANIFEST_PARENT`; subsidiary tail keeps Burn & SLA as the per-brand counterpart. `/delivery/active` retired in the close-out — IWOInboxPage's second section already showed in-flight IWOs, so the standalone route was duplicating the same data; route redirects to `/delivery/inbox`, manifest `active-work` head entry dropped. **All Phase 6.UI placeholders are now live or retired.**
- 🟡 **Phase 6.UI.A** — Role Profile + Role Assignment admin (PR 6). 5 new parent-org callables (`createRoleProfile`, `updateRoleProfile`, `archiveRoleProfile`, `assignEmployeeToRole`, `endRoleAssignment`) in `functions/src/hr-central/role-profiles.js`. `src/modules/hr-central/role-profiles/` adds `RoleProfilesListPage`, `RoleProfileDetailPage`, `RoleAssignmentsListPage`, `RoleProfileForm` (with the v1.2 verb-matrix UI + approval-authority list), and `RoleAssignmentDialog`. Routes: `/hr/role-profiles`, `/hr/role-profiles/:id`, `/hr/role-assignments`. 10 backend tests + 5 frontend tests.
- 🟡 **Phase 6.UI.B** — Traffic surface (PR 2). `src/modules/traffic/` with `TrafficLayout` tabbed shell (Routing Queue · Active IWOs · Brand Capacity · Override Log). RoutingQueuePage subscribes to OPEN/unallocated master_jobs, calls the existing `routeBrand` callable (6.B), and renders `RouteBrandProposalCard` with tier badge + SLA countdown + KE-geography badge + candidate breakdown. Confirm hands off to the AM-side `IssueIWODialog` via a URL hash; Override opens a brand picker before the same hand-off. Active IWOs groups in-flight IWOs by brand with burn %. Brand Capacity reads `engine_config.brandCapacityThreshold`. Override Log lists `RoutingBrandProposed` events. Routes wrapped in `ParentOrgGuard`. 8 component tests passing.
- ✅ **Phase 6.A.1** — Human Capital Model foundation (#60): `role_profiles` + `role_assignments` + `EmployeeAssignmentService` skeleton with the `role` rule type on `hr-central`. Foundation for brand routing (v1.1 C2) and the verb-matrix ECD ladder (v1.1 C5). See [`docs/PHASE_6_INTELLIGENCE_LAYER.md`](docs/PHASE_6_INTELLIGENCE_LAYER.md).
- ✅ **Phase 6.A.2** — Five rule types + Tier-SLA engine config (#66): `department`, `user`, `manager`, `creator`, `dynamic` resolvers + `TierSlaPolicy` + `EngineConfig` types + Tier-aware capacity check. Closes v1.1 C4.
- ✅ **Phase 6.B** — Brand Routing in IWO issuance (#64): `routeBrand()` callable proposes a serving brand; Traffic confirms / overrides; `tier` propagates engagement → master_job → IWO with `slaDueAt` computed at issue. Closes v1.1 C2.
- ❌ **Phase 6.E** — Event/Task Engine: `EventDefinition.tasks[]` → `generatedTasks` → uniform inbox; agency event families (`campaign.*` / `iwo.*` / `creative.*` / `media.*` / `financial.*` / `hr.*`). Closes v1.2 subsystem B.
- ❌ **Phase 6.F** — Agent Network: `agents` + `agent_audit_entries` + dispatcher with 4 gates + MCP/agent registry unification; ZA-002 + ZA-003 in `draft_only` (ship early); ZA-001 + ZA-004 + ZA-006 in `gated` **only after §15.5 commercial questions resolved** (now ADR-2026-05-25). Closes v1.2 subsystem C.
- 🟡 **ADR-2026-05-25** — Commercial model: §15.5 resolutions. See [`docs/ADR-2026-05-25-commercial-model.md`](docs/ADR-2026-05-25-commercial-model.md). Separate legal entities (Q1) · brand-direct sales with `primaryBrandId` precedence (Q2 — reverses the "subsidiary never quotes" invariant) · cost-plus IC markup (Q3) · named-competitor list per client (Q4 — **retires the original 6.C category-based conflict-firewall and 6.D PRs #78 + #83 — both closed**). Reshape plan: 6 ordered steps; mutating agents stay `draft_only` until steps 1–5 land.
- 🟡 **ADR Step 2+3 (additive setup)** — `clients.primaryBrandId: SubsidiaryId` schema + create-form picker; `organizations.icMarkupPct` + `engine_config.icMarkupPctDefault` schemas; `resolveIcMarkupPct` helper (backend + frontend mirror) reads org override → engine_config → 15% default; `IssueIWODialog` auto-prefills `transferPriceMinor = budgetMinor × (1 + markupPct/100)`; `appliedMarkupPct` frozen on each `intercompany_invoices/{id}` doc for audit. 11 backend tests + 7 frontend tests.
- 🟡 **ADR Step 1 (conflict firewall rewrite — supersedes original 6.C)** — named-competitor model per ADR §2.Q4. New `client_competitors/{clientId__competitorClientId}` collection + 2 admin callables (`addClientCompetitor` / `removeClientCompetitor`) gated on parent-org. `excludeConflicted` queries the requesting client's competitor list, walks each candidate brand's OPEN IWOs → master_job → clientId, excludes brands serving any listed competitor. Emits `ConflictExclusivityRisk` with `{ requestedClientId, listedCompetitorIds, walledBrandIds, walledCompetitorByBrand, masterJobId }`. `CompetitorListPanel` mounts on `ClientDetailPage`; `BreachRisksPage` at `/conflict-firewall/breach-risks` consumes the event feed. Categories survive as reporting overlay only — no longer drive routing. 12 backend tests + 5 frontend tests.
- 🟡 **ADR Step 4.1 (rules layer relax)** — `canActOnClient(clientId)` helper added to `firestore.rules`. The `msas` / `sows` / `change_orders` / `quotes` / `master_jobs` / `client_invoices` collections now accept reads from PARENT principals OR the SUBSIDIARY whose `homeOrgId == clients/{clientId}.primaryBrandId`. Writes remain CFn-only. Backward-compatible: clients without `primaryBrandId` (pre-ADR) still gate to parent-org. 8 new rules tests + fixture updates. Steps 4.2 (CFn) and 4.3 (UI) ship on top.
- 🟡 **ADR Step 4.2 (functions layer relax)** — Two new helpers in `functions/src/assignment/lib/auth.js`: `assertCommercialPrincipal(auth, clientId)` for callables that take a clientId arg, and `assertCommercialPrincipalForResource(auth, ref)` for callables that resolve clientId from an existing doc (preserves §7.4 "don't leak existence to unauthorized callers" via parent-first → resource → brand-direct ordering). Wired into `clientAdmin.upsertClient` (edit), `msaAdmin.upsertMsa` + `activateMsa`, all of `sowAdmin` (upsert / submit / approve / cancel), and all of `changeOrderAdmin` (upsert / approve / reject). Create paths stay parent-org until the corresponding UI flow opens up. 10 new brand-direct tests + 7 existing 403 tests still pass.
- 🟡 **ADR Step 4.3 + Step 5 (UI layer relax + SUBSIDIARY_SELLING manifest)** — New `BrandAccessGuard` reads the URL's `clientId` (or resolves it via `master_jobs.clientId` etc.) and accepts PARENT principals OR the home brand AD. Per-client commercial routes (`/clients/:clientId`, nested MSA/SOW/CO/quote editors, `/master-jobs/:masterJobId`) swap from `AMAccessGuard` to `BrandAccessGuard`. Manifest gains a `SUBSIDIARY_SELLING` org-kind variant: same head + middle + tail as `SUBSIDIARY` plus a commercial trio (My Clients · Pricing & Quotes · Billing & Inter-Co) inserted before the universal tail. `AppShell` resolves three org-kinds — PARENT (zeus-group + parent-org admin), SUBSIDIARY_SELLING (brand AD on their own brand OR parent-org admin viewing a brand), SUBSIDIARY (plain delivery user). 4 new manifest tests + the existing 18 still pass.

**Open decisions** (plan §12 + §15.5):
- QuickBooks Online — open item #3, decision pending. Currently disabled via empty env in `functions/.env.zeusos`.
- Notion, Meta, Google Drive integrations — same: disabled until enabled per plan §3.
- **Phase 6.F hard gate (plan §15.5 + §17.2)** — ZA-001 / ZA-004 / ZA-006 (mutating agents) may NOT ship until these four are resolved and recorded as an ADR in `docs/`:
  1. Are the five brands separate legal entities (real inter-co invoicing) or trading names (internal cost allocation)?
  2. Who holds the commercial relationship — group-level AM only, or do brands also sell direct?
  3. Transfer pricing policy: cost, cost-plus, or market?
  4. Category-exclusivity granularity: category, sub-category, or named-competitor list?

**Known broken / stale**:
- `functions/index.js` had ~325 exports, ~23 of which were DawinOS-legacy with **no live callers** (advisory triggers, inventory-AI handlers, design-manager AI, matflow handlers, manufacturing/design Firestore triggers, QBO manufacturing triggers). Removed in Phase 1.E sweep. PR #48 had earlier removed the `projectCaseStudyShopifySync` trigger (broke prod deploys via trigger-kind change). **Source files left in place** (e.g. `functions/src/{advisory,matflow}/`, `functions/src/ai/{materialPricingAI,designChat,enhanceInventoryItem,...}.js`) — only the `index.js` exports were removed; deleting the source dirs is a follow-up. **Adobe (~13 exports) and Shopify exports are LIVE** — `AdobePdfTest.tsx` and SettingsPage call them; do not remove.
- **Tools registry cleaned** (done): the three pure-DawinOS tool modules (`designTools`/`manufacturingTools`/`inventoryTools`) were stripped from `functions/src/tools/index.js` and deleted; `mergeInventoryDuplicates` + `generateDesignManagerEvents{,HTTP}` + `processPendingEvents` exports removed. The three *mixed-usage* modules were re-pointed at ZeusOS collections: `crmTools.get_customer_360` keeps customers + crm_deals only; `financeTools.get_financial_summary` reads `client_invoices` + `purchase_orders` + crm_deals (and `get_project_costing` removed); `crossModuleTools` kept `customer_project_summary` / `supplier_spend_analysis` / `pipeline_revenue_forecast` and dropped the three manufacturing query types. `backfillMaterialFields` (last `materials` reader) removed. **No tool references the 6 DawinOS collections any more.**
- **firestore.rules DawinOS blocks dropped** (done): the `materials` (top-level + customer/project nested), `inventoryItems`, `finishLibrary`, `designProjects` (+ all nested designItems/materials/projectParts/deliverables/etc.), `bom`, and `bomEntries` match blocks were removed. Prerequisite was clearing the **frontend** readers (Admin-SDK CFn readers bypass rules, so they never gated it): the Phase 1.E intelligence-layer strip removed the dead NL-query intents (`queryInventory`/`queryDesignProjects` in `naturalLanguageQueryService`) + the DawinOS RAG indexers (`indexProducts/Clips/Features/Parts/InventoryItems` + `reindexAll` + `searchInventoryBySimilarity` in `semanticSearchService`), and deleted the orphan `similarItemService.ts` + unrouted `ShopifySyncPage.tsx`. A follow-up pass then dropped the DawinOS **manufacturing + inventory-adjacent** blocks (all 0 frontend reads, no boundary-test coverage): `manufacturingOrders` ×3 (the MES had duplicate/legacy blocks) + nested steps/materialConsumptions/stageTransitions/quality_events, `workstations`, `inventoryCategories`, `inventoryIssues`, `stock_adjustments`, `inventoryAgentInstructions`, `inventoryAuditResults`, `finishAttributeDefinitions`, `productVariants` (+ nested stockTransactions/reservations). Kept: `creditUsage` (AI-credit tracking) + `offcuts` (live via OffcutProvider). A further MES-rules pass then dropped `routing_templates`, `productionReports`, `part_identifications`, and the Design Studio blocks (`productDefinitions`, `designKnowledgeBase`, `manufacturingDataPackages`, `projectPDFs`, `configuratorAnalytics`) — all 0 frontend reads. The same PR pruned 8 dead `SEARCH_CONFIGS` entries (`navigation.constants.ts`: capital_application/facility, inventory_item, finish_library, sales_order, manufacturing_order, design_project, construction_order) so the global-search index stops attempting permission-denied reads. **KEPT (still have live readers/writers)**: camelCase `purchaseOrders` (read by `QBOSyncDashboardPage` + `BillsPage` finance pages) and camelCase `crmDeals` (write-path in `partyMergeService`) — both rule blocks + their `purchase_order`/`crm_deal` search-config entries left in place. Their cleanup waits on retiring those last DawinOS-shaped finance/merge readers.
- `ci.yml` still runs `lint || true` (line ~70) — ESLint stays advisory until the inherited 49k-problem backlog is paid down. `typecheck` is now gating (PR #46).

## Conventions

- Feature modules live in `src/modules/<module-name>/`
- Cloud Functions live in `functions/src/<context>/` (assignment, billing, contracts, pricing, asset-library, talent, media, finance, …)
- Subsidiary scoping via `SubsidiaryAccess` on each user. Canonical IDs (single source of truth in [src/core/settings/types.ts](src/core/settings/types.ts)): `zeus-group` (parent), `zeus-the-agency`, `zeus-digital`, `labyrinth`, `odd-gorilla`, `house-of-zeus`.
- Each `organizations/{orgId}` doc carries `kind: 'PARENT' \| 'SUBSIDIARY'`, `is_legal_entity`, `base_currency`, `gl_connection_id`. The Commercial Gravity invariant ("subsidiary never quotes") is enforced at three layers: `RoleGuard requireOrgKind="PARENT"` in the UI ([src/router/guards/ParentOrgGuard.tsx](src/router/guards/ParentOrgGuard.tsx)), Cloud Function `assertParentOrgPrincipal` helpers, and `firestore.rules` `isParentOrgPrincipal()`.
- Engagement-level collection is `master_jobs` (not `campaigns`). The marketing-facing `Campaign` interface composes onto `master_job.campaign` — see [`src/modules/campaigns/types/campaign.types.ts`](src/modules/campaigns/types/campaign.types.ts).
- MCP server: `zeusos-mcp-server/` (bundled into `functions/vendor/zeusos-mcp-server/` at deploy time by the `functions` predeploy script in `firebase.json`).
- Outbox: every state-changing Cloud Function appends to `domain_events/{eventId}` via `appendDomainEvent` in `functions/src/platform/outbox.js`. **17 event types live** (11 Tech Spec v1.0 + 4 Phase 4.1 procurement/finance + 2 from Phase 5.A scaffolding); **9 more planned** for Phase 6 (3 from v1.1 ECD ladder, 6 from v1.2 intelligence layer — see [`docs/ADDENDUM_V1_1.md`](docs/ADDENDUM_V1_1.md) §7.2 and [`docs/ADDENDUM_V1_2.md`](docs/ADDENDUM_V1_2.md) §6.1). Canonical list in [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md).
- **Capability-is-data principle** (v1.0 §4.1 + v1.2 §6.3): authority is data that is checked, never code that is trusted. For humans, the `taskCapabilities` verb matrix is the grant; for agents (Phase 6.F), `enabledTools[]` is the grant. Neither widens except by an explicit, audited admin action.

## Module surface (current)

Active `src/modules/`:

| Domain | Modules |
|---|---|
| Commercial — shared core (parent-org only) | `account-management`, `contracts`, `pricing`, `assignment`, `billing`, `intercompany`, `traffic` |
| Delivery — per sibling brand (routed) | `delivery`, `media`, `production`, `talent`, `asset-library`, `campaigns` |
| Operations | `crm`, `procurement`, `suppliers`, `finance`, `hr-central`, `hr`, `strategy`, `compliance`, `admin` |
| Platform / Intelligence | `platform` (outbox + idempotency), `shared-ops`, `intelligence`, `intelligence-layer`, `market-intelligence` (the two `intelligence*` modules **must be merged or formally bounded** in Phase 6.F.6) |
| Removed in this fork | `capital` (PR #47 — plan §4.1 closed; Zeus isn't an investment vehicle), `design-manager`, `inventory`, `manufacturing`, `construction`, `cutlist-processor`, `finishes`, `fulfillment`, `advisory subsidiary` |

The Phase 1 strip is **done in `src/`** but `functions/index.js` still carries the DawinOS-legacy exports (Shopify / matflow / Adobe / inventory triggers / design-manager triggers / QBO / Notion / Meta WhatsApp). Those run on every cold-start until task `#1b` lands.

Removed (do not recreate):
- `src/modules/design-manager/`, `src/subsidiaries/finishes/`, `src/modules/cutlist-processor/`, `src/modules/inventory/`, `src/modules/manufacturing/`, `src/modules/construction/`, `src/modules/fulfillment/`
- `src/subsidiaries/advisory/` (PR #20 — Zeus is not an advisory firm)
- All three.js / camera-controls / three-mesh-bvh
- DawinOS `dawinos-mcp-server/` (renamed and rebuilt as `zeusos-mcp-server/` in Phase 5.A)
