# ZeusOS — Backend Function Map

**Scope:** the **live ZeusOS marketing-agency surface** — the commercial core, delivery,
operations, and intelligence Cloud Functions the refreshed UI actually invokes. DawinOS-legacy
exports (Shopify / QBO / manufacturing / inventory / Adobe / WhatsApp / GChat / design-manager) are
**out of scope** and listed only in the [appendix](#appendix--dawinos-legacy-exports-still-present).

**How to read this:** the UI never calls a Cloud Function directly. Each page imports a typed
**service wrapper** (`somethingFn`) that wraps `httpsCallable(functions, '<callableName>')`; the
callable resolves to an **export** in `functions/index.js`, defined in a source file under
`functions/src/<context>/`. Reads bypass functions entirely — pages subscribe to Firestore
collections directly (writes are Cloud-Function-only, enforced by `firestore.rules`).

```
Page  ──imports──▶  service wrapper (…Fn)  ──httpsCallable──▶  export (index.js)  ──defined in──▶  functions/src/<ctx>/<file>.js
  └──subscribes directly──▶ Firestore collection (read-only; CFn-only writes)
```

> Verified against `functions/index.js` (**225 exports**) and `src/modules/**/services/` on the
> `origin/main` tree. Counts/regions reflect the code as read, with discrepancies against CLAUDE.md
> called out inline.

---

## 1. Regions

| Region | What runs there |
|---|---|
| **europe-west1** | Commercial-core + delivery: assignment/IWO state machine, pricing/quoting, contracts, billing, outbox consumer, talent/media handshake triggers. The Firestore region is `europe-west1`, so these are co-located. |
| **us-central1** (default) | AI / intelligence / reporting (market-intel, strategy AI, embeddings, BigQuery sync) and any export with **no explicit region option** — notably **`routeBrand`** (traffic), the **conflict-firewall** callables, and the **hr-central role-profile** callables, which all inherit the default. *(There is no `setGlobalOptions`; region is set per-export via the v2 `onCall({ region: 'europe-west1' })` option — present on the assignment/contracts/pricing/billing core, absent on the three above.)* *(Standardising the three to `europe-west1` is a recommended follow-up — see [§7](#7-known-gaps--follow-ups).)* |
| **us-east1** | `onAssetUploaded` storage trigger (asset ingestion) only. |

---

## 2. Callable wrappers → callable → source (the core table)

All wrappers follow the `<operation>Fn` convention and live in a per-module
`services/firebase.ts` (or `*.service.ts`). Unless noted, type = **onCall** and region =
**europe-west1**.

### Assignment — IWO state machine (`functions/src/assignment/`)
| Wrapper (frontend) | Callable | Source file |
|---|---|---|
| `issueWorkOrderFn` | `issueWorkOrder` | `assignment/issueWorkOrder.js` |
| `acceptWorkOrderFn` | `acceptWorkOrder` | `assignment/acceptRejectWorkOrder.js` |
| `rejectWorkOrderFn` | `rejectWorkOrder` | `assignment/acceptRejectWorkOrder.js` |
| `startWorkOrderFn` | `startWorkOrder` | `assignment/startWorkOrder.js` |
| `postTimeEntryFn` | `postTimeEntry` | `assignment/postTimeEntry.js` |
| `postCostEntryFn` | `postCostEntry` | `assignment/postCostEntry.js` |
| `submitDeliverableFn` | `submitDeliverable` | `assignment/submitDeliverable.js` |
| `acceptInternalFn` | `acceptInternal` | `assignment/acceptInternalRequestRevision.js` |
| `requestRevisionFn` | `requestRevision` | `assignment/acceptInternalRequestRevision.js` |
| `signAcceptanceCriterionFn` | `signAcceptanceCriterion` | `assignment/signAcceptanceCriterion.js` |
| `closeWorkOrderFn` | `closeWorkOrder` | `assignment/closeWorkOrder.js` |
| `cancelWorkOrderFn` | `cancelWorkOrder` | `assignment/cancelWorkOrder.js` |
| `routeDirectClientRequestFn` | `routeDirectClientRequest` | `assignment/routeDirectClientRequest.js` |
| — (trigger) | `openMasterJobOnQuoteAccepted` | `assignment/openMasterJobOnQuoteAccepted.js` |

Service files: `src/modules/assignment/services/firebase.ts` + `src/modules/delivery/services/firebase.ts`
(delivery wraps the accept/reject/start/post/submit subset the subsidiary surface uses).

### Traffic — brand routing (`functions/src/assignment/routeBrand.js`)
| Wrapper | Callable | Source | Region |
|---|---|---|---|
| `routeBrandFn` | `routeBrand` | `assignment/routeBrand.js` | **default (us-central1)** — `onCall` declares only `{ cors }`, no `region` |

Service: `src/modules/traffic/services/traffic.service.ts`. Emits `RoutingBrandProposed`.

### Pricing + quoting (`functions/src/pricing/`)
| Wrapper | Callable | Source |
|---|---|---|
| `priceQuoteFn` | `priceQuote` | `pricing/` (pricing engine) |
| `issueQuoteFn` | `issueQuote` | `pricing/quoteLifecycle.js` |
| `acceptQuoteFn` | `acceptQuote` | `pricing/quoteLifecycle.js` |
| `voidQuoteFn` | `voidQuote` | `pricing/quoteLifecycle.js` |
| `createRateCardVersionFn` | `createRateCardVersion` | `pricing/rateCardAdmin.js` |
| `activateRateCardFn` | `activateRateCard` | `pricing/rateCardAdmin.js` |
| `retireRateCardFn` | `retireRateCard` | `pricing/rateCardAdmin.js` |

Service: `src/modules/pricing/services/firebase.ts`.

### Contracts — Client / MSA / SOW / Change Order (`functions/src/contracts/`)
| Wrapper | Callable | Source |
|---|---|---|
| `upsertClientFn` | `upsertClient` | `contracts/clientAdmin.js` |
| `upsertMsaFn` | `upsertMsa` | `contracts/msaAdmin.js` |
| `activateMsaFn` | `activateMsa` | `contracts/msaAdmin.js` |
| `upsertSowFn` | `upsertSow` | `contracts/sowAdmin.js` |
| `submitSowForApprovalFn` | `submitSowForApproval` | `contracts/sowAdmin.js` |
| `approveSowFn` | `approveSow` | `contracts/sowAdmin.js` |
| `cancelSowFn` | `cancelSow` | `contracts/sowAdmin.js` |
| `upsertChangeOrderFn` | `upsertChangeOrder` | `contracts/changeOrderAdmin.js` |
| `approveChangeOrderFn` | `approveChangeOrder` | `contracts/changeOrderAdmin.js` |
| `rejectChangeOrderFn` | `rejectChangeOrder` | `contracts/changeOrderAdmin.js` |

Service: `src/modules/contracts/services/firebase.ts`. Brief/CES helpers
(`updateMasterJobBrief`, `postCesLineItem`, `signOffCes`) live in
`src/modules/account-management/services/brief-ces.service.ts`.

### Billing (`functions/src/billing/`)
| Wrapper | Callable / trigger | Source |
|---|---|---|
| (read service) | `issueClientInvoice` | `billing/issueClientInvoice.js` |
| — | inter-company invoice raise | emitted by `closeWorkOrder`/`cancelWorkOrder` (assignment) |
| — (trigger) | GL-posting on invoice paid | `finance/postJournalEntryOnInvoicePaid.js` |

Services: `src/modules/billing/services/client-invoice.service.ts`,
`intercompany-invoice.service.ts` (both **read-only** list/subscribe today; raise paths are
trigger-driven). GL adapter + FX live under `functions/src/billing/` + `functions/src/finance/`.

### Conflict firewall (`functions/src/conflict-firewall/`) — *region: default (us-central1)*
| Wrapper | Callable | Source |
|---|---|---|
| `addClientCompetitorFn` | `addClientCompetitor` | `conflict-firewall/admin.js` |
| `removeClientCompetitorFn` | `removeClientCompetitor` | `conflict-firewall/admin.js` |

Service: `src/modules/conflict-firewall/services/conflict-firewall.service.ts`. The
`excludeConflicted` helper (`conflict-firewall/excludeConflicted.js`) runs inside routing and emits
`ConflictExclusivityRisk`.

### HR Central — role profiles (`functions/src/hr-central/role-profiles.js`) — *region: default (us-central1)*
| Wrapper | Callable | Source |
|---|---|---|
| `createRoleProfileFn` | `createRoleProfile` | `hr-central/role-profiles.js` |
| `updateRoleProfileFn` | `updateRoleProfile` | `hr-central/role-profiles.js` |
| `archiveRoleProfileFn` | `archiveRoleProfile` | `hr-central/role-profiles.js` |
| `assignEmployeeToRoleFn` | `assignEmployeeToRole` | `hr-central/role-profiles.js` |
| `endRoleAssignmentFn` | `endRoleAssignment` | `hr-central/role-profiles.js` |
| — | `advanceApprovalRung` | `assignment/services/approval-ladder.service.js` |

Service: `src/modules/hr-central/role-profiles/services/role-profile.service.ts`.

### Phase 4.1 — procurement ↔ finance handshake (Firestore triggers, europe-west1)
| Trigger export | Source | Emits |
|---|---|---|
| `onTalentInvoiceApproved` | `talent/onTalentInvoiceApproved.js` | `PurchaseOrderRaised` |
| `onMediaSupplierInvoicePaid` | `media/onMediaSupplierInvoicePaid.js` | `PurchaseOrderRaised` |
| `postJournalEntryOnInvoicePaid` | `finance/postJournalEntryOnInvoicePaid.js` | `JournalEntryPosted` |

---

## 3. Page → Service → Callable chains

| Page | Service module | Callables invoked | Reads (collections) |
|---|---|---|---|
| `traffic/RoutingQueuePage` | `traffic.service` | `routeBrandFn` → `routeBrand` | `master_jobs` (OPEN/unrouted), `internal_work_orders`, `domain_events` |
| `delivery/IWOInboxPage` | `delivery/firebase` | `acceptWorkOrderFn`, `rejectWorkOrderFn` | `internal_work_orders` (ISSUED + in-flight, by home subsidiary) |
| `delivery/IWOWorkspacePage` | `delivery/firebase` | `startWorkOrderFn`, `postTimeEntryFn`, `postCostEntryFn`, `submitDeliverableFn` | IWO + handoff packet + time/cost/deliverable subcollections |
| `account-management/ClientsPage` | `contracts/firestore` | — (read-only) | `clients`, `msas`, `sows` |
| `account-management/ClientDetailPage` | `contracts/firebase` | `upsertClientFn` (edit/archive); embeds `CompetitorListPanel` | `clients`, `msas`, `sows` |
| `account-management/MasterJobDetailPage` | `assignment/firebase` + `brief-ces.service` | `issueWorkOrderFn` (via `IssueIWODialog`), `updateMasterJobBriefFn`, `postCesLineItemFn`, `signOffCesFn` | `master_jobs` rollup, `internal_work_orders`, `client_invoices` |
| `account-management/IssueIWODialog` | `assignment/firebase` | `issueWorkOrderFn` | — |
| `pricing/QuoteBuilderPage` | `pricing/firebase` | `priceQuoteFn`, `issueQuoteFn`, `acceptQuoteFn`, `voidQuoteFn` | `clients`, `sows`, `quotes`, quote lines |
| `pricing/RateCardsPage` | `pricing/firebase` | `createRateCardVersionFn` | `rate_cards` (per subsidiary) |
| `billing/ClientInvoicesPage` | `client-invoice.service` | — (read-only) | `client_invoices` |
| `billing/InterCompanyInvoicesPage` | `intercompany-invoice.service` | — (read-only) | `intercompany_invoices` |
| `conflict-firewall/CompetitorListPanel` | `conflict-firewall.service` | `addClientCompetitorFn`, `removeClientCompetitorFn` | `client_competitors` |
| `conflict-firewall/BreachRisksPage` | `conflict-firewall.service` | — (read-only) | `domain_events` (`ConflictExclusivityRisk`) |
| `hr-central/RoleProfilesListPage` | `role-profile.service` | `createRoleProfileFn` | `role_profiles` |
| `hr-central/RoleProfileDetailPage` | `role-profile.service` | `archiveRoleProfileFn`, `endRoleAssignmentFn`, `assignEmployeeToRoleFn` (via dialog) | `role_profiles`, `role_assignments` |
| `time-tracking/MyTimeThisWeekPage` | `time-tracking.service` | — (read); posts via IWO workspace `postTimeEntryFn` | `time_entries` (collection-group by `userId`) |
| `time-tracking/TeamTimePage` | `time-tracking.service` | — (read-only) | `time_entries` (collection-group by `entryDate` / `subsidiaryOrgId`) |

---

## 4. Firestore collections (commercial / delivery core)

All commercial/delivery collections are **Cloud-Function-write-only** — the client SDK reads but
never writes; mutations go through callables that enforce principal checks (Tech Spec §7.4). Verified
against `firestore.rules`.

| Collection | Read access | Writes |
|---|---|---|
| `clients` | staff auth | CFn only |
| `msas` · `sows` · `change_orders` | `canActOnClient()` (parent OR home brand per ADR-2026-05-25) | CFn only |
| `rate_cards` | parent-org principal | CFn only |
| `quotes` | `canActOnClient()` | CFn only |
| `master_jobs` | `canActOnClient()` | CFn only |
| `internal_work_orders` (+ `time_entries`, cost, deliverable subcollections) | parent OR receiving subsidiary (by org) | CFn only |
| `budget_holds` · `cost_allocations` | parent-org principal | CFn only |
| `intercompany_invoices` | parent OR outgoing subsidiary | CFn only |
| `client_invoices` | parent OR home brand | CFn only |
| `domain_events` | parent-org principal | CFn only (Admin SDK) |
| `purchase_orders` · `journal_entries` | admin / parent-org principal | CFn / admin only |
| `role_profiles` · `role_assignments` | staff auth | admin only |
| `client_competitors` | staff auth | admin + CFn |

---

## 5. Domain events / outbox

**`functions/src/platform/outbox.js`** — `appendDomainEvent({ tx, db, eventType, aggregateType,
aggregateId, payload, emittedByUserId?, idempotencyKey? }) → { id }`. Every state-changing callable
writes its event **inside the same Firestore transaction** as the mutation (`tx.set(...)`), so the
event and the state change commit atomically. Event docs carry a **ULID** id (time-sortable),
`processed: false`, and `processedBy: []`; the `onDomainEventCreated` trigger marks them processed
and appends a consumer tag. An optional `idempotencyKey` dedupes on retry.

**Live event types (verified in code — ~22, more than CLAUDE.md's "17"):**

- **Phase 3 (Commercial Gravity):** `SowActivated`, `QuoteAccepted`*, `MasterJobOpened`, `IWOIssued`,
  `IWOAccepted`, `IWORejected`, `BudgetThresholdCrossed`, `DeliverableSubmitted`, `IWOClosed`,
  `InterCompanyInvoiceRaised`, `IntraEntityCostAllocated`
- **Phase 4.1:** `PurchaseOrderRaised`, `JournalEntryPosted` (`TalentInvoiceApproved` /
  `MediaSupplierInvoicePaid` are **defined but not emitted** — see gaps)
- **Phase 6.B / firewall:** `RoutingBrandProposed`, `ConflictExclusivityRisk`
- **Phase 6.D (approval ladder):** `ApprovalRungAdvanced`, `ApprovalRungRejected`,
  `InternalApprovalGranted`
- **Other:** `DirectClientRequestRouted`, `ClientInvoiceIssued`*

\* `QuoteAccepted` (`pricing/quoteLifecycle.js`) and `ClientInvoiceIssued`
(`billing/issueClientInvoice.js`) currently use a **non-canonical emit path** — a local helper that
writes `db.collection('domain_events').add(...)` with `type`/`occurredAt` field names (not
`eventType`/`emittedAt`) and **not** inside the state transaction. Worth normalising onto
`appendDomainEvent` (see gaps).

---

## 6. Architecture notes

1. **One wrapper convention.** Every callable is reached through a `<operation>Fn` constant in a
   module `services/firebase.ts`; pages never call `httpsCallable` inline. This keeps the
   page→callable mapping above stable and greppable.
2. **Reads are direct, writes are gated.** Pages subscribe to Firestore; the "subsidiary never
   quotes" invariant and all commercial mutations are enforced at three layers (rules / callable
   asserts / UI guards), so the refreshed UI changed presentation only — **no callable signature or
   collection contract was touched**.
3. **A feature can span services.** IWO issuance, for example, is `issueWorkOrderFn` (assignment
   service) launched from `IssueIWODialog`, while the surrounding MasterJob brief/CES edits use the
   `brief-ces.service` — both mounted on `MasterJobDetailPage`.

---

## 7. Known gaps / follow-ups

- **Region drift:** `routeBrand` (traffic), the conflict-firewall callables, and the hr-central
  role-profile callables pass no `region` option to `onCall`, so they deploy to `us-central1` while
  the rest of the commercial core pins `europe-west1` (cross-region latency to the EU Firestore).
  Recommend adding `region: 'europe-west1'` to each (e.g. `routeBrand`'s `onCall({ cors: … })` →
  `onCall({ cors: …, region: 'europe-west1' })`).
- **Outbox schema drift:** `QuoteAccepted` and `ClientInvoiceIssued` bypass `appendDomainEvent`
  (different field names, non-transactional). Normalise to the canonical helper so every event is
  uniform and atomic.
- **Defined-but-unemitted events:** `TalentInvoiceApproved` / `MediaSupplierInvoicePaid` exist in the
  `DOMAIN_EVENT_TYPES` registry but no emitter was found — either wire the emitters or drop them from
  the registry.

---

## Appendix — DawinOS-legacy exports still present

`functions/index.js` still carries ~legacy DawinOS exports that the ZeusOS UI **never calls**
(retained until a cleanup sweep). They are out of scope for this map; flagged here so they are not
mistaken for live surface:

- **Manufacturing / inventory / design:** `auditInventoryHealth`, `dailyCatalogAudit`,
  `weeklyCatalogAudit`, `monthlyMaterialPricing`, `designItemEnhancement`, manufacturing/design
  Firestore triggers.
- **Shopify:** `auditShopifyProduct`, `generateProductNames`, `generateProductContent`,
  `generateDiscoverabilityData`, catalog sync.
- **QuickBooks Online:** QBO callback/sync exports (disabled via empty env in
  `functions/.env.zeusos`).
- **Adobe PDF (~13 exports)** and **Shopify** are **LIVE** in DawinOS terms but only reached by
  `AdobePdfTest.tsx` / SettingsPage — not part of the marketing-agency commercial surface; left in
  place intentionally.
- **WhatsApp / Google Chat:** messaging exports are stubbed in the frontend (Phase 1.C) and gated
  behind the `WHATSAPP_ENABLED` feature flag.

See `CLAUDE.md` → "Known broken / stale" for the authoritative legacy-cleanup status.
