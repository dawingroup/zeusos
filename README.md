# ZeusOS

**Operations platform for Zeus Group** — East Africa's leading consortium of award-winning marketing agencies.

ZeusOS is a hard fork of [DawinOS](https://github.com/dawingroup/dawinos), repurposed from a manufacturing/advisory platform into a marketing-agency operations system. It models Zeus Group's five sub-brands (Zeus The Agency, Zeus Digital, Labyrinth, Odd Gorilla, House of Zeus) as a single tenant with subsidiary-scoped access, sharing one user / client / supplier / finance backbone.

## Status: Phase 0 — Repo Bootstrap

Initial import from DawinOS@`80364790` (May 2026). The codebase still contains DawinOS construction/manufacturing modules that will be stripped in Phase 1.

Full work plan: `/Users/danielonzimai/.claude/plans/we-have-onboarded-a-lovely-planet.md`.

## Stack

- React 18 + TypeScript 5
- Vite (dev + build)
- Firebase: Firestore, Auth, Cloud Functions (Node 20), Storage, Hosting
- Tailwind CSS + Radix UI
- React Query + Zustand
- MCP server for AI tool integration (rename from `dawinos-mcp-server` → `zeusos-mcp-server` pending Phase 1)

## Getting started

```bash
# Install
npm install

# Env values for the zeusos Firebase project already live in .env (gitignored).
# Worktrees: copy the parent .env in before running.

# Dev server (port 3000)
npm run dev

# Build
npm run build

# Deploy to prod
npx firebase deploy --project zeusos

# Deploy preview/staging channel
firebase hosting:channel:deploy preview-staging --project zeusos
```

## Firebase

- Project ID: `zeusos`
- Project number: `746031933844`
- Web App ID: `1:746031933844:web:fa40998c6f63e0bed88781`
- Hosting channels: `live` (prod), `preview-staging` (staging)

## Modules

### Keeping (light edits only)
Users, Roles, HR Central, Finance, Procurement, Suppliers, CRM, Strategy, Assets, Compliance, Customer Hub, Admin, Executive Dashboard.

### Removing in Phase 1
Design Manager (replaced), Finishes, Cutlist, Inventory, Manufacturing, Construction, Fulfillment.

### Building new (Phase 3+)
Campaign & Job Manager (replaces Design Manager), Media Plan & Buying, Production, Talent / Freelancer Roster, Creative Asset Library.

## Sub-brands

| ID | Name | Description |
|---|---|---|
| `zeus-the-agency` | Zeus The Agency | Flagship 360° Ugandan advertising agency |
| `zeus-digital` | Zeus Digital | Digital-focused offshoot |
| `labyrinth` | Labyrinth | Audio & visual content studio |
| `odd-gorilla` | Odd Gorilla | Conflict agency for same-category clients |
| `house-of-zeus` | House of Zeus | Kenya market expansion |

## License

Proprietary — Zeus Group internal use only.
