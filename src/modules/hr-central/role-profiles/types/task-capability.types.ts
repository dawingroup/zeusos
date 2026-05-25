/**
 * Task Capability — the verb matrix from Addendum v1.2 §2.2.
 *
 * Capability is data, not code: authority is checked against typed
 * flags per event type rather than resolved through an RBAC role tree.
 * The same matrix drives human routing (who can `canApprove` a
 * `creative.internal_approval_requested` event) and agent gating
 * (which tools the dispatcher will execute).
 *
 * Phase 6.A.1: schema only. Wiring into the event/task engine lands
 * in Phase 6.E and into the agent dispatcher in Phase 6.F.
 */

/**
 * BusinessEvent name, formatted `<module>.<event>`.
 *
 * The full catalogue lives in src/modules/intelligence/config/event-catalog.ts
 * once Phase 6.E lands; until then this is structurally `string`. v1.2 §3.1
 * names the families: `campaign.*`, `iwo.*`, `creative.*`, `media.*`,
 * `financial.*`, `hr.*`.
 */
export type EventTypeName = string;

/**
 * Optional structured condition narrowing a capability — e.g.
 * "canApprove only if amount ≤ 5,000,000 UGX." Modelled as JSON for
 * now; a typed DSL can land in 6.A.2 if the surface grows.
 */
export interface TaskCondition {
  field: string;
  op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'not_in';
  value: unknown;
}

/**
 * Per-event verb matrix entry. Four-flag authority + optional
 * condition envelope. Exactly the shape called out in v1.2 §2.2.
 *
 * Per ADR-0001 Q2 ("brands also sell direct"), a capability can be
 * `brandScope`-restricted to a subset of sibling brands. When set,
 * the capability only fires for events whose aggregate belongs to
 * one of the listed brands. Examples:
 *
 *   - A Zeus Group AM has `brandScope: ['all']` on `quote.*` —
 *     they can quote for any brand's account.
 *   - A Zeus Digital Account Director has `brandScope: ['zeus-digital']`
 *     on `quote.*` — they can quote only for Zeus-Digital-owned
 *     accounts.
 *   - A brand-specific Studio Manager has `brandScope: ['zeus-the-agency']`
 *     on `creative.internal_approval_requested` — they can approve
 *     only at ZTA's ladder, not e.g. House of Zeus's.
 *
 * Resolution: `assertCommercialPrincipal({ allowedBrandIds })` reads
 * the role assignment's TaskCapability rows for the requested event,
 * filters by brandScope intersection, and grants if any row matches.
 *
 * Missing or `['all']` brandScope = no restriction (legacy behaviour,
 * what every pre-Q2 capability does).
 */
export interface TaskCapability {
  eventType: EventTypeName;
  taskTypes: string[];
  canInitiate: boolean;
  canExecute: boolean;
  canApprove: boolean;
  canDelegate: boolean;
  conditions?: TaskCondition[];

  /**
   * Subset of sibling brands this capability applies to. Optional;
   * undefined or `['all']` means no brand-scope restriction.
   * Values: 'zeus-the-agency' | 'zeus-digital' | 'labyrinth' |
   * 'odd-gorilla' | 'house-of-zeus' | 'zeus-group' | 'all'.
   */
  brandScope?: Array<'all' | 'zeus-group' | 'zeus-the-agency' | 'zeus-digital' | 'labyrinth' | 'odd-gorilla' | 'house-of-zeus'>;
}

/**
 * Typed approval authority — the "money / contract / scope" side of
 * the same matrix. Carries an amount ceiling so a Studio Manager can
 * approve up to one cap while a CD has a higher one without changing
 * code paths.
 */
export interface ApprovalAuthority {
  eventType: EventTypeName;
  maxAmountMinor?: number;
  currencyCode?: string;
  requiresCoApproval?: boolean;
  canApproveForScope?: string[];
}
