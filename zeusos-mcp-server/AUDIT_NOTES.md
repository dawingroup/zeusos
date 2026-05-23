# ZeusOS MCP Server — Firestore + Tool Surface Audit

## 2026-05-23 — Phase 5.A audit (current)

Audit ahead of the marketing-domain tool packs (Phase 5.A). Method:
static analysis of the Phase 3 + 4 source modules and the Cloud
Functions that read/write these collections — no live Firestore session
needed because the source files (`firestore.rules`, `src/modules/*/services/firestore.ts`,
`functions/src/{assignment,billing,intercompany,media,talent,production,pricing,contracts}/*.{js,ts}`)
agree end-to-end.

### Marketing-domain collections — all top-level

| Collection | Subcollections | Source of truth |
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
| `client_invoices` | `client_invoice_lines` (spec §14.4) | `functions/src/billing/generateClientInvoice.js:218` |
| `intercompany_invoices` | – | `functions/src/assignment/services/intercompany.admin.js:20` |
| `clients`, `msas`, `sows`, `change_orders`, `rate_cards` (+ `rate_card_lines`), `quotes` (+ `quote_lines`), `domain_events` | – | `firestore.rules` + `functions/src/{contracts,pricing}/*` |

The Phase 1 / Phase 2.A audit (the section below this one) is preserved for
history; none of those construction collections exist in ZeusOS anymore.

### Schema mismatches the new tools handle

| Field | Reality | Note |
|---|---|---|
| `MasterJob.allocatedMinor` vs `MasterJob.ceilingMinor` | both stored, kept in sync transactionally by Phase 3.B Cloud Functions | the burn-pct in `zeusos_list_master_jobs` is derived: no `burnPct` field on the doc |
| `MasterJob.campaign.brief.tier` | required: `1 \| 2 \| 3` | drives the per-Tier SLA timestamps; `zeusos_get_master_job` surfaces both raw + expected dates |
| `InternalWorkOrder.cumulativeCostMinor` vs `budgetMinor` | both stored; `cumulativeCostMinor` is the running sum maintained by `postTimeEntry` / `postCostEntry` callables | spec §11.2 — soft 80% warning, hard 422 at 100%; `zeusos_iwo_burn_report` colours each row |
| `ClientInvoice.total.amountMinor` (not flat `totalMinor`) | total is a `Money` shape (`{ amountMinor, currency }`) | `zeusos_accounts_receivable_aging` unpacks `inv.total?.amountMinor` |
| `TalentProfile.bankDetails` | admin-write-restricted (per the type doc) | `zeusos_list_talent` omits unless `include_bank_details: true` |
| `IntercompanyInvoice.currency` | subsidiary base currency (spec §11.6) | per-currency totals in `zeusos_subsidiary_pnl` — single FX conversion happens at client invoice consolidation, NOT at the IC step |

### Stale references that didn't block Phase 5.A

These are stale **docstrings or comments**, not actual storage paths. The
code that uses them goes to the correct (top-level) location. Documented
here so a future cleanup pass can fix the comments without changing
behaviour:

| File / line | Stale comment | Reality |
|---|---|---|
| `src/modules/intercompany/types/intercompany-invoice.types.ts:22` | `Lives at: organizations/{orgId}/intercompany_invoices/{icInvoiceId}` | code at `functions/src/assignment/services/intercompany.admin.js:20` writes to the top-level `intercompany_invoices` collection (matches `firestore.rules`) |
| `functions/src/ai/strategyAssessment.js:64` | reads `organizations/${companyId}/master_jobs` | the canonical path is the top-level `master_jobs` collection (matches `src/modules/assignment/services/firestore.ts:35`). Phase 5.B Executive Dashboard will hit this; fold the fix in there |

### Stale content in existing MCP tool packs (carried over from Phase 1.D)

The Phase 5.A rebuild does NOT modify these — per the brief
("Don't break existing tools"). Flagged for a separate cleanup PR:

| Tool | Stale content | Suggested fix |
|---|---|---|
| `src/tools/intelligence.ts` — `zeusos_cross_module_query` description | examples reference "manufacturing orders", "POs", "materials", "purchasing/manufacturing" — construction-era prompts | Rewrite examples to marketing-domain ones (master jobs, IWOs at risk, media spend by vehicle, talent invoices outstanding). The handler in the `crossModuleIntelligence` Cloud Function would also need its prompt updated — both should land together. |
| `src/tools/intelligence.ts` — `zeusos_material_demand_forecast` tool | Forecasts demand against `manufacturingOrders` — module removed in Phase 1.D | Remove tool registration; the backing Cloud Function `materialDemandForecast` should also be sunset. |
| `src/tools/intelligence.ts` — `zeusos_market_intelligence` `subsidiary_id` enum | `'finishes' \| 'technology' \| 'capital'` — old DawinOS sub-brands | Replace with the 5 Zeus sub-brand IDs (see `ZEUS_SUBSIDIARY_IDS` in `constants.ts`). |
| `src/constants.ts` `COLLECTIONS` | Still includes `PURCHASE_ORDERS`, `MANUFACTURING_ORDERS`, `FINISH_LIBRARY`, `INVENTORY_ITEMS`, `STOCK_ADJUSTMENTS`, `STOCK_LEVELS`, `DESIGN_PROJECTS` | Of these, only `CLIENT_QUOTES` (still in `COLLECTIONS`) is referenced by an active tool (`tools/quotes.ts`). `SUPPLIERS` is still a valid collection but is not referenced by any current tool. Safe to delete the construction-era keys in the same cleanup PR. |

None of these stale references are reachable from the Phase 5.A tool
packs added in this PR — the new packs use the new `MARKETING_COLLECTIONS`
map and `ZEUS_SUBSIDIARY_IDS` enum exclusively.

### RBAC enforcement layers (Phase 5.A reads)

Per plan §14.10's three-layer model:

1. **Firestore rules** — `firestore.rules` already gates `client_invoices`,
   `intercompany_invoices`, `quotes`, `rate_cards`, `msas`, `sows`,
   `change_orders` to parent (`zeus-group`) principals. Subsidiary
   principals are denied at the storage layer.
2. **MCP service account** — inherits parent visibility through
   `firebase-admin`. Future work (Phase 5.A.2 or later) should add a
   call-time identity forward so subsidiary-bound prompts see only their
   own scope rather than the service account's parent-wide view.
3. **Tool descriptions** explicitly call out parent-only tools
   (`zeusos_accounts_receivable_aging`, `zeusos_subsidiary_pnl`) so an
   MCP-aware agent serving a subsidiary user gets a clean refusal rather
   than an empty list.

---

## 2026-03-29 — DawinOS construction-era audit (historical)

Preserved for history. **All collections below have been removed from
ZeusOS** in the Phase 1 strip — the audit findings are no longer
actionable but document the lineage of the constants in `src/constants.ts`
that still need to be deleted (see "Stale content in existing MCP tool
packs" above).

### Original method

Static analysis of legacy Cloud Functions tool handlers and TypeScript
type definitions (`functions/src/tools/manufacturingTools.js`,
`inventoryTools.js`, `supplierTools.js`, `stockAdjustment.triggers.js`,
`finishTriggers.js`; the Advisory subsidiary's `project.types.ts` +
`allocation.ts`; `src/core/settings/settingsService.ts`).

### Original collection map (DawinOS)

| Collection | Status in ZeusOS | Original casing |
|---|---|---|
| `purchaseOrders` | removed (Phase 1.D) — Phase 4.1 reintroduced for marketing POs | camelCase |
| `manufacturingOrders` | removed | spec said `manufacturing_orders`; actual was camelCase |
| `finishLibrary` | removed | – |
| `inventoryItems` | removed | spec said `inventory_items`; actual was camelCase |
| `stock_adjustments` | removed | snake_case |
| `stockLevels` | removed | bonus collection |
| `suppliers` | retained — used by Suppliers module | – |
| `projectFunds` | never existed; advisory used `organizations/default/advisory_projects` | – |
| `expenditure_allocations` | never existed; advisory used `organizations/default/allocation_groups` | – |

### Original field-name corrections (no longer relevant)

| Collection | Spec / Expected | Actual | Status |
|---|---|---|---|
| `inventoryItems.stockQuantity` | `stockOnHand` | – | obsolete |
| `inventoryItems.unitCost` | `costPrice` | – | obsolete |
| `manufacturingOrders.productionStage` | `currentStage` | – | obsolete |
| `manufacturingOrders.moNumber` | `data.moNumber \|\| data.orderNumber` | – | obsolete |
| `purchaseOrders.grandTotal` | `total` | – | obsolete |
| `purchaseOrders` lineItems | embedded array (not subcollection) | – | obsolete |

### Original scoping decision

`DEFAULT_ORG_ID = 'default'` (not `'dawin-group'`). The constant still
lives in `src/constants.ts` and is referenced by the `finance` /
`strategy` packs that key off `companies/{companyId}/...` paths. **Still
correct for those packs** — they read company-scoped collections that
weren't renamed in the Phase 1 strip.

The Phase 5.A marketing tool packs do NOT use `DEFAULT_ORG_ID` — all
their collections are top-level with no organizationId filter.
