# ZeusOS — Claude Code Project Guide

## What this is

ZeusOS is a hard fork of DawinOS, repurposed as the internal operations platform for **Zeus Group**, an East African marketing consortium (5 sub-brands: Zeus The Agency, Zeus Digital, Labyrinth, Odd Gorilla, House of Zeus). Initial import is a verbatim copy of DawinOS at commit `80364790`; Phases 1–5 strip the construction/manufacturing modules and replace the Design Manager with a marketing-agency-shaped Campaign & Job Manager.

Source of truth for the work plan: `/Users/danielonzimai/.claude/plans/we-have-onboarded-a-lovely-planet.md`.

Domain model overview (Tech Spec v1.0 + plan §14): [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md).

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

## Phase status (Phase 4 complete; Phase 5 in flight)

Last refreshed 2026-05-23. The plan in `/Users/danielonzimai/.claude/plans/we-have-onboarded-a-lovely-planet.md` is the source of truth — this is the working dashboard.

- ✅ **Phase 0** — Repo bootstrap, Firebase project (`zeusos`) wired, branch protection (`.githooks/pre-commit`), CI scaffolding
- ✅ **Phase 1.A–1.D** — DawinOS strip: design-manager, finishes, cutlist, inventory, manufacturing, construction, fulfillment, advisory subsidiary, three.js. Branding to Zeus palette. (Phase 1.E — strip the matching `functions/` exports — is in flight, see PR #42.)
- ✅ **Phase 2** — 5 sub-brands + Zeus Group parent modelled as `OrganizationKind = PARENT | SUBSIDIARY`; module-roles registry; CRM seeded
- ✅ **Phase 3.A.5** — Domain re-model per Tech Spec v1.0 §14 (Commercial Gravity). 11 new top-level Firestore collections: `master_jobs`, `internal_work_orders`, `clients`, `msas`, `sows`, `change_orders`, `rate_cards`, `quotes`, `budget_holds`, `intercompany_invoices`, `client_invoices`, `domain_events`. See [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md).
- ✅ **Phase 3.B** — IWO state machine Cloud Functions in `functions/src/assignment/` (issue/accept/reject/start/postTime/postCost/submit/acceptInternal/requestRevision/close/cancel + handoff packet validation + idempotency keys + outbox)
- ✅ **Phase 3.C** — Pricing engine + Quote builder + RateCard versioning (`functions/src/pricing/`, `src/modules/pricing/`)
- ✅ **Phase 3.D** — Account-Management UI: Clients / MSAs / SOWs / ChangeOrders / MasterJobs / Review Queue / Intake (`src/modules/account-management/`)
- ✅ **Phase 3.E** — Subsidiary Delivery Workspace: IWO Inbox, IWO Workspace, burn meter, RouteToAMButton (`src/modules/delivery/`)
- ✅ **Phase 3.F** — Billing: ClientInvoice (UNIQUE per master_job), InterCompanyInvoice, GL adapter, FX rates (`src/modules/billing/`, `functions/src/billing/`)
- 🟡 **Phase 3.G** — Boundary tests: 40 Firestore-rules tests gating; Playwright lifecycle `continue-on-error: true` pending Phase 3.H test-id backfill across 3.D/3.E pages
- ✅ **Phase 4** — Module surfaces: Media Plans + Buys + Actuals + PCR; Production Kanban + Checklist + Shoot Days + Post Phases; Talent Roster + Contracts + Invoices + Influencers/Models; Asset Library DAM-lite
- 🟡 **Phase 4.1** — Procurement ↔ Finance handshake: 4 new domain events + 3 outbox-consumer CFns wired; talent body still SCAFFOLD; chart-of-accounts JSON pending. See [`docs/PHASE_4_1_HANDSHAKE.md`](docs/PHASE_4_1_HANDSHAKE.md).
- 🟡 **Phase 5.A** — MCP server marketing rebuild (11 tool packs in `zeusos-mcp-server/src/tools/`); read tools live; write callables (`zeusos_create_brief`, `zeusos_advance_master_job_stage`) deferred to 5.A.2
- ❌ **Phase 5.B** — Executive Dashboard rebuild for Zeus (still DawinOS layout)
- ✅ **Phase 5.C** — Asset Library polish (thumbnails + share links + collections)
- ❌ **Phase 5.D** — Time & Effort Tracking module (`src/modules/time-tracking/` not yet created)
- ❌ **Phase 5.E** — Client Portal rebrand (`customer-hub` carryover; no Zeus visual identity pass)
- ❌ **Phase 5.F** — Production launch + custom domain DNS active + GA/PostHog (DNS for `os.zeustheagency.com` not yet verified — deploy health-check still hits `zeusos.web.app`)
- ❌ **Phase 5.G** — Onboarding session with Zeus team (gated by 5.F)
- 🟡 **Phase 6.UI.0** — Sidebar manifest + subsidiary-aware ordering. `src/core/navigation/manifest.ts` resolves `(OrganizationKind, SubsidiaryId)` → ordered NavItem list; `src/core/settings/brand-capabilities.ts` mirrors `BRAND_CAPABILITIES` from `functions/src/assignment/services/route-brand.service.js`. AppShell rewired off `resolveNav`; Odd Gorilla shows an "Isolated" badge on the org-switcher chip + a banner on the IWO Inbox. Zeus Group is now a selectable entry in the org-switcher (parent context). Placeholder routes (`/conflict-firewall/*`, `/delivery/ecd-review`, `/delivery/active`, `/delivery/burn`, `/reports`, `/hr/role-profiles`, `/hr/role-assignments`) wired via `ComingSoonPage` so manifest items don't 404 between PRs. PRs 3–6 (Conflict Firewall, ECD Review, CES, Role Profiles) still pending.
- 🟡 **Phase 6.UI.A** — Role Profile + Role Assignment admin (PR 6). 5 new parent-org callables (`createRoleProfile`, `updateRoleProfile`, `archiveRoleProfile`, `assignEmployeeToRole`, `endRoleAssignment`) in `functions/src/hr-central/role-profiles.js`. `src/modules/hr-central/role-profiles/` adds `RoleProfilesListPage`, `RoleProfileDetailPage`, `RoleAssignmentsListPage`, `RoleProfileForm` (with the v1.2 verb-matrix UI + approval-authority list), and `RoleAssignmentDialog`. Routes: `/hr/role-profiles`, `/hr/role-profiles/:id`, `/hr/role-assignments`. 10 backend tests + 5 frontend tests.
- 🟡 **Phase 6.UI.B** — Traffic surface (PR 2). `src/modules/traffic/` with `TrafficLayout` tabbed shell (Routing Queue · Active IWOs · Brand Capacity · Override Log). RoutingQueuePage subscribes to OPEN/unallocated master_jobs, calls the existing `routeBrand` callable (6.B), and renders `RouteBrandProposalCard` with tier badge + SLA countdown + KE-geography badge + candidate breakdown. Confirm hands off to the AM-side `IssueIWODialog` via a URL hash; Override opens a brand picker before the same hand-off. Active IWOs groups in-flight IWOs by brand with burn %. Brand Capacity reads `engine_config.brandCapacityThreshold`. Override Log lists `RoutingBrandProposed` events. Routes wrapped in `ParentOrgGuard`. 8 component tests passing.
- 🟡 **ADR Step 4.1 (rules layer relax)** — `canActOnClient(clientId)` helper added to `firestore.rules`. The `msas` / `sows` / `change_orders` / `quotes` / `master_jobs` / `client_invoices` collections now accept reads from PARENT principals OR the SUBSIDIARY whose `homeOrgId == clients/{clientId}.primaryBrandId`. Writes remain CFn-only. Backward-compatible: clients without `primaryBrandId` (pre-ADR) still gate to parent-org. 8 new rules tests + fixture updates. Steps 4.2 (CFn) and 4.3 (UI) ship on top.
- 🟡 **ADR Step 4.2 (functions layer relax)** — Two new helpers in `functions/src/assignment/lib/auth.js`: `assertCommercialPrincipal(auth, clientId)` for callables that take a clientId arg, and `assertCommercialPrincipalForResource(auth, ref)` for callables that resolve clientId from an existing doc (preserves §7.4 "don't leak existence to unauthorized callers" via parent-first → resource → brand-direct ordering). Wired into `clientAdmin.upsertClient` (edit), `msaAdmin.upsertMsa` + `activateMsa`, all of `sowAdmin` (upsert / submit / approve / cancel), and all of `changeOrderAdmin` (upsert / approve / reject). Create paths stay parent-org until the corresponding UI flow opens up. 10 new brand-direct tests + 7 existing 403 tests still pass.

**Open decisions** (plan §12):
- QuickBooks Online — open item #3, decision pending. Currently disabled via empty env in `functions/.env.zeusos`.
- Notion, Meta, Google Drive integrations — same: disabled until enabled per plan §3.

**Known broken / stale**:
- `functions/index.js` still has ~65 DawinOS-legacy exports (Shopify, Adobe, matflow, inventory-AI, design-manager triggers) — task tracker item `#1b`. PR #48 removed the `projectCaseStudyShopifySync` trigger that was breaking prod deploys due to a trigger-kind change.
- `firestore.rules` still has match blocks for `bom` (nested under `manufacturingOrders`) and `materials`, `inventoryItems`, `finishLibrary`, `designProjects`, `designItems` — left in PR #45 because the cloud-function tools / semanticSearch / partyMerge services still reference them. Sweeps when the corresponding callers are stripped.
- `ci.yml` still runs `lint || true` (line ~70) — ESLint stays advisory until the inherited 49k-problem backlog is paid down. `typecheck` is now gating (PR #46).

## Conventions

- Feature modules live in `src/modules/<module-name>/`
- Cloud Functions live in `functions/src/<context>/` (assignment, billing, contracts, pricing, asset-library, talent, media, finance, …)
- Subsidiary scoping via `SubsidiaryAccess` on each user. Canonical IDs (single source of truth in [src/core/settings/types.ts](src/core/settings/types.ts)): `zeus-group` (parent), `zeus-the-agency`, `zeus-digital`, `labyrinth`, `odd-gorilla`, `house-of-zeus`.
- Each `organizations/{orgId}` doc carries `kind: 'PARENT' \| 'SUBSIDIARY'`, `is_legal_entity`, `base_currency`, `gl_connection_id`. The Commercial Gravity invariant ("subsidiary never quotes") is enforced at three layers: `RoleGuard requireOrgKind="PARENT"` in the UI ([src/router/guards/ParentOrgGuard.tsx](src/router/guards/ParentOrgGuard.tsx)), Cloud Function `assertParentOrgPrincipal` helpers, and `firestore.rules` `isParentOrgPrincipal()`.
- Engagement-level collection is `master_jobs` (not `campaigns`). The marketing-facing `Campaign` interface composes onto `master_job.campaign` — see [`src/modules/campaigns/types/campaign.types.ts`](src/modules/campaigns/types/campaign.types.ts).
- MCP server: `zeusos-mcp-server/` (bundled into `functions/vendor/zeusos-mcp-server/` at deploy time by the `functions` predeploy script in `firebase.json`).
- Outbox: every state-changing Cloud Function appends to `domain_events/{eventId}` via `appendDomainEvent` in `functions/src/platform/outbox.js`. 11 canonical event types — see [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md).

## Module surface (current)

Active `src/modules/`:

| Domain | Modules |
|---|---|
| Commercial (parent-org only) | `account-management`, `contracts`, `pricing`, `assignment`, `billing`, `intercompany`, `traffic` |
| Delivery (per-subsidiary) | `delivery`, `media`, `production`, `talent`, `asset-library`, `campaigns` |
| Operations | `crm`, `procurement`, `suppliers`, `finance`, `hr-central`, `hr`, `strategy`, `compliance`, `admin` |
| Platform | `platform` (outbox + idempotency), `shared-ops`, `intelligence`, `intelligence-layer`, `market-intelligence` |
| Removed in this fork | `capital` (PR #47 — plan §4.1 closed; Zeus isn't an investment vehicle), `design-manager`, `inventory`, `manufacturing`, `construction`, `cutlist-processor`, `finishes`, `fulfillment`, `advisory subsidiary` |

The Phase 1 strip is **done in `src/`** but `functions/index.js` still carries the DawinOS-legacy exports (Shopify / matflow / Adobe / inventory triggers / design-manager triggers / QBO / Notion / Meta WhatsApp). Those run on every cold-start until task `#1b` lands.

Removed (do not recreate):
- `src/modules/design-manager/`, `src/subsidiaries/finishes/`, `src/modules/cutlist-processor/`, `src/modules/inventory/`, `src/modules/manufacturing/`, `src/modules/construction/`, `src/modules/fulfillment/`
- `src/subsidiaries/advisory/` (PR #20 — Zeus is not an advisory firm)
- All three.js / camera-controls / three-mesh-bvh
- DawinOS `dawinos-mcp-server/` (renamed and rebuilt as `zeusos-mcp-server/` in Phase 5.A)
