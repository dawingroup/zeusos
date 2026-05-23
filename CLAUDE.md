# ZeusOS — Claude Code Project Guide

## What this is

ZeusOS is a hard fork of DawinOS, repurposed as the internal operations platform for **Zeus Group**, an East African marketing consortium (5 sub-brands: Zeus The Agency, Zeus Digital, Labyrinth, Odd Gorilla, House of Zeus). Initial import is a verbatim copy of DawinOS at commit `80364790`; Phases 1–5 strip the construction/manufacturing modules and replace the Design Manager with a marketing-agency-shaped Campaign & Job Manager.

Source of truth for the work plan: `/Users/danielonzimai/.claude/plans/we-have-onboarded-a-lovely-planet.md`.

Domain model overview (Tech Spec v1.0 + plan §14): [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md).

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
- **Firestore region:** `europe-west1` (Spark / free tier)
- **Production URL:** `https://os.zeustheagency.com` (custom domain — see `docs/CUSTOM_DOMAIN_SETUP.md` for DNS + Auth steps)
- **Default Firebase URL:** `https://zeusos.web.app` (still works — Firebase keeps both alive)
- `.firebaserc` already points at `zeusos`.

`.env` is gitignored and holds the Vite-side Firebase keys (see `.env.example`). The Firebase web API key is **safe to commit** in principle (security is enforced by Firestore Rules + Auth domain restrictions), but we keep it in `.env` per convention. Worktrees need their own `.env`:
```bash
cp /Users/danielonzimai/Developer/zeusos/.env "$PWD/.env"
```

## Branch protection

**Integration branch:** `main`. All PRs target `main`. (`phase-3e-delivery-workspace` was the integration branch earlier in the project — see [PR #11](https://github.com/dawingroup/zeusos/pull/11) — and has since been retired.)

Direct commits to integration branches are blocked by a `pre-commit` hook in `.githooks/pre-commit`. Protected branches: `main`, `master`.

**One-time setup per clone / worktree** (the hook lives in the tree but `core.hooksPath` is a local-only config):
```bash
git config core.hooksPath .githooks
```

**Workflow:** `git switch -c <feature-branch>` → commit → push → `gh pr create`.

**Emergency bypass** (use sparingly; explain why in the commit message):
```bash
ALLOW_DIRECT_COMMIT=1 git commit ...
```

To change the list of protected branches, edit the `PROTECTED_BRANCHES` array in `.githooks/pre-commit`.

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
- Firestore collections to be aware of: `users`, `organizations/{orgId}/users`, and the legal-entity Organization records at `organizations/{orgId}` (Phase 3.A.5 seed — see `scripts/seed-zeus-legal-entities.cjs`). Phase 3.A.5 also renamed the engagement-level collection `campaigns` → `master_jobs` (Phase 2.D's earlier rename of `advisory_projects` → `campaigns` is now superseded).
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
