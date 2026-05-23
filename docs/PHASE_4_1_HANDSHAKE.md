# Phase 4.1 — Procurement / Finance handshake

Cross-module wiring from Talent + Media invoice services into
Procurement (PO) and Finance (JE), satisfying the **Phase 4 acceptance
gate** from plan §15:

> "Media plan attached to campaign, buy logged, **supplier invoice
> triggers PO + journal entry**."

Phase 4 PR #10 shipped the module surfaces (media / production / talent)
with their types, services, and UI pages but deferred the cross-module
wiring. The follow-up work documented here lands that wiring.

## Architecture

```
functions/src/
├── talent/onTalentInvoiceApproved.js      ← outbox consumer (talent → PO)
├── media/onMediaSupplierInvoicePaid.js    ← outbox consumer (media → PO)
└── finance/postJournalEntryOnInvoicePaid.js  ← outbox consumer (PO → JE,
                                                                 ClientInvoicePaid → JE)

functions/src/platform/outbox.js
└── DOMAIN_EVENT_TYPES   13 → 17  (4 new events added)

src/modules/procurement/
└── types/purchase-order.types.ts          ← PO type + id builder
```

Each Cloud Function is a Firestore trigger on `domain_events/{eventId}`
filtered by `eventType`. Idempotency comes from two layers:
deterministic doc ids (`po_talent_${invoiceId}`, `je_${kind}_${poId}`)
and a `processedBy` tag on the source event. The 3.B outbox-consumer
pattern is preserved.

## The 4 new domain events

| Event | Emitted by | Consumed by | Result |
|---|---|---|---|
| `TalentInvoiceApproved` | [`approveTalentInvoice`](../src/modules/talent/services/talent-invoice.service.ts) | `onTalentInvoiceApproved` | `purchase_orders/po_talent_${id}` |
| `MediaSupplierInvoicePaid` | [`markMediaSupplierInvoicePaid`](../src/modules/media/services/media-supplier-invoice.service.ts) | `onMediaSupplierInvoicePaid` | `purchase_orders/po_media_${id}` |
| `PurchaseOrderRaised` | the two consumers above | `postJournalEntryOnInvoicePaid` | `journal_entries/je_${kind}_${poId}` |
| `JournalEntryPosted` | `postJournalEntryOnInvoicePaid` | (audit log + dashboards) | terminal |

## Status — COMPLETE (2026-05-23)

All scaffolds have been replaced with working implementations.
Acceptance gate verified by `npm test` in `functions/` — 88 tests
pass, including 3 dedicated to this handshake.

### ✅ 1. Upstream emitters wired
- [src/modules/talent/services/talent-invoice.service.ts:69-114](../src/modules/talent/services/talent-invoice.service.ts) — `approveTalentInvoice` batch-writes the status update + `TalentInvoiceApproved` event in one Firestore commit.
- [src/modules/media/services/media-supplier-invoice.service.ts:135-186](../src/modules/media/services/media-supplier-invoice.service.ts) — `markMediaSupplierInvoicePaid` does the same shape on the PAID transition.

### ✅ 2. CFn bodies live
- [functions/src/talent/onTalentInvoiceApproved.js](../functions/src/talent/onTalentInvoiceApproved.js) — reads the source invoice, builds the PO, idempotent transactional write, emits `PurchaseOrderRaised`.
- [functions/src/media/onMediaSupplierInvoicePaid.js](../functions/src/media/onMediaSupplierInvoicePaid.js) — same shape, carries `mediaPlanId` / `mediaBuyId` / `vehicleType` so reconciliation can join.
- [functions/src/finance/postJournalEntryOnInvoicePaid.js](../functions/src/finance/postJournalEntryOnInvoicePaid.js) — listens for `PurchaseOrderRaised` + `ClientInvoicePaid`, posts a balanced double-entry JE against the chart of accounts, flips PO `postedToGL` flag.

### ✅ 3. Firestore rules
[firestore.rules:4174-4183](../firestore.rules) — `purchase_orders` and `journal_entries` are gated to `isParentOrgPrincipal()` for reads and CFn-only for writes (`allow write: if false` on JE; conservative carve-out on PO for `VENDOR_OTHER`). Subsidiaries cannot see supplier costs.

### ✅ 4. Tests
- [functions/\_\_tests\_\_/talent/onTalentInvoiceApproved.test.js](../functions/__tests__/talent/onTalentInvoiceApproved.test.js) — happy path + idempotency replay + malformed-payload + source-deleted
- [functions/\_\_tests\_\_/media/onMediaSupplierInvoicePaid.test.js](../functions/__tests__/media/onMediaSupplierInvoicePaid.test.js) — same coverage shape
- [functions/\_\_tests\_\_/finance/postJournalEntryOnInvoicePaid.test.js](../functions/__tests__/finance/postJournalEntryOnInvoicePaid.test.js) — debits/credits balance check, unknown-kind guard, PO `postedToGL` flip
- ⏳ Playwright lifecycle spec extending the Phase 3 e2e (`approve talent invoice → assert PO + JE land within 5s`) — deferred to Phase 3.H test-id backfill (the spec needs stable selectors on the talent invoice approval page).

### ✅ 5. Chart of accounts
Inlined in `functions/src/finance/postJournalEntryOnInvoicePaid.js:35-48`:

| Source kind | Debit | Credit |
|---|---|---|
| `TALENT_FREELANCER` | `5010` Contractor Fees — Talent & Freelancers | `2050` Accounts Payable — Contractors |
| `MEDIA_SUPPLIER` | `5020` Media Spend — Agencies & Suppliers | `2051` Accounts Payable — Media |
| `CLIENT_REVENUE_RECOGNISED` | `1200` Accounts Receivable — Clients | `4000` Service Revenue — Agencies |

This is a code-level mapping for Phase 4.1. Phase 5.F (go-live) should
migrate it to a `finance_config/chart_of_accounts` Firestore doc so
the finance team can amend codes without a deploy.

## Functions barrel

[functions/index.js:4793-4795](../functions/index.js) re-exports the
three triggers next to the Phase 3 consumers. The `domain_events`
outbox catalogue in [functions/src/platform/outbox.js:62-78](../functions/src/platform/outbox.js)
declares the 4 new event types alongside the 13 Phase 3 events.

## Acceptance gate

Plan §15 acceptance for Phase 4: _"Media plan attached to campaign,
buy logged, supplier invoice triggers PO + journal entry."_

The full chain is now provable end-to-end at the CFn / integration
level:

1. AM creates a media plan → buys logged → supplier invoice submitted.
2. AM marks supplier invoice PAID → `MediaSupplierInvoicePaid` lands in `domain_events`.
3. `onMediaSupplierInvoicePaid` creates `purchase_orders/po_media_<id>` + emits `PurchaseOrderRaised`.
4. `postJournalEntryOnInvoicePaid` creates `journal_entries/je_media_supplier_<poId>` with balanced debit/credit, flips PO `postedToGL = true`.

The talent path is identical with `TalentInvoiceApproved` as the
upstream trigger.

UI-driven verification (Playwright) waits on Phase 3.H test-ids.
