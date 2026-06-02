/**
 * Tool id → Firestore read config, re-pointed at ZeusOS collections.
 *
 * One row per `read.*` tool in AGENT_TOOLS. Consumed by createReadHandler.
 * ZeusOS's commercial/delivery collections are TOP-LEVEL (scope:'global');
 * the strategy collections live under companies/zeus-group/ (scope:'company',
 * the readFactory default companyId). Collection names verified against the
 * live service layer.
 */

const READ_HANDLER_CONFIGS = {
  // ── Commercial gravity (top-level) ──────────────────────────────────────
  'read.master_jobs': {
    scope: 'global', collection: 'master_jobs',
    allowedFilters: ['stage', 'status', 'tier', 'clientId', 'primaryBrandId', 'subsidiaryOrgId'],
    defaultOrder: { field: 'createdAt', direction: 'desc' }, entityLabel: 'master job',
  },
  'read.internal_work_orders': {
    scope: 'global', collection: 'internal_work_orders',
    allowedFilters: ['state', 'subsidiaryOrgId', 'masterJobId', 'tier'],
    defaultOrder: { field: 'createdAt', direction: 'desc' }, entityLabel: 'IWO',
  },
  'read.clients': {
    scope: 'global', collection: 'clients',
    allowedFilters: ['status', 'primaryBrandId', 'sector'],
    defaultOrder: { field: 'createdAt', direction: 'desc' }, entityLabel: 'client',
  },
  'read.client_invoices': {
    scope: 'global', collection: 'client_invoices',
    allowedFilters: ['status', 'masterJobId', 'clientId', 'subsidiaryOrgId'],
    defaultOrder: { field: 'issuedAt', direction: 'desc' }, entityLabel: 'client invoice',
  },
  'read.intercompany_invoices': {
    scope: 'global', collection: 'intercompany_invoices',
    allowedFilters: ['status', 'masterJobId', 'sourceSubsidiaryId', 'targetSubsidiaryId'],
    defaultOrder: { field: 'issuedAt', direction: 'desc' }, entityLabel: 'inter-co invoice',
  },
  'read.quotes': {
    scope: 'global', collection: 'quotes',
    allowedFilters: ['status', 'clientId', 'masterJobId'],
    defaultOrder: { field: 'createdAt', direction: 'desc' }, entityLabel: 'quote',
  },
  // ── Delivery / marketing (top-level) ────────────────────────────────────
  'read.media_plans': {
    scope: 'global', collection: 'media_plans',
    allowedFilters: ['status', 'masterJobId', 'subsidiaryOrgId'],
    defaultOrder: { field: 'createdAt', direction: 'desc' }, entityLabel: 'media plan',
  },
  'read.talent': {
    scope: 'global', collection: 'talent_profiles',
    allowedFilters: ['status', 'type', 'subsidiaryOrgId'],
    defaultOrder: { field: 'createdAt', direction: 'desc' }, entityLabel: 'talent profile',
  },
  'read.production': {
    scope: 'global', collection: 'production_jobs',
    allowedFilters: ['status', 'stage', 'masterJobId', 'subsidiaryOrgId'],
    defaultOrder: { field: 'createdAt', direction: 'desc' }, entityLabel: 'production job',
  },
  // ── CRM / HR (top-level) ────────────────────────────────────────────────
  'read.crm_deals': {
    scope: 'global', collection: 'crm_deals',
    allowedFilters: ['stage', 'ownerId', 'status'],
    defaultOrder: { field: 'updatedAt', direction: 'desc' }, entityLabel: 'deal',
  },
  'read.employees': {
    scope: 'global', collection: 'employees',
    allowedFilters: ['status', 'departmentId', 'subsidiaryOrgId'],
    defaultOrder: { field: 'updatedAt', direction: 'desc' }, entityLabel: 'employee',
  },
  // ── CEO Strategy (company-scoped under companies/zeus-group/) ────────────
  'read.okrs': {
    scope: 'company', collection: 'okrs',
    allowedFilters: ['status', 'cycleId', 'ownerId', 'subsidiaryId'],
    defaultOrder: { field: 'updatedAt', direction: 'desc' }, entityLabel: 'objective',
  },
  'read.kpis': {
    scope: 'company', collection: 'kpis',
    allowedFilters: ['status', 'ownerId', 'category', 'frequency'],
    defaultOrder: { field: 'updatedAt', direction: 'desc' }, entityLabel: 'KPI',
  },
  'read.scorecards': {
    scope: 'company', collection: 'kpiScorecards',
    allowedFilters: ['status', 'period', 'ownerId'],
    defaultOrder: { field: 'updatedAt', direction: 'desc' }, entityLabel: 'scorecard',
  },
  'read.strategy_documents': {
    scope: 'company', collection: 'strategy_reviews',
    allowedFilters: ['status'],
    defaultOrder: { field: 'updatedAt', direction: 'desc' }, entityLabel: 'strategy review',
  },
  // ── Finance / Market Intel / Compliance (top-level) ─────────────────────
  'read.finance_journals': {
    scope: 'global', collection: 'gl_postings',
    allowedFilters: ['subsidiaryOrgId', 'period', 'accountCode'],
    defaultOrder: { field: 'postedAt', direction: 'desc' }, entityLabel: 'GL posting',
  },
  'read.competitors': {
    scope: 'global', collection: 'competitors',
    allowedFilters: ['status', 'sector'],
    defaultOrder: { field: 'updatedAt', direction: 'desc' }, entityLabel: 'competitor',
  },
  'read.regulatory_changes': {
    scope: 'global', collection: 'regulatory_changes',
    allowedFilters: ['impactLevel', 'regulatoryBody'],
    defaultOrder: { field: 'effectiveDate', direction: 'desc' }, entityLabel: 'regulatory change',
  },
  // ── Cross-cutting / Intelligence layer (top-level) ──────────────────────
  'read.business_events': {
    scope: 'global', collection: 'domain_events',
    allowedFilters: ['eventType', 'aggregateType', 'aggregateId', 'processed'],
    defaultOrder: { field: 'emittedAt', direction: 'desc' }, entityLabel: 'domain event',
  },
  'read.audit_trail': {
    scope: 'global', collection: 'agentAuditEntries',
    allowedFilters: ['agentId', 'outcome', 'toolId'],
    defaultOrder: { field: 'createdAt', direction: 'desc' }, entityLabel: 'audit entry',
  },
};

module.exports = { READ_HANDLER_CONFIGS };
