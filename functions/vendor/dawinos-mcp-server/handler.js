import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createHash, randomUUID } from 'node:crypto';
import { registerPurchasingTools } from './tools/purchasing.js';
import { registerManufacturingTools } from './tools/manufacturing.js';
import { registerInventoryTools } from './tools/inventory.js';
import { registerAdvisoryTools } from './tools/advisory.js';
import { registerIntelligenceTools } from './tools/intelligence.js';
import { registerMemoryTools } from './tools/memory.js';
import { registerAdvisoryAiTools } from './tools/advisory-ai.js';
import { registerQuoteTools } from './tools/quotes.js';
import { registerFinanceTools } from './tools/finance.js';
import { registerMatflowTools } from './tools/matflow.js';
import { registerBOQTools } from './tools/boq.js';
import { registerStrategyTools } from './tools/strategy.js';
import { registerCategoryTools } from './tools/categories.js';
import { registerFinishTools } from './tools/finishes.js';
import { registerDesignManagerTools } from './tools/designManager.js';
import { getDb, serverTimestamp } from './services/firebase.js';
function parseBearerToken(authHeader) {
    if (!authHeader)
        return null;
    const [scheme, token] = authHeader.split(' ');
    if (!scheme || !token)
        return null;
    if (scheme.toLowerCase() !== 'bearer')
        return null;
    return token.trim();
}
function isMutatingTool(toolName) {
    const explicitMutating = new Set([
        'dawinos_create_inventory_item',
        'dawinos_update_inventory_item',
        'dawinos_delete_inventory_item',
        'dawinos_batch_update_inventory',
        'dawinos_create_stock_adjustment',
        'dawinos_link_inventory_to_finish',
        'dawinos_unlink_inventory_from_finish',
        'dawinos_create_finish_library_entry',
        'dawinos_update_finish_library_entry',
        'dawinos_delete_finish_library_entry',
        'dawinos_create_formula',
        'dawinos_update_formula',
        'dawinos_delete_formula',
        'dawinos_create_quote',
        'dawinos_update_quote',
        'dawinos_create_boq_item',
        'dawinos_update_boq_item',
        'dawinos_regenerate_boq_rates',
        'dawinos_generate_spend_plan',
        'dawinos_run_cash_flow_scenario',
        'dawinos_save_memory',
        'dawinos_extract_memories',
        'dawinos_rewrite_strategy_section',
        'dawinos_process_receipt',
    ]);
    if (explicitMutating.has(toolName))
        return true;
    return /(create|update|delete|batch|save|rewrite|process)\b/i.test(toolName);
}
function jsonRpcErrorResponse(id, code, message) {
    return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code, message },
    };
}
function stableJson(value) {
    if (value === null || value === undefined)
        return String(value);
    if (typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(stableJson).join(',')}]`;
    const obj = value;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`;
}
function hashArgs(args) {
    const digest = createHash('sha256').update(stableJson(args)).digest('hex');
    return `sha256:${digest}`;
}
function getRequestIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim())
        return xff.split(',')[0].trim();
    if (Array.isArray(xff) && xff.length > 0)
        return xff[0];
    return req.ip || 'unknown';
}
async function writeAuditLog(entry) {
    try {
        const db = getDb();
        const companyId = process.env['DAWINOS_COMPANY_ID']?.trim() || 'unknown';
        await db.collection(`companies/${companyId}/mcp_audit_logs`).add({
            ...entry,
            createdAt: serverTimestamp(),
        });
    }
    catch (err) {
        console.warn(`[dawinos-mcp] audit-write-failed: ${String(err)}`);
    }
}
// ─── McpServer Singleton ──────────────────────────────────────────────────────
// One server instance per Cloud Functions container (survives warm invocations).
// Tool registration is idempotent with a single cold-start call to getServer().
let _server = null;
function getServer() {
    if (!_server) {
        _server = new McpServer({
            name: 'dawinos-mcp-server',
            version: '1.0.0',
        });
        registerPurchasingTools(_server);
        registerManufacturingTools(_server);
        registerInventoryTools(_server);
        registerAdvisoryTools(_server);
        registerIntelligenceTools(_server);
        registerMemoryTools(_server);
        registerAdvisoryAiTools(_server);
        registerQuoteTools(_server);
        registerFinanceTools(_server);
        registerMatflowTools(_server);
        registerBOQTools(_server);
        registerStrategyTools(_server);
        registerCategoryTools(_server);
        registerFinishTools(_server);
        registerDesignManagerTools(_server);
    }
    return _server;
}
// ─── HTTP Handler ─────────────────────────────────────────────────────────────
// Exported for use in the Cloud Functions wrapper (via dynamic import) and in
// the standalone Express server in index.ts.
//
// Each POST request gets its own StatelessHTTPServerTransport so Cloud Functions
// can handle concurrent requests without shared session state.
export async function createMcpHandler(req, res) {
    // Health check
    if (req.method === 'GET') {
        res.json({
            status: 'ok',
            server: 'dawinos-mcp-server',
            version: '1.0.0',
            tools: 79,
        });
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed', allowed: ['GET', 'POST'] });
        return;
    }
    const requestId = req.get('x-request-id') ||
        req.get('x-cloud-trace-context')?.split('/')[0] ||
        randomUUID();
    const actorId = req.get('x-dawinos-actor-id') || 'unknown';
    const requiredBearerToken = process.env['DAWINOS_MCP_BEARER_TOKEN']?.trim();
    if (!requiredBearerToken) {
        await writeAuditLog({
            requestId,
            actorId,
            method: 'misconfigured',
            decision: 'misconfigured',
            reason: 'DAWINOS_MCP_BEARER_TOKEN not configured',
            ip: getRequestIp(req),
            userAgent: req.get('user-agent') ?? undefined,
        });
        res.status(503).json({ error: 'Service misconfigured' });
        return;
    }
    const providedToken = parseBearerToken(req.headers.authorization);
    if (!providedToken || providedToken !== requiredBearerToken) {
        await writeAuditLog({
            requestId,
            actorId,
            method: 'unauthorized',
            decision: 'unauthorized',
            reason: 'Missing or invalid bearer token',
            ip: getRequestIp(req),
            userAgent: req.get('user-agent') ?? undefined,
        });
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const rpc = (req.body ?? {});
    const args = rpc.params?.['arguments'];
    const argsDigest = hashArgs(args);
    const toolName = rpc.method === 'tools/call'
        ? String(rpc.params?.['name'] ?? '')
        : '';
    const ip = getRequestIp(req);
    if (toolName) {
        const allowMutations = process.env['DAWINOS_MCP_ALLOW_MUTATIONS'] === 'true';
        if (!allowMutations && isMutatingTool(toolName)) {
            await writeAuditLog({
                requestId,
                actorId,
                method: rpc.method ?? 'unknown',
                toolName,
                argsHash: argsDigest,
                decision: 'blocked',
                reason: 'Mutating tools blocked by policy',
                ip,
                userAgent: req.get('user-agent') ?? undefined,
            });
            res.status(403).json(jsonRpcErrorResponse(rpc.id, -32000, `Tool "${toolName}" is blocked by compliance policy (set DAWINOS_MCP_ALLOW_MUTATIONS=true to override).`));
            console.warn(`[dawinos-mcp] blocked mutating tool call tool=${toolName} ip=${ip} ua=${req.get('user-agent') ?? 'unknown'}`);
            return;
        }
    }
    await writeAuditLog({
        requestId,
        actorId,
        method: rpc.method ?? 'unknown',
        toolName: toolName || undefined,
        argsHash: toolName ? argsDigest : undefined,
        decision: 'allowed',
        ip,
        userAgent: req.get('user-agent') ?? undefined,
    });
    console.info(`[dawinos-mcp] request requestId=${requestId} actor=${actorId} method=${rpc.method ?? 'unknown'} tool=${toolName || '-'} argsHash=${toolName ? argsDigest : '-'} ip=${ip}`);
    // Stateless transport — new instance per request (required for Cloud Functions)
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless: no session tracking
        enableJsonResponse: true, // return JSON-RPC response inline (not SSE)
    });
    // Clean up transport when the response stream closes
    res.on('close', () => {
        transport.close().catch(() => {
            // Ignore close errors on already-closed transports
        });
    });
    await getServer().connect(transport);
    await transport.handleRequest(req, res, req.body);
}
//# sourceMappingURL=handler.js.map