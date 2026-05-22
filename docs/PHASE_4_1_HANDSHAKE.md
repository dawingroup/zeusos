# Phase 4.1 — Procurement / Finance handshake

This branch (`phase-4-procurement-handshake`) scaffolds the last piece
needed to close the **Phase 4 acceptance gate** from plan §15:

> "Media plan attached to campaign, buy logged, **supplier invoice
> triggers PO + journal entry**."

Phase 4 PR #10 shipped the module surfaces (media / production / talent)
with their types, services, and UI pages. What it deferred — and what
this branch sets the harness for — is the **cross-module wiring** from
those modules into Procurement and Finance.

## What's in the scaffold

```
functions/src/
├── talent/onTalentInvoiceApproved.js      ← outbox consumer (talent → PO)
├── media/onMediaSupplierInvoicePaid.js    ← outbox consumer (media → PO)
└── finance/postJournalEntryOnInvoicePaid.js  ← outbox consumer (PO → JE)

functions/src/platform/outbox.js
└── DOMAIN_EVENT_TYPES   13 → 17  (4 new events added)

src/modules/procurement/
└── types/purchase-order.types.ts          ← PO type + id builder
```

Each Cloud Function is **registered with a real trigger** so the
runtime knows about it. Bodies are documented TODOs that follow the
Phase 3.B outbox-consumer pattern (Firestore trigger on
`domain_events/{eventId}` + `processedBy` idempotency tag +
deterministic doc ids). A SCAFFOLD short-circuit tags the event so
events aren't silently dropped during the implementation window.

## The 4 new domain events

| Event | Emitted by | Consumed by | Result |
|---|---|---|---|
| `TalentInvoiceApproved` | `approveTalentInvoiceFn` (TBD) | `onTalentInvoiceApproved` | `purchase_orders/po_talent_${id}` |
| `MediaSupplierInvoicePaid` | `markMediaSupplierInvoicePaidFn` (TBD) | `onMediaSupplierInvoicePaid` | `purchase_orders/po_media_${id}` |
| `PurchaseOrderRaised` | the two consumers above | `postJournalEntryOnInvoicePaid` | `journal_entries/je_po_raised_${id}` |
| `JournalEntryPosted` | `postJournalEntryOnInvoicePaid` | (audit log + dashboards) | terminal |

## What still needs to land

To turn the scaffold into a passing acceptance gate:

### 1. Emit the upstream events
- `src/modules/talent/services/talent-invoice.service.ts` already has
  the `approve()` transition. It needs to call a new callable
  `approveTalentInvoiceFn` that writes the talent_invoice update AND
  emits `TalentInvoiceApproved` in the same Firestore transaction
  (use `appendDomainEvent` from `functions/src/platform/outbox.js`).
- `src/modules/media/services/media-supplier-invoice.service.ts` (new)
  — same shape for media supplier invoices on the PAID transition.

### 2. Fill in the CFn bodies
Replace each SCAFFOLD short-circuit with the TODO block above it. The
TODO blocks specify:
- Doc shape to write
- Transactional read/write order
- processedBy tagging discipline
- Idempotency guarantees

### 3. Firestore rules
Add to `firestore.rules`:
```
match /purchase_orders/{poId} {
  allow read: if isParentOrgPrincipal();
  allow write: if false;   // CFn-only
}
match /journal_entries/{jeId} {
  allow read: if isParentOrgPrincipal();
  allow write: if false;
}
```
Both leak supplier costs that subsidiaries must not see.

### 4. Tests
- `functions/__tests__/talent/onTalentInvoiceApproved.test.js`
- `functions/__tests__/media/onMediaSupplierInvoicePaid.test.js`
- `functions/__tests__/finance/postJournalEntryOnInvoicePaid.test.js`
- A Playwright lifecycle spec extending the Phase 3 lifecycle:
  approve a talent invoice → assert PO + JE land within 5s.

### 5. Chart of accounts
The finance consumer needs an account-code mapping. Open question
for the finance owner:
- Which account code is `talent contractor expense` debited to?
- Which is `media spend` debited to?
- Where does the credit-side AP land for each kind?

A small `finance_config/chart_of_accounts` Firestore doc (or a
checked-in JSON) is the lightest landing — see the TODO block in
`postJournalEntryOnInvoicePaid.js` for the integration point.

## Wiring into the functions barrel

`functions/index.js` re-exports the three new triggers next to the
existing Phase 3 consumers. Adding the requires + the module.exports
entries is the last mechanical step before the scaffold deploys.

## Why this is a scaffold and not an implementation

The handshake is small in lines-of-code but large in **integration
surface**: it crosses Procurement (which currently has no module),
Finance (which has types but no JE-writer service), and the
chart-of-accounts (which lives outside engineering scope). Landing
the harness as a scaffold gives the next implementer:
- All four event types defined and validated
- Three real CFn triggers wired
- A documented contract for upstream emitters
- A PO type ready for the rules layer

…without committing to chart-of-accounts decisions or stub
implementations that would need to be unwound.
