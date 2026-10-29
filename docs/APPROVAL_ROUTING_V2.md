# Approval routing v2 — supplier spend

Who signs money leaving the group, in what order. Port of DawinOS's approval-routing Phase 2 (purpose × band × signatures) reshaped for Zeus Group. Companion to [ADR-2026-10-25 — approvals need a human](ADR-2026-10-25-approvals-need-a-human.md).

## What is routed

One module, **`supplier_spend`**: a third party is paid.

| Record | Purpose | Approval door |
|---|---|---|
| `talent_invoices` (freelancers) | `talent` | `approveTalentInvoice` callable |
| `media_supplier_invoices` (media houses) | `media` | `approveMediaSupplierInvoice` callable |
| `purchase_orders` kind `VENDOR_OTHER` (manual) | `overhead`, or `production` when linked to a production job | rules only today (`approverIsCallerNotRaiser`); the callable is the follow-up |

Purposes: `media | production | talent | overhead`. A record with no resolvable purpose is refused while `requirePurpose` is on.

## The ladder (defaults)

Amounts are compared against the record's own `amountMinor`, in the module's currency (**KES**, minor units). No FX conversion happens; a record in another currency is routed as-is and its plan carries `currencyMismatch: true` so finance can see it.

| Band | Up to (KES) | Signatures |
|---|---|---|
| `lead` | 100,000 | 1 — the delivery lead the **purpose** names (`manager`) |
| `brand_md` | 1,000,000 | 1 — Brand MD (`admin`) |
| `group` | 5,000,000 | 2 — Brand MD (`admin`) · Zeus Group CEO (`owner`) |
| `board` | above | 3 — Brand MD · Zeus Group CEO · Group Finance (`owner`) |

**Purpose rules** decide who the level-1 lead is (`Media lead`, `Production lead`, `Talent lead`); **overheads** skip the lead and start at the Brand MD. A purpose rule may only make level 1 *more* senior than the band says, never less. Each rule can escalate level 1 above an amount (`escalateAboveMinor`) or when the record is not linked to an engagement (`requireAnyLink`), to its `escalateTo` signer.

**Tier** raises the band: a `TIER_1` engagement climbs one band at the same amount (`tierBandRaise: { TIER_1: 1 }`). The top band saturates.

**Aggregate oversight** (ships empty; an admin turns it on) adds a signer when a running total trips:

| Kind | Trips when |
|---|---|
| `supplier_rolling` | approved + paid spend with this supplier in the last `windowDays`, plus this record, exceeds `thresholdMinor` |
| `master_job_budget_pct` | approved spend on the engagement, plus this record, reaches `thresholdPct` of its `ceilingMinor` — or the record is unlinked / the engagement unbudgeted |
| `weekly_cash` | (schema present; evaluation wired when a brand turns it on) |

The added signer is deduped against the band's own signers; levels are renumbered 1..n.

## Invariants the config cannot break

Validated identically by `functions/src/approvals/routing.js` and `src/modules/approvals/routing/engine.ts` (lockstep-tested):

1. Thresholds strictly increase; the top band is unbounded.
2. Level-1 authority never decreases as value rises; a higher band never needs fewer signatures.
3. Signature levels are `1..n` with no gaps; every role is a `GlobalRole`.
4. A stored config that fails validation is **not** partially applied — routing falls back to the defaults wholesale and logs why.

## How a signature is taken

`approveTalentInvoice({ invoiceId, note?, idempotencyKey? })`:

1. Caller is a parent-org principal **and a person** (`isMachineActor` refuses `current-user`, `agent:*`, …).
2. First touch freezes the routing decision onto the record as `approval` (band, purpose, signatures, tier raise, aggregate rules tripped). Later config edits do not rewrite an in-flight plan.
3. The caller signs the **lowest pending level** if they are at least as senior as its `approverRole`, or pinned to it by `approverEmail` or as a holder of its `roleProfileId` (active `role_assignments` → `employees/{id}.userId`).
4. Refused when the caller raised the record (`self_approval`, admins included), already signed another level (`already_signed`), or is under tier (`under_tier`).
5. When the last level is signed: `status: 'APPROVED'`, `approvedBy` = final signer, and (talent) the `TalentInvoiceApproved` outbox event the PO consumer listens for. Until then the record stays `SUBMITTED` with `approval.pendingLevel` set.

The Approvals inbox (`/approvals`) shows the record's progress (`level 2 of 3 · Zeus Group CEO`) and offers Approve only to people who could plausibly sign; the server decides.

## Config document

`systemSettings/approvalRouting` — `{ version: 2, modules: { supplier_spend: ApprovalModuleRoutingV2 }, updatedAt, updatedBy }`. Edited at **Settings → Approval routing** (`/settings/approval-routing`, parent-org admins). "Reset to defaults" restores the table above. The page validates with the same engine the Cloud Function uses and previews the decision for an amount / purpose / tier before saving.

## Tests

- `functions/__tests__/approvals/routing.test.js` — bands, purposes, tier raise, aggregates, dedupe, validation, loader fallback, `planSignature`.
- `functions/__tests__/approvals/approveSupplierInvoice.test.js` — the callable against the in-memory Firestore stub (single / multi-signature, raiser refused, machine actor refused, tier raise, pinned role-profile holder, aggregates, media variant, idempotency).
- `src/modules/approvals/routing/__tests__/routingLockstep.test.ts` — TS mirror ↔ CFn engine on >1000 decisions and every validation case.
- `src/testing/rules/approval-human.test.ts` — the rules door (emulator).
