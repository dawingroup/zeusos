/**
 * DawinOS MCP Server — standalone entry point
 *
 * Supports two transport modes (selected via TRANSPORT env var):
 *   TRANSPORT=stdio  (default) — reads JSON-RPC from stdin, writes to stdout
 *                                 Use with Claude Desktop or `mcp dev`
 *   TRANSPORT=http              — starts an Express HTTP server
 *                                 Use for local HTTP testing; Cloud Functions uses handler.ts directly
 */
export { createMcpHandler } from './handler.js';
//# sourceMappingURL=index.d.ts.map