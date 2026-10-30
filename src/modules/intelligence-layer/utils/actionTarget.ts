/**
 * "When someone picks this item, where should they land?" — answered once, here,
 * so the rail's Tasks and Actions segments send people to the same place.
 *
 *   RECORD-FIRST   The item IS the work: an IWO, a quote, a memo. Open the
 *                  record and act on it. A list first is a wasted click.
 *   CONTEXT-FIRST  The task carries something to read before touching the
 *                  record — steps to follow. It lands on the task in the inbox,
 *                  which links the record.
 *
 * A task with no routable entity is always context-first: there is nowhere else
 * to send it, and the bare inbox drops them in a list holding what they clicked.
 */
import { getEntityRoute, recordTypeForEntity } from './getEntityRoute';

/** Deep link that opens the inbox with this task's detail already open. */
export function taskDrawerRoute(taskId: string): string {
  return `/intelligence/inbox?task=${encodeURIComponent(taskId)}`;
}

/** Short, rail-sized noun for an entity, keyed by record type. */
const RECORD_SHORT_LABEL: Record<string, string> = {
  masterJob: 'job',
  iwo: 'IWO',
  client: 'client',
  msa: 'MSA',
  sow: 'SOW',
  changeOrder: 'change order',
  quote: 'quote',
  rateCard: 'rate card',
  clientInvoice: 'invoice',
  intercompanyInvoice: 'inter-co invoice',
  employee: 'employee',
  roleProfile: 'role',
  mediaPlan: 'media plan',
  productionJob: 'production job',
  talentProfile: 'talent',
  purchaseOrder: 'PO',
  journalEntry: 'journal',
  supplier: 'supplier',
  lead: 'lead',
  asset: 'asset',
  assetCollection: 'collection',
  objective: 'objective',
  kpi: 'KPI',
  scorecard: 'scorecard',
  memo: 'memo',
};

export function entityShortLabel(entityType?: string | null): string {
  if (!entityType) return 'record';
  const type = recordTypeForEntity(entityType);
  return (type && RECORD_SHORT_LABEL[type]) || entityType.replace(/[_-]/g, ' ').toLowerCase();
}

export interface TaskTargetInput {
  id: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  sourceModule?: string;
  checklistItems?: unknown[] | null;
}

export interface ActionTarget {
  /** Where selecting the item takes you. */
  go: string;
  /** Label for the primary button ("Open IWO", "Read context"). */
  goLabel: string;
  /** The task itself, when `go` is the record. */
  contextGo?: string;
  contextFirst: boolean;
}

export function resolveTaskTarget(task: TaskTargetInput): ActionTarget {
  const drawer = taskDrawerRoute(task.id);
  const record = getEntityRoute({
    entityType: task.entityType,
    entityId: task.entityId,
    projectId: task.projectId,
    sourceModule: task.sourceModule,
  });
  const hasSteps = Array.isArray(task.checklistItems) && task.checklistItems.length > 0;
  if (!record || hasSteps) return { go: drawer, goLabel: 'Read context', contextFirst: true };
  return { go: record, goLabel: `Open ${entityShortLabel(task.entityType)}`, contextGo: drawer, contextFirst: false };
}
