/**
 * Maps a task's source entity to the page that shows it.
 *
 * The route table itself is `src/shared/navigation/recordRoutes.ts`; this
 * module only translates the loose `entityType` strings a task carries
 * (`'IWO'`, `'internal_work_order'`, `'masterJob'`, …) onto a record type, so
 * "Open record" always lands on a page that exists.
 */
import { resolveRecordTarget, type RecordEntityType } from '@/shared/navigation/recordRoutes';

interface EntityRouteParams {
  entityType?: string;
  entityId?: string;
  projectId?: string;
  sourceModule?: string;
}

/** Lower-cased, separators removed: 'internal_work_order' | 'InternalWorkOrder' → 'internalworkorder'. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ENTITY_TYPES: Record<string, RecordEntityType> = {
  masterjob: 'masterJob',
  job: 'masterJob',
  campaign: 'masterJob',
  iwo: 'iwo',
  internalworkorder: 'iwo',
  workorder: 'iwo',
  client: 'client',
  msa: 'msa',
  sow: 'sow',
  changeorder: 'changeOrder',
  quote: 'quote',
  ratecard: 'rateCard',
  clientinvoice: 'clientInvoice',
  intercompanyinvoice: 'intercompanyInvoice',
  employee: 'employee',
  roleprofile: 'roleProfile',
  mediaplan: 'mediaPlan',
  productionjob: 'productionJob',
  talentprofile: 'talentProfile',
  talent: 'talentProfile',
  purchaseorder: 'purchaseOrder',
  journalentry: 'journalEntry',
  supplier: 'supplier',
  lead: 'lead',
  crmlead: 'lead',
  asset: 'asset',
  assetcollection: 'assetCollection',
  objective: 'objective',
  okr: 'objective',
  kpi: 'kpi',
  scorecard: 'scorecard',
  memo: 'memo',
};

/** The record type a task's `entityType` names, or null when it is not one we route. */
export function recordTypeForEntity(entityType: string | undefined): RecordEntityType | null {
  if (!entityType) return null;
  return ENTITY_TYPES[normalize(entityType)] ?? null;
}

/**
 * Returns a navigation route for the task's source entity.
 * Returns null if the combination is unrecognized or missing required IDs.
 */
export function getEntityRoute(params: EntityRouteParams): string | null {
  const { entityType, entityId } = params;
  if (!entityType || !entityId) return null;
  const type = recordTypeForEntity(entityType);
  if (!type) return null;
  return resolveRecordTarget(type, { id: entityId }).path;
}

/**
 * Returns a route to the task's parent "project" — in the agency model the
 * master job, or the work order when the task came from delivery.
 */
export function getProjectRoute(params: {
  projectId?: string;
  sourceModule?: string;
}): string | null {
  const { projectId, sourceModule } = params;
  if (!projectId) return null;
  const type: RecordEntityType = sourceModule === 'delivery' ? 'iwo' : 'masterJob';
  return resolveRecordTarget(type, { id: projectId }).path;
}
