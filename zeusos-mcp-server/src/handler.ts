import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { registerIntelligenceTools } from './tools/intelligence.js';
import { registerMemoryTools } from './tools/memory.js';
import { registerQuoteTools } from './tools/quotes.js';
import { registerFinanceTools } from './tools/finance.js';
import { registerStrategyTools } from './tools/strategy.js';
import { getDb, serverTimestamp } from './services/firebase.js';

interface JsonRpcRequest {
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function parseBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

function isMutatingTool(toolName: string): boolean {
  // Construction-domain mutating tools (inventory / finishes / formulas / BOQ /
  // designManager / process_receipt) were removed in Phase 1.D, along with the
  // Advisory tool pack. The kept mutating-tool surface is finance + quotes +
  // memory + strategy.
  const explicitMutating = new Set([
    'zeusos_create_quote',
    'zeusos_update_quote',
    'zeusos_generate_spend_plan',
    'zeusos_run_cash_flow_scenario',
    'zeusos_save_memory',
    'zeusos_extract_memories',
    'zeusos_rewrite_strategy_section',
  ]);

  if (explicitMutating.has(toolName)) return true;
  return /(create|update|delete|batch|save|rewrite|process)\b/i.test(toolName);
}

function jsonRpcErrorResponse(
  id: string | number | null | undefined,
  code: number,
  message: string
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message },
  };
}

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`;
}

function hashArgs(args: unknown): string {
  const digest = createHash('sha256').update(stableJson(args)).digest('hex');
  return `sha256:${digest}`;
}

function getRequestIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  return req.ip || 'unknown';
}

async function writeAuditLog(entry: {
  requestId: string;
  actorId: string;
  method: string;
  toolName?: string;
  argsHash?: string;
  decision: 'allowed' | 'blocked' | 'unauthorized' | 'misconfigured';
  reason?: string;
  ip: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const db = getDb();
    const companyId = process.env['ZEUSOS_COMPANY_ID']?.trim() || 'unknown';
    await db.collection(`companies/${companyId}/mcp_audit_logs`).add({
      ...entry,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn(`[zeusos-mcp] audit-write-failed: ${String(err)}`);
  }
}

// ─── McpServer Singleton ──────────────────────────────────────────────────────
// One server instance per Cloud Functions container (survives warm invocations).
// Tool registration is idempotent with a single cold-start call to getServer().

let _server: McpServer | null = null;

function getServer(): McpServer {
  if (!_server) {
    _server = new McpServer({
      name: 'zeusos-mcp-server',
      version: '0.1.0',
    });
    registerIntelligenceTools(_server);
    registerMemoryTools(_server);
    registerQuoteTools(_server);
    registerFinanceTools(_server);
    registerStrategyTools(_server);
  }
  return _server;
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────
// Exported for use in the Cloud Functions wrapper (via dynamic import) and in
// the standalone Express server in index.ts.
//
// Each POST request gets its own StatelessHTTPServerTransport so Cloud Functions
// can handle concurrent requests without shared session state.

export async function createMcpHandler(req: Request, res: Response): Promise<void> {
  // Health check
  if (req.method === 'GET') {
    res.json({
      status: 'ok',
      server: 'zeusos-mcp-server',
      version: '0.1.0',
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', allowed: ['GET', 'POST'] });
    return;
  }

  const requestId =
    req.get('x-request-id') ||
    req.get('x-cloud-trace-context')?.split('/')[0] ||
    randomUUID();
  const actorId = req.get('x-zeusos-actor-id') || 'unknown';
  const requiredBearerToken = process.env['ZEUSOS_MCP_BEARER_TOKEN']?.trim();
  if (!requiredBearerToken) {
    await writeAuditLog({
      requestId,
      actorId,
      method: 'misconfigured',
      decision: 'misconfigured',
      reason: 'ZEUSOS_MCP_BEARER_TOKEN not configured',
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

  const rpc = (req.body ?? {}) as JsonRpcRequest;
  const args = rpc.params?.['arguments'];
  const argsDigest = hashArgs(args);
  const toolName = rpc.method === 'tools/call'
    ? String((rpc.params?.['name'] as string | undefined) ?? '')
    : '';
  const ip = getRequestIp(req);

  if (toolName) {
    const allowMutations = process.env['ZEUSOS_MCP_ALLOW_MUTATIONS'] === 'true';
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
      res.status(403).json(
        jsonRpcErrorResponse(
          rpc.id,
          -32000,
          `Tool "${toolName}" is blocked by compliance policy (set ZEUSOS_MCP_ALLOW_MUTATIONS=true to override).`
        )
      );
      console.warn(
        `[zeusos-mcp] blocked mutating tool call tool=${toolName} ip=${ip} ua=${req.get('user-agent') ?? 'unknown'}`
      );
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

  console.info(
    `[zeusos-mcp] request requestId=${requestId} actor=${actorId} method=${rpc.method ?? 'unknown'} tool=${toolName || '-'} argsHash=${toolName ? argsDigest : '-'} ip=${ip}`
  );

  // Stateless transport — new instance per request (required for Cloud Functions)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session tracking
    enableJsonResponse: true,      // return JSON-RPC response inline (not SSE)
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
