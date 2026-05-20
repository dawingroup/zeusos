# Shopify Integration — locked decisions

Companion to [`dawinos-storefront-schema.md`](./dawinos-storefront-schema.md) and [`../handoffs/dawinos-integration-handoff.md`](../handoffs/dawinos-integration-handoff.md). Captures the answers to the open questions in schema §9 and handoff §8 so future sessions don't re-litigate.

Date: 2026-05-17 · Session: `claude/great-hawking-98afa5`

---

## Locked (do not revisit without business signal)

### 1. Scope of this build
Full integration, Phase 0–9. All 6 metaobject types get publishers, triggers, and (where the source doesn't exist yet) new DawinOS source modules.

### 2. Missing source modules — build, don't skip
`voice`, `press_mention`, `featured_update` get minimal DawinOS source modules under `src/modules/marketing/` (collection + type + service + CRUD UI). This preserves DawinOS as single source of truth instead of forcing editors into the Shopify admin.

### 3. Project entity transport — metaobject replaces article
`projectCaseStudyService.publishCaseStudyToShopify()` is refactored to publish to the `project` **metaobject** (not the Shopify blog `projects` article). The old Cloud Function export `shopifyPublishCaseStudy` is kept as a one-release alias of `publishProjectMetaobject`, then removed.

### 4. Image hosting
- DawinOS retains originals in Firebase Storage (raw, full-resolution).
- On publish, the DawinOS publisher calls Shopify `fileCreate` with the public Firebase URL as `originalSource`. Shopify CDN fetches it server-side; no re-upload from DawinOS.
- Filenames: `<entity-type>-<dawin-source-id>-<slot>.jpg` (e.g. `finish-DAW-FIN-aef3b2-wall-preview.jpg`).
- Alt text format: `"<Entity name> · DAW-IMG-<asset-id>"` so DawinOS can reverse-lookup edits.
- Long edge ≤ 2400 px; format `image/webp` or `image/jpeg`. Shopify CDN serves AVIF/WebP on response.
- On DawinOS asset delete: trigger `fileDelete` mutation against the cached Shopify GID.

### 5. Auth model
- **One** Shopify private app: **"DawinOS Sync"**.
- Scopes: `read_products, write_products, read_files, write_files, read_metaobjects, write_metaobjects, read_metaobject_definitions, write_metaobject_definitions, read_inventory, write_inventory, read_translations, write_translations`.
- Token stored in Firestore `systemConfig/shopifyConfig.accessToken` (existing pattern; **not** migrated to env vars).
- Rotation: quarterly (calendar reminder; rotation is a manual ops step).
- Inbound HMAC secret stored separately at `systemConfig/shopifyConfig.webhookSecret`.

### 6. Stock reconciliation
DawinOS wins. Every catalogue push writes `dawin.last_reconciled_at` (ISO timestamp) onto the Shopify product so audits can spot drift.

### 7. Sample orders
Webhook-only intake to `sampleRequests` Firestore collection. Promotion to real Shopify product SKUs is **deferred** until ops can supply a monthly-volume threshold. Schema §4.10 is the contract today.

---

## Still open (must resolve before Phase 6)

These do not block Phase 1–5 but must be answered before voices / press / featured updates go wide.

### 8. Multi-language storage in DawinOS
**Status**: Unresolved. Until decided, publish English-only. Shopify metaobjects already mark `translatable: true` on every field, so per-locale data can be filled in after the fact without a schema change.

**Proposed**: a `translations` subcollection on each entity (`finishLibrary/{id}/translations/{locale}`) with the same shape as the parent doc. Publisher reads parent + locale subdocs in one batch and pushes per-locale field values via Shopify's `translationsRegister` mutation.

### 9. Press / client logo asset library
**Status**: Unresolved. Recommend a `marketingAssets` Firestore collection keyed by client/publication slug (e.g. `marketingAssets/speke-group`) storing a single logo URL + Shopify file GID per brand. Voice, press_mention, and project all reference by slug instead of re-uploading.

---

## One-time manual ops steps (not code)

These happen outside this repo. Tracked here so they don't get lost.

| Step                                                                                  | Owner       | Status   |
| ------------------------------------------------------------------------------------- | ----------- | -------- |
| Shopify private app exists with token in `systemConfig/shopifyConfig.accessToken`     | Studio Eng  | **Done** (used by existing inventory + article paths) |
| **Verify scopes** include `write_metaobjects`, `write_metaobject_definitions`, `write_files` (required by new code) | Studio Eng | Pending — likely needs scope-bump |
| Generate webhook HMAC secret; store at `systemConfig/shopifyConfig.webhookSecret`     | Studio Eng  | Pending  |
| Online Store → Pages → create page handle `llms-txt` with template `llms-txt`         | Studio Eng  | Pending  |
| Online Store → Navigation → URL redirect `/llms.txt` → `/pages/llms-txt`              | Studio Eng  | Pending  |
| Verify `/robots.txt` allows `GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot`| Studio Eng  | Pending  |
| Submit `/sitemap.xml` to Google Search Console + Bing Webmaster Tools                  | Studio Eng  | Pending  |
| Generate IndexNow key + host as `/{key}.txt` on the storefront                         | Studio Eng  | Pending  |

---

*Edits via PR. Discoveries that contradict a locked decision must update this doc and the schema doc in the same PR.*
