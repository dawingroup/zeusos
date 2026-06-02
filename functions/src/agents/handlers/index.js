/**
 * Handler registry — the single source of truth the dispatcher imports.
 * Each tool id maps to one async (input, context) -> { result, summary }.
 *
 * READ   — 20 tools generated from ./lib/collectionMap.js.
 * WRITE  — create_task, draft_message, create_alert, acknowledge_alert,
 *          create_kpi_measurement.
 * SEARCH — knowledge_base, cross_module, documents, contacts.
 * NOTIFY — user, team, subsidiary_lead, escalate.
 */
const { READ_HANDLERS } = require('./reads');
const {
  handleCreateTask,
  handleDraftMessage,
  handleCreateAlert,
  handleAcknowledgeAlert,
  handleCreateKpiMeasurement,
} = require('./writes');
const {
  handleNotifyUser,
  handleNotifyTeam,
  handleNotifySubsidiaryLead,
  handleNotifyEscalate,
} = require('./notify');
const {
  handleSearchKnowledgeBase,
  handleSearchCrossModule,
  handleSearchDocuments,
  handleSearchContacts,
} = require('./search');

const HANDLERS = {
  ...READ_HANDLERS,

  'write.create_task': handleCreateTask,
  'write.draft_message': handleDraftMessage,
  'write.create_alert': handleCreateAlert,
  'write.acknowledge_alert': handleAcknowledgeAlert,
  'write.create_kpi_measurement': handleCreateKpiMeasurement,

  'search.knowledge_base': handleSearchKnowledgeBase,
  'search.cross_module': handleSearchCrossModule,
  'search.documents': handleSearchDocuments,
  'search.contacts': handleSearchContacts,

  'notify.user': handleNotifyUser,
  'notify.team': handleNotifyTeam,
  'notify.subsidiary_lead': handleNotifySubsidiaryLead,
  'notify.escalate': handleNotifyEscalate,
};

module.exports = { HANDLERS };
