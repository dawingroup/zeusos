# DawinOS MCP Server — Installation Guide

The DawinOS MCP server exposes a suite of tools for querying (and, when enabled, mutating) Firestore operational data — purchase orders, manufacturing orders, inventory, advisory projects, finishes, BOQ, finance, strategy, and AI-assisted briefings. It runs as a Cloud Function and connects to any MCP-compatible client. By default, only read tools are reachable; mutating tools require an explicit server-side flag (`DAWINOS_MCP_ALLOW_MUTATIONS=true`).

**Endpoint:** `https://us-central1-dawinos.cloudfunctions.net/dawinos_mcp`

---

## Authentication (required)

The Cloud Function enforces **two layered checks** on every request — a shared bearer token *and* a per-staff Firebase ID token. Both must be present, or the server returns 401.

| Header | Purpose | How to obtain |
|---|---|---|
| `Authorization: Bearer $DAWINOS_MCP_TOKEN` | Shared MCP service token | From the DawinOS admin (stored in Google Secret Manager as `DAWINOS_MCP_BEARER_TOKEN`) |
| `x-dawinos-firebase-auth: Bearer $DAWINOS_FB_ID_TOKEN` | Your individual Firebase ID token, with a `staff: true` (or `admin: true`) custom claim | Sign into the DawinOS web app, then run the snippet below in the browser console |

Additional gates the server enforces (no client action needed, but useful for troubleshooting):
- The decoded ID token must have `staff: true` or `admin: true` as a custom claim. Without it, the server returns 403 ("Forbidden: staff role required"). Ask an admin to set the claim.
- If `DAWINOS_MCP_ALLOWED_UIDS` is set on the Cloud Function, your UID must appear in it. Otherwise 403 ("Forbidden: user not allowlisted").
- Firebase ID tokens **expire after 1 hour**. The HTTP-transport flow currently has no auto-refresh — you'll need to re-mint and update the header (see "Refreshing the staff token" below).

### Get your Firebase ID token

While signed into the DawinOS web app, open the browser dev console and run:

```js
await firebase.auth().currentUser.getIdToken(true)
```

(or, if the app uses the modular SDK, `await getIdToken(getAuth().currentUser, true)`)

Copy the resulting string. Then in your shell:

```bash
export DAWINOS_MCP_TOKEN="<service-token-from-secret-manager>"
export DAWINOS_FB_ID_TOKEN="<paste-id-token-from-browser>"
```

Treat both as secrets — do not commit either to git.

### Refreshing the staff token

ID tokens are short-lived (1 hour). When you start getting 401s mid-session, re-run the browser snippet, update `DAWINOS_FB_ID_TOKEN`, and re-add the MCP server (`claude mcp remove dawinos && claude mcp add ...`) or restart Claude Desktop. A long-running install path (token-refresh proxy, service-account-minted token) is on the roadmap — see TODO_MCP_SERVER.md.

---

## Option A — Claude Code CLI (quickest)

One command — no config file editing required:

```bash
claude mcp add --transport http dawinos \
  https://us-central1-dawinos.cloudfunctions.net/dawinos_mcp \
  --header "Authorization: Bearer $DAWINOS_MCP_TOKEN" \
  --header "x-dawinos-firebase-auth: Bearer $DAWINOS_FB_ID_TOKEN"
```

Verify it was added:

```bash
claude mcp list
# dawinos: https://us-central1-dawinos.cloudfunctions.net/dawinos_mcp (http)
```

The server is now available in any Claude Code session. To see tools inside a session, run `/mcp`.

**Scope options** (add `--scope` flag if needed):

| Flag | Behaviour |
|------|-----------|
| *(default)* | Available in the current project only |
| `--scope user` | Available across all projects |
| `--scope project` | Saved to `.mcp.json` in the project root (shared with teammates via git) |

To share with the team, use `--scope project` — but **never commit a real token**. Use a placeholder and have each teammate substitute their own:

```bash
claude mcp add --transport http --scope project dawinos \
  https://us-central1-dawinos.cloudfunctions.net/dawinos_mcp \
  --header "Authorization: Bearer $DAWINOS_MCP_TOKEN" \
  --header "x-dawinos-firebase-auth: Bearer $DAWINOS_FB_ID_TOKEN"
```

The resulting `.mcp.json` will contain the literal `$DAWINOS_MCP_TOKEN` and `$DAWINOS_FB_ID_TOKEN` — Claude Code expands them from the environment at runtime, so neither secret lands in source control. Each teammate exports their own ID token, since the Firebase ID token is per-user.

---

## Option B — Claude Desktop

### 1. Open the config file

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

### 2. Add the server entry

```json
{
  "mcpServers": {
    "dawinos": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://us-central1-dawinos.cloudfunctions.net/dawinos_mcp",
        "--header",
        "Authorization: Bearer ${DAWINOS_MCP_TOKEN}",
        "--header",
        "x-dawinos-firebase-auth: Bearer ${DAWINOS_FB_ID_TOKEN}"
      ],
      "env": {
        "DAWINOS_MCP_TOKEN": "<paste-service-token-here>",
        "DAWINOS_FB_ID_TOKEN": "<paste-firebase-id-token-here>"
      }
    }
  }
}
```

`mcp-remote` bridges Claude Desktop's stdio transport to the HTTP endpoint and forwards both `--header` flags on every upstream request. `npx` downloads `mcp-remote` automatically on first run — no pre-installation needed.

Both tokens are kept inside the `env` block so they live only in the Desktop config (which is per-user and not synced to git). Note that `DAWINOS_FB_ID_TOKEN` expires after ~1 hour — when calls start failing with 401, re-mint the ID token (see "Refreshing the staff token" above), update the value in this config, and restart Claude Desktop.

If you already have other entries in `mcpServers`, just add `"dawinos"` alongside them.

### 3. Restart Claude Desktop

Quit completely (Cmd+Q on Mac) and reopen.

### 4. Verify

Look for the **hammer icon** in the bottom-right of the chat input. Click it — 14 DawinOS tools should appear.

---

## Option C — MCP Inspector (testing / debugging)

Interactive browser UI, no installation required:

```bash
npx @modelcontextprotocol/inspector \
  npx mcp-remote \
  https://us-central1-dawinos.cloudfunctions.net/dawinos_mcp \
  --header "Authorization: Bearer $DAWINOS_MCP_TOKEN" \
  --header "x-dawinos-firebase-auth: Bearer $DAWINOS_FB_ID_TOKEN"
```

Opens at `http://localhost:5173`. Use the **Tools** tab to browse and call the tools with custom inputs.

---

## Option D — Local stdio (development only)

Run the server locally against production Firestore.

### Prerequisites

- Node.js 20+
- Firebase service account JSON with Firestore read access

### Setup

```bash
cd dawinos-mcp-server
npm install
npm run build
```

### Run

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# stdio mode (default) — for Claude Desktop / Claude Code
node dist/index.js

# HTTP mode — for local curl/Inspector testing
TRANSPORT=http node dist/index.js

# Custom port
TRANSPORT=http PORT=3000 node dist/index.js
```

### Add to Claude Code (local)

```bash
claude mcp add dawinos-local \
  -- node /path/to/dawinos-mcp-server/dist/index.js
```

### Add to Claude Desktop (local)

```json
{
  "mcpServers": {
    "dawinos-local": {
      "command": "node",
      "args": ["/path/to/dawinos-mcp-server/dist/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

---

## Available Tools

The full live list is the source of truth — call `tools/list` over JSON-RPC, or run `/mcp` inside Claude Code to see what your install can actually invoke. The table below is a non-exhaustive sample of the read-only surface in the default (mutations-blocked) configuration:

| Tool | Description |
|------|-------------|
| `dawinos_list_purchase_orders` | List POs with filters (status, supplier, project, date range) |
| `dawinos_get_purchase_order` | Full PO detail including line items |
| `dawinos_po_spend_analysis` | Spend breakdown by supplier, month, or status |
| `dawinos_list_manufacturing_orders` | List MOs with filters (status, stage, priority, project) |
| `dawinos_get_manufacturing_order` | Full MO detail with BOM, consumptions, stage history |
| `dawinos_production_summary` | Production counts by status and stage, overdue alerts |
| `dawinos_search_inventory` | Search inventory items by name/SKU/category/low-stock flag |
| `dawinos_get_finish_library` | Browse finish library (wood, paint, laminates, etc.) |
| `dawinos_stock_levels` | Current stock levels by item or warehouse |
| `dawinos_list_stock_adjustments` | Stock adjustment history with line items |
| `dawinos_list_project_funds` | List advisory projects with budget summaries |
| `dawinos_get_project_fund` | Full advisory project with budget, progress, accountability |
| `dawinos_project_expenditures` | List allocation groups / expenditures for a project |
| `dawinos_accountability_summary` | Portfolio accountability roll-up across projects |

Additional modules registered: BOQ, finance (cash flow, spend plans, market intelligence), finishes, design manager, matflow formulas, strategy review, business memory, and AI assistant tools (procurement advisor, CFO briefing, OCR, cross-module query, strategy research). Mutating tools (`*_create_*`, `*_update_*`, `*_delete_*`, etc.) are visible in `tools/list` but blocked by the server unless the deployment sets `DAWINOS_MCP_ALLOW_MUTATIONS=true`.

---

## Example Prompts

Once connected, try asking:

```
Show me all open purchase orders from the last 30 days

What manufacturing orders are currently overdue?

Which inventory items are below reorder level?

Give me an accountability summary for all active advisory projects

What did we spend with each supplier last month?
```

---

## Troubleshooting

**Tools don't appear in Claude Desktop**
- Confirm you fully quit and restarted (Cmd+Q, not just closing the window)
- Validate the JSON config (no trailing commas, balanced braces)
- Run the MCP Inspector to confirm the server responds

**"Internal Server Error" from the endpoint**
- Cloud Function may be cold-starting — wait a few seconds and retry
- Check logs: `firebase functions:log --only dawinos_mcp`

**401 with body `{"error":"Unauthorized"}`**
- The shared service token is missing or wrong. Re-check that `--header "Authorization: Bearer …"` is set and matches `DAWINOS_MCP_BEARER_TOKEN`.

**401 with body `{"error":"Missing staff identity token"}`**
- The bearer is fine but the `x-dawinos-firebase-auth` header is absent. Add `--header "x-dawinos-firebase-auth: Bearer $DAWINOS_FB_ID_TOKEN"` (or the equivalent in your client config).

**401 with body `{"error":"Invalid staff identity token"}`**
- The Firebase ID token is malformed or expired. Re-mint it from the browser console (see "Get your Firebase ID token") and update your env / config.

**403 with body `{"error":"Forbidden: staff role required"}`**
- Your account is signed in but doesn't have the `staff: true` (or `admin: true`) custom claim. Ask an admin to set it via the user-management tooling.

**403 with body `{"error":"Forbidden: user not allowlisted"}`**
- `DAWINOS_MCP_ALLOWED_UIDS` is set on the function and your UID isn't in the list. Get an admin to add your UID, or have them clear the allowlist if it's no longer needed.

**503 with body `{"error":"Service misconfigured"}`**
- The Cloud Function is missing the `DAWINOS_MCP_BEARER_TOKEN` env var. A redeploy is needed by the DawinOS admin.

**"Not Acceptable" error on curl**
- Add the required Accept header: `-H "Accept: application/json, text/event-stream"`
- Full curl smoke test (replace tokens):
  ```bash
  curl -X POST https://us-central1-dawinos.cloudfunctions.net/dawinos_mcp \
    -H "Authorization: Bearer $DAWINOS_MCP_TOKEN" \
    -H "x-dawinos-firebase-auth: Bearer $DAWINOS_FB_ID_TOKEN" \
    -H "Accept: application/json, text/event-stream" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
  ```

**Empty results**
- The server queries live production Firestore
- Try removing status filters or increasing the `limit` parameter

---

## Re-deploying After Changes

```bash
# From the monorepo root
firebase deploy --only functions:dawinos_mcp
```

The `predeploy` hook in `firebase.json` automatically rebuilds `dawinos-mcp-server` and copies the dist into `functions/vendor/` before upload.
