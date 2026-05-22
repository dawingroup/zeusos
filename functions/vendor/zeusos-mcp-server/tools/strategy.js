/**
 * Strategy MCP Tools
 *
 * Covers the CEO Strategy Command module in ZeusOS:
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
import { z } from 'zod';
import { queryCollection, getDocument, getDb, formatTimestamp, truncateIfNeeded, serverTimestamp, } from '../services/firebase.js';
import { DEFAULT_ORG_ID } from '../constants.js';
// ─── Path helpers ──────────────────────────────────────────────────────────────
const companyId = (id) => id ?? DEFAULT_ORG_ID;
const paths = {
    docs: (cId) => `companies/${cId}/strategyDocuments`,
    doc: (cId, docId) => `companies/${cId}/strategyDocuments/${docId}`,
    versions: (cId, docId) => `companies/${cId}/strategyDocuments/${docId}/versions`,
    reviews: (cId) => `companies/${cId}/strategy_reviews`,
    review: (cId, rId) => `companies/${cId}/strategy_reviews/${rId}`,
    sections: (cId, rId) => `companies/${cId}/strategy_reviews/${rId}/document_sections`,
    section: (cId, rId, sId) => `companies/${cId}/strategy_reviews/${rId}/document_sections/${sId}`,
    auditLog: (cId, rId) => `companies/${cId}/strategy_reviews/${rId}/section_audit_log`,
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
function pillarSummaryLine(p) {
    const objs = p.objectives?.length ?? 0;
    return `| ${p.order ?? '?'} | ${p.name} | ${p.category} | ${p.weight}% | ${p.status} | ${p.progress}% | ${objs} obj |`;
}
function formatScore(score) {
    if (score == null)
        return '—';
    const bars = '█'.repeat(score) + '░'.repeat(5 - score);
    return `${score}/5 ${bars}`;
}
// ─── Tool registration ────────────────────────────────────────────────────────
export function registerStrategyTools(server) {
    // ─── zeusos_list_strategy_documents ─────────────────────────────────────────
    server.registerTool('zeusos_list_strategy_documents', {
        title: 'List Strategy Documents',
        description: `List strategy documents for a company. Returns vision statements, strategic plans, business plans, and other strategy documents with their status, time horizon, and pillar count.

Filter by type, status, scope, or time horizon.`,
        inputSchema: {
            company_id: z.string().optional().describe('Company ID (default: "default")'),
            type: z.enum([
                'vision', 'mission', 'strategic_plan', 'business_plan', 'functional_plan',
                'operational_plan', 'project_charter', 'policy', 'procedure', 'other',
            ]).optional().describe('Filter by document type'),
            status: z.enum(['draft', 'in_review', 'approved', 'active', 'superseded', 'archived']).optional(),
            scope: z.enum(['group', 'subsidiary', 'department', 'team']).optional(),
            time_horizon: z.enum(['short_term', 'medium_term', 'long_term', 'vision']).optional(),
            fiscal_year: z.string().optional().describe('e.g. "2025"'),
            limit: z.number().int().min(1).max(50).optional(),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const cId = companyId(params.company_id);
        try {
            const filters = [];
            if (params.type)
                filters.push({ field: 'type', op: '==', value: params.type });
            if (params.status)
                filters.push({ field: 'status', op: '==', value: params.status });
            if (params.scope)
                filters.push({ field: 'scope', op: '==', value: params.scope });
            if (params.time_horizon)
                filters.push({ field: 'timeHorizon', op: '==', value: params.time_horizon });
            if (params.fiscal_year)
                filters.push({ field: 'fiscalYear', op: '==', value: params.fiscal_year });
            const { items, total } = await queryCollection(paths.docs(cId), {
                filters,
                orderByField: 'updatedAt',
                orderByDirection: 'desc',
                limit: params.limit ?? 20,
            });
            if (!items.length) {
                return { content: [{ type: 'text', text: 'No strategy documents found.' }] };
            }
            const lines = [
                `**Strategy Documents — ${cId}** (${total} total)`,
                '',
                '| ID | Title | Type | Status | Horizon | Pillars | Updated |',
                '|----|-------|------|--------|---------|---------|---------|',
            ];
            for (const d of items) {
                lines.push(`| ${d.id.slice(0, 8)} | ${d.title.slice(0, 40)} | ${d.type} | ${d.status} | ${d.timeHorizon} | ${d.pillars?.length ?? 0} | ${formatTimestamp(d.updatedAt)} |`);
            }
            lines.push('', `_Use \`zeusos_get_strategy_document\` with a document ID for full detail._`);
            return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_get_strategy_document ────────────────────────────────────────────
    server.registerTool('zeusos_get_strategy_document', {
        title: 'Get Strategy Document',
        description: `Get a strategy document with its full pillar structure, objectives, and metrics.`,
        inputSchema: {
            document_id: z.string().describe('Strategy document ID'),
            company_id: z.string().optional(),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const cId = companyId(params.company_id);
        try {
            const doc = await getDocument(paths.docs(cId), params.document_id);
            if (!doc) {
                return { content: [{ type: 'text', text: 'Strategy document not found.' }] };
            }
            const lines = [
                `# ${doc.title}`,
                doc.subtitle ? `_${doc.subtitle}_` : '',
                '',
                `**Type:** ${doc.type}  |  **Status:** ${doc.status}  |  **Horizon:** ${doc.timeHorizon}`,
                `**Scope:** ${doc.scope}${doc.scopeEntityName ? ` — ${doc.scopeEntityName}` : ''}`,
                doc.fiscalYear ? `**Fiscal Year:** ${doc.fiscalYear}${doc.quarter ? ` Q${doc.quarter}` : ''}` : '',
                `**Version:** ${doc.version ?? 1}  |  **Review Frequency:** ${doc.reviewFrequency ?? 'N/A'}`,
                doc.approvedBy ? `**Approved by:** ${doc.approvedBy}  |  ${formatTimestamp(doc.approvedAt)}` : '',
                doc.nextReviewDate ? `**Next review:** ${formatTimestamp(doc.nextReviewDate)}` : '',
                doc.description ? `\n${doc.description}` : '',
            ].filter(l => l !== '');
            const pillars = doc.pillars ?? [];
            if (pillars.length > 0) {
                lines.push('', `## Strategic Pillars (${pillars.length})`, '');
                lines.push('| # | Name | Category | Weight | Status | Progress | Objectives |');
                lines.push('|---|------|----------|--------|--------|----------|------------|');
                const sorted = [...pillars].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                for (const p of sorted) {
                    lines.push(pillarSummaryLine(p));
                }
                // Detail per pillar
                for (const p of sorted) {
                    lines.push('', `### ${p.order ?? ''}. ${p.name}${p.description ? `\n${p.description}` : ''}`);
                    if (p.owner)
                        lines.push(`Owner: ${p.owner.name}${p.owner.role ? ` (${p.owner.role})` : ''}`);
                    const objs = p.objectives ?? [];
                    if (objs.length > 0) {
                        lines.push('', '**Objectives:**');
                        for (const o of objs) {
                            lines.push(`- [${o.status}] **${o.title}** (${o.priority} priority, ${o.progress}% done)${o.notes ? ` — ${o.notes}` : ''}`);
                        }
                    }
                    const metrics = p.metrics ?? [];
                    if (metrics.length > 0) {
                        lines.push('', '**Metrics:**');
                        for (const m of metrics) {
                            const curr = m.currentValue != null ? `${m.currentValue}${m.unit}` : 'N/A';
                            lines.push(`- ${m.name}: ${curr} → target ${m.targetValue}${m.unit}${m.source ? ` (${m.source})` : ''}`);
                        }
                    }
                }
            }
            if (doc.tags?.length) {
                lines.push('', `_Tags: ${doc.tags.join(', ')}_`);
            }
            lines.push('', `_ID: ${doc.id} | Updated: ${formatTimestamp(doc.updatedAt)}_`);
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_update_strategy_document ─────────────────────────────────────────
    server.registerTool('zeusos_update_strategy_document', {
        title: 'Update Strategy Document',
        description: `Update top-level fields of a strategy document — title, status, description, approval, review schedule, tags. Does NOT modify pillars; use \`zeusos_update_strategy_pillar\` for that.`,
        inputSchema: {
            document_id: z.string().describe('Strategy document ID'),
            company_id: z.string().optional(),
            title: z.string().optional(),
            subtitle: z.string().optional(),
            description: z.string().optional(),
            status: z.enum(['draft', 'in_review', 'approved', 'active', 'superseded', 'archived']).optional(),
            fiscal_year: z.string().optional().describe('e.g. "2025"'),
            quarter: z.number().int().min(1).max(4).optional(),
            approved_by: z.string().optional(),
            review_frequency: z.enum(['weekly', 'monthly', 'quarterly', 'semi_annual', 'annual']).optional(),
            tags: z.array(z.string()).optional(),
            updated_by: z.string().describe('User ID making the update'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        const cId = companyId(params.company_id);
        const db = getDb();
        try {
            const updates = {
                updatedAt: serverTimestamp(),
                updatedBy: params.updated_by,
            };
            if (params.title !== undefined)
                updates['title'] = params.title;
            if (params.subtitle !== undefined)
                updates['subtitle'] = params.subtitle;
            if (params.description !== undefined)
                updates['description'] = params.description;
            if (params.status !== undefined)
                updates['status'] = params.status;
            if (params.fiscal_year !== undefined)
                updates['fiscalYear'] = params.fiscal_year;
            if (params.quarter !== undefined)
                updates['quarter'] = params.quarter;
            if (params.approved_by !== undefined) {
                updates['approvedBy'] = params.approved_by;
                updates['approvedAt'] = serverTimestamp();
            }
            if (params.review_frequency !== undefined)
                updates['reviewFrequency'] = params.review_frequency;
            if (params.tags !== undefined)
                updates['tags'] = params.tags;
            await db.collection(paths.docs(cId)).doc(params.document_id).update(updates);
            const changed = Object.keys(updates).filter(k => !['updatedAt', 'updatedBy'].includes(k));
            return {
                content: [{ type: 'text', text: `Strategy document \`${params.document_id}\` updated.\nFields changed: ${changed.join(', ')}` }],
            };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_update_strategy_pillar ───────────────────────────────────────────
    server.registerTool('zeusos_update_strategy_pillar', {
        title: 'Update Strategic Pillar',
        description: `Update a strategic pillar within a strategy document — status, progress, description, weight, or owner. Updates the pillars array in the document.`,
        inputSchema: {
            document_id: z.string().describe('Strategy document ID'),
            pillar_id: z.string().describe('Pillar ID to update'),
            company_id: z.string().optional(),
            name: z.string().optional(),
            description: z.string().optional(),
            status: z.enum(['not_started', 'on_track', 'at_risk', 'behind']).optional(),
            progress: z.number().int().min(0).max(100).optional().describe('Progress 0–100%'),
            weight: z.number().min(0).max(100).optional().describe('Weight percentage'),
            owner_name: z.string().optional(),
            owner_id: z.string().optional(),
            updated_by: z.string().describe('User ID'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        const cId = companyId(params.company_id);
        const db = getDb();
        try {
            const stratDoc = await getDocument(paths.docs(cId), params.document_id);
            if (!stratDoc) {
                return { isError: true, content: [{ type: 'text', text: 'Strategy document not found.' }] };
            }
            const pillars = stratDoc.pillars ?? [];
            const idx = pillars.findIndex(p => p.id === params.pillar_id);
            if (idx === -1) {
                return { isError: true, content: [{ type: 'text', text: `Pillar ${params.pillar_id} not found in document.` }] };
            }
            const pillar = { ...pillars[idx] };
            const changed = [];
            if (params.name !== undefined) {
                pillar.name = params.name;
                changed.push('name');
            }
            if (params.description !== undefined) {
                pillar.description = params.description;
                changed.push('description');
            }
            if (params.status !== undefined) {
                pillar.status = params.status;
                changed.push('status');
            }
            if (params.progress !== undefined) {
                pillar.progress = params.progress;
                changed.push('progress');
            }
            if (params.weight !== undefined) {
                pillar.weight = params.weight;
                changed.push('weight');
            }
            if (params.owner_name !== undefined || params.owner_id !== undefined) {
                pillar.owner = {
                    id: params.owner_id ?? pillar.owner?.id ?? '',
                    name: params.owner_name ?? pillar.owner?.name ?? '',
                    role: pillar.owner?.role,
                };
                changed.push('owner');
            }
            pillars[idx] = pillar;
            await db.collection(paths.docs(cId)).doc(params.document_id).update({
                pillars,
                updatedAt: serverTimestamp(),
                updatedBy: params.updated_by,
            });
            return {
                content: [{ type: 'text', text: `Pillar "${pillar.name}" updated.\nFields changed: ${changed.join(', ')}` }],
            };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_update_strategy_objective ────────────────────────────────────────
    server.registerTool('zeusos_update_strategy_objective', {
        title: 'Update Strategic Objective',
        description: `Update a strategic objective within a pillar — status, progress, priority, notes, assignee.`,
        inputSchema: {
            document_id: z.string().describe('Strategy document ID'),
            pillar_id: z.string().describe('Pillar ID containing the objective'),
            objective_id: z.string().describe('Objective ID to update'),
            company_id: z.string().optional(),
            title: z.string().optional(),
            description: z.string().optional(),
            status: z.enum(['not_started', 'in_progress', 'completed', 'deferred', 'cancelled']).optional(),
            progress: z.number().int().min(0).max(100).optional(),
            priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
            notes: z.string().optional(),
            assignee_name: z.string().optional(),
            assignee_id: z.string().optional(),
            updated_by: z.string().describe('User ID'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        const cId = companyId(params.company_id);
        const db = getDb();
        try {
            const stratDoc = await getDocument(paths.docs(cId), params.document_id);
            if (!stratDoc) {
                return { isError: true, content: [{ type: 'text', text: 'Strategy document not found.' }] };
            }
            const pillars = stratDoc.pillars ?? [];
            const pillarIdx = pillars.findIndex(p => p.id === params.pillar_id);
            if (pillarIdx === -1) {
                return { isError: true, content: [{ type: 'text', text: `Pillar ${params.pillar_id} not found.` }] };
            }
            const pillar = { ...pillars[pillarIdx] };
            const objectives = pillar.objectives ?? [];
            const objIdx = objectives.findIndex(o => o.id === params.objective_id);
            if (objIdx === -1) {
                return { isError: true, content: [{ type: 'text', text: `Objective ${params.objective_id} not found.` }] };
            }
            const obj = { ...objectives[objIdx] };
            const changed = [];
            if (params.title !== undefined) {
                obj.title = params.title;
                changed.push('title');
            }
            if (params.description !== undefined) {
                obj.description = params.description;
                changed.push('description');
            }
            if (params.status !== undefined) {
                obj.status = params.status;
                changed.push('status');
            }
            if (params.progress !== undefined) {
                obj.progress = params.progress;
                changed.push('progress');
            }
            if (params.priority !== undefined) {
                obj.priority = params.priority;
                changed.push('priority');
            }
            if (params.notes !== undefined) {
                obj.notes = params.notes;
                changed.push('notes');
            }
            if (params.assignee_name !== undefined) {
                obj.assigneeName = params.assignee_name;
                changed.push('assigneeName');
            }
            if (params.assignee_id !== undefined) {
                obj.assigneeId = params.assignee_id;
                changed.push('assigneeId');
            }
            objectives[objIdx] = obj;
            pillar.objectives = objectives;
            pillars[pillarIdx] = pillar;
            await db.collection(paths.docs(cId)).doc(params.document_id).update({
                pillars,
                updatedAt: serverTimestamp(),
                updatedBy: params.updated_by,
            });
            return {
                content: [{ type: 'text', text: `Objective "${obj.title}" updated.\nFields changed: ${changed.join(', ')}` }],
            };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_list_strategy_reviews ────────────────────────────────────────────
    server.registerTool('zeusos_list_strategy_reviews', {
        title: 'List Strategy Reviews',
        description: `List strategy reviews for a company. Each review represents a cycle of assessing and updating a strategy document's sections.`,
        inputSchema: {
            company_id: z.string().optional(),
            document_id: z.string().optional().describe('Filter by strategy document ID'),
            status: z.string().optional().describe('Filter by review status'),
            limit: z.number().int().min(1).max(50).optional(),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const cId = companyId(params.company_id);
        try {
            const filters = [];
            if (params.document_id)
                filters.push({ field: 'documentId', op: '==', value: params.document_id });
            if (params.status)
                filters.push({ field: 'status', op: '==', value: params.status });
            const { items, total } = await queryCollection(paths.reviews(cId), {
                filters,
                orderByField: 'createdAt',
                orderByDirection: 'desc',
                limit: params.limit ?? 20,
            });
            if (!items.length) {
                return { content: [{ type: 'text', text: 'No strategy reviews found.' }] };
            }
            const lines = [
                `**Strategy Reviews — ${cId}** (${total} total)`,
                '',
                '| ID | Title | Document | Status | Started | Completed |',
                '|----|-------|----------|--------|---------|-----------|',
            ];
            for (const r of items) {
                lines.push(`| ${r.id.slice(0, 8)} | ${(r.title ?? 'Untitled').slice(0, 35)} | ${(r.documentId ?? '—').slice(0, 8)} | ${r.status ?? '—'} | ${formatTimestamp(r.startedAt)} | ${formatTimestamp(r.completedAt)} |`);
            }
            lines.push('', `_Use \`zeusos_get_strategy_review\` for full detail, \`zeusos_list_strategy_sections\` to see parsed sections._`);
            return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_get_strategy_review ──────────────────────────────────────────────
    server.registerTool('zeusos_get_strategy_review', {
        title: 'Get Strategy Review',
        description: `Get full detail of a strategy review including metadata, section counts, and assessment progress.`,
        inputSchema: {
            review_id: z.string().describe('Strategy review ID'),
            company_id: z.string().optional(),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const cId = companyId(params.company_id);
        try {
            const review = await getDocument(paths.reviews(cId), params.review_id);
            if (!review) {
                return { content: [{ type: 'text', text: 'Strategy review not found.' }] };
            }
            // Count sections
            const { items: sections } = await queryCollection(paths.sections(cId, params.review_id), { limit: 200 });
            const assessed = sections.filter(s => s.alignmentScore != null).length;
            const pendingRewrites = sections.filter(s => s.rewriteStatus === 'pending_review').length;
            const avgScore = assessed > 0
                ? (sections.reduce((sum, s) => sum + (s.alignmentScore ?? 0), 0) / assessed).toFixed(1)
                : 'N/A';
            const lines = [
                `**Review: ${review.title ?? review.id}**`,
                `Status: ${review.status ?? '—'}  |  Type: ${review.reviewType ?? '—'}`,
                review.description ? `\n${review.description}` : '',
                '',
                `**Document ID:** ${review.documentId ?? '—'}`,
                `**Started:** ${formatTimestamp(review.startedAt)}`,
                `**Completed:** ${formatTimestamp(review.completedAt)}`,
                '',
                `**Sections:** ${sections.length} total`,
                `**Assessed:** ${assessed} / ${sections.length} (avg score: ${avgScore})`,
                `**Pending rewrites:** ${pendingRewrites}`,
                '',
                `_Use \`zeusos_list_strategy_sections\` to see all sections._`,
                `_Use \`zeusos_assess_strategy_section\` and \`zeusos_rewrite_strategy_section\` to improve sections._`,
                `_ID: ${review.id} | Updated: ${formatTimestamp(review.updatedAt)}_`,
            ].filter(l => l !== '');
            return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_list_strategy_sections ───────────────────────────────────────────
    server.registerTool('zeusos_list_strategy_sections', {
        title: 'List Strategy Document Sections',
        description: `List all parsed sections within a strategy review. Shows alignment scores, rewrite status, and section types.

Filter by rewrite status to find sections needing attention:
- \`pending_review\` — AI rewrite waiting for approval
- \`none\` — not yet rewritten
Use with \`zeusos_get_strategy_section\` for full content.`,
        inputSchema: {
            review_id: z.string().describe('Strategy review ID'),
            company_id: z.string().optional(),
            rewrite_status: z.enum(['none', 'pending_review', 'approved', 'rejected', 'applied']).optional(),
            section_type: z.string().optional().describe('Filter by section type (financial, market, operations, etc.)'),
            unassessed_only: z.boolean().optional().describe('Show only sections without an alignment score'),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const cId = companyId(params.company_id);
        try {
            const filters = [];
            if (params.rewrite_status)
                filters.push({ field: 'rewriteStatus', op: '==', value: params.rewrite_status });
            if (params.section_type)
                filters.push({ field: 'sectionType', op: '==', value: params.section_type });
            const { items } = await queryCollection(paths.sections(cId, params.review_id), {
                filters,
                orderByField: 'sectionIndex',
                orderByDirection: 'asc',
                limit: 200,
            });
            let result = items;
            if (params.unassessed_only) {
                result = result.filter(s => s.alignmentScore == null);
            }
            if (!result.length) {
                return { content: [{ type: 'text', text: 'No sections found matching filters.' }] };
            }
            const lines = [
                `**Sections — Review ${params.review_id.slice(0, 8)}** (${result.length} shown)`,
                '',
                '| # | Heading | Type | Score | Rewrite |',
                '|---|---------|------|-------|---------|',
            ];
            for (const s of result) {
                const rewriteLabel = s.rewriteStatus && s.rewriteStatus !== 'none'
                    ? `⚡ ${s.rewriteStatus}`
                    : '—';
                lines.push(`| ${s.sectionIndex ?? '?'} | ${'#'.repeat(s.headingLevel ?? 1)} ${s.headingText.slice(0, 45)} | ${s.sectionType ?? '—'} | ${formatScore(s.alignmentScore)} | ${rewriteLabel} |`);
            }
            lines.push('', `_Use \`zeusos_get_strategy_section\` with section_id for content and pending rewrites._`);
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_get_strategy_section ─────────────────────────────────────────────
    server.registerTool('zeusos_get_strategy_section', {
        title: 'Get Strategy Section',
        description: `Get full content of a single strategy document section, including current text, pending AI rewrite, alignment score, and data sources.`,
        inputSchema: {
            review_id: z.string().describe('Strategy review ID'),
            section_id: z.string().describe('Section document ID'),
            company_id: z.string().optional(),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const cId = companyId(params.company_id);
        try {
            const section = await getDocument(paths.sections(cId, params.review_id), params.section_id);
            if (!section) {
                return { content: [{ type: 'text', text: 'Section not found.' }] };
            }
            const lines = [
                `${'#'.repeat(section.headingLevel ?? 1)} ${section.headingText}`,
                `**Type:** ${section.sectionType ?? 'general'}  |  **Score:** ${formatScore(section.alignmentScore)}  |  **Rewrite status:** ${section.rewriteStatus ?? 'none'}`,
                '',
                '**Current content:**',
                section.content,
            ];
            if (section.pendingRewrite) {
                lines.push('', '---', `**Pending AI rewrite:**`, section.pendingRewrite);
                lines.push('', `_Use \`zeusos_apply_strategy_rewrite\` to approve or reject this rewrite._`);
            }
            lines.push('', `_Section ${section.sectionIndex ?? '?'} | ID: ${section.id} | Updated: ${formatTimestamp(section.updatedAt)}_`);
            return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_update_strategy_section ──────────────────────────────────────────
    server.registerTool('zeusos_update_strategy_section', {
        title: 'Update Strategy Section Content',
        description: `Manually edit the content of a strategy document section. Use this for direct edits. For AI-suggested rewrites, use \`zeusos_rewrite_strategy_section\` then \`zeusos_apply_strategy_rewrite\`.`,
        inputSchema: {
            review_id: z.string().describe('Strategy review ID'),
            section_id: z.string().describe('Section document ID'),
            content: z.string().describe('New section content (full replacement)'),
            company_id: z.string().optional(),
            updated_by: z.string().describe('User ID making the edit'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        const cId = companyId(params.company_id);
        const db = getDb();
        try {
            await db
                .collection(paths.sections(cId, params.review_id))
                .doc(params.section_id)
                .update({
                content: params.content,
                updatedAt: serverTimestamp(),
                rewriteStatus: 'applied',
            });
            return {
                content: [{ type: 'text', text: `Section ${params.section_id} content updated.` }],
            };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_apply_strategy_rewrite ───────────────────────────────────────────
    server.registerTool('zeusos_apply_strategy_rewrite', {
        title: 'Apply or Reject Strategy Section Rewrite',
        description: `Approve (apply) or reject a pending AI rewrite on a strategy document section. After assessment + rewrite, use this to finalize the change.

- **approve**: Copies pendingRewrite → content, marks rewriteStatus = "applied"
- **reject**: Clears pendingRewrite, marks rewriteStatus = "rejected"`,
        inputSchema: {
            review_id: z.string().describe('Strategy review ID'),
            section_id: z.string().describe('Section document ID'),
            action: z.enum(['approve', 'reject']).describe('Whether to apply or discard the pending rewrite'),
            company_id: z.string().optional(),
            updated_by: z.string().describe('User ID'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        const cId = companyId(params.company_id);
        const db = getDb();
        try {
            const section = await getDocument(paths.sections(cId, params.review_id), params.section_id);
            if (!section) {
                return { isError: true, content: [{ type: 'text', text: 'Section not found.' }] };
            }
            if (!section.pendingRewrite) {
                return { isError: true, content: [{ type: 'text', text: 'No pending rewrite on this section.' }] };
            }
            const updates = { updatedAt: serverTimestamp() };
            if (params.action === 'approve') {
                updates['content'] = section.pendingRewrite;
                updates['pendingRewrite'] = null;
                updates['rewriteStatus'] = 'applied';
            }
            else {
                updates['pendingRewrite'] = null;
                updates['rewriteStatus'] = 'rejected';
            }
            await db
                .collection(paths.sections(cId, params.review_id))
                .doc(params.section_id)
                .update(updates);
            const msg = params.action === 'approve'
                ? `Rewrite applied to section "${section.headingText}". Content updated.`
                : `Rewrite rejected for section "${section.headingText}". Original content preserved.`;
            return { content: [{ type: 'text', text: msg }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
    // ─── zeusos_get_strategy_audit_log ───────────────────────────────────────────
    server.registerTool('zeusos_get_strategy_audit_log', {
        title: 'Get Strategy Section Audit Log',
        description: `View the audit trail for section changes in a strategy review. Shows what was changed, by whom, and alignment score changes.`,
        inputSchema: {
            review_id: z.string().describe('Strategy review ID'),
            company_id: z.string().optional(),
            section_id: z.string().optional().describe('Filter to a specific section'),
            limit: z.number().int().min(1).max(50).optional(),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async (params) => {
        const cId = companyId(params.company_id);
        try {
            const filters = [];
            if (params.section_id)
                filters.push({ field: 'sectionId', op: '==', value: params.section_id });
            const { items } = await queryCollection(paths.auditLog(cId, params.review_id), {
                filters,
                orderByField: 'timestamp',
                orderByDirection: 'desc',
                limit: params.limit ?? 20,
            });
            if (!items.length) {
                return { content: [{ type: 'text', text: 'No audit log entries found.' }] };
            }
            const lines = [
                `**Audit Log — Review ${params.review_id.slice(0, 8)}** (${items.length} entries)`,
                '',
                '| When | Section | Change | Score Δ | By | Rationale |',
                '|------|---------|--------|---------|-----|-----------|',
            ];
            for (const e of items) {
                const scoreDelta = (e.alignmentScoreBefore != null && e.alignmentScoreAfter != null)
                    ? `${e.alignmentScoreBefore} → ${e.alignmentScoreAfter}`
                    : '—';
                lines.push(`| ${formatTimestamp(e.timestamp)} | ${e.sectionHeading?.slice(0, 30) ?? '—'} | ${e.changeType} | ${scoreDelta} | ${e.approvedBy ?? e.triggeredBy ?? '—'} | ${(e.rationale ?? '').slice(0, 40)} |`);
            }
            return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        catch (err) {
            return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] };
        }
    });
}
//# sourceMappingURL=strategy.js.map