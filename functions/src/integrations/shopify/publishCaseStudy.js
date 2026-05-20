/**
 * shopifyPublishCaseStudy
 *
 * Callable Cloud Function — publishes (or updates) a DawinOS Project Case Study
 * as a Shopify blog article in the "projects" blog, using the `article.project`
 * theme template.
 *
 * Input  (request.data): { caseStudyId: string, publish?: boolean }
 *   - publish=true  → article.published = true (default)
 *   - publish=false → article.published = false (unpublish without deleting)
 *
 * Output: { articleId, handle, url, isUpdate }
 *
 * Side effects on the case study doc:
 *   - status               → 'published' (only when publish=true)
 *   - shopifyArticleId
 *   - shopifyPageHandle    (article handle — keeps the field name from existing schema)
 *   - shopifyPageUrl       (article URL)
 *   - lastPublishedAt
 *   - publishedBy          (auth uid)
 *
 * Prerequisites (one-time, see docs/integrations/shopify-case-study-publish.md):
 *   1. systemConfig/shopifyConfig has { shopDomain, accessToken }
 *   2. Shopify blog with handle "projects" exists
 *   3. Article metafield definitions exist under namespace `project`
 *   4. Theme has templates/article.project.json deployed
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const SHOPIFY_API_VERSION = '2024-01';
const SHOPIFY_CONFIG_DOC = 'systemConfig/shopifyConfig';
const TARGET_BLOG_HANDLE = 'projects';
const TEMPLATE_SUFFIX = 'project';
const CASE_STUDIES_COLLECTION = 'projectCaseStudies';

async function shopifyFetch(config, path, init = {}) {
  const url = `https://${config.shopDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'X-Shopify-Access-Token': config.accessToken,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new HttpsError(
      'internal',
      `Shopify Admin API ${init.method || 'GET'} ${path} failed: ${res.status} ${body}`
    );
  }
  return body ? JSON.parse(body) : {};
}

async function shopifyGraphQL(config, query, variables) {
  const url = `https://${config.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': config.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new HttpsError('internal', `Shopify GraphQL failed: ${res.status} ${body}`);
  }
  const json = JSON.parse(body);
  if (json.errors) {
    throw new HttpsError('internal', `Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

/**
 * Upload each gallery image URL to Shopify Files via fileCreate
 * (with originalSource — Shopify fetches the image server-side from
 * the supplied Firebase Storage download URL). Returns the resulting
 * MediaImage GIDs that go into the `project.gallery` metafield.
 *
 * Failures on individual images are logged and skipped — the rest of
 * the publish proceeds. Returns [] if no images succeed.
 */
async function uploadGalleryToShopify(config, imageUrls, alt) {
  if (!imageUrls || imageUrls.length === 0) return [];

  const FILE_CREATE = `
    mutation FileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id alt fileStatus }
        userErrors { field message }
      }
    }
  `;

  const gids = [];
  for (const url of imageUrls) {
    try {
      const data = await shopifyGraphQL(config, FILE_CREATE, {
        files: [
          {
            originalSource: url,
            contentType: 'IMAGE',
            alt: alt || '',
          },
        ],
      });
      const errors = data.fileCreate?.userErrors || [];
      if (errors.length > 0) {
        logger.warn(`fileCreate userErrors for ${url}:`, errors);
        continue;
      }
      const file = data.fileCreate?.files?.[0];
      if (file?.id) {
        gids.push(file.id);
      }
    } catch (err) {
      logger.warn(`Failed to upload gallery image ${url}:`, err.message || err);
    }
  }
  return gids;
}

async function findBlogId(config) {
  const { blogs } = await shopifyFetch(config, `/blogs.json?handle=${TARGET_BLOG_HANDLE}`);
  const blog = (blogs || []).find((b) => b.handle === TARGET_BLOG_HANDLE);
  if (!blog) {
    throw new HttpsError(
      'failed-precondition',
      `Shopify blog with handle "${TARGET_BLOG_HANDLE}" not found. Create it in admin first ` +
        `(Online Store → Blog posts → Manage blogs → Add blog).`
    );
  }
  return blog.id;
}

/**
 * Build the article create/update payload from a case study.
 * `metafields` are inlined on create; on update they have to be PUT separately
 * (Shopify doesn't support inline metafield updates on PUT for some types).
 */
function buildArticlePayload(cs, opts) {
  const body = cs.narrative?.body || '';
  const summary = cs.hero?.summary || '';
  const heroImageUrl = cs.hero?.imageUrl || '';

  // First tag is the category; rest follow.
  const tagList = [cs.category, ...(cs.tags || [])]
    .filter(Boolean)
    .map((t) => String(t).trim())
    .filter((t) => t.length > 0);
  // Title-case the category tag for nicer display.
  if (tagList[0]) {
    tagList[0] = tagList[0].charAt(0).toUpperCase() + tagList[0].slice(1);
  }

  const article = {
    title: cs.hero?.title || 'Untitled project',
    body_html: body,
    summary_html: summary,
    tags: tagList.join(', '),
    template_suffix: TEMPLATE_SUFFIX,
    handle: cs.handle,
    published: opts.publish,
  };

  if (heroImageUrl) {
    article.image = { src: heroImageUrl };
  }

  return article;
}

/**
 * Map case study fields → Shopify metafield definitions.
 * For list metafields, value must be a JSON-encoded array string.
 */
function buildMetafieldPayloads(cs) {
  const out = [];

  const add = (key, value, type = 'single_line_text_field') => {
    if (value == null) return;
    const stringVal = typeof value === 'string' ? value : String(value);
    if (!stringVal.trim()) return;
    out.push({
      namespace: 'project',
      key,
      type,
      value: stringVal,
    });
  };

  add('summary', cs.hero?.summary);
  add('eyebrow', cs.hero?.eyebrow);
  add('client', cs.hero?.client);
  add('location', cs.hero?.location);
  add('year', cs.hero?.year);
  add('scope', cs.hero?.scope);
  add('tag', cs.category);
  add('quote_body', cs.quote?.quote);
  add('quote_attribution', cs.quote?.attribution);

  // Materials → list.single_line_text_field
  const materials = (cs.materials || [])
    .map((m) => (m && m.label ? String(m.label).trim() : ''))
    .filter(Boolean);
  if (materials.length > 0) {
    out.push({
      namespace: 'project',
      key: 'materials',
      type: 'list.single_line_text_field',
      value: JSON.stringify(materials),
    });
  }

  // Gallery is handled separately because it requires async Shopify Files
  // uploads (see uploadGalleryToShopify). The caller appends it to `out`
  // after collecting MediaImage GIDs.

  return out;
}

const shopifyPublishCaseStudy = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { caseStudyId, publish = true } = request.data || {};
    if (!caseStudyId || typeof caseStudyId !== 'string') {
      throw new HttpsError('invalid-argument', 'caseStudyId is required');
    }

    const db = getFirestore();

    // 1. Load case study
    const csRef = db.collection(CASE_STUDIES_COLLECTION).doc(caseStudyId);
    const csSnap = await csRef.get();
    if (!csSnap.exists) {
      throw new HttpsError('not-found', `Case study ${caseStudyId} not found`);
    }
    const cs = csSnap.data();

    if (!cs.handle) {
      throw new HttpsError('failed-precondition', 'Case study has no handle');
    }
    if (!cs.hero?.title) {
      throw new HttpsError('failed-precondition', 'Case study has no title');
    }

    // 2. Load Shopify config
    const configSnap = await db.doc(SHOPIFY_CONFIG_DOC).get();
    if (!configSnap.exists) {
      throw new HttpsError(
        'failed-precondition',
        `Shopify not configured. Set systemConfig/shopifyConfig with { shopDomain, accessToken }.`
      );
    }
    const config = configSnap.data();
    if (!config.shopDomain || !config.accessToken) {
      throw new HttpsError(
        'failed-precondition',
        'systemConfig/shopifyConfig is missing shopDomain or accessToken'
      );
    }

    // 3. Resolve blog id
    const blogId = await findBlogId(config);

    // 4. Build payloads
    const articlePayload = buildArticlePayload(cs, { publish });
    const metafieldPayloads = buildMetafieldPayloads(cs);

    // 4b. Upload gallery images to Shopify Files (one at a time — these are
    // tiny GraphQL calls and a few seconds total). Failures are logged and
    // the publish proceeds with the rest.
    const galleryUrls = (cs.gallery && cs.gallery.imagePaths) || [];
    if (galleryUrls.length > 0) {
      const galleryGids = await uploadGalleryToShopify(
        config,
        galleryUrls,
        cs.hero?.title
      );
      if (galleryGids.length > 0) {
        metafieldPayloads.push({
          namespace: 'project',
          key: 'gallery',
          type: 'list.file_reference',
          value: JSON.stringify(galleryGids),
        });
      }
    }

    // 5. Create or update
    let article;
    const isUpdate = Boolean(cs.shopifyArticleId);
    if (isUpdate) {
      const { article: updated } = await shopifyFetch(
        config,
        `/blogs/${blogId}/articles/${cs.shopifyArticleId}.json`,
        {
          method: 'PUT',
          body: JSON.stringify({ article: { id: cs.shopifyArticleId, ...articlePayload } }),
        }
      );
      article = updated;
    } else {
      // Inline metafields on create — Shopify accepts this for new articles.
      const { article: created } = await shopifyFetch(
        config,
        `/blogs/${blogId}/articles.json`,
        {
          method: 'POST',
          body: JSON.stringify({
            article: { ...articlePayload, metafields: metafieldPayloads },
          }),
        }
      );
      article = created;
    }

    // 6. On update, write metafields one-by-one (Shopify upserts by namespace+key).
    if (isUpdate) {
      for (const mf of metafieldPayloads) {
        try {
          await shopifyFetch(config, `/articles/${article.id}/metafields.json`, {
            method: 'POST',
            body: JSON.stringify({ metafield: mf }),
          });
        } catch (err) {
          // Common case on update: Shopify returns 422 "is already taken" for
          // existing keys — fall back to find-then-PUT.
          const list = await shopifyFetch(
            config,
            `/articles/${article.id}/metafields.json?namespace=${mf.namespace}&key=${mf.key}`
          );
          const existing = (list.metafields || [])[0];
          if (!existing) {
            logger.error(`Metafield ${mf.namespace}.${mf.key} POST failed and no existing found`, err);
            throw err;
          }
          await shopifyFetch(config, `/metafields/${existing.id}.json`, {
            method: 'PUT',
            body: JSON.stringify({
              metafield: { id: existing.id, type: mf.type, value: mf.value },
            }),
          });
        }
      }
    }

    // 7. Write back to case study doc
    const articleUrl = `https://${config.shopDomain}/blogs/${TARGET_BLOG_HANDLE}/${article.handle}`;
    const update = {
      shopifyArticleId: String(article.id),
      shopifyPageHandle: article.handle,
      shopifyPageUrl: articleUrl,
      lastPublishedAt: FieldValue.serverTimestamp(),
      publishedBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    };
    if (publish) {
      update.status = 'published';
    }
    await csRef.update(update);

    logger.info(
      `shopifyPublishCaseStudy: ${isUpdate ? 'updated' : 'created'} article ${article.id} ` +
        `for case study ${caseStudyId} (publish=${publish})`
    );

    return {
      articleId: String(article.id),
      handle: article.handle,
      url: articleUrl,
      isUpdate,
    };
  }
);

module.exports = { shopifyPublishCaseStudy };
