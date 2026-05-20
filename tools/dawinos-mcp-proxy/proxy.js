#!/usr/bin/env node
/**
 * DawinOS MCP token-refresh proxy.
 *
 * Listens on localhost and acts as an auth-injecting reverse proxy in front
 * of the DawinOS MCP Cloud Function. Holds a Firebase refresh token + the
 * shared service bearer token, mints fresh ID tokens on demand, and forwards
 * requests upstream with both required headers.
 *
 * Why this exists: Firebase ID tokens expire every hour. Without this proxy,
 * Claude Desktop's mcp-remote config requires manually pasting a fresh ID
 * token every hour. With this proxy, the desktop config points at
 * http://localhost:8765/mcp (no headers, no token), and we handle refresh
 * transparently.
 *
 * Storage: ~/.dawinos-mcp/config.json (mode 0600). See setup.js.
 *
 * Usage:
 *   node proxy.js              # listen on default port 8765
 *   PORT=9000 node proxy.js    # listen on a custom port
 */

const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const CONFIG_DIR = path.join(os.homedir(), '.dawinos-mcp');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const PORT = parseInt(process.env.PORT || '8765', 10);
const REFRESH_LEEWAY_MS = 5 * 60 * 1000; // refresh ID tokens 5 min before expiry

let config = null;
const cache = { idToken: null, expiresAt: 0 };

// ─── Config ──────────────────────────────────────────────────────────────────

async function loadConfig() {
  let raw;
  try {
    raw = await fs.readFile(CONFIG_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `No config found at ${CONFIG_PATH}. Run \`node setup.js\` first.`,
      );
    }
    throw err;
  }
  const parsed = JSON.parse(raw);
  for (const field of ['refreshToken', 'apiKey', 'bearerToken', 'endpoint']) {
    if (!parsed[field] || typeof parsed[field] !== 'string') {
      throw new Error(`config field "${field}" missing or not a string`);
    }
  }
  config = parsed;
}

// ─── ID-token cache ──────────────────────────────────────────────────────────

async function ensureFreshIdToken({ allowConfigReload = true } = {}) {
  const now = Date.now();
  if (cache.idToken && cache.expiresAt > now + REFRESH_LEEWAY_MS) {
    return cache.idToken;
  }

  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // If the refresh token has been rotated/revoked, try one config reload —
    // useful when the user re-ran `setup.js` while the proxy was running.
    if (allowConfigReload && (res.status === 400 || res.status === 401)) {
      try {
        await loadConfig();
        return await ensureFreshIdToken({ allowConfigReload: false });
      } catch {
        // fall through to throw below
      }
    }
    throw new Error(`Mint failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.id_token) {
    throw new Error(`Mint succeeded but response had no id_token: ${JSON.stringify(data)}`);
  }
  cache.idToken = data.id_token;
  cache.expiresAt = now + parseInt(data.expires_in || '3600', 10) * 1000;
  return cache.idToken;
}

// ─── HTTP handlers ───────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function forward(req, res) {
  let idToken;
  try {
    idToken = await ensureFreshIdToken();
  } catch (err) {
    log(`mint-error: ${err.message}`);
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Token refresh failed', detail: err.message }));
    return;
  }

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);

  const forwardHeaders = {
    Authorization: `Bearer ${config.bearerToken}`,
    'x-dawinos-firebase-auth': `Bearer ${idToken}`,
  };
  // Forward content-type and accept verbatim if present
  for (const h of ['content-type', 'accept']) {
    const v = req.headers[h];
    if (v) forwardHeaders[h] = v;
  }

  let upstream;
  try {
    upstream = await fetch(config.endpoint, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });
  } catch (err) {
    log(`upstream-error: ${err.message}`);
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }));
    return;
  }

  // Mirror status + content headers back to the client
  const passthroughHeaders = {};
  for (const [k, v] of upstream.headers.entries()) {
    // Skip headers that the runtime sets itself
    if (['content-encoding', 'transfer-encoding', 'connection'].includes(k)) continue;
    passthroughHeaders[k] = v;
  }
  res.writeHead(upstream.status, passthroughHeaders);

  if (!upstream.body) {
    res.end();
    return;
  }
  // Stream the body — works for JSON and SSE alike
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch (err) {
    log(`stream-error: ${err.message}`);
  }
  res.end();
}

function handleHealth(res) {
  const now = Date.now();
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(
    JSON.stringify({
      ok: true,
      proxy: 'dawinos-mcp-proxy',
      endpoint: config.endpoint,
      idTokenCached: Boolean(cache.idToken),
      idTokenExpiresIn: cache.idToken ? Math.max(0, Math.round((cache.expiresAt - now) / 1000)) : null,
    }),
  );
}

async function handleRequest(req, res) {
  // Reject anything not coming from localhost. Cheap defense — the loopback
  // bind already blocks remote callers, but be explicit.
  const host = req.headers.host || '';
  if (!host.startsWith('127.0.0.1:') && !host.startsWith('localhost:')) {
    res.writeHead(403);
    res.end('Loopback only');
    return;
  }

  const u = new URL(req.url, `http://${host}`);

  if (u.pathname === '/health') {
    return handleHealth(res);
  }
  // /mcp (and anything else) → forward
  await forward(req, res);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function log(msg) {
  process.stderr.write(`[dawinos-mcp-proxy] ${new Date().toISOString()} ${msg}\n`);
}

async function main() {
  await loadConfig();
  // Eagerly mint at startup so first request is fast and config errors surface now
  try {
    await ensureFreshIdToken();
    log(`startup ok — id_token cached, expires in ${Math.round((cache.expiresAt - Date.now()) / 1000)}s`);
  } catch (err) {
    log(`startup mint failed (will retry on first request): ${err.message}`);
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      log(`unhandled-error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy crashed', detail: err.message }));
      } else {
        res.end();
      }
    });
  });

  server.listen(PORT, '127.0.0.1', () => {
    log(`listening on http://127.0.0.1:${PORT}/mcp (health: /health)`);
  });

  process.on('SIGTERM', () => { log('SIGTERM — shutting down'); server.close(() => process.exit(0)); });
  process.on('SIGINT',  () => { log('SIGINT — shutting down');  server.close(() => process.exit(0)); });
}

main().catch((err) => {
  log(`fatal: ${err.message}`);
  process.exit(1);
});
