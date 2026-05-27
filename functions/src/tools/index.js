/**
 * Tool Registry
 *
 * Central registry of tool definitions + handlers consumed by the
 * `crossModuleIntelligence` Cloud Function (the orchestrator behind
 * `AIAssistantPanel` in the frontend).
 *
 * Three DawinOS-era tool modules were removed in the Phase 1.E
 * follow-up cleanup:
 *
 *   • `designTools.js`        — queried `designProjects` / `designItems`
 *                               / per-project `materials` sub-collection.
 *                               Design Manager was stripped in Phase 1.A
 *                               and these collections no longer carry
 *                               data in ZeusOS.
 *   • `manufacturingTools.js` — queried `manufacturingOrders` /
 *                               `bomEntries` / `materialConsumptions` /
 *                               `stageTransitions`. Manufacturing was
 *                               stripped in Phase 1.A as well; the
 *                               associated triggers came out in PR #104.
 *   • `inventoryTools.js`     — queried `inventoryItems`. The inventory
 *                               module was stripped in Phase 1.C and its
 *                               triggers in PR #105.
 *
 * `crmTools.js`, `financeTools.js`, and `crossModuleTools.js` still
 * cross-reference the same stripped collections in some of their
 * branches; those are degraded-but-functional (the queries return
 * empty) and the call shape will be re-pointed at ZeusOS-mapped
 * collections (master_jobs / quotes / client_invoices) in a follow-up
 * PR with proper domain analysis.
 */

const crmTools = require('./crmTools');
const financeTools = require('./financeTools');
const supplierTools = require('./supplierTools');
const intelligenceTools = require('./intelligenceTools');
const crossModuleTools = require('./crossModuleTools');

// ============================================================================
// ALL TOOL DEFINITIONS (for Claude's tools parameter)
// ============================================================================

const allDefinitions = [
  ...crmTools.definitions,
  ...financeTools.definitions,
  ...supplierTools.definitions,
  ...intelligenceTools.definitions,
  ...crossModuleTools.definitions,
];

// ============================================================================
// HANDLER REGISTRY (toolName → handler function)
// ============================================================================

const allHandlers = {
  ...crmTools.handlers,
  ...financeTools.handlers,
  ...supplierTools.handlers,
  ...intelligenceTools.handlers,
  ...crossModuleTools.handlers,
};

module.exports = {
  allDefinitions,
  allHandlers,
  // Individual modules for selective loading
  crmTools,
  financeTools,
  supplierTools,
  intelligenceTools,
  crossModuleTools,
};
