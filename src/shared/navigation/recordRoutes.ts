/**
 * recordRoutes — single source of truth for "where does a linked record live?".
 *
 * Maps an entity type + the ids in hand to its detail-page route, mirroring
 * the route table in `src/router/index.tsx`. `RecordLink` and `getEntityRoute`
 * read from here so a reference to a record always lands on the page that
 * exists, never on a path somebody remembered.
 *
 * Pure module: no React, no hooks. Returns `path: null` when the ids required
 * to build a real route are missing or the type has no page of its own
 * (callers degrade to plain text).
 *
 * `guard` names the access shape the route sits behind, so a future
 * permission-aware link can run the same check the route guard runs:
 *   parent   — ParentOrgGuard (Zeus Group principals only)
 *   brand    — BrandAccessGuard (parent, or the client's primaryBrandId brand)
 *   delivery — SubsidiaryDeliveryGuard (the serving brand's delivery users)
 *   staff    — any signed-in staff user
 */

export type RecordEntityType =
  | 'masterJob'
  | 'iwo'
  | 'client'
  | 'msa'
  | 'sow'
  | 'changeOrder'
  | 'quote'
  | 'rateCard'
  | 'clientInvoice'
  | 'intercompanyInvoice'
  | 'employee'
  | 'roleProfile'
  | 'mediaPlan'
  | 'productionJob'
  | 'talentProfile'
  | 'purchaseOrder'
  | 'journalEntry'
  | 'supplier'
  | 'lead'
  | 'asset'
  | 'assetCollection'
  | 'objective'
  | 'kpi'
  | 'scorecard'
  | 'memo';

export type RecordGuard = 'parent' | 'brand' | 'delivery' | 'staff';

export interface RecordTargetParams {
  /** Primary id of the record being linked. */
  id: string;
  /** Owning client (needed for msa / sow / changeOrder). */
  clientId?: string;
  /** Owning MSA (needed for sow / changeOrder). */
  msaId?: string;
  /** Owning SOW (needed for changeOrder). */
  sowId?: string;
}

export interface RecordTarget {
  /** Route to navigate to, or null when this entity has no routed page or ids are missing. */
  path: string | null;
  guard: RecordGuard;
}

const enc = encodeURIComponent;

/** Build the detail-page target for a linked record. Pure. */
export function resolveRecordTarget(type: RecordEntityType, params: RecordTargetParams): RecordTarget {
  const { id, clientId, msaId, sowId } = params;
  if (!id) return { path: null, guard: 'staff' };

  switch (type) {
    case 'masterJob':
      return { path: `/master-jobs/${enc(id)}`, guard: 'brand' };
    case 'iwo':
      return { path: `/delivery/iwo/${enc(id)}`, guard: 'delivery' };
    case 'client':
      return { path: `/clients/${enc(id)}`, guard: 'brand' };
    case 'msa':
      return { path: clientId ? `/clients/${enc(clientId)}/msas/${enc(id)}` : null, guard: 'brand' };
    case 'sow':
      return { path: clientId && msaId ? `/clients/${enc(clientId)}/msas/${enc(msaId)}/sows/${enc(id)}` : null, guard: 'brand' };
    case 'changeOrder':
      return {
        path: clientId && msaId && sowId
          ? `/clients/${enc(clientId)}/msas/${enc(msaId)}/sows/${enc(sowId)}/change-orders/${enc(id)}`
          : null,
        guard: 'brand',
      };
    case 'quote':
      return { path: `/pricing/quotes/${enc(id)}`, guard: 'parent' };
    case 'rateCard':
      return { path: `/pricing/rate-cards/${enc(id)}`, guard: 'parent' };
    case 'clientInvoice':
      return { path: `/billing/client-invoices/${enc(id)}`, guard: 'parent' };
    case 'intercompanyInvoice':
      // Listed on /billing/intercompany; no detail page of its own yet.
      return { path: null, guard: 'parent' };
    case 'employee':
      return { path: `/hr/employees/${enc(id)}`, guard: 'staff' };
    case 'roleProfile':
      return { path: `/hr/role-profiles/${enc(id)}`, guard: 'parent' };
    case 'mediaPlan':
      return { path: `/media/${enc(id)}`, guard: 'staff' };
    case 'productionJob':
      return { path: `/production/${enc(id)}`, guard: 'staff' };
    case 'talentProfile':
      return { path: `/talent/${enc(id)}`, guard: 'staff' };
    case 'purchaseOrder':
      return { path: `/procurement/purchase-orders/${enc(id)}`, guard: 'staff' };
    case 'journalEntry':
      return { path: `/procurement/journal-entries/${enc(id)}`, guard: 'staff' };
    case 'supplier':
      return { path: `/suppliers/${enc(id)}`, guard: 'staff' };
    case 'lead':
      return { path: `/crm/${enc(id)}`, guard: 'staff' };
    case 'asset':
      return { path: `/assets/${enc(id)}`, guard: 'staff' };
    case 'assetCollection':
      return { path: `/assets/collections/${enc(id)}`, guard: 'staff' };
    case 'objective':
      return { path: `/strategy/okrs/${enc(id)}`, guard: 'staff' };
    case 'kpi':
      return { path: `/strategy/kpis/active/${enc(id)}`, guard: 'staff' };
    case 'scorecard':
      return { path: `/strategy/kpis/scorecards/${enc(id)}`, guard: 'staff' };
    case 'memo':
      // Who may read a memo is decided per document (participants, the brand,
      // parent org, admins) by the `memos` rules; the page shows its own
      // "not found / no access" state.
      return { path: `/memos/${enc(id)}`, guard: 'staff' };
    default:
      return { path: null, guard: 'staff' };
  }
}
