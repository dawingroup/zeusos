/**
 * Has the record behind a task already been dealt with?
 *
 * The reverse of task completion: when the ENTITY a task is about reaches a
 * resolved state on its own screen (the IWO was accepted, the invoice paid,
 * the quote decided), the task auto-completes instead of sitting in an inbox.
 * Predicates live here so the hourly auto-close, the stale sweep and the
 * event trigger cannot drift apart.
 *
 * `resolveEntity(db, task)` → 'resolved' | 'open' | 'missing' | 'unsupported' | 'error'
 *
 * Entity types are the ZeusOS aggregate types the outbox emits, lower-cased
 * (`IWO` → 'iwo', `MasterJob` → 'master_job'). A task's own `sourceRuleId`
 * can narrow the predicate: the "Accept this IWO" task is resolved the moment
 * the IWO leaves ISSUED, long before the IWO is terminal.
 */

const { IWO_TERMINAL_STATES } = require('../../assignment/lib/iwo-state-machine');

const DEFAULT_TERMINAL = ['CLOSED', 'CANCELLED', 'COMPLETED', 'ARCHIVED', 'VOID', 'REJECTED'];

/**
 * Per entity type: where the record lives, which field holds its state, and
 * which values mean "dealt with". `rules` narrows by the task's sourceRuleId.
 */
const ENTITY_SOURCES = Object.freeze({
  iwo: {
    collection: 'internal_work_orders',
    field: 'state',
    resolved: IWO_TERMINAL_STATES,
    rules: {
      // The receiving brand decided — accepted or rejected — so the acceptance task is over.
      accept_iwo: (doc) => doc.state !== 'ISSUED',
      // A rung review is over once the chain moved past the rung it was filed
      // for, the whole chain was granted, or the IWO is terminal.
      review_at_next_rung: (doc, task) => {
        if (IWO_TERMINAL_STATES.includes(doc.state)) return true;
        if (doc.state === 'ACCEPTED_INTERNALLY') return true;
        const current = doc.approvalChain && doc.approvalChain.currentRung;
        const rung = task && task.rung != null ? task.rung : null;
        return rung != null && current != null && current !== rung;
      },
    },
  },
  master_job: { collection: 'master_jobs', field: 'status', resolved: DEFAULT_TERMINAL },
  client_invoice: { collection: 'client_invoices', field: 'status', resolved: ['PAID', 'VOID', 'CANCELLED', 'WRITTEN_OFF'] },
  intercompany_invoice: { collection: 'intercompany_invoices', field: 'status', resolved: ['SETTLED', 'PAID', 'VOID', 'CANCELLED'] },
  quote: { collection: 'quotes', field: 'status', resolved: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'] },
  sow: { collection: 'sows', field: 'status', resolved: ['ACTIVE', 'APPROVED', 'CANCELLED', 'CLOSED', 'REJECTED'] },
  change_order: { collection: 'change_orders', field: 'status', resolved: ['APPROVED', 'REJECTED', 'CANCELLED'] },
  msa: { collection: 'msas', field: 'status', resolved: ['ACTIVE', 'TERMINATED', 'EXPIRED', 'CANCELLED'] },
  purchase_order: { collection: 'purchase_orders', field: 'status', resolved: ['RECEIVED', 'CLOSED', 'CANCELLED', 'PAID', 'VOID'] },
  talent_invoice: { collection: 'talent_invoices', field: 'status', resolved: ['PAID', 'VOID', 'CANCELLED', 'REJECTED'] },
  media_supplier_invoice: { collection: 'media_supplier_invoices', field: 'status', resolved: ['PAID', 'VOID', 'CANCELLED'] },
});

/** Aggregate type (as the outbox spells it) → entity type key. */
const AGGREGATE_TO_ENTITY_TYPE = Object.freeze({
  IWO: 'iwo',
  MasterJob: 'master_job',
  ClientInvoice: 'client_invoice',
  InterCompanyInvoice: 'intercompany_invoice',
  Quote: 'quote',
  SOW: 'sow',
  ChangeOrder: 'change_order',
  MSA: 'msa',
  PurchaseOrder: 'purchase_order',
  TalentInvoice: 'talent_invoice',
  MediaSupplierInvoice: 'media_supplier_invoice',
  Client: 'client',
  Agent: 'agent',
  JournalEntry: 'journal_entry',
  CostAllocation: 'cost_allocation',
});

function entityTypeForAggregate(aggregateType) {
  if (!aggregateType) return null;
  if (AGGREGATE_TO_ENTITY_TYPE[aggregateType]) return AGGREGATE_TO_ENTITY_TYPE[aggregateType];
  return String(aggregateType).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Entity types the engine can judge at all. */
const AUTO_CLOSE_ENTITY_TYPES = new Set(Object.keys(ENTITY_SOURCES));

/**
 * May this task be auto-closed when its record resolves? Notices are read,
 * not done, and a person's own task has no record behind it.
 */
function autoCloseAllowed(task) {
  if (!task || !task.entityType || !task.entityId) return false;
  if (task.kind === 'notify') return false;
  if (task.source === 'personal') return false;
  if (task.autoClose === false) return false;
  return AUTO_CLOSE_ENTITY_TYPES.has(task.entityType);
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} task
 * @param {{ cache?: Map<string, object|null> }} [opts] - dedupes record reads across a sweep
 */
async function resolveEntity(db, task, { cache } = {}) {
  const source = task && task.entityType ? ENTITY_SOURCES[task.entityType] : null;
  if (!source || !task.entityId) return 'unsupported';
  const key = `${source.collection}/${task.entityId}`;
  try {
    let doc;
    if (cache && cache.has(key)) {
      doc = cache.get(key);
    } else {
      const snap = await db.collection(source.collection).doc(task.entityId).get();
      doc = snap.exists ? snap.data() : null;
      if (cache) cache.set(key, doc);
    }
    if (!doc) return 'missing';
    const ruleFn = task.sourceRuleId && source.rules ? source.rules[task.sourceRuleId] : null;
    if (ruleFn) return ruleFn(doc, task) ? 'resolved' : 'open';
    const value = doc[source.field];
    return source.resolved.includes(value) ? 'resolved' : 'open';
  } catch (err) {
    return 'error';
  }
}

module.exports = {
  ENTITY_SOURCES,
  AGGREGATE_TO_ENTITY_TYPE,
  AUTO_CLOSE_ENTITY_TYPES,
  entityTypeForAggregate,
  autoCloseAllowed,
  resolveEntity,
};
