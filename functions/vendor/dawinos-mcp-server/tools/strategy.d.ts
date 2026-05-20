/**
 * Strategy MCP Tools
 *
 * Covers the CEO Strategy Command module in DawinOS:
 *   - Strategy document CRUD (list, get, create, update)
 *   - Strategy review lifecycle (list, get, create, update, finalize)
 *   - Document section management (list, get, update content, apply rewrite)
 *   - Pillar / objective / metric updates (nested in strategy documents)
 *
 * Firestore paths:
 *   companies/{companyId}/strategyDocuments/{docId}
 *   companies/{companyId}/strategyDocuments/{docId}/versions/{versionId}
 *   companies/{companyId}/strategy_reviews/{reviewId}
 *   companies/{companyId}/strategy_reviews/{reviewId}/document_sections/{sectionId}
 *   companies/{companyId}/strategy_reviews/{reviewId}/section_audit_log/{entryId}
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export declare function registerStrategyTools(server: McpServer): void;
//# sourceMappingURL=strategy.d.ts.map