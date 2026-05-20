# ZeusOS — Claude Code Project Guide

## What this is

ZeusOS is a hard fork of DawinOS, repurposed as the internal operations platform for **Zeus Group**, an East African marketing consortium (5 sub-brands: Zeus The Agency, Zeus Digital, Labyrinth, Odd Gorilla, House of Zeus). Initial import is a verbatim copy of DawinOS at commit `80364790`; Phases 1–5 strip the construction/manufacturing modules and replace the Design Manager with a marketing-agency-shaped Campaign & Job Manager.

Source of truth for the work plan: `/Users/danielonzimai/.claude/plans/we-have-onboarded-a-lovely-planet.md`.

## Build & Deploy

- **Stack:** Vite + React + TypeScript + Firebase (Firestore, Auth, Functions, Hosting, Storage)
- **Dev server:** `npm run dev` (port 3000)
- **Build:** `npx vite build`
- **Deploy:** `npx firebase deploy --only hosting --project zeusos`
- **Preview channel (staging):** `firebase hosting:channel:deploy preview-staging --project zeusos`

## Firebase

- **Project ID:** `zeusos`
- **Project number:** `746031933844`
- **Web App ID:** `1:746031933844:web:fa40998c6f63e0bed88781`
- **Storage bucket:** `zeusos.firebasestorage.app`
- `.firebaserc` already points at `zeusos`.

`.env` is gitignored and holds the Vite-side Firebase keys (see `.env.example`). The Firebase web API key is **safe to commit** in principle (security is enforced by Firestore Rules + Auth domain restrictions), but we keep it in `.env` per convention. Worktrees need their own `.env`:
```bash
cp /Users/danielonzimai/Developer/zeusos/.env "$PWD/.env"
```

## Phase status (Phase 0 in progress)

- ✅ Source copied from DawinOS@80364790
- ✅ Firebase project wired (`.firebaserc`, `.env`)
- ⏳ Initial git commit
- ⏳ `npm install` + boot verification
- ❌ Phase 1: strip construction modules, rebrand
- ❌ Phase 2: subsidiary setup, retained modules smoke test
- ❌ Phase 3: Campaign & Job Manager (new core module)
- ❌ Phase 4: Media Plan, Production, Talent Roster
- ❌ Phase 5: AI/MCP rebuild, executive dashboard, go-live

## Inherited DawinOS conventions

- Feature modules live in `src/modules/<module-name>/`
- Subsidiary scoping via `SubsidiaryAccess` on each user — ZeusOS uses keys `zeus-the-agency`, `zeus-digital`, `labyrinth`, `odd-gorilla`, `house-of-zeus`
- Firestore collections to be aware of: `users`, `organizations/{orgId}/users`, `advisory_projects` (will rename → `campaigns` in Phase 2)
- MCP server lives in `dawinos-mcp-server/` until Phase 1 rename to `zeusos-mcp-server`

## Modules being removed in Phase 1

Construction/millwork-specific — do NOT extend or fix bugs in these, just remove:
- `src/modules/design-manager/`
- `src/subsidiaries/finishes/`
- `src/modules/cutlist-processor/`
- `src/modules/inventory/`
- `src/modules/manufacturing/`
- `src/modules/construction/`
- `src/modules/fulfillment/`
- All Three.js / 3D viewer dependencies

## Modules being kept

Users, Auth, Roles, HR Central, Finance, Procurement, Suppliers, CRM, Strategy, Assets, Compliance, Customer Hub, Admin, Executive Dashboard — these carry over with light branding edits only.

## New modules being built

`src/modules/campaigns/` (P0), `src/modules/media/` (P0), `src/modules/production/` (P1), `src/modules/talent/` (P1), `src/modules/asset-library/` (P1).
