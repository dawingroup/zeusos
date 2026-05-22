/**
 * Internal Work Order state machine — the heart of the handoff engine.
 *
 * Spec §6.1 + transition table. NINE states + a transition table.
 * TYPES + CONSTANTS ONLY in this session — the runtime guards and Cloud
 * Function transitions land in Phase 3.B.
 *
 * Why the states matter:
 * - DRAFT → ISSUED is the moment budget is HELD. Holding at ISSUED
 *   (not ACCEPTED) closes the double-allocation race (spec §11.1).
 * - ACCEPTED → IN_PROGRESS gates cost postings, which are hard-blocked at
 *   100% burn (spec §11.2).
 * - DELIVERED is reversible via `request_revision` (AM-only) — keeps
 *   internal settlement aligned with accepted work (spec §11.10).
 * - CLOSED is what raises the inter-company invoice and settles the
 *   budget hold.
 */

export const IWO_STATES = [
  'DRAFT',
  'ISSUED',
  'ACCEPTED',
  'REJECTED',
  'IN_PROGRESS',
  'DELIVERED',
  'ACCEPTED_INTERNALLY',
  'CLOSED',
  'CANCELLED',
] as const;

export type IWOState = (typeof IWO_STATES)[number];

/**
 * Events that transition an IWO between states. Cloud Functions in Phase
 * 3.B implement the guards for each event.
 */
export const IWO_EVENTS = [
  'issue',
  'accept',
  'reject',
  'start',
  'post_cost',
  'deliver',
  'accept_internal',
  'request_revision',
  'close',
  'cancel',
] as const;

export type IWOEvent = (typeof IWO_EVENTS)[number];

/**
 * Authority required to fire an event. Driven by the receiver of the
 * IWO (delivery lead of the subsidiary it was issued to) or by
 * Account-Management. Used by Phase 3.B Cloud Function guards.
 */
export type IWOEventActor =
  | 'AM'                    // Account Management (parent-org actor)
  | 'DELIVERY_LEAD'         // Delivery lead of the receiving subsidiary
  | 'TIMEKEEPER'            // Anyone with timekeeper role on the IWO
  | 'AM_OR_DELIVERY_LEAD';

export interface IWOTransition {
  event: IWOEvent;
  from: IWOState;
  to: IWOState;
  actor: IWOEventActor;
  /** Human-readable guard summary; full guard implemented in Phase 3.B. */
  guard: string;
  /** Side-effects emitted by the transition (domain events, hold state
   *  changes, derived collection writes). */
  sideEffects?: string[];
}

/**
 * The transition table. Mirrors spec §6.1.1. Phase 3.B's Cloud Functions
 * read this to validate every `transitionIwo()` call.
 *
 * Edge / off-ramp transitions:
 * - `cancel` from any active state → CANCELLED. Modeled below as an
 *   array of pseudo-rows, one per origin state (kept explicit so the
 *   table is exhaustive).
 */
export const IWO_TRANSITIONS: readonly IWOTransition[] = [
  {
    event: 'issue',
    from: 'DRAFT',
    to: 'ISSUED',
    actor: 'AM',
    guard: 'SOW ACTIVE · quote ACCEPTED · budget HELD (same txn)',
    sideEffects: ['BudgetHold:HELD', 'IWOIssued event'],
  },
  {
    event: 'accept',
    from: 'ISSUED',
    to: 'ACCEPTED',
    actor: 'DELIVERY_LEAD',
    guard: 'Actor is delivery lead of receiving subsidiary',
    sideEffects: ['BudgetHold:HELD→LOCKED', 'IWOAccepted event'],
  },
  {
    event: 'reject',
    from: 'ISSUED',
    to: 'REJECTED',
    actor: 'DELIVERY_LEAD',
    guard: 'Reason required',
    sideEffects: ['BudgetHold:HELD→RELEASED', 'MasterJob.allocatedMinor decrement', 'IWORejected event'],
  },
  {
    event: 'start',
    from: 'ACCEPTED',
    to: 'IN_PROGRESS',
    actor: 'DELIVERY_LEAD',
    guard: '—',
  },
  {
    event: 'post_cost',
    from: 'IN_PROGRESS',
    to: 'IN_PROGRESS',
    actor: 'TIMEKEEPER',
    guard: 'cumulative ≤ budget (else 422 BUDGET_EXCEEDED)',
    sideEffects: ['BudgetThresholdCrossed event @ 80% / 100%'],
  },
  {
    event: 'deliver',
    from: 'IN_PROGRESS',
    to: 'DELIVERED',
    actor: 'DELIVERY_LEAD',
    guard: '≥1 deliverable attached',
    sideEffects: ['DeliverableSubmitted event'],
  },
  {
    event: 'accept_internal',
    from: 'DELIVERED',
    to: 'ACCEPTED_INTERNALLY',
    actor: 'AM',
    guard: 'All required acceptance criteria signed by AM',
  },
  {
    event: 'request_revision',
    from: 'DELIVERED',
    to: 'IN_PROGRESS',
    actor: 'AM',
    guard: 'AM-only — bounces IWO back to delivery',
  },
  {
    event: 'close',
    from: 'ACCEPTED_INTERNALLY',
    to: 'CLOSED',
    actor: 'AM',
    guard: '—',
    sideEffects: ['BudgetHold:LOCKED→SETTLED', 'InterCompanyInvoice raised', 'IWOClosed event'],
  },
  // cancel: AM authority from any active state
  ...(['ISSUED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED'] as const).map(
    (from): IWOTransition => ({
      event: 'cancel',
      from,
      to: 'CANCELLED',
      actor: 'AM',
      guard: 'AM authority',
      sideEffects: [
        'BudgetHold:HELD|LOCKED→RELEASED (or partial settle if work done)',
        'MasterJob.allocatedMinor decrement',
      ],
    }),
  ),
];

/**
 * O(1) lookup: `IWO_TRANSITION_LOOKUP[from][event]` → target state or
 * undefined if the transition is not permitted. Used by Phase 3.B
 * `transitionIwo()` to validate before running guards.
 */
export const IWO_TRANSITION_LOOKUP: Readonly<Partial<Record<IWOState, Partial<Record<IWOEvent, IWOState>>>>> =
  IWO_TRANSITIONS.reduce<Record<string, Record<string, IWOState>>>((acc, t) => {
    acc[t.from] ??= {};
    acc[t.from][t.event] = t.to;
    return acc;
  }, {});

/** Terminal states — once entered, no further transitions are valid. */
export const IWO_TERMINAL_STATES: readonly IWOState[] = ['REJECTED', 'CLOSED', 'CANCELLED'];

/** Active states — used by the `cancel` event's "any active" precondition
 *  and by the Phase 3.B helper that finds in-flight IWOs to reconcile. */
export const IWO_ACTIVE_STATES: readonly IWOState[] = [
  'ISSUED',
  'ACCEPTED',
  'IN_PROGRESS',
  'DELIVERED',
  'ACCEPTED_INTERNALLY',
];

// ─────────────────────────────────────────────────────────────────
// Budget hold lifecycle — runs in parallel to the IWO state
// ─────────────────────────────────────────────────────────────────

export const BUDGET_HOLD_STATES = ['HELD', 'LOCKED', 'SETTLED', 'RELEASED'] as const;
export type BudgetHoldState = (typeof BUDGET_HOLD_STATES)[number];
