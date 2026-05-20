#!/usr/bin/env node
/**
 * One-time setup for the DawinOS MCP token-refresh proxy.
 *
 * Writes ~/.dawinos-mcp/config.json (mode 0600) with everything proxy.js
 * needs to mint fresh ID tokens. After this runs successfully, you can
 * launch the proxy with `node proxy.js` and never paste a token again.
 *
 * Usage:
 *   node setup.js
 *
 * Defaults:
 *   - endpoint  : DawinOS production Cloud Function
 *   - apiKey    : DawinOS Firebase web API key (read from /Users/danielonzimai/CascadeProjects/dawinos/.env)
 *   - bearer    : DAWINOS_MCP_BEARER_TOKEN (read from functions/.env)
 *   - refresh   : you provide this — the per-user Firebase refresh token
 *
 * To grab the refresh token, run this in the DawinOS browser dev console
 * (page must be open and signed in):
 *
 *   await new Promise((resolve, reject) => {
 *     const open = indexedDB.open('firebaseLocalStorageDb');
 *     open.onerror = () => reject(open.error);
 *     open.onsuccess = (e) => {
 *       const tx = e.target.result.transaction('firebaseLocalStorage');
 *       tx.objectStore('firebaseLocalStorage').getAll().onsuccess = (ev) => {
 *         const entry = ev.target.result.find(x => x.fbase_key?.startsWith('firebase:authUser:'));
 *         if (!entry) return reject(new Error('Not signed in'));
 *         console.log('REFRESH_TOKEN:', entry.value.stsTokenManager.refreshToken);
 *         console.log('API_KEY:', entry.value.apiKey);
 *         resolve();
 *       };
 *     };
 *   });
 */

const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const readline = require('node:readline/promises');

const CONFIG_DIR = path.join(os.homedir(), '.dawinos-mcp');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_ENDPOINT = 'https://us-central1-dawinos.cloudfunctions.net/dawinos_mcp';
const DAWINOS_REPO = path.resolve(__dirname, '..', '..');
const DOTENV_PATH = path.join(DAWINOS_REPO, '.env');
const FUNCTIONS_DOTENV_PATH = path.join(DAWINOS_REPO, 'functions', '.env');

function readDotEnv(p) {
  try {
    const raw = fsSync.readFileSync(p, 'utf8');
    const out = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

function deriveDefaults() {
  const root = readDotEnv(DOTENV_PATH);
  const fns = readDotEnv(FUNCTIONS_DOTENV_PATH);
  return {
    endpoint: DEFAULT_ENDPOINT,
    apiKey: root.VITE_FIREBASE_API_KEY || '',
    bearerToken: fns.DAWINOS_MCP_BEARER_TOKEN || '',
  };
}

async function prompt(rl, label, fallback) {
  const hint = fallback ? ` [${fallback.length > 16 ? fallback.slice(0, 8) + '…' : fallback}]` : '';
  const answer = (await rl.question(`${label}${hint}: `)).trim();
  return answer || fallback || '';
}

async function verifyAndWrite(cfg) {
  // Quick sanity check: does the refresh token actually mint?
  process.stderr.write('Verifying refresh token mints an id_token… ');
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cfg.refreshToken }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`mint check failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.id_token) {
    throw new Error('mint returned no id_token');
  }
  process.stderr.write('ok\n');

  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  // chmod again in case file pre-existed with looser perms
  await fs.chmod(CONFIG_PATH, 0o600);
  await fs.chmod(CONFIG_DIR, 0o700);
}

// ─── login subcommand: browser-based pairing flow ────────────────────────────
//
// Spins up a one-shot loopback HTTP server, opens the DawinOS web app's
// /mcp-login route in the default browser, and waits for the page to POST
// the refresh token + apiKey back. No copy-paste required.

const PAIRING_BASE_URL =
  process.env.DAWINOS_PAIRING_URL || 'https://dawinos.web.app/mcp-login';
const PAIRING_TIMEOUT_MS = 5 * 60 * 1000;

function corsHeaders() {
  // Browsers will preflight a JSON POST. We accept any origin because the
  // request is only ever reaching loopback — but we additionally check the
  // nonce against what we generated, which is the actual auth boundary.
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

async function awaitCallback({ port, nonce }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`Timed out after ${PAIRING_TIMEOUT_MS / 1000}s waiting for browser callback.`));
    }, PAIRING_TIMEOUT_MS);

    const server = http.createServer((req, res) => {
      // Loopback-only — the listen address already enforces this, but be
      // explicit so a misconfigured listener can't accept remote callers.
      const host = req.headers.host || '';
      if (!host.startsWith('127.0.0.1:') && !host.startsWith('localhost:')) {
        res.writeHead(403, corsHeaders());
        res.end('Loopback only');
        return;
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
      }

      if (req.method !== 'POST' || req.url !== '/callback') {
        res.writeHead(404, corsHeaders());
        res.end();
        return;
      }

      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        let payload;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch (err) {
          res.writeHead(400, { 'content-type': 'application/json', ...corsHeaders() });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }
        if (payload.nonce !== nonce) {
          res.writeHead(403, { 'content-type': 'application/json', ...corsHeaders() });
          res.end(JSON.stringify({ error: 'Nonce mismatch' }));
          return;
        }
        if (!payload.refreshToken || !payload.apiKey) {
          res.writeHead(400, { 'content-type': 'application/json', ...corsHeaders() });
          res.end(JSON.stringify({ error: 'Missing refreshToken or apiKey' }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json', ...corsHeaders() });
        res.end(JSON.stringify({ ok: true }));
        clearTimeout(timer);
        server.close();
        resolve(payload);
      });
      req.on('error', (err) => {
        clearTimeout(timer);
        server.close();
        reject(err);
      });
    });

    server.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    server.listen(port, '127.0.0.1');
  });
}

function openBrowser(url) {
  // macOS only for now. Windows: 'start ""', linux: 'xdg-open'.
  // If the spawn fails, we still print the URL so the user can open manually.
  try {
    const child = spawn('open', [url], { stdio: 'ignore', detached: true });
    child.on('error', () => { /* ignored — fallback prints the URL */ });
    child.unref();
  } catch {
    /* swallowed — printed URL is the fallback */
  }
}

async function loginMain() {
  const defaults = deriveDefaults();

  if (!defaults.apiKey) {
    console.error('Missing VITE_FIREBASE_API_KEY in repo .env — aborting.');
    process.exit(1);
  }
  if (!defaults.bearerToken) {
    console.error('Missing DAWINOS_MCP_BEARER_TOKEN in functions/.env — aborting.');
    process.exit(1);
  }

  // Bind a server on an OS-assigned ephemeral port first to learn the port number.
  const probe = http.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));

  const nonce = crypto.randomBytes(16).toString('hex');
  const url = `${PAIRING_BASE_URL}?port=${port}&nonce=${nonce}`;

  console.log('DawinOS MCP proxy — browser pairing');
  console.log('-----------------------------------');
  console.log(`Listening on   : http://127.0.0.1:${port}/callback`);
  console.log(`Opening browser: ${url}`);
  console.log('');
  console.log('Sign in to DawinOS in your browser if you are not already, then click "Authorize this terminal".');
  console.log(`(Times out in ${PAIRING_TIMEOUT_MS / 1000 / 60} minutes.)`);
  console.log('');

  openBrowser(url);

  let payload;
  try {
    payload = await awaitCallback({ port, nonce });
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }

  console.log(`Received credentials for ${payload.email || payload.uid || '(unknown user)'}.`);

  try {
    await verifyAndWrite({
      endpoint: defaults.endpoint,
      apiKey: payload.apiKey,
      bearerToken: defaults.bearerToken,
      refreshToken: payload.refreshToken,
    });
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }

  console.log('\n✅ Saved.');
  console.log('If the proxy is already running (launchd), no further action needed —');
  console.log('it will pick up the new refresh token on its next mint.');
  console.log('Otherwise:  node proxy.js   (or `launchctl start com.dawingroup.mcp-proxy`)');
}

// ─── interactive subcommand (legacy / fallback) ──────────────────────────────

async function interactiveMain() {
  const defaults = deriveDefaults();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('DawinOS MCP proxy setup (interactive)');
  console.log('-------------------------------------');
  console.log(`Config will be written to: ${CONFIG_PATH} (mode 0600)`);
  console.log('Press Enter to accept the [bracketed default] for any field.\n');
  console.log('Tip: `node setup.js login` opens a browser and skips the manual paste.\n');

  const endpoint = await prompt(rl, 'MCP endpoint', defaults.endpoint);
  const apiKey = await prompt(rl, 'Firebase web API key', defaults.apiKey);
  const bearerToken = await prompt(rl, 'MCP bearer (DAWINOS_MCP_BEARER_TOKEN)', defaults.bearerToken);
  const refreshToken = await prompt(rl, 'Firebase refresh token (paste from browser)', '');

  rl.close();

  if (!endpoint || !apiKey || !bearerToken || !refreshToken) {
    console.error('\nMissing required field. Aborting.');
    process.exit(1);
  }

  try {
    await verifyAndWrite({ endpoint, apiKey, bearerToken, refreshToken });
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }

  console.log('\n✅ Saved.');
  console.log(`Start the proxy:    node ${path.relative(process.cwd(), path.join(__dirname, 'proxy.js'))}`);
  console.log('Then update ~/Library/Application Support/Claude/claude_desktop_config.json');
  console.log('to point at http://localhost:8765/mcp (no headers, no env block).');
  console.log('See README for launchd auto-start instructions.');
}

// ─── entry point ─────────────────────────────────────────────────────────────

const subcommand = process.argv[2];

(async () => {
  if (subcommand === 'login') {
    await loginMain();
  } else if (!subcommand || subcommand === 'interactive') {
    await interactiveMain();
  } else if (subcommand === '-h' || subcommand === '--help' || subcommand === 'help') {
    console.log('Usage:');
    console.log('  node setup.js               # interactive (paste refresh token)');
    console.log('  node setup.js login         # browser pairing (recommended)');
    process.exit(0);
  } else {
    console.error(`Unknown subcommand: ${subcommand}. Try \`node setup.js --help\`.`);
    process.exit(1);
  }
})().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
