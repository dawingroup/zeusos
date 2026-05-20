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
import { z } from 'zod';
import { queryCollection, getDocument, getDb, formatCurrency, formatTimestamp, truncateIfNeeded, serverTimestamp, } from '../services/firebase.js';
import { MATFLOW_PATHS } from '../constants.js';
const DEFAULT_ORG = 'default';
/** Build the Firestore path to a project's BOQ items sub-collection. */
function boqPath(projectId, orgId = DEFAULT_ORG) {
    return `organizations/${orgId}/advisory_projects/${projectId}/boq_items`;
}
/** Build path to a single BOQ item. */
function boqItemPath(projectId, itemId, orgId = DEFAULT_ORG) {
    return `organizations/${orgId}/advisory_projects/${projectId}/boq_items/${itemId}`;
}
const fmt = (n, currency = 'UGX') => formatCurrency(n, currency);
export function registerBOQTools(server) {
    // ─── dawinos_list_boq_items ───────────────────────────────────────────────────
    server.registerTool('dawinos_list_boq_items', {
        title: 'List BOQ Items for a Project',
        description: `List the Bill of Quantities (BOQ) items for an infrastructure delivery project.

Returns the hierarchical BOQ with formula status, material requirement counts, quantities, and amounts.

Use filters to narrow to items that still need formulas, or to a specific category/hierarchy level.
Combine with \`dawinos_apply_formula_to_boq\` to assign formulas, or \`dawinos_boq_cost_summary\` for a cost roll-up.`,
        inputSchema: {
            project_id: z.string().describe('Advisory project document ID'),
            org_id: z.string().optional().describe('Organisation ID (default: "default")'),
            formula_status: z.enum(['all', 'applied', 'not_applied', 'custom', 'bulk', 'excluded'])
                .optional().default('all')
                .describe('Filter by formula status'),
            category: z.string().optional().describe('Filter by BOQ category (e.g. "CONCRETE", "MASONRY")'),
            hierarchy_level: z.number().int().min(1).max(5).optional()
                .describe('Only return items at this hierarchy level (1=Bill, 2=Element, 3=Section, 4+=Work items)'),
            limit: z.number().int().min(1).max(200).optional().default(100),
            offset: z.number().int().min(0).optional().default(0),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const orgId = params.org_id ?? DEFAULT_ORG;
        const path = boqPath(params.project_id, orgId);
        try {
            const filters = [];
            if (params.category) {
                filters.push({ field: 'category', op: '==', value: params.category });
            }
            const { items } = await queryCollection(path, {
                filters,
                orderByField: 'hierarchyPath',
                orderByDirection: 'asc',
                limit: 500, // fetch broadly, filter client-side for formula_status & level
            });
            // Client-side filters
            let result = items;
            if (params.hierarchy_level != null) {
                result = result.filter(i => (i.hierarchyLevel ?? 99) === params.hierarchy_level);
            }
            if (params.formula_status && params.formula_status !== 'all') {
                result = result.filter(item => {
                    const hasMaterials = item.materialRequirements && item.materialRequirements.length > 0;
                    switch (params.formula_status) {
                        case 'applied': return item.formulaId && hasMaterials;
                        case 'not_applied': return !item.formulaId && !hasMaterials && !item.isBulkItem && !item.noFormulaRequired;
                        case 'custom': return !item.formulaId && hasMaterials;
                        case 'bulk': return item.isBulkItem === true;
                        case 'excluded': return item.noFormulaRequired === true;
                        default: return true;
                    }
                });
            }
            const total = result.length;
            const page = result.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 100));
            const lines = [
                `**BOQ Items — Project ${params.project_id}** (${total} items${params.formula_status !== 'all' ? `, filter: ${params.formula_status}` : ''})`,
                '',
                '| # | Code | Description | Unit | Qty | Amount | Formula | Materials |',
                '|---|------|-------------|------|-----|--------|---------|-----------|',
            ];
            for (const item of page) {
                const qty = (item.quantityContract ?? item.quantity ?? 0).toLocaleString();
                const amount = item.amount ?? ((item.quantityContract ?? item.quantity ?? 0) * (item.rate ?? item.unitRate ?? 0));
                const matCount = item.materialRequirements?.length ?? 0;
                const formulaLabel = item.noFormulaRequired ? 'Excluded'
                    : item.isBulkItem ? 'Bulk'
                        : item.formulaId ? `✓ ${item.formulaCode ?? item.formulaId.slice(0, 8)}`
                            : matCount > 0 ? 'Custom'
                                : '—';
                const lvl = item.hierarchyLevel ?? '?';
                lines.push(`| L${lvl} | ${item.hierarchyPath ?? item.itemCode ?? item.itemNumber ?? item.id.slice(0, 8)} | ${item.description.slice(0, 60)} | ${item.unit ?? '-'} | ${qty} | ${fmt(amount)} | ${formulaLabel} | ${matCount > 0 ? matCount : '—'} |`);
            }
            if (total > page.length) {
                lines.push('', `_Showing ${params.offset ?? 0 + 1}–${(params.offset ?? 0) + page.length} of ${total} items._`);
            }
            lines.push('', `_Use \`dawinos_get_boq_item\` with an item ID for full detail including material requirements._`);
            lines.push(`_Use \`dawinos_boq_cost_summary\` for cost roll-up and formula coverage._`);
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── dawinos_get_boq_item ─────────────────────────────────────────────────────
    server.registerTool('dawinos_get_boq_item', {
        title: 'Get BOQ Item Detail',
        description: `Get full detail for a single BOQ item including material requirements, formula reference, quantities, and rates.

Shows the complete material breakdown per component with required quantity, purchase quantity (MOQ-rounded), unit price, and cost.`,
        inputSchema: {
            project_id: z.string().describe('Advisory project document ID'),
            item_id: z.string().describe('BOQ item document ID'),
            org_id: z.string().optional().describe('Organisation ID (default: "default")'),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const orgId = params.org_id ?? DEFAULT_ORG;
        try {
            const item = await getDocument(boqPath(params.project_id, orgId), params.item_id);
            if (!item) {
                return { content: [{ type: 'text', text: 'BOQ item not found.' }] };
            }
            const qty = item.quantityContract ?? item.quantity ?? 0;
            const rate = item.rate ?? item.unitRate ?? 0;
            const amount = item.amount ?? qty * rate;
            const lines = [
                `**BOQ Item: ${item.hierarchyPath ?? item.itemCode ?? item.id}**`,
                `${item.description}`,
                item.specification ? `_${item.specification}_` : '',
                '',
                `**Quantities & Rates**`,
                `Contract Qty: ${qty.toLocaleString()} ${item.unit ?? ''}`,
                `Unit Rate: ${fmt(rate)}`,
                `Amount: ${fmt(amount)}`,
                item.laborRate ? `Labour Rate: ${fmt(item.laborRate)}/${item.unit}` : '',
                item.equipmentRate ? `Equipment Rate: ${fmt(item.equipmentRate)}/${item.unit}` : '',
                '',
                `**Formula Status**`,
                item.noFormulaRequired ? '⊘ Excluded — no formula required'
                    : item.isBulkItem ? '📦 Bulk — sent to supplier as-is'
                        : item.formulaId ? `✓ Formula applied: ${item.formulaCode ?? item.formulaId}`
                            : item.materialRequirements?.length ? `Custom material list (${item.materialRequirements.length} items)`
                                : '⚠ No formula assigned',
            ].filter(l => l !== '');
            if (item.materialRequirements && item.materialRequirements.length > 0) {
                const reqs = item.materialRequirements;
                const materialCost = reqs.reduce((s, r) => s + (r.totalCost ?? 0), 0);
                const labourCost = qty * (item.laborRate ?? 0);
                const equipCost = qty * (item.equipmentRate ?? 0);
                lines.push('', `**Material Requirements (${reqs.length} components)**`);
                lines.push('| Material | Req Qty | Purchase Qty | MOQ | Unit | Unit Price | Cost |');
                lines.push('|----------|---------|--------------|-----|------|------------|------|');
                for (const r of reqs) {
                    const reqQty = r.requiredQuantity ?? r.quantity ?? 0;
                    const purQty = r.purchaseQuantity ?? reqQty;
                    const moqLabel = r.moq ? `${r.moq}${r.packUnit ? ' ' + r.packUnit : ''}` : '—';
                    lines.push(`| ${r.materialName} | ${reqQty.toFixed(2)} | **${purQty.toFixed(2)}** | ${moqLabel} | ${r.unit ?? '-'} | ${r.unitPrice ? fmt(r.unitPrice) : '—'} | ${r.totalCost ? fmt(r.totalCost) : '—'} |`);
                }
                lines.push('');
                lines.push(`Material cost: **${fmt(materialCost)}**`);
                if (labourCost > 0)
                    lines.push(`Labour cost: **${fmt(labourCost)}**`);
                if (equipCost > 0)
                    lines.push(`Equipment cost: **${fmt(equipCost)}**`);
                lines.push(`Line total: **${fmt(materialCost + labourCost + equipCost)}**`);
            }
            lines.push('', `_Item ID: ${item.id} | Updated: ${formatTimestamp(item.updatedAt)}_`);
            return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── dawinos_update_boq_item ──────────────────────────────────────────────────
    server.registerTool('dawinos_update_boq_item', {
        title: 'Update BOQ Item',
        description: `Update fields on a BOQ item — quantities, rates, stage, category, or description. All fields optional; only supplied fields are written.

To assign a formula and calculate materials, use \`dawinos_apply_formula_to_boq\` instead.
To mark an item as excluded or bulk, set the \`no_formula_required\` or \`is_bulk_item\` flags.`,
        inputSchema: {
            project_id: z.string().describe('Advisory project document ID'),
            item_id: z.string().describe('BOQ item document ID'),
            org_id: z.string().optional().describe('Organisation ID (default: "default")'),
            description: z.string().optional(),
            specification: z.string().optional(),
            unit: z.string().optional(),
            quantity_contract: z.number().positive().optional().describe('Contract quantity'),
            rate: z.number().min(0).optional().describe('Unit rate'),
            labor_rate: z.number().min(0).optional().describe('Labour rate per unit'),
            material_rate: z.number().min(0).optional().describe('Material rate per unit'),
            equipment_rate: z.number().min(0).optional().describe('Equipment rate per unit'),
            stage: z.string().optional().describe('BOQ stage/phase'),
            category: z.string().optional().describe('BOQ category (e.g. CONCRETE, MASONRY)'),
            status: z.enum(['pending', 'partial', 'in_progress', 'completed']).optional(),
            no_formula_required: z.boolean().optional().describe('Mark as excluded — no formula needed'),
            is_bulk_item: z.boolean().optional().describe('Mark as bulk — sent to supplier as-is'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        const orgId = params.org_id ?? DEFAULT_ORG;
        const db = getDb();
        const path = boqPath(params.project_id, orgId);
        try {
            const updates = { updatedAt: serverTimestamp() };
            if (params.description !== undefined)
                updates['description'] = params.description;
            if (params.specification !== undefined)
                updates['specification'] = params.specification;
            if (params.unit !== undefined)
                updates['unit'] = params.unit;
            if (params.quantity_contract !== undefined) {
                updates['quantityContract'] = params.quantity_contract;
                updates['quantity'] = params.quantity_contract;
            }
            if (params.rate !== undefined) {
                updates['rate'] = params.rate;
                updates['unitRate'] = params.rate;
            }
            if (params.labor_rate !== undefined)
                updates['laborRate'] = params.labor_rate;
            if (params.material_rate !== undefined)
                updates['materialRate'] = params.material_rate;
            if (params.equipment_rate !== undefined)
                updates['equipmentRate'] = params.equipment_rate;
            if (params.stage !== undefined)
                updates['stage'] = params.stage;
            if (params.category !== undefined)
                updates['category'] = params.category;
            if (params.status !== undefined)
                updates['status'] = params.status;
            if (params.no_formula_required !== undefined)
                updates['noFormulaRequired'] = params.no_formula_required;
            if (params.is_bulk_item !== undefined)
                updates['isBulkItem'] = params.is_bulk_item;
            // Recalculate amount if both qty and rate are now known
            if (params.quantity_contract !== undefined || params.rate !== undefined) {
                const existing = await getDocument(path, params.item_id);
                if (existing) {
                    const qty = params.quantity_contract ?? existing.quantityContract ?? existing.quantity ?? 0;
                    const rate = params.rate ?? existing.rate ?? existing.unitRate ?? 0;
                    updates['amount'] = qty * rate;
                }
            }
            await db.collection(path).doc(params.item_id).update(updates);
            const changed = Object.keys(updates).filter(k => k !== 'updatedAt');
            return {
                content: [{
                        type: 'text',
                        text: `BOQ item \`${params.item_id}\` updated.\nFields changed: ${changed.join(', ')}`,
                    }],
            };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── dawinos_apply_formula_to_boq ─────────────────────────────────────────────
    server.registerTool('dawinos_apply_formula_to_boq', {
        title: 'Apply Formula to BOQ Item',
        description: `Apply a MatFlow construction formula to a BOQ item. Calculates material requirements (with wastage and MOQ rounding), fetches unit prices from the material rates library, computes costs, and writes the requirements back to the BOQ item.

Provide either \`formula_id\` or \`formula_code\` to identify the formula, plus \`project_id\` and \`item_id\`.

After running this tool, use \`dawinos_get_boq_item\` to see the computed material breakdown.`,
        inputSchema: {
            project_id: z.string().describe('Advisory project document ID'),
            item_id: z.string().describe('BOQ item document ID'),
            formula_id: z.string().optional().describe('Firestore formula document ID'),
            formula_code: z.string().optional().describe('Formula code (e.g. "C25", "BRICK_230")'),
            org_id: z.string().optional().describe('Organisation ID (default: "default")'),
            wastage_override: z.number().min(0).max(100).optional()
                .describe('Override wastage % for all components (uses formula defaults if omitted)'),
            rate_source: z.enum(['standard', 'lastPurchase', 'average']).optional().default('standard')
                .describe('Which price to use from the material library'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        if (!params.formula_id && !params.formula_code) {
            return { isError: true, content: [{ type: 'text', text: 'Provide either formula_id or formula_code.' }] };
        }
        const orgId = params.org_id ?? DEFAULT_ORG;
        const db = getDb();
        const path = boqPath(params.project_id, orgId);
        try {
            // Fetch BOQ item
            const item = await getDocument(path, params.item_id);
            if (!item) {
                return { isError: true, content: [{ type: 'text', text: 'BOQ item not found.' }] };
            }
            // Fetch formula
            let formula = null;
            if (params.formula_id) {
                formula = await getDocument(MATFLOW_PATHS.formulas, params.formula_id);
            }
            else if (params.formula_code) {
                const { items } = await queryCollection(MATFLOW_PATHS.formulas, {
                    filters: [{ field: 'code', op: '==', value: params.formula_code.toUpperCase() }],
                    limit: 1,
                });
                formula = items[0] ?? null;
            }
            if (!formula) {
                return { isError: true, content: [{ type: 'text', text: 'Formula not found.' }] };
            }
            const qty = item.quantityContract ?? item.quantity ?? 0;
            const rateSource = params.rate_source ?? 'standard';
            const warnings = [];
            // Batch-fetch material rates
            const materialIds = formula.components.map(c => c.materialId).filter(Boolean);
            const rateMap = new Map();
            if (materialIds.length > 0) {
                try {
                    const { items: rates } = await queryCollection(MATFLOW_PATHS.materials, {
                        filters: [],
                        limit: 500,
                    });
                    for (const r of rates) {
                        const price = (rateSource === 'lastPurchase' ? r.lastPurchaseRate?.amount :
                            rateSource === 'average' ? r.averageRate?.amount :
                                r.standardRate?.amount) ?? 0;
                        rateMap.set(r.id, price);
                    }
                }
                catch {
                    warnings.push('Could not fetch material rates — costs set to 0');
                }
            }
            // Calculate requirements
            const requirements = [];
            for (const c of formula.components) {
                let compQty = qty * c.quantity;
                const wastage = params.wastage_override ?? c.wastagePercent ?? 0;
                compQty *= (1 + wastage / 100);
                const requiredQuantity = Math.ceil(compQty * 100) / 100;
                // MOQ rounding
                const purchaseQuantity = c.moq
                    ? Math.ceil(requiredQuantity / c.moq) * c.moq
                    : requiredQuantity;
                const unitPrice = rateMap.get(c.materialId) ?? 0;
                if (!unitPrice && c.materialId) {
                    warnings.push(`No rate found for "${c.materialName}" — cost set to 0`);
                }
                const totalCost = purchaseQuantity * unitPrice;
                requirements.push({
                    materialId: c.materialId,
                    materialName: c.materialName,
                    quantity: requiredQuantity,
                    requiredQuantity,
                    purchaseQuantity,
                    ...(c.moq != null ? { moq: c.moq } : {}),
                    ...(c.packUnit != null ? { packUnit: c.packUnit } : {}),
                    unit: c.unit,
                    unitPrice,
                    totalCost,
                    wastageIncluded: true,
                });
            }
            // Write back to Firestore
            await db.collection(path).doc(params.item_id).update({
                formulaId: formula.id,
                formulaCode: formula.code,
                materialRequirements: requirements,
                updatedAt: serverTimestamp(),
            });
            const totalCost = requirements.reduce((s, r) => s + r.totalCost, 0);
            const labourCost = qty * (formula.defaultLaborRate ?? 0);
            const equipCost = qty * (formula.defaultEquipmentRate ?? 0);
            const lines = [
                `**Formula applied: ${formula.code} → ${item.description.slice(0, 60)}**`,
                `${requirements.length} material components calculated for ${qty.toLocaleString()} ${item.unit ?? ''}`,
                '',
                '| Material | Req Qty | Purchase Qty | Unit | Unit Price | Cost |',
                '|----------|---------|--------------|------|------------|------|',
            ];
            for (const r of requirements) {
                const moqNote = r.moq && r.purchaseQuantity !== r.requiredQuantity
                    ? ` _(MOQ ${r.moq}${r.packUnit ? ' ' + r.packUnit : ''})_` : '';
                lines.push(`| ${r.materialName} | ${r.requiredQuantity.toFixed(2)} | **${r.purchaseQuantity.toFixed(2)}**${moqNote} | ${r.unit} | ${r.unitPrice ? fmt(r.unitPrice) : '—'} | ${r.totalCost ? fmt(r.totalCost) : '—'} |`);
            }
            lines.push('');
            lines.push(`Material cost: **${fmt(totalCost)}**`);
            if (labourCost > 0)
                lines.push(`Labour (formula default): **${fmt(labourCost)}**`);
            if (equipCost > 0)
                lines.push(`Equipment (formula default): **${fmt(equipCost)}**`);
            lines.push(`Line total: **${fmt(totalCost + labourCost + equipCost)}**`);
            if (warnings.length > 0) {
                lines.push('', `⚠ Warnings: ${warnings.join('; ')}`);
            }
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── dawinos_boq_cost_summary ─────────────────────────────────────────────────
    server.registerTool('dawinos_boq_cost_summary', {
        title: 'BOQ Cost Summary & Formula Coverage',
        description: `Analyse the cost breakdown and formula coverage for an infrastructure delivery project's BOQ.

Returns:
- Contract value vs computed material + labour + equipment cost
- Formula coverage (items with formulas / total workable items)
- Items still needing formulas
- Top materials by cost

Use this for a quick project health-check or to identify gaps before a cost estimate.`,
        inputSchema: {
            project_id: z.string().describe('Advisory project document ID'),
            org_id: z.string().optional().describe('Organisation ID (default: "default")'),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const orgId = params.org_id ?? DEFAULT_ORG;
        const path = boqPath(params.project_id, orgId);
        try {
            const { items } = await queryCollection(path, {
                filters: [],
                limit: 1000,
            });
            const workItems = items.filter(i => (i.hierarchyLevel ?? 99) >= 3);
            const level4Plus = items.filter(i => (i.hierarchyLevel ?? 99) >= 4);
            let contractValue = 0;
            let materialCost = 0;
            let labourCost = 0;
            let equipCost = 0;
            let withFormulas = 0;
            let withCustom = 0;
            let withBulk = 0;
            let excluded = 0;
            let needsFormula = 0;
            const materialMap = new Map();
            for (const item of level4Plus) {
                const qty = item.quantityContract ?? item.quantity ?? 0;
                const rate = item.rate ?? item.unitRate ?? 0;
                contractValue += qty * rate;
                const hasMaterials = item.materialRequirements && item.materialRequirements.length > 0;
                if (item.noFormulaRequired) {
                    excluded++;
                    continue;
                }
                if (item.isBulkItem) {
                    withBulk++;
                    continue;
                }
                if (item.formulaId && hasMaterials)
                    withFormulas++;
                else if (!item.formulaId && hasMaterials)
                    withCustom++;
                else
                    needsFormula++;
                const reqs = item.materialRequirements ?? [];
                for (const r of reqs) {
                    const cost = r.totalCost ?? 0;
                    materialCost += cost;
                    const key = r.materialId || r.materialName;
                    const existing = materialMap.get(key);
                    if (existing) {
                        existing.cost += cost;
                    }
                    else {
                        materialMap.set(key, { name: r.materialName, cost });
                    }
                }
                labourCost += qty * (item.laborRate ?? 0);
                equipCost += qty * (item.equipmentRate ?? 0);
            }
            const totalWorkable = withFormulas + withCustom + needsFormula + withBulk;
            const coveragePct = totalWorkable > 0
                ? Math.round(((withFormulas + withCustom + withBulk) / totalWorkable) * 100) : 0;
            const computedTotal = materialCost + labourCost + equipCost;
            // Top materials by cost
            const topMaterials = Array.from(materialMap.values())
                .sort((a, b) => b.cost - a.cost)
                .slice(0, 10);
            const lines = [
                `**BOQ Cost Summary — Project ${params.project_id}**`,
                '',
                `**Contract Value:** ${fmt(contractValue)}`,
                `**Computed Cost:** ${fmt(computedTotal)}${contractValue > 0 ? ` (${Math.round((computedTotal / contractValue) * 100)}% of contract)` : ''}`,
                `  • Material: ${fmt(materialCost)}`,
                labourCost > 0 ? `  • Labour: ${fmt(labourCost)}` : '',
                equipCost > 0 ? `  • Equipment: ${fmt(equipCost)}` : '',
                '',
                `**Formula Coverage: ${coveragePct}%** (${withFormulas + withCustom + withBulk}/${totalWorkable} items)`,
                `  • Formula applied: ${withFormulas}`,
                `  • Custom materials: ${withCustom}`,
                `  • Bulk: ${withBulk}`,
                `  • Excluded: ${excluded}`,
                needsFormula > 0 ? `  ⚠ Needs formula: **${needsFormula}**` : '  ✓ All items have coverage',
                '',
                `**All items:** ${workItems.length} (level 3+) | ${level4Plus.length} work items (level 4+)`,
            ].filter(l => l !== '');
            if (topMaterials.length > 0) {
                lines.push('', `**Top Materials by Cost**`);
                lines.push('| Material | Total Cost |');
                lines.push('|----------|------------|');
                for (const m of topMaterials) {
                    if (m.cost > 0)
                        lines.push(`| ${m.name} | ${fmt(m.cost)} |`);
                }
            }
            lines.push('', `_Use \`dawinos_list_boq_items\` with \`formula_status: "not_applied"\` to see items needing formulas._`);
            lines.push(`_Use \`dawinos_get_material_requirements\` for the consolidated procurement view._`);
            return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── dawinos_get_material_requirements ───────────────────────────────────────
    server.registerTool('dawinos_get_material_requirements', {
        title: 'Get Consolidated Material Requirements',
        description: `Aggregate all material requirements across a project's BOQ items into a consolidated procurement list.

Each row represents a unique material with totals for required quantity, purchase quantity (MOQ-rounded), and estimated cost.

This is the "Sheet 4 — Consolidated Materials" view — useful for procurement planning and supplier negotiations.

Pass \`item_id\` to get requirements for a single BOQ item instead of the whole project.`,
        inputSchema: {
            project_id: z.string().describe('Advisory project document ID'),
            org_id: z.string().optional().describe('Organisation ID (default: "default")'),
            item_id: z.string().optional().describe('If set, return requirements for this single BOQ item only'),
            min_cost: z.number().min(0).optional().describe('Only include materials with total cost above this threshold'),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const orgId = params.org_id ?? DEFAULT_ORG;
        const path = boqPath(params.project_id, orgId);
        try {
            let boqItems = [];
            if (params.item_id) {
                const single = await getDocument(path, params.item_id);
                if (!single)
                    return { content: [{ type: 'text', text: 'BOQ item not found.' }] };
                boqItems = [single];
            }
            else {
                const { items } = await queryCollection(path, { filters: [], limit: 1000 });
                boqItems = items.filter(i => (i.hierarchyLevel ?? 99) >= 4 &&
                    i.materialRequirements && i.materialRequirements.length > 0);
            }
            // Aggregate by materialId/materialName
            const consolidated = new Map();
            for (const item of boqItems) {
                for (const r of (item.materialRequirements ?? [])) {
                    const key = r.materialId || r.materialName;
                    const reqQty = r.requiredQuantity ?? r.quantity ?? 0;
                    const purQty = r.purchaseQuantity ?? reqQty;
                    const existing = consolidated.get(key);
                    if (existing) {
                        existing.totalRequired += reqQty;
                        existing.totalPurchase += purQty;
                        existing.totalCost += r.totalCost ?? 0;
                        existing.itemCount++;
                    }
                    else {
                        consolidated.set(key, {
                            name: r.materialName,
                            unit: r.unit ?? '',
                            totalRequired: reqQty,
                            totalPurchase: purQty,
                            moq: r.moq ?? null,
                            packUnit: r.packUnit ?? null,
                            unitPrice: r.unitPrice ?? 0,
                            totalCost: r.totalCost ?? 0,
                            itemCount: 1,
                        });
                    }
                }
            }
            let rows = Array.from(consolidated.values())
                .sort((a, b) => b.totalCost - a.totalCost);
            if (params.min_cost != null) {
                rows = rows.filter(r => r.totalCost >= params.min_cost);
            }
            const grandTotal = rows.reduce((s, r) => s + r.totalCost, 0);
            const scope = params.item_id ? `Item ${params.item_id}` : `Project ${params.project_id}`;
            const lines = [
                `**Consolidated Materials — ${scope}**`,
                `${rows.length} unique materials | Total: **${fmt(grandTotal)}**`,
                '',
                '| Material | Req Qty | Purchase Qty | MOQ | Unit | Unit Price | Total Cost |',
                '|----------|---------|--------------|-----|------|------------|------------|',
            ];
            for (const r of rows) {
                const moqLabel = r.moq ? `${r.moq}${r.packUnit ? ' ' + r.packUnit : ''}` : '—';
                lines.push(`| ${r.name} | ${r.totalRequired.toFixed(2)} | **${r.totalPurchase.toFixed(2)}** | ${moqLabel} | ${r.unit} | ${r.unitPrice ? fmt(r.unitPrice) : '—'} | **${fmt(r.totalCost)}** |`);
            }
            if (!params.item_id) {
                lines.push('', `_Covers ${boqItems.length} BOQ items with material requirements._`);
                lines.push(`_Use \`dawinos_apply_formula_to_boq\` to add requirements to uncovered items._`);
            }
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
}
//# sourceMappingURL=boq.js.map