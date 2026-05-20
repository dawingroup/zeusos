/**
 * Tool Registry
 * Central registry of all Claude tool definitions and their handlers.
 * Used by the crossModuleIntelligence orchestrator.
 */

const designTools = require('./designTools');
const manufacturingTools = require('./manufacturingTools');
const inventoryTools = require('./inventoryTools');
const crmTools = require('./crmTools');
const financeTools = require('./financeTools');
const supplierTools = require('./supplierTools');
const intelligenceTools = require('./intelligenceTools');
const crossModuleTools = require('./crossModuleTools');

// ============================================================================
// ALL TOOL DEFINITIONS (for Claude's tools parameter)
// ============================================================================

const allDefinitions = [
  ...designTools.definitions,
  ...manufacturingTools.definitions,
  ...inventoryTools.definitions,
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
  ...designTools.handlers,
  ...manufacturingTools.handlers,
  ...inventoryTools.handlers,
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
  designTools,
  manufacturingTools,
  inventoryTools,
  crmTools,
  financeTools,
  supplierTools,
  intelligenceTools,
  crossModuleTools,
};
