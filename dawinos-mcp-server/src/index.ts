/**
 * DawinOS MCP Server — standalone entry point
 *
 * Supports two transport modes (selected via TRANSPORT env var):
 *   TRANSPORT=stdio  (default) — reads JSON-RPC from stdin, writes to stdout
 *                                 Use with Claude Desktop or `mcp dev`
 *   TRANSPORT=http              — starts an Express HTTP server
 *                                 Use for local HTTP testing; Cloud Functions uses handler.ts directly
 */

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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

// ─── Re-export handler for Cloud Functions wrapper ────────────────────────────
export { createMcpHandler } from './handler.js';

// ─── Server factory ───────────────────────────────────────────────────────────

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'dawinos-mcp-server',
    version: '1.0.0',
  });
  registerPurchasingTools(server);
  registerManufacturingTools(server);
  registerInventoryTools(server);
  registerAdvisoryTools(server);
  registerIntelligenceTools(server);
  registerMemoryTools(server);
  registerAdvisoryAiTools(server);
  registerQuoteTools(server);
  registerFinanceTools(server);
  registerMatflowTools(server);
  registerBOQTools(server);
  registerStrategyTools(server);
  registerCategoryTools(server);
  registerFinishTools(server);
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
    res.json({ status: 'ok', server: 'dawinos-mcp-server', version: '1.0.0', tools: 79 });
  });

  app.all('/mcp', async (req, res) => {
    if (req.method === 'GET') {
      res.json({ status: 'ok', server: 'dawinos-mcp-server', version: '1.0.0', tools: 79 });
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
    process.stderr.write(`[dawinos-mcp-server] Listening on http://localhost:${port}/mcp\n`);
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const mode = process.env['TRANSPORT'] ?? 'stdio';
const port = parseInt(process.env['PORT'] ?? '8080', 10);

if (mode === 'http') {
  runHttp(port).catch((err: unknown) => {
    process.stderr.write(`[dawinos-mcp-server] Fatal: ${String(err)}\n`);
    process.exit(1);
  });
} else {
  runStdio().catch((err: unknown) => {
    process.stderr.write(`[dawinos-mcp-server] Fatal: ${String(err)}\n`);
    process.exit(1);
  });
}
