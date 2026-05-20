/**
 * Tool Executor
 * Central dispatcher that routes Claude tool_use blocks to their handlers,
 * executes them in parallel, and enforces security scoping.
 */

const { loadUserContext, hasModuleAccess, stripFinancials } = require('./toolSecurity');
const { summarizeResult } = require('../utils/resultSummarizer');

// Tool → module mapping for access control
const TOOL_MODULE_MAP = {
  get_project_overview: 'design_manager',
  search_design_items: 'design_manager',
  get_project_optimization: 'design_manager',
  get_manufacturing_orders: 'manufacturing',
  get_manufacturing_order_detail: 'manufacturing',
  get_purchase_orders: 'manufacturing',
  search_inventory: 'inventory',
  get_inventory_item: 'inventory',
  check_material_availability: 'inventory',
  get_customer_360: 'customer_hub',
  search_customers: 'customer_hub',
  get_deals_pipeline: 'crm',
  get_financial_summary: 'financial',
  get_project_costing: 'financial',
  search_suppliers: 'inventory', // Suppliers are accessible to inventory users
  get_supplier_detail: 'inventory',
  get_business_events: null, // Available to all authenticated users
  search_business_memory: null,
  cross_module_query: null, // Access checked per sub-query
};

/**
 * Execute all tool_use blocks from a Claude response in parallel.
 *
 * @param {Array} toolUseBlocks - Array of { type: 'tool_use', id, name, input }
 * @param {object} toolRegistry - Map of toolName → handler function
 * @param {object} requestContext - { userId, companyId, subsidiaryId }
 * @returns {Promise<Array>} Array of tool_result content blocks
 */
async function executeToolCalls(toolUseBlocks, toolRegistry, requestContext) {
  // Load security context once for all tool calls
  const securityContext = await loadUserContext(
    requestContext.userId,
    requestContext.companyId
  );

  const results = await Promise.all(
    toolUseBlocks.map(async (block) => {
      try {
        const handler = toolRegistry[block.name];
        if (!handler) {
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ error: `Unknown tool: ${block.name}` }),
          };
        }

        // Check module access
        const requiredModule = TOOL_MODULE_MAP[block.name];
        if (requiredModule && !hasModuleAccess(securityContext, requiredModule)) {
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({
              error: `Access denied: you do not have access to the ${requiredModule} module`,
            }),
          };
        }

        // Execute the handler
        const rawResult = await handler(block.input, securityContext);

        // Strip financials if user lacks financial access
        const sanitizedResult = stripFinancials(rawResult, securityContext);

        // Summarize to keep within token budget
        const summarizedResult = summarizeResult(sanitizedResult);

        return {
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(summarizedResult),
        };
      } catch (error) {
        console.error(`Tool execution error (${block.name}):`, error.message);
        return {
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({
            error: `Tool execution failed: ${error.message}`,
          }),
          is_error: true,
        };
      }
    })
  );

  return results;
}

/**
 * Select relevant tools based on the current module context.
 * Reduces token usage by not sending all 20+ tools when only a subset is relevant.
 *
 * @param {string} currentModule - The module the user is currently viewing
 * @param {Array} allTools - All available tool definitions
 * @returns {Array} Filtered tool definitions
 */
function selectRelevantTools(currentModule, allTools) {
  // Always include cross-module and intelligence tools
  const alwaysInclude = [
    'cross_module_query',
    'get_business_events',
    'search_business_memory',
    'search_customers',
    'get_customer_360',
  ];

  // Module-specific tool inclusions
  const moduleTools = {
    design_manager: [
      'get_project_overview', 'search_design_items', 'get_project_optimization',
      'search_inventory', 'get_inventory_item', 'check_material_availability',
      'get_manufacturing_orders', 'get_manufacturing_order_detail',
      'search_suppliers', 'get_project_costing',
    ],
    manufacturing: [
      'get_manufacturing_orders', 'get_manufacturing_order_detail', 'get_purchase_orders',
      'search_inventory', 'get_inventory_item', 'check_material_availability',
      'search_suppliers', 'get_supplier_detail',
      'get_project_overview', 'get_project_costing',
    ],
    inventory: [
      'search_inventory', 'get_inventory_item', 'check_material_availability',
      'search_suppliers', 'get_supplier_detail',
      'get_manufacturing_orders', 'get_purchase_orders',
    ],
    customer_hub: [
      'get_customer_360', 'search_customers', 'get_deals_pipeline',
      'get_project_overview', 'search_design_items',
      'get_manufacturing_orders', 'get_financial_summary',
    ],
    financial: [
      'get_financial_summary', 'get_project_costing',
      'get_deals_pipeline', 'get_purchase_orders',
      'search_suppliers', 'get_customer_360',
    ],
    launch_pipeline: [
      'search_inventory', 'get_inventory_item',
      'get_project_overview', 'search_design_items',
      'search_suppliers', 'get_deals_pipeline',
    ],
  };

  const relevantNames = new Set([
    ...alwaysInclude,
    ...(moduleTools[currentModule] || []),
  ]);

  // If no module context or unknown module, include all tools
  if (!currentModule || !moduleTools[currentModule]) {
    return allTools;
  }

  return allTools.filter(tool => relevantNames.has(tool.name));
}

module.exports = {
  executeToolCalls,
  selectRelevantTools,
  TOOL_MODULE_MAP,
};
