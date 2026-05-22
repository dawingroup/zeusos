/**
 * ZeusOS MCP Server — standalone entry point
 *
 * Supports two transport modes (selected via TRANSPORT env var):
 *   TRANSPORT=stdio  (default) — reads JSON-RPC from stdin, writes to stdout
 *                                 Use with Claude Desktop or `mcp dev`
 *   TRANSPORT=http              — starts an Express HTTP server
 *                                 Use for local HTTP testing; Cloud Functions uses handler.ts directly
 *
 * Phase 1.D removed Advisory: tool surface trimmed to the kept ZeusOS domains
 * — Finance, Strategy, Intelligence, Quotes, Memory. Construction-domain tool
 * packs (purchasing, manufacturing, inventory, matflow, boq, categories,
 * finishes, designManager) were removed alongside the source modules.
 * Marketing-domain tool packs (campaigns, media, production, talent,
 * asset-library) will be added in Phase 3+.
 */
export { createMcpHandler } from './handler.js';
//# sourceMappingURL=index.d.ts.map