# Handoff — DawinOS ↔ Shopify storefront integration

**To**: `claude/great-hawking-98afa5` (DawinOS-side build)
**From**: `claude/romantic-elion-9cfc8a` (storefront-side build, complete)
**Date**: 2026-05-17
**Status**: Storefront scaffolding live on theme #186267173169. DawinOS-side
build now needed.

---

## TL;DR — what you're picking up

The Shopify storefront side of the DawinOS ↔ Dawin Finishes data pipe is
**built and live**. Schema, metaobject specs, JSON-LD layer, metaobject
templates, and the `/llms.txt` generator are all in place — but they're
*empty containers*. Your job is to build the DawinOS side that fills them.

Specifically, you need to:

1. **Create the 6 Shopify metaobject definitions** from the JSON specs in
   [`docs/integrations/metaobjects/`](../integrations/metaobjects/).
2. **Build DawinOS publishers** that push data from the relevant modules
   (design, marketing, finishes, manufacturing, materials) into Shopify via
   the Admin GraphQL API.
3. **Build DawinOS webhook listeners** that receive the inbound storefront
   forms (start-a-project, sample-order, newsletter).
4. **Wire image upload** from DawinOS asset storage to Shopify CDN on publish.

You do **not** need to touch the theme files. If you find a mismatch between
the schema doc and theme code, that's a bug in this handoff — raise it.

---

## 1. Read these first, in this order

1. [`docs/integrations/dawinos-storefront-schema.md`](../integrations/dawinos-storefront-schema.md)
   — the canonical schema. §4 has every field. §10 covers the SEO/LLM layer
   you'll need to feed.
2. [`docs/integrations/metaobjects/`](../integrations/metaobjects/) — 6 JSON
   files, one per metaobject type. These are the contract.
3. This file (the handoff).
4. The Shopify Admin GraphQL Reference for
   [`metaobjectDefinitionCreate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/metaobjectDefinitionCreate),
   [`metaobjectCreate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/metaobjectCreate),
   [`metaobjectUpdate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/metaobjectUpdate),
   [`fileCreate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate).

---

## 2. Repos & branch coordination

| Branch                              | Owner          | Status        |
| ----------------------------------- | -------------- | ------------- |
| `main`                              | (merge target) | Up-to-date    |
| `claude/romantic-elion-9cfc8a`      | this session   | **Complete**, ready to merge once you review |
| `claude/great-hawking-98afa5`       | **you**        | To start      |

The storefront work lives on `claude/romantic-elion-9cfc8a` (this worktree).
The 27-task mobile UX refit + the metaobject scaffolding all sit on that
branch. Final commit before this handoff: storefront ready for DawinOS
data — verify with `git log claude/romantic-elion-9cfc8a` once your session
spins up.

You should branch from `main` (after this work merges) so you start with
the metaobject scaffolding in place. **Do not edit theme files** on your
branch unless coordinated — the storefront side is feature-complete.

---

## 3. Live theme context

- **Store**: `dawin-finishes.myshopify.com`
- **Published theme**: `Staging (GitHub main)` — **id `186267173169`**
- **Push command** (only if you absolutely need to touch theme files):
  ```sh
  shopify theme push --store=dawin-finishes.myshopify.com \
    --theme=186267173169 --only=<path> --nodelete --allow-live
  ```
- **GitHub bridge**: Shopify auto-syncs admin edits back to `origin/main`
  (`config/settings_data.json` is admin-authoritative).

You should not need to push the theme. Your work is on the Shopify Admin API
side (metaobjects, products, files) and the DawinOS service that calls it.

---

## 4. What you need to build, in order

### Step 1 — Create the 6 metaobject definitions in Shopify

Use the JSON specs in [`docs/integrations/metaobjects/`](../integrations/metaobjects/)
as the source of truth. Each file describes a metaobject definition:
type, capabilities, field_definitions with validations.

**Two ways to create them**:

- **(A) Manually via admin**: Settings → Custom data → Metaobjects → Add
  definition. Slower, manual, easy to miss a validation.
- **(B) Programmatically via `metaobjectDefinitionCreate`** mutation —
  recommended. Write a small DawinOS bootstrap script that reads the 6 JSON
  files and creates each definition. Idempotent: check by `type` before
  create.

Order matters for cross-references:

1. `material` (no refs)
2. `voice` (no refs to other dawin metaobjects yet — `project_ref` is added later)
3. `press_mention` (no refs)
4. `featured_update` (refs `project` — create after #5 or defer ref field)
5. `finish` (refs `material`, `project` — create after material; defer the
   `projects_used_in` field until projects exist)
6. `project` (refs `finish`, `material`, `press_mention`, and Shopify
   product type)

Once all 6 are created, go back and add the deferred ref fields
(circular refs need both sides to exist first).

### Step 2 — Wire image upload pipeline

DawinOS originates most images. Convention (per schema §6):

- DawinOS keeps the original (raw, full-resolution) in its own asset storage.
- On publish, DawinOS calls Shopify `fileCreate` mutation with the image,
  filename `<entity-type>-<dawin-source-id>-<slot>.jpg`, and alt text
  embedding the DawinOS asset ID:
  > "Walnut credenza · DAW-IMG-aef3b2"
- Returned Shopify GID is stored back in DawinOS so the next publish updates
  the same file instead of creating duplicates.
- Use `image/webp` or `image/jpeg` at max 2400px on the long edge. Shopify
  CDN serves AVIF/WebP on response.

### Step 3 — Build DawinOS → Shopify publishers

One publisher per content type. Each is event-driven (DawinOS internal
event bus) plus a daily reconciler.

| DawinOS event                            | Shopify action                                              |
| ---------------------------------------- | ----------------------------------------------------------- |
| `design.project.published`               | `metaobjectCreate` or `metaobjectUpdate` for `project`      |
| `design.project.updated`                 | `metaobjectUpdate` for `project`                            |
| `finishes.entry.published`               | `metaobjectCreate/Update` for `finish`                      |
| `finishes.entry.updated`                 | `metaobjectUpdate` for `finish`                             |
| `marketing.featured_update.scheduled`    | `metaobjectCreate` for `featured_update`                    |
| `marketing.voice.featured_changed`       | `metaobjectUpdate` for `voice`                              |
| `marketing.press_mention.added`          | `metaobjectCreate` for `press_mention`                      |
| `materials.entry.added`                  | `metaobjectCreate/Update` for `material`                    |
| `inventory.item.published`               | `productUpdate` for the Shopify product + metafields        |
| `inventory.item.stock_changed`           | `inventoryAdjustQuantity`                                   |
| `manufacturing.order.stage_changed`      | `productUpdate` on related product's `dawin.workshop_status` |

Each publisher must:

- Idempotency check via `dawin_source_id` (lookup-then-create-or-update).
- Cap concurrent writes (Shopify Admin API: 50 points/sec bucket; metafield
  + metaobject ops cost 10 pts each).
- Retry with jittered backoff on 429/5xx.
- Emit a structured log per publish (entity, dawin_id, shopify_gid, action,
  duration_ms).

### Step 4 — Build the inbound webhook listeners (storefront → DawinOS)

The storefront posts three things to DawinOS via webhook:

1. **Custom-quote intake** (Start a Project form) — see schema §4.9 for the
   payload. The storefront submits via Shopify contact form; DawinOS needs
   to either:
   - Poll Shopify Notifications API for contact submissions tagged with
     `start-project`, or
   - Set up a Shopify Flow workflow that posts the payload to a DawinOS
     endpoint (recommended).
2. **Sample-order request** — webhook payload per schema §4.10.
3. **Newsletter subscribe** — Shopify `customer.create` with tag
   `newsletter`; DawinOS marketing module subscribes them to the campaign
   tool.

Endpoint contract (recommended):

```
POST https://<dawinos-host>/api/intake/<type>
Headers:
  X-Dawin-Signature: hmac-sha256(<webhook-secret>, body)
  Content-Type: application/json
Body: per-type JSON (matches schema §4.9 / §4.10)
Response: { "ticket_id": "DF·PROJ·26W19·001", "received_at": "..." }
```

### Step 5 — Sync the `/llms.txt` page

Once metaobjects start landing, the storefront's [`dawin-llms-txt`
section](../../sections/dawin-llms-txt.liquid) renders the index live from
published metaobjects. You need to:

1. Create the page in Shopify admin: Online Store → Pages → New page,
   handle `llms-txt`, template `llms-txt`. Title can be "Dawin LLM index".
2. Add a URL redirect: Online Store → Navigation → URL redirects,
   `/llms.txt` → `/pages/llms-txt`.
3. Confirm at least one published project + finish renders correctly at
   `/llms.txt`.

### Step 6 — Verify SEO surfaces

- `/robots.txt` allows `GPTBot`, `ClaudeBot`, `PerplexityBot`,
  `Google-Extended`, `CCBot`. Default Shopify allows all; verify in
  Online Store → Preferences.
- `/sitemap.xml` includes the metaobjects. Once `online_store.enabled` is
  true on the metaobject definition, Shopify includes them automatically.
- Submit `/sitemap.xml` to Google Search Console + Bing Webmaster Tools.
- IndexNow ping on publish (Bing has an endpoint Shopify can fire; the
  DawinOS publisher can also POST to `https://api.indexnow.org/indexnow`
  with the new URL).

---

## 5. Files this session shipped (don't edit unless coordinated)

### Schema + specs

- [`docs/integrations/dawinos-storefront-schema.md`](../integrations/dawinos-storefront-schema.md) — canonical schema
- [`docs/integrations/metaobjects/project.json`](../integrations/metaobjects/project.json)
- [`docs/integrations/metaobjects/finish.json`](../integrations/metaobjects/finish.json)
- [`docs/integrations/metaobjects/material.json`](../integrations/metaobjects/material.json)
- [`docs/integrations/metaobjects/featured_update.json`](../integrations/metaobjects/featured_update.json)
- [`docs/integrations/metaobjects/voice.json`](../integrations/metaobjects/voice.json)
- [`docs/integrations/metaobjects/press_mention.json`](../integrations/metaobjects/press_mention.json)

### Theme files (already live)

- [`templates/metaobject.project.liquid`](../../templates/metaobject.project.liquid) — URL-addressable project page
- [`templates/metaobject.finish.liquid`](../../templates/metaobject.finish.liquid) — URL-addressable finish page
- [`templates/page.llms-txt.json`](../../templates/page.llms-txt.json) — `/pages/llms-txt` template
- [`sections/dawin-metaobject-project.liquid`](../../sections/dawin-metaobject-project.liquid) — renderer
- [`sections/dawin-metaobject-finish.liquid`](../../sections/dawin-metaobject-finish.liquid) — renderer
- [`sections/dawin-llms-txt.liquid`](../../sections/dawin-llms-txt.liquid) — llms.txt generator
- [`snippets/dawin-jsonld-organization.liquid`](../../snippets/dawin-jsonld-organization.liquid) — site-wide Org/Place/WebSite schema
- [`snippets/dawin-jsonld-project.liquid`](../../snippets/dawin-jsonld-project.liquid) — per-project CreativeWork schema
- [`snippets/dawin-jsonld-finish.liquid`](../../snippets/dawin-jsonld-finish.liquid) — per-finish Product schema
- [`snippets/dawin-meta-tags.liquid`](../../snippets/dawin-meta-tags.liquid) — canonical + OG + Twitter cards
- [`layout/theme.liquid`](../../layout/theme.liquid) — wires the org JSON-LD into every page

### Theme files you may extend (with coordination)

- Existing dawin sections that currently render hard-coded blocks
  (home-finish-library, home-today, home-press, home-voices,
  projects-portfolio) will eventually swap to metaobject reads. The
  inline block blocks stay as a fallback. **Adding metaobject reads to
  these sections is shared work** — flag in your handoff back.

---

## 6. Auth model (suggested)

DawinOS needs **one Shopify Admin API token** scoped to:

- `read_products, write_products`
- `read_files, write_files`
- `read_metaobjects, write_metaobjects`
- `read_metaobject_definitions, write_metaobject_definitions`
- `read_inventory, write_inventory`
- `read_translations, write_translations` *(once locales land)*

Recommend a **single private app** named "DawinOS Sync" in Shopify admin
with the above scopes; rotate token quarterly. Store in DawinOS secrets
as `SHOPIFY_ADMIN_TOKEN_DAWINFINISHES`.

Inbound webhooks from Shopify → DawinOS use a separate HMAC secret stored
as `SHOPIFY_WEBHOOK_SECRET_DAWINFINISHES`.

---

## 7. Test plan — how we verify end-to-end

Build one full vertical slice first, then scale. Suggested first slice:

1. **Pick one finish** (`Kyambogo Bone`) and create the `finish` metaobject
   definition + one record.
2. Confirm `https://dawinfinishes.com/finishes/kyambogo-bone` renders with
   the dawin design (this validates the storefront template).
3. View page source — confirm the `<script type="application/ld+json">`
   block emits the `Product` schema with the color + sample offer.
4. Run [Google Rich Results Test](https://search.google.com/test/rich-results)
   on the URL — should pass for `Product`.
5. Confirm `https://dawinfinishes.com/sitemap.xml` includes
   `/finishes/kyambogo-bone`.

Repeat for one `project` record. Then expand to the full set (64 finishes,
20–30 projects).

---

## 8. Open questions that still need decisions

These were flagged in the schema doc and are blockers for some of the
above. Resolve before going wide:

1. **Image hosting model**: DawinOS retains originals, Shopify CDN holds
   delivery copies. Confirmed direction; needs implementation detail —
   what filenames, what alt-text format, what cleanup on delete?
2. **Sample order**: storefront answer chose "webhook only for now"; when
   does it promote to real Shopify product SKUs? Trigger: when sample
   requests exceed `N/month` (need a number from ops).
3. **Multi-language**: Where in DawinOS does the Luganda/Swahili
   translation live? Shopify supports per-locale fields on metaobjects.
4. **Stock reconciliation rule**: If Shopify inventory and DawinOS
   inventory disagree, which wins? Suggested: DawinOS wins, with a
   `last_reconciled_at` field for audit.
5. **Press logos / client logos**: Should DawinOS marketing have a shared
   asset library so the same Speke Group logo isn't re-uploaded for every
   project? Storefront assumes yes (the `client_logo` field on `project`
   could be normalized to a metaobject ref).
6. **Auth scopes & rotation**: confirm the suggested single-app approach
   in §6 is acceptable, or split into two apps (catalogue + marketing).

---

## 9. Definition of done (for the DawinOS-side work)

The integration is complete when all of these are true:

- [ ] All 6 metaobject definitions exist in Shopify admin with all fields
      per the JSON specs
- [ ] DawinOS publishers run on event for at least: project, finish,
      featured_update, voice, press_mention, material, inventory item
- [ ] One end-to-end test: create a project in DawinOS → it appears at
      `/projects/{handle}` within 60 seconds with full JSON-LD
- [ ] One end-to-end test: change a manufacturing order stage in DawinOS →
      the related product's `dawin.workshop_status` metafield updates
      within 60 seconds
- [ ] Inbound webhook: storefront start-project form submits → DawinOS
      design intake creates a ticket
- [ ] `/llms.txt` renders the live published metaobjects
- [ ] `/sitemap.xml` includes all published metaobject URLs
- [ ] Google Rich Results Test passes on a sample project and finish URL
- [ ] Auth tokens stored in DawinOS secrets, not committed
- [ ] Publisher logs are structured and queryable for ops

---

## 10. Hand-back protocol

When you complete the work (or hit a blocker requiring storefront
changes), write a handoff back at
`docs/handoffs/dawinos-handback-<your-branch-suffix>.md` with:

- What you shipped on the DawinOS side
- Which Shopify Admin API surfaces you used and any quirks discovered
- Any metaobject spec deviations and why
- The full event → mutation mapping you actually implemented
- Any storefront-side changes needed (don't make them yourself; flag for
  the next storefront session)
- Test plan results: which slices passed, which need follow-up

---

*Storefront session sign-off: `claude/romantic-elion-9cfc8a` —
storefront scaffolding is complete and live. Theme push needed only for
hand-back changes from your end. Good luck.*
