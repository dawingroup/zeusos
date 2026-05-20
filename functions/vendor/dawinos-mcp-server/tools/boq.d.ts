/**
 * BOQ (Bill of Quantities) & Material Requirements MCP Tools
 *
 * Covers the Infrastructure Delivery module under Dawin Advisory:
 *   - Read / analyse / update Control BOQ items
 *   - Apply construction formulas and persist material requirements
 *   - Aggregate material requirements for procurement
 *   - Project-level cost summaries
 *
 * Firestore path for BOQ items:
 *   organizations/{orgId}/advisory_projects/{projectId}/boq_items
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export declare function registerBOQTools(server: McpServer): void;
//# sourceMappingURL=boq.d.ts.map