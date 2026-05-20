# DawinOS MCP token-refresh proxy

A small zero-dependency Node script that runs on `localhost`, holds your Firebase refresh token + the shared MCP bearer, mints fresh ID tokens on demand, and forwards MCP requests upstream with both required headers.

The point: **stop hand-pasting Firebase ID tokens into `claude_desktop_config.json` every hour.**

```
Claude Desktop (mcp-remote)
   ↓ stdio
   ↓ HTTP to http://127.0.0.1:8765/mcp  (no auth headers)
[ proxy.js — this directory ]
   ↓ HTTPS + Authorization + x-dawinos-firebase-auth
Cloud Function dawinos_mcp
```

## Requirements

- Node 18+ (uses native `fetch`). DawinOS dev machines typically have Node ≥20.
- Already-signed-in DawinOS web session in a browser (to grab the refresh token once).

## Initial setup

### Option 1 — browser pairing (recommended)

```bash
cd tools/dawinos-mcp-proxy
node setup.js login
```

This:
1. Picks an ephemeral local port and a one-shot nonce.
2. Opens `https://dawinos.web.app/mcp-login?port=…&nonce=…` in your default browser.
3. The DawinOS web app (where you're already signed in) shows a "Pair this terminal?" confirmation. Click **Authorize**.
4. The page POSTs your refresh token + Firebase API key back to the local listener over loopback.
5. `setup.js` validates the token, writes `~/.dawinos-mcp/config.json` (`0600`), and exits.

No copy-paste, no dev console.

### Option 2 — interactive paste (works without web app)

```bash
node setup.js
```

`setup.js` will prompt for the four fields below; defaults are auto-filled from the repo `.env`s.

| Field | Default | How to get it |
|---|---|---|
| MCP endpoint | DawinOS prod URL | Press Enter |
| Firebase web API key | auto-read from repo `.env` | Press Enter |
| MCP bearer | auto-read from `functions/.env` | Press Enter |
| **Firebase refresh token** | *(none — you provide)* | See snippet below |

#### Grabbing the refresh token via dev console (fallback)

Use this only if the browser pairing flow can't run for some reason. Open the DawinOS web app in a browser where you're signed in, open dev console (Cmd+Opt+I), paste:

```js
await new Promise((resolve, reject) => {
  const open = indexedDB.open('firebaseLocalStorageDb');
  open.onerror = () => reject(open.error);
  open.onsuccess = (e) => {
    const tx = e.target.result.transaction('firebaseLocalStorage');
    tx.objectStore('firebaseLocalStorage').getAll().onsuccess = (ev) => {
      const entry = ev.target.result.find(x => x.fbase_key?.startsWith('firebase:authUser:'));
      if (!entry) return reject(new Error('Not signed in'));
      console.log('REFRESH_TOKEN:', entry.value.stsTokenManager.refreshToken);
      console.log('API_KEY:', entry.value.apiKey);
      resolve();
    };
  };
});
```

Triple-click the printed `REFRESH_TOKEN` value, copy it, paste it into the `setup.js` prompt.

The refresh token is long-lived (months → indefinite, until you sign out everywhere or rotate). Once stored, the proxy refreshes ID tokens forever without further input.

## Running the proxy

Foreground (for testing):

```bash
node proxy.js
```

You should see:

```
[dawinos-mcp-proxy] 2026-... startup ok — id_token cached, expires in 3597s
[dawinos-mcp-proxy] 2026-... listening on http://127.0.0.1:8765/mcp (health: /health)
```

Hit the health endpoint to confirm:

```bash
curl http://127.0.0.1:8765/health
# {"ok":true,"proxy":"dawinos-mcp-proxy", ... ,"idTokenExpiresIn":3597}
```

## Updating the Claude Desktop config

Replace your `dawinos` entry in `~/Library/Application Support/Claude/claude_desktop_config.json` with:

```json
{
  "mcpServers": {
    "dawinos": {
      "command": "npx",
      "args": ["mcp-remote", "http://127.0.0.1:8765/mcp"]
    }
  }
}
```

That's the whole entry. No `--header` flags, no `env` block — the proxy injects auth.

Cmd+Q Claude Desktop fully, then relaunch. The connector should load all tools.

## Auto-start at login (launchd)

So the proxy is always running:

1. Edit `com.dawingroup.mcp-proxy.plist` (in this directory) and replace the placeholder paths with absolute paths on your machine. The two values you may need to set:
   - `<NODE_PATH>` — output of `which node` (e.g. `/opt/homebrew/bin/node`)
   - `<PROXY_PATH>` — absolute path to `proxy.js` (e.g. `/Users/yourname/CascadeProjects/dawinos/tools/dawinos-mcp-proxy/proxy.js`)

2. Copy and load:

   ```bash
   cp com.dawingroup.mcp-proxy.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.dawingroup.mcp-proxy.plist
   launchctl start com.dawingroup.mcp-proxy
   ```

3. Verify it's running:

   ```bash
   curl http://127.0.0.1:8765/health
   tail -f ~/.dawinos-mcp/logs/proxy.log
   ```

To stop / unload:

```bash
launchctl unload ~/Library/LaunchAgents/com.dawingroup.mcp-proxy.plist
```

## Files

| Path | Purpose |
|---|---|
| `~/.dawinos-mcp/config.json` | Stored credentials. `0600`. Do **not** commit, mail, screenshot, or paste into chat. |
| `~/.dawinos-mcp/logs/proxy.log` | launchd-managed proxy stdout/stderr (only if installed via plist) |
| `tools/dawinos-mcp-proxy/proxy.js` | The proxy — long-running, ~200 lines, no deps |
| `tools/dawinos-mcp-proxy/setup.js` | One-time interactive setup |
| `tools/dawinos-mcp-proxy/com.dawingroup.mcp-proxy.plist` | launchd template |

## Troubleshooting

**`No config found at ~/.dawinos-mcp/config.json`** — run `node setup.js`.

**`Mint failed (400)` with `INVALID_REFRESH_TOKEN` or similar** — your refresh token was rotated or revoked (e.g. you signed out of DawinOS in all browsers, or an admin reset your session). Re-run `node setup.js` with a fresh refresh token; the running proxy will reload config automatically on the next mint attempt.

**`http://127.0.0.1:8765/health` returns connection refused** — proxy isn't running. `node proxy.js` to start, or `launchctl start com.dawingroup.mcp-proxy` if you installed via launchd.

**Claude Desktop shows "404 Page not found" or "Cannot read OAuth"** — the desktop config still points at the cloud function URL, not localhost. Update it.

**Custom claims changed (e.g. you got the `staff` claim added today)** — `proxy.js` caches the ID token for ~55 min, so claims set after the last mint won't take effect until the next refresh. Restart the proxy to mint immediately.

## Security notes

- The config file is `0600` — only your user can read it. The directory is `0700`.
- The proxy binds to `127.0.0.1` only (loopback), so other machines on your network can't reach it.
- An additional Host-header check rejects anything not coming through `127.0.0.1` or `localhost`.
- The bearer token + refresh token in the config file have the same blast radius as the values in `claude_desktop_config.json` did before — same trust boundary, just centralised.
- The refresh token does **not** expire automatically. Sign out of DawinOS in all browsers (or have an admin revoke your sessions) to invalidate it.
