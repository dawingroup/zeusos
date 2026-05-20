# Publishing case studies to Shopify

DawinOS Marketing → Case Studies has a **Publish to Shopify** button that
creates (or updates) a blog article in the `projects` blog on
dawinfinishes.com, using the `article.project` theme template.

Backed by the `shopifyPublishCaseStudy` callable Cloud Function.

## One-time setup

### 1. Extend the existing operations app's scopes

DawinOS already has a Shopify custom app installed for product/order/inventory
sync. Its access token lives at `systemConfig/shopifyConfig.accessToken` and is
reused here — **no new app, no new token rotation**.

The existing token has scopes for products, orders, customers, inventory, and
locations. It almost certainly does **not** have content scopes. Add them:

1. Shopify admin → **Settings → Apps and sales channels → Develop apps**.
2. Open the existing DawinOS app (the one that owns the current
   `systemConfig/shopifyConfig.accessToken`).
3. **Configuration → Admin API integration → Edit**. Add:
   - `read_content`, `write_content` — blogs, articles, article metafields
   - `read_files`, `write_files` — future gallery upload pipeline
4. **Save**, then **Install app** again. Shopify regenerates the token with
   the new scopes.
5. **Copy the new token** and update `systemConfig/shopifyConfig.accessToken`
   in Firestore (it may be the same string, may not — verify).

> Sanity check: after the update, `curl -H "X-Shopify-Access-Token: <token>"
> https://<shop>.myshopify.com/admin/api/2024-01/blogs.json` should return
> a `blogs` array (possibly empty). If it returns 401/403, the new scopes
> didn't apply — repeat step 4.

### 2. Confirm `systemConfig/shopifyConfig` is intact

The function reads from the same doc the other Shopify integrations use:

```jsonc
// systemConfig/shopifyConfig
{
  "shopDomain": "dawinfinishes.myshopify.com",   // existing
  "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxxxxx", // possibly refreshed in step 1.5
  "webhookSecret": "...",       // existing, used by order webhooks
  "enquirySecret": "..."        // existing, used by project enquiry webhook
}
```

No new fields are required. The function fails with a `failed-precondition`
error if either `shopDomain` or `accessToken` is missing.

### 3. Shopify theme + blog setup

These are already covered in the theme repo's setup doc — repeated here
for completeness:

1. Create a blog with handle `projects` (Online Store → Blog posts →
   Manage blogs).
2. Define article metafields under namespace `project`. See
   [shopify-project-blog.md](../../../dawinfinishes-com/docs/integrations/shopify-project-blog.md)
   in the theme repo for the exact list.
3. Make sure the theme has `templates/article.project.json` deployed
   (it ships via GitHub sync).

## How it works

When a user clicks **Publish to Shopify** on a saved case study:

1. The frontend calls the `shopifyPublishCaseStudy` callable (auth via
   Firebase ID token).
2. The function loads the case study from Firestore.
3. It looks up the `projects` blog id via the Admin API.
4. If the case study has no `shopifyArticleId` → POST a new article with
   inline metafields.
5. If it has one → PUT to update the article, then upsert each metafield
   individually (Shopify quirk: PUT doesn't accept inline metafields).
6. It writes `shopifyArticleId`, `shopifyPageHandle`, `shopifyPageUrl`,
   `lastPublishedAt`, `publishedBy` back to the case study. If
   `publish=true` (default), `status` is set to `published`.

## Field mapping

| Case study field           | Shopify article location                          |
|----------------------------|---------------------------------------------------|
| `hero.title`               | `article.title`                                   |
| `narrative.body`           | `article.body_html`                               |
| `hero.summary`             | `article.summary_html` + metafield `project.summary` |
| `hero.imageUrl`            | `article.image.src`                               |
| `handle`                   | `article.handle`                                  |
| `category` + `tags`        | `article.tags` (category first, then tags)        |
| `hero.eyebrow`             | metafield `project.eyebrow`                       |
| `hero.client`              | metafield `project.client`                        |
| `hero.location`            | metafield `project.location`                      |
| `hero.year`                | metafield `project.year`                          |
| `hero.scope`               | metafield `project.scope`                         |
| `quote.quote`              | metafield `project.quote_body`                    |
| `quote.attribution`        | metafield `project.quote_attribution`             |
| `materials[].label`        | metafield `project.materials` (list)              |
| `category`                 | metafield `project.tag` (card badge)              |

`gallery.imagePaths[]` is **not** mapped in v1 — Shopify file-reference
metafields require uploading via the Files API first. Editors can
upload gallery images directly in Shopify admin until that pipeline is
built. Hero image must be hosted at a publicly-reachable URL (Firebase
Storage with public read works).

## Operational notes

- Failure modes return a structured `HttpsError`:
  - `unauthenticated` — no Firebase auth context
  - `invalid-argument` — missing `caseStudyId`
  - `not-found` — case study doesn't exist
  - `failed-precondition` — Shopify config missing, blog not created
  - `internal` — Shopify Admin API call failed (full response in message)
- The function uses `firebase-functions/v2`, region `us-central1`,
  timeout 120s, memory 512MiB.
- The function is registered as `exports.shopifyPublishCaseStudy` in
  `functions/index.js`.

## Smoke test

After deploy, exercise it from the Firebase Functions emulator or via
the deployed callable (requires an authenticated session in the app).
A minimal manual test:

1. Sign in to `https://dawinos.web.app/marketing/case-studies`.
2. Create a case study with: title, handle, hero.imageUrl (public URL),
   narrative.body. Save as draft.
3. Reopen the case study → click **Publish to Shopify**.
4. Expect a green success banner with the live URL
   (`https://dawinfinishes.com/blogs/projects/<handle>`).
5. Reopen the article in Shopify admin to confirm tags + metafields.
