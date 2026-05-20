import { z } from 'zod';
import { queryCollection, getDocument, getDb, serializeDoc, formatTimestamp, formatCurrency, truncateIfNeeded, serverTimestamp, } from '../services/firebase.js';
import { COLLECTIONS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PO_STATUSES, } from '../constants.js';
export function registerPurchasingTools(server) {
    // ─── Tool 1: List Purchase Orders ────────────────────────────────────────────
    server.registerTool('dawinos_list_purchase_orders', {
        title: 'List Purchase Orders',
        description: `List and filter purchase orders from DawinOS Firestore.

Parameters:
- status (optional): Filter by PO status. Values: ${PO_STATUSES.join(' | ')}
- supplier_name (optional): Partial match on supplier name (case-insensitive)
- supplier_id (optional): Exact match on supplierId field
- project_id (optional): Filter by linked project ID
- date_from (optional): Filter orders created on/after this date (YYYY-MM-DD)
- date_to (optional): Filter orders created on/before this date (YYYY-MM-DD)
- limit (optional): Max results, default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}
- offset (optional): Pagination offset, default 0
- response_format (optional): 'markdown' (default) or 'json'

Returns: Paginated list of POs with status, supplier, totals, and line item count.
For full line item details, use dawinos_get_purchase_order with a specific PO id.

Examples:
- List all open POs: { "status": "approved" }
- Supplier POs: { "supplier_name": "Timber" }
- Recent POs: { "date_from": "2026-01-01", "limit": 10 }`,
        inputSchema: {
            status: z
                .enum(PO_STATUSES)
                .optional()
                .describe(`Filter by status: ${PO_STATUSES.join(' | ')}`),
            supplier_name: z
                .string()
                .optional()
                .describe('Partial supplier name match (case-insensitive)'),
            supplier_id: z.string().optional().describe('Exact supplierId match'),
            project_id: z.string().optional().describe('Filter by linked project ID'),
            date_from: z
                .string()
                .optional()
                .describe('Filter createdAt >= this date (YYYY-MM-DD)'),
            date_to: z
                .string()
                .optional()
                .describe('Filter createdAt <= this date (YYYY-MM-DD)'),
            limit: z
                .number()
                .int()
                .min(1)
                .max(MAX_PAGE_SIZE)
                .default(DEFAULT_PAGE_SIZE)
                .describe(`Max results (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE})`),
            offset: z.number().int().min(0).default(0).describe('Pagination offset'),
            response_format: z
                .enum(['markdown', 'json'])
                .default('markdown')
                .describe("'markdown' for human-readable output, 'json' for structured data"),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const { status, supplier_name, supplier_id, project_id, date_from, date_to, limit, offset, response_format, } = params;
            const filters = [];
            if (status)
                filters.push({ field: 'status', op: '==', value: status });
            if (supplier_id)
                filters.push({ field: 'supplierId', op: '==', value: supplier_id });
            if (project_id)
                filters.push({ field: 'projectId', op: '==', value: project_id });
            const { items: pos, total } = await queryCollection(COLLECTIONS.PURCHASE_ORDERS, {
                filters,
                orderByField: 'createdAt',
                orderByDirection: 'desc',
                limit: limit * 3, // over-fetch for client-side filtering
                offset,
            });
            // Client-side filters (Firestore doesn't support LIKE queries)
            let filtered = pos;
            if (supplier_name) {
                const term = supplier_name.toLowerCase();
                filtered = filtered.filter((po) => (po.supplierName ?? '').toLowerCase().includes(term));
            }
            if (date_from) {
                const from = new Date(date_from).getTime();
                filtered = filtered.filter((po) => {
                    const ts = po.createdAt;
                    if (!ts)
                        return true;
                    const d = typeof ts.toDate === 'function'
                        ? ts.toDate().getTime()
                        : 0;
                    return d >= from;
                });
            }
            if (date_to) {
                const to = new Date(date_to + 'T23:59:59Z').getTime();
                filtered = filtered.filter((po) => {
                    const ts = po.createdAt;
                    if (!ts)
                        return true;
                    const d = typeof ts.toDate === 'function'
                        ? ts.toDate().getTime()
                        : Infinity;
                    return d <= to;
                });
            }
            const paginated = filtered.slice(0, limit);
            const hasMore = offset + paginated.length < total || filtered.length > limit;
            if (paginated.length === 0) {
                return {
                    content: [{ type: 'text', text: 'No purchase orders found matching your filters.' }],
                };
            }
            if (response_format === 'json') {
                const result = {
                    total,
                    count: paginated.length,
                    offset,
                    limit,
                    hasMore,
                    nextOffset: hasMore ? offset + limit : undefined,
                    items: paginated.map((po) => serializeDoc(po)),
                };
                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                };
            }
            // Markdown format
            const lines = [
                `## Purchase Orders (${paginated.length} of ${total} total)\n`,
                `| PO Number | Status | Supplier | Total | Currency | Created |`,
                `|-----------|--------|----------|-------|----------|---------|`,
            ];
            for (const po of paginated) {
                const poNum = po.poNumber ?? po.orderNumber ?? po.id.slice(0, 8);
                const total_ = po.total ?? po.subtotal ?? 0;
                lines.push(`| ${poNum} | ${po.status ?? 'N/A'} | ${po.supplierName ?? 'N/A'} | ${formatCurrency(total_, po.currency)} | ${po.currency ?? 'UGX'} | ${formatTimestamp(po.createdAt)} |`);
            }
            if (hasMore) {
                lines.push(`\n_Showing ${offset + 1}–${offset + paginated.length} of ${total}. Use offset=${offset + limit} for next page._`);
            }
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error listing purchase orders: ${error.message}` }],
            };
        }
    });
    // ─── Tool 2: Get Purchase Order ───────────────────────────────────────────────
    server.registerTool('dawinos_get_purchase_order', {
        title: 'Get Purchase Order',
        description: `Retrieve full details of a single purchase order, including all embedded line items.

Parameters:
- id (required): Firestore document ID of the purchase order
- response_format (optional): 'markdown' (default) or 'json'

Returns: Complete PO with supplier info, financial summary, and line items table.
Note: line items are embedded in the PO document (not a subcollection).

The 'total' field contains the grand total (not 'grandTotal').`,
        inputSchema: {
            id: z.string().describe('Firestore document ID of the purchase order'),
            response_format: z
                .enum(['markdown', 'json'])
                .default('markdown')
                .describe("'markdown' for human-readable output, 'json' for structured data"),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const { id, response_format } = params;
            const po = await getDocument(COLLECTIONS.PURCHASE_ORDERS, id);
            if (!po) {
                return {
                    content: [{ type: 'text', text: `Purchase order '${id}' not found.` }],
                };
            }
            if (response_format === 'json') {
                return {
                    content: [
                        { type: 'text', text: JSON.stringify(serializeDoc(po), null, 2) },
                    ],
                };
            }
            const poNum = po.poNumber ?? po.orderNumber ?? id;
            const lines = [
                `## Purchase Order: ${poNum}\n`,
                `| Field | Value |`,
                `|-------|-------|`,
                `| Status | ${po.status ?? 'N/A'} |`,
                `| Supplier | ${po.supplierName ?? 'N/A'} |`,
                `| Project | ${po.projectName ?? po.projectId ?? 'N/A'} |`,
                `| Subtotal | ${formatCurrency(po.subtotal, po.currency)} |`,
                `| Total | ${formatCurrency(po.total, po.currency)} |`,
                `| Currency | ${po.currency ?? 'UGX'} |`,
                `| Expected Delivery | ${formatTimestamp(po.expectedDeliveryDate)} |`,
                `| Received Date | ${formatTimestamp(po.receivedDate)} |`,
                `| Created | ${formatTimestamp(po.createdAt)} |`,
            ];
            const lineItems = po.lineItems ?? [];
            if (lineItems.length > 0) {
                lines.push(`\n### Line Items (${lineItems.length})\n`);
                lines.push(`| Item | SKU | Qty | Unit Price | Total | Received |`);
                lines.push(`|------|-----|-----|-----------|-------|---------|`);
                for (const item of lineItems) {
                    lines.push(`| ${item.itemName ?? 'N/A'} | ${item.sku ?? '-'} | ${item.quantity ?? 0} | ${formatCurrency(item.unitPrice, po.currency)} | ${formatCurrency(item.totalPrice, po.currency)} | ${item.receivedQuantity ?? '-'} |`);
                }
            }
            else {
                lines.push(`\n_No line items found on this PO._`);
            }
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error fetching purchase order: ${error.message}` }],
            };
        }
    });
    // ─── Tool 3: PO Spend Analysis (read) ────────────────────────────────────────────────
    server.registerTool('dawinos_po_spend_analysis', {
        title: 'Purchase Order Spend Analysis',
        description: `Aggregate purchase order spend with grouping and breakdown.

Parameters:
- group_by (required): Dimension to group by: 'supplier' | 'month' | 'status'
- status (optional): Filter to specific PO status before aggregating
- supplier_id (optional): Restrict analysis to one supplier
- date_from (optional): Start of analysis period (YYYY-MM-DD)
- date_to (optional): End of analysis period (YYYY-MM-DD)
- response_format (optional): 'markdown' (default) or 'json'

Returns: Summary table with count, total spend, average PO value, and percentage share per group.
Fetches up to 500 POs for aggregation. Use date filters to narrow scope.

Examples:
- Spend by supplier this year: { "group_by": "supplier", "date_from": "2026-01-01" }
- Monthly breakdown: { "group_by": "month", "date_from": "2025-01-01" }`,
        inputSchema: {
            group_by: z
                .enum(['supplier', 'month', 'status'])
                .describe('Aggregation dimension: supplier | month | status'),
            status: z
                .enum(PO_STATUSES)
                .optional()
                .describe('Pre-filter by PO status'),
            supplier_id: z.string().optional().describe('Restrict to one supplier'),
            date_from: z.string().optional().describe('Start date YYYY-MM-DD'),
            date_to: z.string().optional().describe('End date YYYY-MM-DD'),
            response_format: z
                .enum(['markdown', 'json'])
                .default('markdown')
                .describe("'markdown' or 'json'"),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const { group_by, status, supplier_id, date_from, date_to, response_format } = params;
            const filters = [];
            if (status)
                filters.push({ field: 'status', op: '==', value: status });
            if (supplier_id)
                filters.push({ field: 'supplierId', op: '==', value: supplier_id });
            const { items: pos } = await queryCollection(COLLECTIONS.PURCHASE_ORDERS, {
                filters,
                orderByField: 'createdAt',
                orderByDirection: 'desc',
                limit: 500,
                offset: 0,
            });
            // Date filter (client-side)
            let filtered = pos;
            if (date_from) {
                const from = new Date(date_from).getTime();
                filtered = filtered.filter((po) => {
                    const ts = po.createdAt;
                    if (!ts)
                        return true;
                    const d = typeof ts.toDate === 'function'
                        ? ts.toDate().getTime()
                        : 0;
                    return d >= from;
                });
            }
            if (date_to) {
                const to = new Date(date_to + 'T23:59:59Z').getTime();
                filtered = filtered.filter((po) => {
                    const ts = po.createdAt;
                    if (!ts)
                        return true;
                    const d = typeof ts.toDate === 'function'
                        ? ts.toDate().getTime()
                        : Infinity;
                    return d <= to;
                });
            }
            if (filtered.length === 0) {
                return {
                    content: [{ type: 'text', text: 'No purchase orders found for the specified filters.' }],
                };
            }
            // Aggregate
            const groups = new Map();
            for (const po of filtered) {
                let key;
                if (group_by === 'supplier') {
                    key = po.supplierName ?? po.supplierId ?? 'Unknown';
                }
                else if (group_by === 'month') {
                    const ts = po.createdAt;
                    const d = ts && typeof ts.toDate === 'function'
                        ? ts.toDate()
                        : null;
                    key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'Unknown';
                }
                else {
                    key = po.status ?? 'unknown';
                }
                const amount = po.total ?? po.subtotal ?? 0;
                const existing = groups.get(key) ?? { count: 0, totalSpend: 0, currency: po.currency ?? 'UGX' };
                groups.set(key, {
                    count: existing.count + 1,
                    totalSpend: existing.totalSpend + amount,
                    currency: existing.currency,
                });
            }
            const grandTotal = [...groups.values()].reduce((s, g) => s + g.totalSpend, 0);
            const sortedGroups = [...groups.entries()].sort(([, a], [, b]) => b.totalSpend - a.totalSpend);
            if (response_format === 'json') {
                const result = {
                    groupBy: group_by,
                    totalPos: filtered.length,
                    grandTotal,
                    groups: sortedGroups.map(([key, g]) => ({
                        [group_by]: key,
                        count: g.count,
                        totalSpend: g.totalSpend,
                        avgPoValue: g.totalSpend / g.count,
                        sharePercent: grandTotal > 0 ? Math.round((g.totalSpend / grandTotal) * 100) : 0,
                    })),
                };
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            const currency = filtered[0]?.currency ?? 'UGX';
            const lines = [
                `## PO Spend Analysis — by ${group_by}\n`,
                `**Total POs analyzed:** ${filtered.length}  |  **Grand Total:** ${formatCurrency(grandTotal, currency)}\n`,
                `| ${group_by.charAt(0).toUpperCase() + group_by.slice(1)} | Count | Total Spend | Avg PO Value | Share |`,
                `|${'-'.repeat(20)}|-------|-------------|--------------|-------|`,
            ];
            for (const [key, g] of sortedGroups) {
                const share = grandTotal > 0 ? Math.round((g.totalSpend / grandTotal) * 100) : 0;
                lines.push(`| ${key} | ${g.count} | ${formatCurrency(g.totalSpend, g.currency)} | ${formatCurrency(g.totalSpend / g.count, g.currency)} | ${share}% |`);
            }
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error running spend analysis: ${error.message}` }],
            };
        }
    });
    // ─── Tool 4: Create Purchase Order ───────────────────────────────────────────
    server.registerTool('dawinos_create_purchase_order', {
        title: 'Create Purchase Order',
        description: `Create a new purchase order in DawinOS as a draft.

Generates a sequential PO number (PO-YYYY-NNNN) via a Firestore counter transaction.
The PO is created with status='draft'. Use dawinos_update_po_status to advance it.

Required: supplier_name and at least one line item.
Each line item needs: name, quantity, unit_price, unit, currency (UGX or USD).`,
        inputSchema: {
            supplier_name: z.string().min(1).describe('Supplier name'),
            supplier_id: z.string().optional().describe('Supplier document ID (if known)'),
            line_items: z
                .array(z.object({
                name: z.string().min(1),
                quantity: z.number().positive(),
                unit_price: z.number().nonnegative(),
                unit: z.string().min(1).describe('Unit of measure, e.g. pcs, m2, kg'),
                currency: z.enum(['UGX', 'USD']).default('UGX'),
                inventory_item_id: z.string().optional(),
                notes: z.string().optional(),
            }))
                .min(1)
                .describe('Line items — at least one required'),
            project_id: z.string().optional().describe('Linked project ID'),
            notes: z.string().optional().describe('PO-level notes'),
            expected_delivery_date: z.string().optional().describe('ISO date string (YYYY-MM-DD)'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const db = getDb();
            const year = new Date().getFullYear();
            // Generate PO number via counter transaction (mirrors purchaseOrderService.ts)
            const counterRef = db.doc(`counters/po_default_${year}`);
            const nextNum = await db.runTransaction(async (tx) => {
                const snap = await tx.get(counterRef);
                const current = snap.exists ? (snap.data()?.counter ?? 0) : 0;
                const next = current + 1;
                tx.set(counterRef, { counter: next }, { merge: true });
                return next;
            });
            const poNumber = `PO-${year}-${String(nextNum).padStart(4, '0')}`;
            // Build line items and compute totals
            const lineItems = params.line_items.map((li) => ({
                inventoryItemId: li.inventory_item_id ?? null,
                name: li.name,
                quantity: li.quantity,
                unitPrice: li.unit_price,
                unit: li.unit,
                currency: li.currency ?? 'UGX',
                notes: li.notes ?? null,
                lineTotal: li.quantity * li.unit_price,
            }));
            const currency = lineItems[0]?.currency ?? 'UGX';
            const subtotal = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
            const docData = {
                poNumber,
                status: 'draft',
                supplierName: params.supplier_name,
                supplierId: params.supplier_id ?? null,
                lineItems,
                totals: { subtotal, landedCostTotal: 0, grandTotal: subtotal, currency },
                approvals: [],
                receivingHistory: [],
                linkedMOIds: [],
                linkedProjectId: params.project_id ?? null,
                notes: params.notes ?? null,
                subsidiaryId: 'default',
                orderDate: new Date(),
                ...(params.expected_delivery_date
                    ? { expectedDeliveryDate: new Date(params.expected_delivery_date) }
                    : {}),
                createdAt: serverTimestamp(),
                createdBy: 'mcp-agent',
                updatedAt: serverTimestamp(),
                updatedBy: 'mcp-agent',
            };
            const ref = await db.collection(COLLECTIONS.PURCHASE_ORDERS).add(docData);
            return {
                content: [
                    {
                        type: 'text',
                        text: `## Purchase Order Created\n\n**ID:** ${ref.id}\n**PO Number:** ${poNumber}\n**Status:** draft\n**Supplier:** ${params.supplier_name}\n**Line Items:** ${lineItems.length}\n**Subtotal:** ${formatCurrency(subtotal, currency)}\n\nUse \`dawinos_update_po_status\` to submit for approval.`,
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error creating purchase order: ${err.message}` }],
            };
        }
    });
    // ─── Tool 5: Update PO Status ─────────────────────────────────────────────────
    server.registerTool('dawinos_update_po_status', {
        title: 'Update Purchase Order Status',
        description: `Advance or change the status of a purchase order.

Allowed transitions:
  draft            → pending-approval | cancelled
  pending-approval → approved | rejected | cancelled
  approved         → sent | cancelled
  sent             → partially-received | received | cancelled
  partially-received → received | cancelled
  received         → closed
  cancelled        → draft (reinstate)

rejection_reason is required when status=rejected.`,
        inputSchema: {
            po_id: z.string().min(1).describe('Purchase order document ID'),
            status: z
                .enum([
                'draft',
                'pending-approval',
                'approved',
                'rejected',
                'sent',
                'partially-received',
                'received',
                'closed',
                'cancelled',
            ])
                .describe('Target status'),
            rejection_reason: z.string().optional().describe('Required when status=rejected'),
            notes: z.string().optional().describe('Optional notes on this status change'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const db = getDb();
            const ref = db.collection(COLLECTIONS.PURCHASE_ORDERS).doc(params.po_id);
            const snap = await ref.get();
            if (!snap.exists) {
                return { content: [{ type: 'text', text: `Purchase order "${params.po_id}" not found.` }] };
            }
            const current = snap.data()?.status ?? '';
            const target = params.status;
            // Validate transition
            const allowed = {
                draft: ['pending-approval', 'cancelled'],
                'pending-approval': ['approved', 'rejected', 'cancelled'],
                approved: ['sent', 'cancelled'],
                sent: ['partially-received', 'received', 'cancelled'],
                'partially-received': ['received', 'cancelled'],
                received: ['closed'],
                cancelled: ['draft'],
            };
            if (!allowed[current]?.includes(target)) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Invalid transition: ${current} → ${target}.\nAllowed from "${current}": ${(allowed[current] ?? []).join(', ') || 'none'}.`,
                        },
                    ],
                };
            }
            if (target === 'rejected' && !params.rejection_reason) {
                return { content: [{ type: 'text', text: 'rejection_reason is required when setting status to "rejected".' }] };
            }
            const update = {
                status: target,
                updatedAt: serverTimestamp(),
                updatedBy: 'mcp-agent',
            };
            if (target === 'approved') {
                update['approvedAt'] = serverTimestamp();
                update['approvedBy'] = 'mcp-agent';
            }
            if (target === 'rejected') {
                update['rejectedAt'] = serverTimestamp();
                update['rejectedBy'] = 'mcp-agent';
                update['rejectionReason'] = params.rejection_reason ?? '';
            }
            if (params.notes) {
                update['statusChangeNotes'] = params.notes;
            }
            await ref.update(update);
            return {
                content: [
                    {
                        type: 'text',
                        text: `**PO ${snap.data()?.poNumber ?? params.po_id}** status updated: **${current} → ${target}**`,
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error updating PO status: ${err.message}` }],
            };
        }
    });
    // ─── Tool 6: Update Purchase Order Fields ─────────────────────────────────────
    server.registerTool('dawinos_update_purchase_order', {
        title: 'Update Purchase Order Fields',
        description: `Update editable fields on an existing purchase order (partial update).

Only the fields you provide will be changed. Status changes must use dawinos_update_po_status.
Editable fields: notes, expected_delivery_date, supplier_name, supplier_id, project_id.

Best used for POs in draft or approved status.`,
        inputSchema: {
            po_id: z.string().min(1).describe('Purchase order document ID'),
            notes: z.string().optional(),
            expected_delivery_date: z.string().optional().describe('ISO date string (YYYY-MM-DD)'),
            supplier_name: z.string().optional(),
            supplier_id: z.string().optional(),
            project_id: z.string().optional().describe('Pass empty string to unlink project'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const db = getDb();
            const ref = db.collection(COLLECTIONS.PURCHASE_ORDERS).doc(params.po_id);
            const snap = await ref.get();
            if (!snap.exists) {
                return { content: [{ type: 'text', text: `Purchase order "${params.po_id}" not found.` }] };
            }
            const update = {
                updatedAt: serverTimestamp(),
                updatedBy: 'mcp-agent',
            };
            const changed = [];
            if (params.notes !== undefined) {
                update['notes'] = params.notes;
                changed.push('notes');
            }
            if (params.supplier_name !== undefined) {
                update['supplierName'] = params.supplier_name;
                changed.push('supplierName');
            }
            if (params.supplier_id !== undefined) {
                update['supplierId'] = params.supplier_id;
                changed.push('supplierId');
            }
            if (params.project_id !== undefined) {
                update['linkedProjectId'] = params.project_id || null;
                changed.push('linkedProjectId');
            }
            if (params.expected_delivery_date !== undefined) {
                update['expectedDeliveryDate'] = new Date(params.expected_delivery_date);
                changed.push('expectedDeliveryDate');
            }
            if (changed.length === 0) {
                return { content: [{ type: 'text', text: 'No fields provided to update.' }] };
            }
            await ref.update(update);
            return {
                content: [
                    {
                        type: 'text',
                        text: `**PO ${snap.data()?.poNumber ?? params.po_id}** updated.\nChanged fields: ${changed.join(', ')}`,
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error updating purchase order: ${err.message}` }],
            };
        }
    });
}
//# sourceMappingURL=purchasing.js.map