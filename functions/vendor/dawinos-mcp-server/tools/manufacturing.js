import { z } from 'zod';
import { queryCollection, getDocument, getSubcollection, getDb, serializeDoc, formatTimestamp, formatCurrency, truncateIfNeeded, serverTimestamp, } from '../services/firebase.js';
import { COLLECTIONS, MO_SUBCOLLECTIONS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MO_STATUSES, MO_STAGES, } from '../constants.js';
const PRIORITY_EMOJI = {
    urgent: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
};
export function registerManufacturingTools(server) {
    // ─── Tool 1: List Manufacturing Orders ────────────────────────────────────────
    server.registerTool('dawinos_list_manufacturing_orders', {
        title: 'List Manufacturing Orders',
        description: `List and filter manufacturing orders from DawinOS.

Parameters:
- status (optional): Filter by MO status. Values: ${MO_STATUSES.join(' | ')}
- current_stage (optional): Filter by production stage. Values: ${MO_STAGES.join(' | ')}
- priority (optional): Filter by priority: low | medium | high | urgent
- project_id (optional): Filter by linked design project ID
- limit (optional): Max results, default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}
- offset (optional): Pagination offset, default 0
- response_format (optional): 'markdown' (default) or 'json'

Returns: List of MOs with status, stage, priority, scheduling, and cost summary.
For BOM entries and material consumption, use dawinos_get_manufacturing_order.

Note: Status values use kebab-case (e.g. 'in-progress', 'pending-approval', 'on-hold').
Stage field on documents is 'currentStage' (not 'productionStage').`,
        inputSchema: {
            status: z
                .enum(MO_STATUSES)
                .optional()
                .describe(`Filter by status: ${MO_STATUSES.join(' | ')}`),
            current_stage: z
                .enum(MO_STAGES)
                .optional()
                .describe(`Filter by production stage: ${MO_STAGES.join(' | ')}`),
            priority: z
                .enum(['low', 'medium', 'high', 'urgent'])
                .optional()
                .describe('Filter by priority'),
            project_id: z.string().optional().describe('Filter by linked project ID'),
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
            const { status, current_stage, priority, project_id, limit, offset, response_format } = params;
            const filters = [];
            if (status)
                filters.push({ field: 'status', op: '==', value: status });
            if (current_stage)
                filters.push({ field: 'currentStage', op: '==', value: current_stage });
            if (priority)
                filters.push({ field: 'priority', op: '==', value: priority });
            if (project_id)
                filters.push({ field: 'projectId', op: '==', value: project_id });
            const { items: mos, total } = await queryCollection(COLLECTIONS.MANUFACTURING_ORDERS, {
                filters,
                orderByField: 'createdAt',
                orderByDirection: 'desc',
                limit,
                offset,
            });
            if (mos.length === 0) {
                return {
                    content: [{ type: 'text', text: 'No manufacturing orders found matching your filters.' }],
                };
            }
            const hasMore = offset + mos.length < total;
            if (response_format === 'json') {
                const result = {
                    total,
                    count: mos.length,
                    offset,
                    limit,
                    hasMore,
                    nextOffset: hasMore ? offset + limit : undefined,
                    items: mos.map((mo) => serializeDoc(mo)),
                };
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            const lines = [
                `## Manufacturing Orders (${mos.length} of ${total} total)\n`,
                `| MO # | Name | Status | Stage | Priority | Target Completion | Est. Cost |`,
                `|------|------|--------|-------|----------|-------------------|-----------|`,
            ];
            for (const mo of mos) {
                const moNum = mo.moNumber ?? mo.orderNumber ?? mo.id.slice(0, 8);
                const emoji = PRIORITY_EMOJI[mo.priority ?? ''] ?? '⚪';
                lines.push(`| ${moNum} | ${mo.name ?? 'N/A'} | ${mo.status ?? 'N/A'} | ${mo.currentStage ?? 'N/A'} | ${emoji} ${mo.priority ?? 'N/A'} | ${formatTimestamp(mo.targetCompletionDate)} | ${formatCurrency(mo.totalEstimatedCost)} |`);
            }
            if (hasMore) {
                lines.push(`\n_Showing ${offset + 1}–${offset + mos.length} of ${total}. Use offset=${offset + limit} for next page._`);
            }
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error listing manufacturing orders: ${error.message}` }],
            };
        }
    });
    // ─── Tool 2: Get Manufacturing Order ─────────────────────────────────────────
    server.registerTool('dawinos_get_manufacturing_order', {
        title: 'Get Manufacturing Order',
        description: `Get full details of a single manufacturing order, including BOM entries, material consumptions, and stage transitions.

Parameters:
- id (required): Firestore document ID of the manufacturing order
- response_format (optional): 'markdown' (default) or 'json'

Returns: Complete MO document with:
- Main fields: status, currentStage, priority, scheduling, costs
- bomEntries subcollection: bill of materials with items, quantities, costs
- materialConsumptions subcollection: actual material usage records
- stageTransitions subcollection: production stage history

Note: Subcollections are 'bomEntries', 'materialConsumptions', 'stageTransitions'
(not 'bom', 'materials', or 'steps').`,
        inputSchema: {
            id: z.string().describe('Firestore document ID of the manufacturing order'),
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
            const { id, response_format } = params;
            const mo = await getDocument(COLLECTIONS.MANUFACTURING_ORDERS, id);
            if (!mo) {
                return {
                    content: [{ type: 'text', text: `Manufacturing order '${id}' not found.` }],
                };
            }
            // Load subcollections in parallel
            const [bomEntries, materialConsumptions, stageTransitions] = await Promise.all([
                getSubcollection(COLLECTIONS.MANUFACTURING_ORDERS, id, MO_SUBCOLLECTIONS.BOM_ENTRIES, { limit: 200 }),
                getSubcollection(COLLECTIONS.MANUFACTURING_ORDERS, id, MO_SUBCOLLECTIONS.MATERIAL_CONSUMPTIONS, { orderByField: 'consumedAt', orderByDirection: 'desc', limit: 50 }),
                getSubcollection(COLLECTIONS.MANUFACTURING_ORDERS, id, MO_SUBCOLLECTIONS.STAGE_TRANSITIONS, { orderByField: 'transitionedAt', orderByDirection: 'desc', limit: 50 }),
            ]);
            mo.bomEntries = bomEntries;
            mo.materialConsumptions = materialConsumptions;
            mo.stageTransitions = stageTransitions;
            if (response_format === 'json') {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(serializeDoc(mo), null, 2),
                        },
                    ],
                };
            }
            const moNum = mo.moNumber ?? mo.orderNumber ?? id;
            const emoji = PRIORITY_EMOJI[mo.priority ?? ''] ?? '⚪';
            const lines = [
                `## Manufacturing Order: ${moNum}\n`,
                `| Field | Value |`,
                `|-------|-------|`,
                `| Name | ${mo.name ?? 'N/A'} |`,
                `| Status | ${mo.status ?? 'N/A'} |`,
                `| Stage | ${mo.currentStage ?? 'N/A'} |`,
                `| Priority | ${emoji} ${mo.priority ?? 'N/A'} |`,
                `| Project | ${mo.projectName ?? mo.projectId ?? 'N/A'} |`,
                `| Customer | ${mo.customerName ?? mo.customerId ?? 'N/A'} |`,
                `| Start Date | ${formatTimestamp(mo.startDate)} |`,
                `| Target Completion | ${formatTimestamp(mo.targetCompletionDate)} |`,
                `| Actual Completion | ${formatTimestamp(mo.actualCompletionDate)} |`,
                `| Estimated Cost | ${formatCurrency(mo.totalEstimatedCost)} |`,
                `| Actual Cost | ${formatCurrency(mo.totalActualCost)} |`,
                `| BOM Items | ${mo.bomItemCount ?? bomEntries.length} |`,
                `| Created | ${formatTimestamp(mo.createdAt)} |`,
            ];
            if (bomEntries.length > 0) {
                lines.push(`\n### BOM Entries (${bomEntries.length})\n`);
                lines.push(`| Item | SKU | Qty | Unit Cost | Total Cost | Status |`);
                lines.push(`|------|-----|-----|-----------|-----------|--------|`);
                for (const b of bomEntries) {
                    lines.push(`| ${b.itemName ?? b.name ?? 'N/A'} | ${b.sku ?? '-'} | ${b.quantity ?? '-'} | ${formatCurrency(b.unitCost)} | ${formatCurrency(b.totalCost)} | ${b.status ?? '-'} |`);
                }
            }
            if (materialConsumptions.length > 0) {
                lines.push(`\n### Material Consumptions (${materialConsumptions.length})\n`);
                lines.push(`| Item | Qty | Cost/Unit | Total | Consumed At |`);
                lines.push(`|------|-----|-----------|-------|------------|`);
                for (const c of materialConsumptions) {
                    lines.push(`| ${c.itemName ?? 'N/A'} | ${c.quantity ?? '-'} | ${formatCurrency(c.costPerUnit)} | ${formatCurrency(c.totalCost)} | ${formatTimestamp(c.consumedAt)} |`);
                }
            }
            if (stageTransitions.length > 0) {
                lines.push(`\n### Stage History (${stageTransitions.length})\n`);
                lines.push(`| From | To | By | When | Notes |`);
                lines.push(`|------|----|----|------|-------|`);
                for (const t of stageTransitions) {
                    lines.push(`| ${t.fromStage ?? '-'} | ${t.toStage ?? '-'} | ${t.transitionedByName ?? t.transitionedBy ?? '-'} | ${formatTimestamp(t.transitionedAt)} | ${t.notes ?? '-'} |`);
                }
            }
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error fetching manufacturing order: ${error.message}` }],
            };
        }
    });
    // ─── Tool 3: Production Summary ────────────────────────────────────────────────
    server.registerTool('dawinos_production_summary', {
        title: 'Production Summary Dashboard',
        description: `Get a dashboard-level overview of manufacturing order status and production health.

Parameters:
- response_format (optional): 'markdown' (default) or 'json'

Returns:
- Total MO counts by status (draft, pending-approval, approved, in-progress, on-hold, completed, cancelled)
- Active MO counts by production stage (queued, cutting, assembly, finishing, qc, ready)
- Overdue count: MOs where targetCompletionDate < now and status is not completed/cancelled
- Total estimated vs actual cost for completed orders

Fetches up to 500 non-cancelled MOs for aggregation.`,
        inputSchema: {
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
            const { response_format } = params;
            const { items: mos } = await queryCollection(COLLECTIONS.MANUFACTURING_ORDERS, {
                filters: [],
                orderByField: 'createdAt',
                orderByDirection: 'desc',
                limit: 500,
                offset: 0,
            });
            const now = Date.now();
            const byStatus = {};
            const byStage = {};
            let overdueCount = 0;
            let totalEstimated = 0;
            let totalActual = 0;
            let completedCount = 0;
            for (const mo of mos) {
                const st = mo.status ?? 'unknown';
                byStatus[st] = (byStatus[st] ?? 0) + 1;
                if (mo.currentStage && !['completed', 'cancelled'].includes(st)) {
                    byStage[mo.currentStage] = (byStage[mo.currentStage] ?? 0) + 1;
                }
                // Overdue check
                if (!['completed', 'cancelled'].includes(st) && mo.targetCompletionDate) {
                    const dueMs = typeof mo.targetCompletionDate.toDate === 'function'
                        ? mo.targetCompletionDate.toDate().getTime()
                        : 0;
                    if (dueMs > 0 && dueMs < now)
                        overdueCount++;
                }
                if (st === 'completed') {
                    completedCount++;
                    totalEstimated += mo.totalEstimatedCost ?? 0;
                    totalActual += mo.totalActualCost ?? 0;
                }
            }
            const activeMOs = mos.filter(m => !['completed', 'cancelled', 'draft'].includes(m.status ?? ''));
            if (response_format === 'json') {
                const result = {
                    totalMOs: mos.length,
                    activeMOs: activeMOs.length,
                    overdueCount,
                    completedCount,
                    byStatus,
                    byStage,
                    completedCosts: {
                        totalEstimated,
                        totalActual,
                        variance: totalActual - totalEstimated,
                    },
                };
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            const lines = [
                `## Production Summary Dashboard\n`,
                `| Metric | Value |`,
                `|--------|-------|`,
                `| Total MOs (in system) | ${mos.length} |`,
                `| Active MOs | ${activeMOs.length} |`,
                `| Overdue 🚨 | ${overdueCount} |`,
                `| Completed | ${completedCount} |`,
                ``,
                `### By Status\n`,
                `| Status | Count |`,
                `|--------|-------|`,
            ];
            const statusOrder = MO_STATUSES;
            for (const s of statusOrder) {
                if (byStatus[s])
                    lines.push(`| ${s} | ${byStatus[s]} |`);
            }
            if (Object.keys(byStage).length > 0) {
                lines.push(`\n### Active Orders by Stage\n`);
                lines.push(`| Stage | Count |`);
                lines.push(`|-------|-------|`);
                for (const [stage, count] of Object.entries(byStage).sort(([, a], [, b]) => b - a)) {
                    lines.push(`| ${stage} | ${count} |`);
                }
            }
            if (completedCount > 0) {
                const variance = totalActual - totalEstimated;
                lines.push(`\n### Completed Order Costs\n`);
                lines.push(`| Metric | Value |`);
                lines.push(`|--------|-------|`);
                lines.push(`| Total Estimated | ${formatCurrency(totalEstimated)} |`);
                lines.push(`| Total Actual | ${formatCurrency(totalActual)} |`);
                lines.push(`| Variance | ${formatCurrency(Math.abs(variance))} ${variance > 0 ? '(over budget)' : variance < 0 ? '(under budget)' : ''} |`);
            }
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error generating production summary: ${error.message}` }],
            };
        }
    });
    // ─── Tool 4: Create Manufacturing Order ──────────────────────────────────────
    server.registerTool('dawinos_create_manufacturing_order', {
        title: 'Create Manufacturing Order',
        description: `Create a new manufacturing order (MO) in DawinOS as a draft.

Generates a sequential MO number (MO-YYYY-NNNN). The order starts with status='draft'
and currentStage='queued'. Use dawinos_advance_mo_stage to start production.

Required: item_name, quantity, priority.
Optional: bom (bill of materials), project_id, instructions.`,
        inputSchema: {
            item_name: z.string().min(1).describe('Name of the item to manufacture'),
            quantity: z.number().positive().describe('Quantity to produce'),
            priority: z.enum(['low', 'medium', 'high', 'urgent']).describe('Production priority'),
            project_id: z.string().optional().describe('Linked project ID'),
            instructions: z.string().optional().describe('Production instructions'),
            notes: z.string().optional().describe('Handover notes'),
            target_completion_date: z.string().optional().describe('ISO date string (YYYY-MM-DD)'),
            bom: z
                .array(z.object({
                inventory_item_id: z.string().min(1),
                name: z.string().min(1),
                quantity: z.number().positive(),
                unit: z.string().min(1),
                unit_cost: z.number().nonnegative().optional(),
                currency: z.enum(['UGX', 'USD']).optional().default('UGX'),
            }))
                .optional()
                .describe('Bill of materials — optional'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const db = getDb();
            const year = new Date().getFullYear();
            // Generate MO number via counter transaction
            const counterRef = db.doc(`counters/mo_default_${year}`);
            const nextNum = await db.runTransaction(async (tx) => {
                const snap = await tx.get(counterRef);
                const current = snap.exists ? (snap.data()?.counter ?? 0) : 0;
                const next = current + 1;
                tx.set(counterRef, { counter: next }, { merge: true });
                return next;
            });
            const moNumber = `MO-${year}-${String(nextNum).padStart(4, '0')}`;
            // Build BOM and cost summary
            const bomEntries = (params.bom ?? []).map((b) => ({
                inventoryItemId: b.inventory_item_id,
                name: b.name,
                quantity: b.quantity,
                unit: b.unit,
                unitCost: b.unit_cost ?? 0,
                currency: b.currency ?? 'UGX',
                totalCost: b.quantity * (b.unit_cost ?? 0),
            }));
            const materialCost = bomEntries.reduce((s, b) => s + b.totalCost, 0);
            const now = new Date();
            const stageHistory = [
                {
                    fromStage: null,
                    toStage: 'queued',
                    transitionedAt: now.toISOString(),
                    transitionedBy: 'mcp-agent',
                    notes: 'Manufacturing order created via MCP',
                },
            ];
            const docData = {
                moNumber,
                status: 'draft',
                itemName: params.item_name,
                sourceType: 'manual',
                quantity: params.quantity,
                priority: params.priority,
                bom: bomEntries,
                parts: [],
                instructions: params.instructions ?? '',
                handoverNotes: params.notes ?? '',
                projectId: params.project_id ?? null,
                currentStage: 'queued',
                stageHistory,
                stageEnteredAt: serverTimestamp(),
                scheduling: {},
                materialReservations: [],
                materialConsumptions: [],
                costSummary: { materialCost, laborCost: 0, totalCost: materialCost, currency: 'UGX' },
                subsidiaryId: 'default',
                createdAt: serverTimestamp(),
                createdBy: 'mcp-agent',
                updatedAt: serverTimestamp(),
                updatedBy: 'mcp-agent',
            };
            if (params.target_completion_date) {
                docData['targetCompletionDate'] = new Date(params.target_completion_date);
            }
            const ref = await db.collection(COLLECTIONS.MANUFACTURING_ORDERS).add(docData);
            return {
                content: [
                    {
                        type: 'text',
                        text: `## Manufacturing Order Created\n\n**ID:** ${ref.id}\n**MO Number:** ${moNumber}\n**Status:** draft\n**Stage:** queued\n**Item:** ${params.item_name}\n**Quantity:** ${params.quantity}\n**Priority:** ${params.priority}\n**BOM Items:** ${bomEntries.length}\n**Material Cost:** ${formatCurrency(materialCost)}\n\nUse \`dawinos_advance_mo_stage\` with action=\`approve\` to approve, then \`start\` to begin production.`,
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error creating manufacturing order: ${err.message}` }],
            };
        }
    });
    // ─── Tool 5: Advance MO Stage ─────────────────────────────────────────────────
    server.registerTool('dawinos_advance_mo_stage', {
        title: 'Advance Manufacturing Order Stage',
        description: `Change the status or production stage of a manufacturing order.

Actions and their effects:
  approve       → status: approved (from draft)
  start         → status: in-progress, stage: cutting (from approved+queued)
  advance_stage → moves stage forward: cutting→assembly→finishing→qc→ready
  hold          → status: on-hold (from in-progress)
  resume        → status: in-progress (from on-hold)
  complete      → status: completed (when stage=ready)
  cancel        → status: cancelled (from any non-terminal status)`,
        inputSchema: {
            mo_id: z.string().min(1).describe('Manufacturing order document ID'),
            action: z
                .enum(['approve', 'start', 'advance_stage', 'hold', 'resume', 'complete', 'cancel'])
                .describe('Action to perform'),
            notes: z.string().optional().describe('Notes on this stage transition'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const db = getDb();
            const ref = db.collection(COLLECTIONS.MANUFACTURING_ORDERS).doc(params.mo_id);
            const snap = await ref.get();
            if (!snap.exists) {
                return { content: [{ type: 'text', text: `Manufacturing order "${params.mo_id}" not found.` }] };
            }
            const data = snap.data();
            const currentStatus = data['status'];
            const currentStage = data['currentStage'];
            const moNumber = data['moNumber'] ?? params.mo_id;
            const STAGE_ORDER = ['queued', 'cutting', 'assembly', 'finishing', 'qc', 'ready'];
            const update = {
                updatedAt: serverTimestamp(),
                updatedBy: 'mcp-agent',
            };
            let fromStage = currentStage;
            let toStage = currentStage;
            let statusChange = null;
            let description = '';
            switch (params.action) {
                case 'approve':
                    if (currentStatus !== 'draft') {
                        return { content: [{ type: 'text', text: `Cannot approve: MO is "${currentStatus}", must be "draft".` }] };
                    }
                    statusChange = 'approved';
                    description = 'Approved via MCP';
                    break;
                case 'start':
                    if (currentStatus !== 'approved') {
                        return { content: [{ type: 'text', text: `Cannot start: MO is "${currentStatus}", must be "approved".` }] };
                    }
                    statusChange = 'in-progress';
                    toStage = 'cutting';
                    update['currentStage'] = 'cutting';
                    update['stageEnteredAt'] = serverTimestamp();
                    description = 'Production started via MCP';
                    break;
                case 'advance_stage': {
                    if (currentStatus !== 'in-progress') {
                        return { content: [{ type: 'text', text: `Cannot advance stage: MO is "${currentStatus}", must be "in-progress".` }] };
                    }
                    const idx = STAGE_ORDER.indexOf(currentStage);
                    if (idx === -1 || idx >= STAGE_ORDER.length - 1) {
                        return { content: [{ type: 'text', text: `Cannot advance: already at final stage "${currentStage}". Use action=complete.` }] };
                    }
                    toStage = STAGE_ORDER[idx + 1];
                    update['currentStage'] = toStage;
                    update['stageEnteredAt'] = serverTimestamp();
                    description = `Advanced from ${currentStage} to ${toStage} via MCP`;
                    break;
                }
                case 'hold':
                    if (currentStatus !== 'in-progress') {
                        return { content: [{ type: 'text', text: `Cannot hold: MO is "${currentStatus}", must be "in-progress".` }] };
                    }
                    statusChange = 'on-hold';
                    description = 'Put on hold via MCP';
                    break;
                case 'resume':
                    if (currentStatus !== 'on-hold') {
                        return { content: [{ type: 'text', text: `Cannot resume: MO is "${currentStatus}", must be "on-hold".` }] };
                    }
                    statusChange = 'in-progress';
                    description = 'Resumed via MCP';
                    break;
                case 'complete':
                    if (currentStage !== 'ready') {
                        return { content: [{ type: 'text', text: `Cannot complete: current stage is "${currentStage}", must be "ready".` }] };
                    }
                    statusChange = 'completed';
                    update['completedAt'] = serverTimestamp();
                    description = 'Completed via MCP';
                    break;
                case 'cancel':
                    if (['completed', 'cancelled'].includes(currentStatus)) {
                        return { content: [{ type: 'text', text: `Cannot cancel: MO is already "${currentStatus}".` }] };
                    }
                    statusChange = 'cancelled';
                    description = 'Cancelled via MCP';
                    break;
            }
            if (statusChange) {
                update['status'] = statusChange;
            }
            // Append to stageHistory
            const historyEntry = {
                fromStage,
                toStage,
                transitionedAt: new Date().toISOString(),
                transitionedBy: 'mcp-agent',
                notes: params.notes ?? description,
            };
            if (statusChange)
                historyEntry['statusChange'] = statusChange;
            // Use FieldValue.arrayUnion to append without overwriting
            const { FieldValue } = await import('firebase-admin/firestore');
            update['stageHistory'] = FieldValue.arrayUnion(historyEntry);
            await ref.update(update);
            const newStatus = statusChange ?? currentStatus;
            const newStage = update['currentStage'] ?? currentStage;
            return {
                content: [
                    {
                        type: 'text',
                        text: `**MO ${moNumber}** — action: ${params.action}\n**Status:** ${currentStatus} → ${newStatus}\n**Stage:** ${fromStage} → ${newStage}`,
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error advancing MO stage: ${err.message}` }],
            };
        }
    });
    // ─── Tool 6: Update Manufacturing Order Fields ────────────────────────────────
    server.registerTool('dawinos_update_manufacturing_order', {
        title: 'Update Manufacturing Order Fields',
        description: `Update editable fields on a manufacturing order (partial update).

Editable fields: instructions, notes (handover), priority, target_completion_date.
Status and stage changes must use dawinos_advance_mo_stage.`,
        inputSchema: {
            mo_id: z.string().min(1).describe('Manufacturing order document ID'),
            instructions: z.string().optional(),
            notes: z.string().optional().describe('Handover notes'),
            priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
            target_completion_date: z.string().optional().describe('ISO date string (YYYY-MM-DD)'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const db = getDb();
            const ref = db.collection(COLLECTIONS.MANUFACTURING_ORDERS).doc(params.mo_id);
            const snap = await ref.get();
            if (!snap.exists) {
                return { content: [{ type: 'text', text: `Manufacturing order "${params.mo_id}" not found.` }] };
            }
            const update = {
                updatedAt: serverTimestamp(),
                updatedBy: 'mcp-agent',
            };
            const changed = [];
            if (params.instructions !== undefined) {
                update['instructions'] = params.instructions;
                changed.push('instructions');
            }
            if (params.notes !== undefined) {
                update['handoverNotes'] = params.notes;
                changed.push('handoverNotes');
            }
            if (params.priority !== undefined) {
                update['priority'] = params.priority;
                changed.push('priority');
            }
            if (params.target_completion_date !== undefined) {
                update['targetCompletionDate'] = new Date(params.target_completion_date);
                changed.push('targetCompletionDate');
            }
            if (changed.length === 0) {
                return { content: [{ type: 'text', text: 'No fields provided to update.' }] };
            }
            await ref.update(update);
            const moNumber = snap.data()?.['moNumber'] ?? params.mo_id;
            return {
                content: [
                    {
                        type: 'text',
                        text: `**MO ${moNumber}** updated.\nChanged fields: ${changed.join(', ')}`,
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error updating manufacturing order: ${err.message}` }],
            };
        }
    });
}
//# sourceMappingURL=manufacturing.js.map