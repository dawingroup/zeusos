import { z } from 'zod';
import { queryCollection, getSubDocument, getSubcollection, serializeDoc, truncateIfNeeded } from '../services/firebase.js';
import { COLLECTIONS } from '../constants.js';
const SUB_DESIGN_ITEMS = 'designItems';
/**
 * Read-only access to Design Manager Firestore: `designProjects` and
 * `designItems` (including the `parts` array synced from Design Studio).
 */
export function registerDesignManagerTools(server) {
    // ─── dawinos_search_design_projects ─────────────────────────────────────────
    server.registerTool('dawinos_search_design_projects', {
        title: 'Search design projects (Design Manager)',
        description: 'Find `designProjects` by exact `code` (e.g. DF-2026-584) and/or by partial match on `name` / `customerName` (client-side filter, capped).',
        inputSchema: {
            project_code: z
                .string()
                .optional()
                .describe('Exact project code, e.g. DF-2026-584 (matches field `code`)'),
            search: z
                .string()
                .optional()
                .describe('Case-insensitive substring on `name` and `customerName` (only if `project_code` is not set, or in addition to narrow results); uses a paginated scan — keep search specific.'),
            limit: z.number().int().min(1).max(20).optional().describe('Max results when using `search` (default: 10)'),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const path = COLLECTIONS.DESIGN_PROJECTS;
        if (params.project_code?.trim()) {
            const { items, total } = await queryCollection(path, {
                filters: [{ field: 'code', op: '==', value: params.project_code.trim() }],
                limit: 10,
            });
            const body = {
                count: items.length,
                total_hint: total,
                projects: items.map(p => ({
                    id: p.id,
                    code: p.code,
                    name: p.name,
                    customerName: p.customerName,
                })),
            };
            return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] };
        }
        if (!params.search?.trim()) {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: 'Provide `project_code` (exact) or `search` (partial name).',
                    },
                ],
            };
        }
        const needle = params.search.trim().toLowerCase();
        const cap = params.limit ?? 10;
        const { items } = await queryCollection(path, { limit: 200 });
        const hit = items.filter(p => {
            const n = (p.name ?? '').toLowerCase();
            const c = (p.customerName ?? '').toLowerCase();
            return n.includes(needle) || c.includes(needle);
        });
        const sliced = hit.slice(0, cap);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ count: sliced.length, scanned: items.length, projects: sliced }, null, 2),
                },
            ],
        };
    });
    // ─── dawinos_list_design_items ─────────────────────────────────────────────
    server.registerTool('dawinos_list_design_items', {
        title: 'List design items for a project',
        description: 'List documents under `designProjects/{projectId}/designItems` (summary fields, no `parts` array).',
        inputSchema: {
            project_id: z.string().min(1).describe('Design project document ID'),
            limit: z.number().int().min(1).max(200).optional().default(100),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const rows = await getSubcollection(COLLECTIONS.DESIGN_PROJECTS, params.project_id, SUB_DESIGN_ITEMS, { limit: params.limit ?? 100 });
        const summary = rows.map(r => {
            const parts = r.parts;
            const n = Array.isArray(parts) ? parts.length : 0;
            const { parts: _drop, ...rest } = r;
            return { ...serializeDoc(rest), _partsCount: n };
        });
        return { content: [{ type: 'text', text: JSON.stringify({ count: summary.length, items: summary }, null, 2) }] };
    });
    // ─── dawinos_get_design_item ───────────────────────────────────────────────
    server.registerTool('dawinos_get_design_item', {
        title: 'Get a design item (incl. parts from Design Studio)',
        description: 'Read `designItems/{id}` on a project. Includes `parts` (scene sync rows have `source: "design-studio"`). Large responses may be truncated.',
        inputSchema: {
            project_id: z.string().min(1).describe('Design project document ID'),
            design_item_id: z.string().min(1).describe('Design item document ID'),
            parts_only: z
                .boolean()
                .optional()
                .describe('If true, return only `parts` (and id/title) to reduce size'),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const row = await getSubDocument(COLLECTIONS.DESIGN_PROJECTS, params.project_id, SUB_DESIGN_ITEMS, params.design_item_id);
        if (!row) {
            return {
                isError: true,
                content: [{ type: 'text', text: 'Design item not found.' }],
            };
        }
        let payload = serializeDoc(row);
        if (params.parts_only) {
            payload = {
                id: row.id,
                name: row.name,
                itemCode: row.itemCode,
                parts: row.parts,
            };
        }
        const text = truncateIfNeeded(JSON.stringify(payload, null, 2));
        return { content: [{ type: 'text', text }] };
    });
}
//# sourceMappingURL=designManager.js.map