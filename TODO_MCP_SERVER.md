# ZeusOS MCP Server — Phase 5.A Tool Surface

This file is the working plan for Phase 5.A (MCP server rebuild). It supersedes
the construction-era DawinOS TODO (removed 2026-05-23 alongside Phase 1.D's
strip of the manufacturing/inventory/finishes tool packs).

Source plan: `/Users/danielonzimai/.claude/plans/we-have-onboarded-a-lovely-planet.md`
§9 (Phase 5 deliverables) + §14.4 (commercial-gravity domain model).

The existing tool packs — `finance`, `intelligence`, `memory`, `quotes`,
`strategy` — stay as-is. Phase 5.A adds **six new packs** for the marketing
domain (campaigns, IWOs, media, production, talent, billing/AR) on top of
the Phase 3 + 4 schema.

## Status legend

- [x] Implemented in `src/tools/<pack>.ts`
- [ ] Planned for Phase 5.A
- ⤳ Deferred — see note

## Audit: collection paths in use

All Phase 3 + 4 collections are **top-level** in Firestore (confirmed by
direct reads of `firestore.rules`, `src/modules/*/services/firestore.ts`, and
`functions/src/`):

| Collection | Subcollections | Source |
|---|---|---|
| `master_jobs` | – | `src/modules/assignment/services/firestore.ts:35` |
| `internal_work_orders` | `handoff_packet/packet`, `time_entries`, `cost_entries`, `deliverables` | `src/modules/delivery/services/firestore.ts:142` |
| `budget_holds` | – | `functions/src/assignment/acceptRejectWorkOrder.js:45` |
| `media_plans` | `media_buys`, `actuals` | `src/modules/media/types/media-buy.types.ts:5` |
| `media_supplier_invoices` | – | `functions/src/media/onMediaSupplierInvoicePaid.js:71` |
| `production_jobs` | – | `src/modules/production/types/production-job.types.ts` |
| `talent_profiles` | – | `src/modules/talent/types/talent-profile.types.ts` |
| `talent_invoices` | – | `functions/src/talent/onTalentInvoiceApproved.js:67` |
| `freelancer_contracts` | – | `src/modules/talent/types/freelancer-contract.types.ts` |
| `client_invoices` | `client_invoice_lines` (per spec §14.4) | `functions/src/billing/generateClientInvoice.js:218` |
| `intercompany_invoices` | – | `functions/src/assignment/services/intercompany.admin.js:20` |
| `clients`, `msas`, `sows`, `change_orders`, `rate_cards`, `quotes`, `domain_events` | – | `firestore.rules` + `functions/src/{contracts,pricing}/*` |

Stale references found during audit:

- `src/modules/intercompany/types/intercompany-invoice.types.ts:22` docstring
  says `organizations/{orgId}/intercompany_invoices` but the actual code path
  (and `firestore.rules` match) is the top-level `intercompany_invoices`. The
  type comment is wrong; the code is right. **No fix needed for Phase 5.A**
  (read tools key off the actual path); fold the docstring fix into Phase 3.F
  cleanup.
- `functions/src/ai/strategyAssessment.js:64` reads
  `organizations/{companyId}/master_jobs` — also stale. Same recommendation:
  ignore for the MCP rebuild; flag during the Phase 5.B Executive Dashboard
  work, which will hit the same path.

The `companies/{companyId}/` paths used by the existing `finance` and
`strategy` packs are unchanged — they back the spend-plan / expenditure-queue
/ strategy-document collections, which sit beside (not inside) the
marketing-domain collections above.

## Pack: campaigns (`src/tools/campaigns.ts`) — NEW

Reads `master_jobs`. The marketing-domain fields (Brief, IMCTeam, 14-stage
workflow, ARAAM, performanceReview) hang off `master_job.campaign` per
`src/modules/campaigns/types/campaign.types.ts`.

- [ ] `zeusos_list_master_jobs` — filter by `clientId`, `status`, `subsidiaryId`,
      `stage`. Returns code, status, stage, allocated vs ceiling, currency,
      AM owner.
- [ ] `zeusos_get_master_job` — full MasterJob doc including embedded
      `campaign` (Brief, BIG IDEA, IMC team, stage history, ARAAM ticks,
      performance review). Includes a roll-up of attached IWOs (count by
      state).
- [ ] `zeusos_master_job_summary` — concise cost-vs-ceiling + IWO-state
      breakdown + deliverable count + revert/feedback SLA status. Designed
      for the Phase 5.B Executive Dashboard.

⤳ Deferred — `zeusos_create_brief` and `zeusos_advance_master_job_stage`.
The plan §9 bullet lists both. They are **write** mutations and want
serializable guards (the 14-stage state machine, the per-tier SLA timer,
audit-log emission). The right hookup is a Cloud Function callable similar
to Phase 3.B's IWO callables. Once such a callable exists, the MCP tool is
a one-call wrapper via `services/callFunction.ts`. Flagged for Phase 5.A.2
(post-write callable scaffold).

## Pack: iwos (`src/tools/iwos.ts`) — NEW

Reads `internal_work_orders` + `budget_holds`.

- [ ] `zeusos_list_iwos` — filter by `masterJobId`, `subsidiaryOrgId`, `state`.
      Returns code, state, budget vs cumulative cost, transfer price.
- [ ] `zeusos_get_iwo` — full IWO including the `handoff_packet/packet`
      subdoc and a summary of `time_entries` / `cost_entries` totals plus
      `deliverables` count.
- [ ] `zeusos_iwo_burn_report` — cumulative cost vs locked budget across all
      IWOs of a master job. Surfaces 80% / 100% threshold crossings (the
      `BudgetThresholdCrossed` event source — see §11.2).

## Pack: media (`src/tools/media.ts`) — NEW

Reads `media_plans` + `media_buys` subcollection + `actuals` subcollection
+ `media_supplier_invoices`.

- [ ] `zeusos_list_media_plans` — filter by `masterJobId`, `subsidiaryOrgId`,
      `status`. Returns title, total budget, flight window.
- [ ] `zeusos_media_plan_summary` — planned vs booked vs actual roll-up by
      vehicle type (TV / RADIO / OOH / DIGITAL / etc.); per-supplier spend;
      campaign-level cost variance.
- [ ] `zeusos_media_supplier_invoice_status` — outstanding `SUBMITTED` /
      `APPROVED` / unpaid invoices, by supplier and master job.

## Pack: production (`src/tools/production.ts`) — NEW

Reads `production_jobs`.

- [ ] `zeusos_list_productions` — filter by `masterJobId`, `type`, `stage`,
      `subsidiaryOrgId`.
- [ ] `zeusos_production_summary` — distribution across the 10 production
      stages (`BRIEF` → `COMPLETE`), throughput, jobs blocked at a stage.

## Pack: talent (`src/tools/talent.ts`) — NEW

Reads `talent_profiles` + `talent_invoices` + `freelancer_contracts`.

- [ ] `zeusos_list_talent` — filter by `type` (STAFF / FREELANCER), `status`,
      `roles`, `subsidiaryOrgId`.
- [ ] `zeusos_talent_invoice_status` — outstanding talent invoices by status,
      with totals.
- [ ] `zeusos_freelancer_cost_summary` — total spend per freelancer over
      window; signed contracts referenced.

`bankDetails` on `talent_profiles` is admin-write-restricted per the type doc;
the MCP read tools omit it from output by default.

## Pack: billing (`src/tools/billing.ts`) — NEW

Reads `client_invoices` + `intercompany_invoices` + `master_jobs`.

- [ ] `zeusos_accounts_receivable_aging` — open `client_invoices`
      (status ∈ {ISSUED, PART_PAID}) bucketed 0–30 / 31–60 / 61–90 / 90+
      days past `issuedAt`. Uses the **internal** invoice shape; only the
      MCP server (parent-role) calls this.
- [ ] `zeusos_subsidiary_pnl` — group P&L per legal entity for a window:
      sum of `intercompany_invoices.amountMinor` per `fromOrgId`, plus
      open IWO commitment by `subsidiaryOrgId`. Designed for the Phase 5.B
      Executive Dashboard's per-sub-brand P&L.

The `cost_minor` / `transfer_price_minor` invariant (spec §14.7 / §14.8) is
respected: these tools are server-side and read by parent-org MCP callers,
so the redacted client-facing invoice shape is not used here. The MCP
caller's home org is checked the same way the existing finance/strategy
tools check it — via `ZEUSOS_COMPANY_ID` and the principal's role.

## Cross-cutting RBAC model

All Phase 5.A tools are **read-only** (`readOnlyHint: true`).

Effective access matrix (matches plan §14.10's three layers of "subsidiary
never quotes"):

| Caller home org | campaigns | iwos | media | production | talent | billing |
|---|---|---|---|---|---|---|
| `zeus-group` (PARENT) | full | full | full | full | full | full |
| Subsidiary | own IWOs + own productions + own media + own talent | own only | own only | own only | own only | **403** |

Enforced by:

1. `firestore.rules` already gates `client_invoices`, `intercompany_invoices`,
   `quotes`, `rate_cards`, `msas`, `sows`, `change_orders` to parent
   principals. The MCP service account inherits these rules through
   `firebase-admin`. The MCP-side responsibility is to **forward the caller's
   identity** when this lands behind a Cloud Function gateway in Phase 5.A.2.
2. Tool descriptions explicitly call out parent-only tools so a subsidiary
   user prompting an MCP-aware agent gets a clean 403 instead of an empty
   list.

## Verification gate

- [ ] `cd zeusos-mcp-server && npm run build` clean
- [ ] `npm run lint` clean (tsc --noEmit)
- [ ] Each new tool registered in `src/index.ts`
- [ ] Tool names use the `zeusos_` prefix (not `dawinos_`)
- [ ] Tool outputs are markdown-formatted (matches existing pack style) AND
      pull from the right collection per the audit table above

## Out of scope for Phase 5.A

- Write tools (Brief create, stage advance, IWO transitions). Owners: Phase
  3.B (Cloud Functions already exist for IWO state machine), Phase 5.A.2
  (Brief + stage advance callables).
- Executive Dashboard UI consumption — Phase 5.B.
- New collections. If a tool needs data not yet persisted (e.g. asset library
  search), defer the tool, don't invent the collection. None currently fit
  this case for Phase 5.A.
