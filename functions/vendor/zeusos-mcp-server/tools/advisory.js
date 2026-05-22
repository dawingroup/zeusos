import { z } from 'zod';
import { queryCollection, getDocument, serializeDoc, formatTimestamp, formatCurrency, truncateIfNeeded, } from '../services/firebase.js';
import { ADVISORY_PATHS } from '../constants.js';
// ─── Constants ────────────────────────────────────────────────────────────────
const ADVISORY_PROJECT_STATUSES = [
    'planning',
    'procurement',
    'mobilization',
    'active',
    'substantial_completion',
    'defects_liability',
    'completed',
    'suspended',
    'cancelled',
];
// ─── Tool Registration ────────────────────────────────────────────────────────
export function registerAdvisoryTools(server) {
    // ── 1. zeusos_list_project_funds ────────────────────────────────────────────
    server.registerTool('zeusos_list_project_funds', {
        title: 'List Advisory Projects (Project Funds)',
        description: `List advisory projects from the ZeusOS advisory module (financial backbone for Campaigns) with optional filters.
Returns project summaries including budget totals, spend, and accountability status.

Advisory projects live at: organizations/default/campaigns  (Phase 2.D rename — see Campaign data model in Phase 3 for the campaign-specific fields layered on top of the AdvisoryProject backbone)
Each project has: budget {totalBudget, spent, committed, remaining}, progress {physicalProgress, financialProgress},
accountabilitySummary {totalDisbursed, totalAccounted, unaccountedAmount, accountabilityRate, overdueCount}.

Filters: status (planning|procurement|mobilization|active|substantial_completion|defects_liability|completed|suspended|cancelled),
programId (exact match), search (partial match on name/projectCode/customerName).`,
        inputSchema: {
            status: z
                .enum(ADVISORY_PROJECT_STATUSES)
                .optional()
                .describe('Filter by project status'),
            program_id: z.string().optional().describe('Filter by programId (exact match)'),
            search: z.string().optional().describe('Partial text search on name, projectCode, or customerName'),
            limit: z.number().int().min(1).max(100).default(20).describe('Results per page (default 20, max 100)'),
            offset: z.number().int().min(0).default(0).describe('Pagination offset'),
            response_format: z
                .enum(['table', 'json'])
                .default('table')
                .describe('Output format: table (default) or json'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const collectionPath = ADVISORY_PATHS.projects();
            const filters = [];
            if (params.status) {
                filters.push({ field: 'status', op: '==', value: params.status });
            }
            if (params.program_id) {
                filters.push({ field: 'programId', op: '==', value: params.program_id });
            }
            const limit = params.limit ?? 20;
            const offset = params.offset ?? 0;
            const { items, total } = await queryCollection(collectionPath, {
                filters,
                orderByField: 'createdAt',
                orderByDirection: 'desc',
                limit,
                offset,
            });
            // Client-side search filter
            const search = params.search?.toLowerCase();
            const filtered = search
                ? items.filter((p) => p.name?.toLowerCase().includes(search) ||
                    p.projectCode?.toLowerCase().includes(search) ||
                    p.customerName?.toLowerCase().includes(search))
                : items;
            if (filtered.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `No advisory projects found${params.status ? ` with status "${params.status}"` : ''}${params.search ? ` matching "${params.search}"` : ''}.`,
                        },
                    ],
                };
            }
            const hasMore = offset + limit < total;
            const responseFormat = params.response_format ?? 'table';
            if (responseFormat === 'json') {
                const result = {
                    total,
                    count: filtered.length,
                    offset,
                    limit,
                    hasMore,
                    nextOffset: hasMore ? offset + limit : undefined,
                    items: filtered.map((p) => serializeDoc(p)),
                };
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            // Markdown table
            const rows = filtered.map((p) => {
                const currency = p.budget?.currency ?? 'UGX';
                const totalBudget = p.budget?.totalBudget != null ? formatCurrency(p.budget.totalBudget, currency) : 'N/A';
                const spent = p.budget?.spent != null ? formatCurrency(p.budget.spent, currency) : 'N/A';
                const remaining = p.budget?.remaining != null ? formatCurrency(p.budget.remaining, currency) : 'N/A';
                const physProgress = p.progress?.physicalProgress != null ? `${p.progress.physicalProgress}%` : 'N/A';
                const accountRate = p.accountabilitySummary?.accountabilityRate != null
                    ? `${Math.round(p.accountabilitySummary.accountabilityRate)}%`
                    : 'N/A';
                const overdue = p.accountabilitySummary?.overdueCount ?? 0;
                const overdueFlag = overdue > 0 ? ` ⚠️` : '';
                const code = p.projectCode ?? p.id.slice(0, 8);
                return `| ${code} | ${p.name ?? 'N/A'} | ${p.status ?? 'N/A'} | ${totalBudget} | ${spent} | ${remaining} | ${physProgress} | ${accountRate}${overdueFlag} |`;
            });
            const header = `| Code | Name | Status | Budget | Spent | Remaining | Physical % | Accountability |
|------|------|--------|--------|-------|-----------|-----------|----------------|`;
            const pagination = `\n*Showing ${offset + 1}–${offset + filtered.length} of ${total} projects.*${hasMore ? ` Pass \`offset: ${offset + limit}\` for next page.` : ''}`;
            return {
                content: [
                    {
                        type: 'text',
                        text: truncateIfNeeded(`## Advisory Projects\n\n${header}\n${rows.join('\n')}${pagination}`),
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error listing advisory projects: ${err.message}` }],
            };
        }
    });
    // ── 2. zeusos_get_project_fund ──────────────────────────────────────────────
    server.registerTool('zeusos_get_project_fund', {
        title: 'Get Advisory Project Detail',
        description: `Fetch a single advisory project by ID, returning full budget, progress, and accountability details.

Returns:
- budget: {currency, totalBudget, spent, committed, remaining, variance, varianceStatus, contingencyPercent}
- progress: {physicalProgress, financialProgress, completionPercent, progressStatus}
- accountabilitySummary: {totalDisbursed, totalAccounted, unaccountedAmount, accountabilityRate, overdueCount, requisitionCount}
- location, tags, programId, projectType, dates`,
        inputSchema: {
            project_id: z.string().min(1).describe('The Firestore document ID of the advisory project'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const project = await getDocument(ADVISORY_PATHS.projects(), params.project_id);
            if (!project) {
                return {
                    content: [
                        { type: 'text', text: `Advisory project "${params.project_id}" not found.` },
                    ],
                };
            }
            const currency = project.budget?.currency ?? 'UGX';
            const budgetSection = project.budget
                ? `## Budget
| Field | Value |
|-------|-------|
| Total Budget | ${formatCurrency(project.budget.totalBudget ?? 0, currency)} |
| Spent | ${formatCurrency(project.budget.spent ?? 0, currency)} |
| Committed | ${formatCurrency(project.budget.committed ?? 0, currency)} |
| Remaining | ${formatCurrency(project.budget.remaining ?? 0, currency)} |
| Variance | ${project.budget.variance != null ? formatCurrency(project.budget.variance, currency) : 'N/A'} |
| Variance Status | ${project.budget.varianceStatus ?? 'N/A'} |
| Contingency | ${project.budget.contingencyPercent != null ? `${project.budget.contingencyPercent}%` : 'N/A'} |`
                : '## Budget\n*No budget data.*';
            const progressSection = project.progress
                ? `## Progress
| Field | Value |
|-------|-------|
| Physical Progress | ${project.progress.physicalProgress != null ? `${project.progress.physicalProgress}%` : 'N/A'} |
| Financial Progress | ${project.progress.financialProgress != null ? `${project.progress.financialProgress}%` : 'N/A'} |
| Completion % | ${project.progress.completionPercent != null ? `${project.progress.completionPercent}%` : 'N/A'} |
| Progress Status | ${project.progress.progressStatus ?? 'N/A'} |`
                : '## Progress\n*No progress data.*';
            const acct = project.accountabilitySummary;
            const accountabilitySection = acct
                ? `## Accountability Summary
| Field | Value |
|-------|-------|
| Total Disbursed | ${formatCurrency(acct.totalDisbursed ?? 0, currency)} |
| Total Accounted | ${formatCurrency(acct.totalAccounted ?? 0, currency)} |
| Unaccounted Amount | ${formatCurrency(acct.unaccountedAmount ?? 0, currency)} |
| Accountability Rate | ${acct.accountabilityRate != null ? `${Math.round(acct.accountabilityRate)}%` : 'N/A'} |
| Requisition Count | ${acct.requisitionCount ?? 'N/A'} |
| Manual Requisitions | ${acct.manualRequisitionCount ?? 'N/A'} |
| Overdue Count | ${acct.overdueCount ?? 0}${(acct.overdueCount ?? 0) > 0 ? ' ⚠️' : ''} |
| Status | ${acct.status ?? 'N/A'} |`
                : '## Accountability Summary\n*No accountability data.*';
            const locationSection = project.location
                ? `**Location:** ${[project.location.siteName, project.location.district, project.location.region, project.location.country].filter(Boolean).join(', ')}`
                : '';
            const text = `# Advisory Project: ${project.name ?? project.id}

**ID:** ${project.id}
**Code:** ${project.projectCode ?? 'N/A'}
**Status:** ${project.status ?? 'N/A'}
**Type:** ${project.projectType ?? 'N/A'}
**Program:** ${project.programName ?? project.programId ?? 'N/A'}
**Customer:** ${project.customerName ?? 'N/A'}
${locationSection}
**Tags:** ${project.tags?.join(', ') || 'None'}
**Created:** ${formatTimestamp(project.createdAt)}
**Updated:** ${formatTimestamp(project.updatedAt)}

${budgetSection}

${progressSection}

${accountabilitySection}`;
            return { content: [{ type: 'text', text: truncateIfNeeded(text) }] };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error fetching advisory project: ${err.message}` }],
            };
        }
    });
    // ── 3. zeusos_project_expenditures ─────────────────────────────────────────
    server.registerTool('zeusos_project_expenditures', {
        title: 'List Project Expenditure Allocations',
        description: `List allocation groups (expenditure allocations) for the ZeusOS advisory module (financial backbone for Campaigns).
Allocation groups represent payments or disbursements split across multiple advisory projects.

Collection: organizations/default/allocation_groups
Each group has: groupNumber, date, vendorName, totalAmount, currency, allocations[], projectIds[] (denormalized).

To filter by project: pass project_id — uses array-contains on the projectIds field (denormalized index).
To filter by status: 'Draft' or 'Finalized' (PascalCase).`,
        inputSchema: {
            project_id: z.string().optional().describe('Filter allocations involving this project ID (array-contains on projectIds field)'),
            status: z
                .enum(['Draft', 'Finalized'])
                .optional()
                .describe('Filter by allocation status: Draft or Finalized'),
            date_from: z.string().optional().describe('ISO date string: only return allocations on or after this date'),
            date_to: z.string().optional().describe('ISO date string: only return allocations on or before this date'),
            limit: z.number().int().min(1).max(100).default(20).describe('Results per page (default 20, max 100)'),
            offset: z.number().int().min(0).default(0).describe('Pagination offset'),
            response_format: z
                .enum(['table', 'json'])
                .default('table')
                .describe('Output format: table (default) or json'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const collectionPath = ADVISORY_PATHS.allocationGroups();
            const filters = [];
            // NOTE: array-contains on denormalized projectIds field — correct way to filter by project
            if (params.project_id) {
                filters.push({ field: 'projectIds', op: 'array-contains', value: params.project_id });
            }
            if (params.status) {
                filters.push({ field: 'status', op: '==', value: params.status });
            }
            const limit = params.limit ?? 20;
            const offset = params.offset ?? 0;
            const { items, total } = await queryCollection(collectionPath, {
                filters,
                orderByField: 'date',
                orderByDirection: 'desc',
                limit,
                offset,
            });
            // Client-side date range filter
            const dateFrom = params.date_from ? new Date(params.date_from) : null;
            const dateTo = params.date_to ? new Date(params.date_to) : null;
            const filtered = items.filter((ag) => {
                if (!dateFrom && !dateTo)
                    return true;
                const d = ag.date
                    ? typeof ag.date.toDate === 'function'
                        ? ag.date.toDate()
                        : new Date(ag.date)
                    : null;
                if (!d)
                    return true;
                if (dateFrom && d < dateFrom)
                    return false;
                if (dateTo && d > dateTo)
                    return false;
                return true;
            });
            if (filtered.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `No allocation groups found${params.project_id ? ` for project "${params.project_id}"` : ''}${params.status ? ` with status "${params.status}"` : ''}.`,
                        },
                    ],
                };
            }
            const hasMore = offset + limit < total;
            const responseFormat = params.response_format ?? 'table';
            if (responseFormat === 'json') {
                const result = {
                    total,
                    count: filtered.length,
                    offset,
                    limit,
                    hasMore,
                    nextOffset: hasMore ? offset + limit : undefined,
                    items: filtered.map((ag) => serializeDoc(ag)),
                };
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            const rows = filtered.map((ag) => {
                const currency = ag.currency ?? 'UGX';
                const amount = ag.totalAmount != null ? formatCurrency(ag.totalAmount, currency) : 'N/A';
                const date = formatTimestamp(ag.date);
                const allocCount = ag.allocations?.length ?? 0;
                const projectCount = ag.projectIds?.length ?? 0;
                return `| ${ag.groupNumber ?? ag.id.slice(0, 8)} | ${date} | ${ag.vendorName ?? 'N/A'} | ${amount} | ${ag.status ?? 'N/A'} | ${allocCount} allocs / ${projectCount} projects |`;
            });
            const header = `| Group # | Date | Vendor | Amount | Status | Allocations |
|---------|------|--------|--------|--------|-------------|`;
            const pagination = `\n*Showing ${offset + 1}–${offset + filtered.length} of ${total} allocation groups.*${hasMore ? ` Pass \`offset: ${offset + limit}\` for next page.` : ''}`;
            return {
                content: [
                    {
                        type: 'text',
                        text: truncateIfNeeded(`## Expenditure Allocation Groups${params.project_id ? ` — Project ${params.project_id}` : ''}\n\n${header}\n${rows.join('\n')}${pagination}`),
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error listing allocation groups: ${err.message}` }],
            };
        }
    });
    // ── 4. zeusos_accountability_summary ───────────────────────────────────────
    server.registerTool('zeusos_accountability_summary', {
        title: 'Advisory Accountability Summary',
        description: `Aggregate accountability summary across multiple advisory projects.
Useful for portfolio-level oversight: total disbursed, total accounted, unaccounted amounts, overall accountability rate, and overdue counts.

Fetches advisory projects filtered by optional programId or status, then aggregates their accountabilitySummary fields.
Returns:
- totalProjects: count of matched projects
- totalDisbursed: sum of accountabilitySummary.totalDisbursed
- totalAccounted: sum of accountabilitySummary.totalAccounted
- totalUnaccounted: sum of accountabilitySummary.unaccountedAmount
- overallAccountabilityRate: weighted average (totalAccounted / totalDisbursed)
- totalOverdue: sum of accountabilitySummary.overdueCount
- projectSummaries: per-project breakdown`,
        inputSchema: {
            program_id: z.string().optional().describe('Aggregate only projects in this program'),
            status: z
                .enum(ADVISORY_PROJECT_STATUSES)
                .optional()
                .describe('Aggregate only projects with this status (e.g. "active")'),
            limit: z
                .number()
                .int()
                .min(1)
                .max(200)
                .default(100)
                .describe('Max projects to aggregate (default 100, max 200)'),
            response_format: z
                .enum(['summary', 'json'])
                .default('summary')
                .describe('Output: summary (default, human-readable) or json (machine-readable)'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const collectionPath = ADVISORY_PATHS.projects();
            const filters = [];
            if (params.program_id) {
                filters.push({ field: 'programId', op: '==', value: params.program_id });
            }
            if (params.status) {
                filters.push({ field: 'status', op: '==', value: params.status });
            }
            const limit = Math.min(params.limit ?? 100, 200);
            const { items, total } = await queryCollection(collectionPath, {
                filters,
                orderByField: 'createdAt',
                orderByDirection: 'desc',
                limit,
                offset: 0,
            });
            if (items.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `No advisory projects found${params.program_id ? ` in program "${params.program_id}"` : ''}${params.status ? ` with status "${params.status}"` : ''}.`,
                        },
                    ],
                };
            }
            // Aggregate
            let totalDisbursed = 0;
            let totalAccounted = 0;
            let totalUnaccounted = 0;
            let totalOverdue = 0;
            let projectsWithData = 0;
            const projectSummaries = items.map((p) => {
                const acct = p.accountabilitySummary;
                const currency = p.budget?.currency ?? 'UGX';
                if (acct) {
                    totalDisbursed += acct.totalDisbursed ?? 0;
                    totalAccounted += acct.totalAccounted ?? 0;
                    totalUnaccounted += acct.unaccountedAmount ?? 0;
                    totalOverdue += acct.overdueCount ?? 0;
                    projectsWithData++;
                }
                return {
                    id: p.id,
                    name: p.name ?? 'N/A',
                    projectCode: p.projectCode ?? 'N/A',
                    status: p.status ?? 'N/A',
                    programId: p.programId,
                    currency,
                    totalDisbursed: acct?.totalDisbursed ?? 0,
                    totalAccounted: acct?.totalAccounted ?? 0,
                    unaccountedAmount: acct?.unaccountedAmount ?? 0,
                    accountabilityRate: acct?.accountabilityRate ?? null,
                    overdueCount: acct?.overdueCount ?? 0,
                    accountabilityStatus: acct?.status ?? 'N/A',
                };
            });
            const overallRate = totalDisbursed > 0 ? Math.round((totalAccounted / totalDisbursed) * 100) : null;
            if ((params.response_format ?? 'summary') === 'json') {
                const result = {
                    totalProjects: total,
                    fetchedProjects: items.length,
                    projectsWithAccountabilityData: projectsWithData,
                    totalDisbursed,
                    totalAccounted,
                    totalUnaccounted,
                    overallAccountabilityRate: overallRate,
                    totalOverdue,
                    projectSummaries,
                };
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            // Human-readable summary
            const overallRateStr = overallRate != null ? `${overallRate}%` : 'N/A';
            const healthIndicator = overallRate == null ? '⚪' : overallRate >= 90 ? '🟢' : overallRate >= 70 ? '🟡' : '🔴';
            const sortedSummaries = [...projectSummaries].sort((a, b) => (b.unaccountedAmount ?? 0) - (a.unaccountedAmount ?? 0));
            const summaryRows = sortedSummaries.map((p) => {
                const rateStr = p.accountabilityRate != null ? `${Math.round(p.accountabilityRate)}%` : 'N/A';
                const overdueFlag = p.overdueCount > 0 ? ` ⚠️` : '';
                const currency = p.currency ?? 'UGX';
                return `| ${p.projectCode} | ${p.name} | ${p.status} | ${formatCurrency(p.totalDisbursed, currency)} | ${formatCurrency(p.totalAccounted, currency)} | ${formatCurrency(p.unaccountedAmount, currency)} | ${rateStr} | ${p.overdueCount}${overdueFlag} |`;
            });
            const summaryHeader = `| Code | Project | Status | Disbursed | Accounted | Unaccounted | Rate | Overdue |
|------|---------|--------|-----------|-----------|-------------|------|---------|`;
            const text = `## Advisory Accountability Summary${params.program_id ? ` — Program ${params.program_id}` : ''}${params.status ? ` (${params.status})` : ''}

**Total Projects:** ${total}${items.length < total ? ` (showing ${items.length})` : ''}
**Projects With Data:** ${projectsWithData}

### Portfolio Totals
| Metric | Value |
|--------|-------|
| Total Disbursed | ${formatCurrency(totalDisbursed)} |
| Total Accounted | ${formatCurrency(totalAccounted)} |
| Unaccounted | ${formatCurrency(totalUnaccounted)} |
| Overall Accountability Rate | ${healthIndicator} ${overallRateStr} |
| Overdue Requisitions | ${totalOverdue}${totalOverdue > 0 ? ' ⚠️' : ''} |

### Per-Project Breakdown (sorted by unaccounted amount ↓)

${summaryHeader}
${summaryRows.join('\n')}`;
            return { content: [{ type: 'text', text: truncateIfNeeded(text) }] };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error generating accountability summary: ${err.message}` }],
            };
        }
    });
}
//# sourceMappingURL=advisory.js.map