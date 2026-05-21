const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

/**
 * ZeusOS MCP Server — Cloud Functions Gen 2 wrapper
 *
 * Thin wrapper around the standalone zeusos-mcp-server package.
 * Uses dynamic import() to avoid bundling @modelcontextprotocol/sdk
 * into the main Cloud Functions bundle.
 *
 * Deploy sequence:
 *   1. cd zeusos-mcp-server && npm run build
 *   2. firebase deploy --only functions:zeusos_mcp
 *
 * Health check:  GET  .../zeusos_mcp
 * MCP endpoint:  POST .../zeusos_mcp  (JSON-RPC 2.0)
 */
const zeusos_mcp = onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
    // Keep CORS locked down for browser clients; MCP clients can still call directly.
    cors: process.env.ZEUSOS_MCP_CORS_ORIGINS
      ? process.env.ZEUSOS_MCP_CORS_ORIGINS.split(',').map((v) => v.trim()).filter(Boolean)
      : false,
  },
  async (req, res) => {
    const requiredBearer = process.env.ZEUSOS_MCP_BEARER_TOKEN;
    if (!requiredBearer) {
      res.status(503).json({ error: 'Service misconfigured' });
      return;
    }

    // Advertise bearer auth on every 401 so mcp-remote doesn't fall back to
    // OAuth discovery (which 404s against Cloud Functions and crashes the proxy
    // with a "404 Page not found" HTML parse error).
    const setAuthChallenge = (errorCode) =>
      res.set('WWW-Authenticate', `Bearer realm="zeusos-mcp", error="${errorCode}"`);

    const provided = parseBearerToken(req.get('authorization'));
    if (!provided || provided !== requiredBearer) {
      setAuthChallenge('invalid_token');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Staff identity gate (Firebase ID token)
    const idToken = parseBearerToken(req.get('x-zeusos-firebase-auth'));
    if (!idToken) {
      setAuthChallenge('invalid_request');
      res.status(401).json({ error: 'Missing staff identity token' });
      return;
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken, true);
    } catch (_err) {
      setAuthChallenge('invalid_token');
      res.status(401).json({ error: 'Invalid staff identity token' });
      return;
    }

    // Accept the existing role conventions used across storage.rules / firestore.rules
    // so users onboarded via set-owner-claims.js don't need a separate flag.
    const isStaff =
      decoded.staff === true ||
      decoded.admin === true ||
      decoded.role === 'platform_admin' ||
      decoded.globalRole === 'admin' ||
      decoded.globalRole === 'owner';
    if (!isStaff) {
      res.status(403).json({ error: 'Forbidden: staff role required' });
      return;
    }

    const allowedUids = (process.env.ZEUSOS_MCP_ALLOWED_UIDS || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (allowedUids.length > 0 && !allowedUids.includes(decoded.uid)) {
      res.status(403).json({ error: 'Forbidden: user not allowlisted' });
      return;
    }

    // Pass verified actor id downstream for audit logs.
    req.headers['x-zeusos-actor-id'] = decoded.uid;

    // vendor/zeusos-mcp-server is copied here by the firebase.json predeploy script
    const { createMcpHandler } = await import(
      '../../vendor/zeusos-mcp-server/handler.js'
    );
    return createMcpHandler(req, res);
  },
);

module.exports = { zeusos_mcp };
