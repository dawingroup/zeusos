# ZeusOS Domain Model (Phase 3.A.5)

Authoritative domain map. Hard-forks from plan §14 / Tech Spec v1.0 §3–§8.
For full prose see those documents; this page is a quick reference for code
authors and reviewers.

## Invariant: Commercial Gravity

> The client experiences **one agency, one price, one contract, one
> invoice**, while the work is actually executed across several
> independent legal entities that each keep their own books.

Pricing, contracts, and external billing live exclusively at the parent.
Every cross-entity movement of **work** is an Internal Work Order; every
cross-entity movement of **money** is an Inter-Company Invoice at a
governed transfer price.

## Entity sketch

```
 Client 1───* MSA 1───* SOW 1───* ChangeOrder
                         │
                         ▼
                       Quote ──── pinned to ──── RateCard (per Org, versioned)
                         │
                         ▼
                     MasterJob ───────────────┐
                         │                    │ allocates
                         ▼ *                  ▼
                 InternalWorkOrder ──── BudgetHold (HELD→LOCKED→SETTLED/RELEASED)
                  │  │  │  │
       ┌──────────┘  │  │  └─────── HandoffPacket (1:1, gates ISSUED)
       ▼ *           ▼ * ▼ *
   TimeEntry     CostEntry  Deliverable
       │
       └── on IWO.CLOSED ──→ InterCompanyInvoice (sub → parent, transfer price)
                                                    │
                                                    ▼ rolled up by MasterJob
                                              ClientInvoice ──* ClientInvoiceLine
                                              (UNIQUE per master_job)
```

Every state change emits a `DomainEvent` into the append-only `domain_events`
outbox (see `src/modules/platform/types/domain-event.types.ts` for the 11
canonical event names).

## Bounded contexts

| Module path | Owns | Must never |
|---|---|---|
| `src/core/settings` (Organization) | Legal-entity org records — `kind`, `is_legal_entity`, `base_currency`, `gl_connection_id`. | Let a SUBSIDIARY org hold a commercial role. |
| `src/modules/contracts` | `Client`, `MSA`, `SOW`, `ChangeOrder`. | Let delivery teams edit terms. |
| `src/modules/pricing` | `RateCard`, `RateCardLine`, `Quote`, `QuoteLine`. Pricing engine builds quote = cost × markup. | Expose `cost_minor` to subsidiary or client. |
| `src/modules/assignment` | `MasterJob`, `InternalWorkOrder`, `HandoffPacket`, `BudgetHold`. IWO state machine in `constants/iwo-states.ts`. | Issue an IWO without a locked budget. |
| `src/modules/delivery` | `TimeEntry`, `CostEntry`, `Deliverable`. Per-subsidiary actuals against an IWO. | Contact the client on price or scope. |
| `src/modules/billing` | `ClientInvoice` (UNIQUE per MasterJob), GL adapters, FX. | Emit more than one non-void client invoice per master job. |
| `src/modules/intercompany` | `InterCompanyInvoice` (raised on IWO close, governed transfer price). | Net across entities silently. |
| `src/modules/platform` | `DomainEvent`, `IdempotencyKeyRecord` (transactional outbox + mutation idempotency). | Permit a domain event to be edited or deleted after emission. |

## Money

All monetary fields are stored as integer **minor units** (UGX cents = 1,
USD cents = 0.01) on a JavaScript `number`. JS `number` safely represents
integers up to 2⁵³ ≈ 9 quadrillion — comfortably above any conceivable
agency invoice — and avoids the `bigint` ↔ Firestore-Number marshaling
overhead. The canonical decision lives at
`src/modules/billing/types/money.types.ts`.

## Marketing-domain primitives

The Zeus profile constructs (14-stage workflow, ARAAM, IMC Team, Tier
System, 6-stage Creative Approval Chain, Performance Review) all live as
optional fields on `MasterJob.campaign` (the `Campaign` TypeScript type
in `src/modules/campaigns`). Per plan §14.14 the wire-format /
persistence label is `MasterJob`; `Campaign` is the marketing-UI view.

## Three layers of "subsidiary never quotes"

1. **Authorization (Firestore rules + Cloud Function callable auth).** `firestore.rules` `isParentOrgPrincipal()` / `isSubsidiaryOrgPrincipal()` gate every commercial collection. Subsidiary principals are rejected from `msas`, `sows`, `change_orders`, `quotes`, `client_invoices` and from reading `rate_card_lines.cost_minor` / `quote_lines.cost_minor`. Cloud Functions add a second `home_org_kind == 'PARENT'` check.
2. **API.** Pricing / Contracts / Billing callables return `403 COMMERCIAL_SCOPE_REQUIRED` to SUBSIDIARY principals regardless of token claims.
3. **Workflow.** The subsidiary delivery workspace UI (Phase 3.E) has no affordance to answer a client with a price — only `DirectClientRequestRouted` (route to AM).
