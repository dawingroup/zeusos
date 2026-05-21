/**
 * ZeusOS MCP Server — standalone entry point
 *
 * Supports two transport modes (selected via TRANSPORT env var):
 *   TRANSPORT=stdio  (default) — reads JSON-RPC from stdin, writes to stdout
 *                                 Use with Claude Desktop or `mcp dev`
 *   TRANSPORT=http              — starts an Express HTTP server
 *                                 Use for local HTTP testing; Cloud Functions uses handler.ts directly
 *
 * Phase 1.D scope: tool surface trimmed to the kept ZeusOS domains —
 * Advisory (project / financial backbone for Campaigns), Finance, Strategy,
 * Intelligence, Quotes, Memory, Advisory AI. Construction-domain tool packs
 * (purchasing, manufacturing, inventory, matflow, boq, categories, finishes,
 * designManager) were removed alongside the source modules. Marketing-domain
 * tool packs (campaigns, media, production, talent, asset-library) will be
 * added in Phase 3+.
 */

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAdvisoryTools } from './tools/advisory.js';
import { registerIntelligenceTools } from './tools/intelligence.js';
import { registerMemoryTools } from './tools/memory.js';
import { registerAdvisoryAiTools } from './tools/advisory-ai.js';
import { registerQuoteTools } from './tools/quotes.js';
import { registerFinanceTools } from './tools/finance.js';
import { registerStrategyTools } from './tools/strategy.js';

// ─── Re-export handler for Cloud Functions wrapper ────────────────────────────
export { createMcpHandler } from './handler.js';

// ─── Server factory ───────────────────────────────────────────────────────────

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'zeusos-mcp-server',
    version: '0.1.0',
  });
  registerAdvisoryTools(server);
  registerIntelligenceTools(server);
  registerMemoryTools(server);
  registerAdvisoryAiTools(server);
  registerQuoteTools(server);
  registerFinanceTools(server);
  registerStrategyTools(server);
  return server;
}

// ─── Stdio mode ───────────────────────────────────────────────────────────────

async function runStdio(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep alive — transport ends when stdin closes
}

// ─── HTTP mode ────────────────────────────────────────────────────────────────

async function runHttp(port: number): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'zeusos-mcp-server', version: '0.1.0' });
  });

  app.all('/mcp', async (req, res) => {
    if (req.method === 'GET') {
      res.json({ status: 'ok', server: 'zeusos-mcp-server', version: '0.1.0' });
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed', allowed: ['GET', 'POST'] });
      return;
    }

    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      transport.close().catch(() => {});
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, () => {
    process.stderr.write(`[zeusos-mcp-server] Listening on http://localhost:${port}/mcp\n`);
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const mode = process.env['TRANSPORT'] ?? 'stdio';
const port = parseInt(process.env['PORT'] ?? '8080', 10);

if (mode === 'http') {
  runHttp(port).catch((err: unknown) => {
    process.stderr.write(`[zeusos-mcp-server] Fatal: ${String(err)}\n`);
    process.exit(1);
  });
} else {
  runStdio().catch((err: unknown) => {
    process.stderr.write(`[zeusos-mcp-server] Fatal: ${String(err)}\n`);
    process.exit(1);
  });
}
