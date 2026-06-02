/**
 * Server-side tool catalog (ZeusOS).
 *
 * Per tool: a description + a small JSON-Schema `input_schema`. Used to
 * (1) validate `input` at the dispatcher chokepoint, (2) expose per-agent
 * schemas to a future Claude tool-use loop. Schema dialect is a deliberate
 * subset: type / properties / required / enum / description.
 *
 * Kept in lockstep with AGENT_TOOLS in
 * src/modules/intelligence-layer/agents/types/agent.ts.
 */

// ─── Reusable fragments ──────────────────────────────────────────────────────

const READ_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Fetch a single doc by id instead of listing.' },
    limit: { type: 'number', description: 'Max docs (default 25, cap 200).' },
    filters: { type: 'object', description: 'Equality filters keyed by allowed field; value raw or {op,value}.' },
    orderBy: { type: 'object', description: 'Override ordering: {field, direction:"asc"|"desc"}.' },
    companyId: { type: 'string', description: 'Override the company scope (strategy reads).' },
  },
  required: [],
};

const SEARCH_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Search text (min 2 chars).' },
    limit: { type: 'number', description: 'Max hits (default 10, cap 50).' },
  },
  required: ['query'],
};

const NOTIFY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
    targetUserId: { type: 'string' },
    targetBrandId: { type: 'string' },
    sourceModule: { type: 'string' },
    entityType: { type: 'string' },
    entityId: { type: 'string' },
    actionUrl: { type: 'string' },
  },
  required: ['title'],
};

// ─── Per-tool catalog ────────────────────────────────────────────────────────

const READ_TOOL_IDS = [
  'read.master_jobs', 'read.internal_work_orders', 'read.clients', 'read.client_invoices',
  'read.intercompany_invoices', 'read.quotes', 'read.media_plans', 'read.talent',
  'read.production', 'read.crm_deals', 'read.employees', 'read.okrs', 'read.kpis',
  'read.scorecards', 'read.strategy_documents', 'read.finance_journals', 'read.competitors',
  'read.regulatory_changes', 'read.business_events', 'read.audit_trail',
];

const TOOL_CATALOG = {};
for (const id of READ_TOOL_IDS) {
  TOOL_CATALOG[id] = { description: `Read ${id.slice('read.'.length).replace(/_/g, ' ')}.`, input_schema: READ_INPUT_SCHEMA };
}

// SEARCH
TOOL_CATALOG['search.knowledge_base'] = { description: 'Search attached skill docs + business memory.', input_schema: SEARCH_INPUT_SCHEMA };
TOOL_CATALOG['search.cross_module'] = { description: 'Federated search across jobs/IWOs/clients/deals.', input_schema: SEARCH_INPUT_SCHEMA };
TOOL_CATALOG['search.documents'] = { description: 'Search strategy + compliance documents.', input_schema: SEARCH_INPUT_SCHEMA };
TOOL_CATALOG['search.contacts'] = { description: 'Search client contacts + employees.', input_schema: SEARCH_INPUT_SCHEMA };

// WRITE — draftable + alerts + KPI
TOOL_CATALOG['write.create_task'] = {
  description: 'Create a generated_tasks row that lands in the task inbox. Pass dedupeKey for idempotence.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
      dueAt: { type: 'string' },
      assignedToUserId: { type: 'string' },
      masterJobId: { type: 'string' },
      iwoId: { type: 'string' },
      brandId: { type: 'string' },
      sourceModule: { type: 'string' },
      dedupeKey: { type: 'string' },
    },
    required: ['title', 'description'],
  },
};
TOOL_CATALOG['write.draft_message'] = {
  description: 'Compose an email / WhatsApp / chat draft (never auto-sends).',
  input_schema: {
    type: 'object',
    properties: {
      channel: { type: 'string', enum: ['email', 'whatsapp', 'chat'] },
      to: { type: 'string' },
      subject: { type: 'string' },
      body: { type: 'string' },
      clientId: { type: 'string' },
      masterJobId: { type: 'string' },
      dedupeKey: { type: 'string' },
    },
    required: ['channel', 'body'],
  },
};
TOOL_CATALOG['write.create_alert'] = {
  description: 'Raise a finding / alert. Severity drives sort + escalation.',
  input_schema: {
    type: 'object',
    properties: {
      severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
      message: { type: 'string' },
      entityType: { type: 'string' },
      entityId: { type: 'string' },
      brandId: { type: 'string' },
      value: { type: 'number' },
      threshold: { type: 'number' },
      dedupeKey: { type: 'string' },
    },
    required: ['severity', 'message'],
  },
};
TOOL_CATALOG['write.acknowledge_alert'] = {
  description: 'Mark an agent_alerts row acknowledged.',
  input_schema: {
    type: 'object',
    properties: { alertId: { type: 'string' }, note: { type: 'string' } },
    required: ['alertId'],
  },
};
TOOL_CATALOG['write.create_kpi_measurement'] = {
  description: 'Record a KPI data point under companies/zeus-group/kpis/{kpiId}/dataPoints.',
  input_schema: {
    type: 'object',
    properties: {
      kpiId: { type: 'string' },
      value: { type: 'number' },
      note: { type: 'string' },
      date: { type: 'string' },
      companyId: { type: 'string' },
    },
    required: ['kpiId', 'value'],
  },
};

// NOTIFY
TOOL_CATALOG['notify.user'] = { description: 'Notify a single user.', input_schema: NOTIFY_SCHEMA };
TOOL_CATALOG['notify.team'] = { description: 'Notify a team.', input_schema: NOTIFY_SCHEMA };
TOOL_CATALOG['notify.subsidiary_lead'] = { description: 'Notify the head of a sibling brand.', input_schema: NOTIFY_SCHEMA };
TOOL_CATALOG['notify.escalate'] = { description: 'Escalate a finding to group leadership / Traffic.', input_schema: NOTIFY_SCHEMA };

// ─── Validation ──────────────────────────────────────────────────────────────

const TYPE_CHECKS = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  boolean: (v) => typeof v === 'boolean',
  object: (v) => v != null && typeof v === 'object' && !Array.isArray(v),
  array: (v) => Array.isArray(v),
};

function validateAgainstSchema(input, schema) {
  if (!schema) return;
  if (schema.type === 'object') {
    if (input == null || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('input must be an object');
    }
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const field of required) {
      if (input[field] == null) throw new Error(`Missing required field: "${field}"`);
    }
    const props = schema.properties || {};
    for (const [field, value] of Object.entries(input)) {
      const fieldSchema = props[field];
      if (!fieldSchema) continue;
      const check = TYPE_CHECKS[fieldSchema.type];
      if (check && value != null && !check(value)) {
        throw new Error(`Field "${field}" must be of type ${fieldSchema.type}`);
      }
      if (fieldSchema.enum && value != null && !fieldSchema.enum.includes(value)) {
        throw new Error(`Field "${field}" must be one of: ${fieldSchema.enum.join(', ')}`);
      }
    }
  }
}

function getToolSchema(toolId) {
  return TOOL_CATALOG[toolId] || null;
}

function getCatalogForAgent(enabledTools, autoActMode) {
  if (!Array.isArray(enabledTools)) return [];
  const DRAFT_OK = (id) =>
    id.startsWith('read.') || id.startsWith('search.') || id.startsWith('notify.') ||
    id === 'write.draft_message' || id === 'write.create_task';
  return enabledTools
    .map((toolId) => {
      const entry = TOOL_CATALOG[toolId];
      if (!entry) return null;
      if (autoActMode === 'draft_only' && !DRAFT_OK(toolId)) return null;
      return { tool_id: toolId, description: entry.description, input_schema: entry.input_schema };
    })
    .filter(Boolean);
}

module.exports = { TOOL_CATALOG, getToolSchema, getCatalogForAgent, validateAgainstSchema };
