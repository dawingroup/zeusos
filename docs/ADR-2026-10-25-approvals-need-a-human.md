# ADR-2026-10-25 — Approvals need a human

**Status:** Accepted · **Scope:** every record whose approval moves money out of the group or past a commercial gate · **Ported from:** DawinOS ADR-0002 (approval transitions), with the DawinOS audit finding and the ZeusOS finding below.

## Context

An approval is the one write in the system where a person takes responsibility for a number. Two audits found the field that is supposed to carry that responsibility empty:

- **DawinOS (2026-10-09):** 47 of 64 past-draft purchase orders had no approver recorded; payables were approved by a client click that wrote `approvedBy: 'user'` and checked nothing.
- **ZeusOS (2026-10-25, this port):** `InvoiceApprovalPanel` approved freelancer invoices with `approveTalentInvoice(invoice.id, 'current-user')` — a `writeBatch` from the browser that set `status: 'APPROVED'` and recorded the literal string `'current-user'` as the approver, then emitted the `TalentInvoiceApproved` outbox event that raises a purchase order and a journal entry. Every talent invoice approved before this ADR names nobody. The media-house invoice panel has the same shape.

The Firestore rules let any parent-org principal perform that update, so the server never saw an approval at all — only its consequences.

## Decision

1. **An approval names a person.** `approvedBy` (and each signature's `approvedBy`) is a Firebase Auth uid of a human. Machine and placeholder actors (`current-user`, `user`, `system`, `agent:*`, `mcp-agent`, `seed-script`, `unknown`, …) may never be recorded as an approver. The list lives in `functions/src/approvals/policy.js` with a client mirror in `src/modules/approvals/routing/policy.ts`; the lockstep test pins the two.
2. **The raiser is never the approver.** The person who created the record (`createdBy` on invoices, `raisedBy` on manual POs) cannot sign it — admins and owners included. No role is exempt.
3. **One person, one signature.** Where a record needs several signatures, a uid signs at most one level.
4. **Approval into the approved state is a server write.** For supplier spend (`talent_invoices`, `media_supplier_invoices`) the only door into `APPROVED` is the `approveTalentInvoice` / `approveMediaSupplierInvoice` callables; the rules refuse any client write that enters `APPROVED` (`isEnteringApproved()`). Where a client write may still touch `approvedBy` (manual `purchase_orders` edits), the rules require it to name the caller and not the raiser (`approverIsCallerNotRaiser()`).
5. **Who may sign is data.** The signature ladder (purpose × value band × tier) is configuration at `systemSettings/approvalRouting`, validated identically on the client and the server, and frozen onto each record as its plan when first touched. See [APPROVAL_ROUTING_V2.md](APPROVAL_ROUTING_V2.md).
6. **Agents may not approve.** Phase 6.F agents stay `draft_only` on these collections; an agent proposing an approval creates the task, a person signs it. This is the same capability-is-data principle as v1.2 §6.3.

## Consequences

- The talent and media invoice panels and the Approvals inbox call the callables; the client services no longer write `APPROVED`.
- Records approved before this ADR carry `approvedBy: 'current-user'`. They are left as they are (rewriting history would be worse) and are visible as such; a backfill that marks them `approvalProvenance: 'pre-ADR'` is a follow-up.
- Reject and pay remain client writes (they commit no money a person has not already approved), still parent-org gated.
- The ECD ladder (`advanceApprovalRung`), SOW approval, and change-order approval were already server writes with a real uid; this ADR adds nothing to them beyond the inbox's client-side raiser check. Extending `forbidSelfApproval` to those callables is the natural next step.

## Enforcement map

| Layer | Where |
|---|---|
| Rules | `isEnteringApproved()`, `approverIsCallerNotRaiser(field)` on `talent_invoices`, `media_supplier_invoices`, `purchase_orders`; tests in `src/testing/rules/approval-human.test.ts` |
| Cloud Functions | `functions/src/approvals/approveSupplierInvoice.js` (`isMachineActor`, `planSignature` self-approval / distinct-signer / seniority checks); tests in `functions/__tests__/approvals/` |
| UI | `src/modules/approvals/approvalActions.ts` (`assertNotSelfApproval`), rows the viewer raised show no decision buttons |
