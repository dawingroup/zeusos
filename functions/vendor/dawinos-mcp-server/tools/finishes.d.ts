/**
 * Finish Library write surface.
 *
 * Pairs with the read-only `dawinos_get_finish_library` tool in inventory.ts.
 * All writes target COLLECTIONS.FINISH_LIBRARY with organizationId=DEFAULT_ORG_ID.
 *
 * Tool inventory:
 *   - dawinos_create_finish_library_entry
 *   - dawinos_update_finish_library_entry
 *   - dawinos_delete_finish_library_entry   (soft by default, hard_delete opt-in)
 *   - dawinos_bulk_import_finishes          (batch insert, up to 50 rows)
 *   - dawinos_link_finish_to_inventory      (add/remove linked inventory IDs)
 *
 * Category validation uses the STATIC FINISH_CATEGORIES enum, not the dynamic
 * inventoryCategories registry — these are different taxonomies.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export declare function registerFinishTools(server: McpServer): void;
//# sourceMappingURL=finishes.d.ts.map