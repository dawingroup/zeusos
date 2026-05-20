/**
 * Shopify Product Update Webhook Handler
 * Triggers audit when products are created or updated in Shopify
 */

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const { ALLOWED_ORIGINS } = require('../config/cors');

/**
 * Verify Shopify webhook signature
 */
function verifyShopifyWebhook(req, secret) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  if (!hmac) return false;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash));
}

/**
 * Run product audit logic (same as in catalogAudit.js)
 */
function runProductAudit(shopifyProduct, config) {
  const issues = [];
  const categoryScores = {
    content_completeness: 100,
    seo_quality: 100,
    image_optimization: 100,
    schema_data: 100,
    brand_consistency: 100,
  };

  // Title check
  if (!shopifyProduct.title || shopifyProduct.title.length < 5) {
    issues.push({
      id: `title_${Date.now()}`,
      category: 'content_completeness',
      severity: 'critical',
      field: 'title',
      message: 'Title is missing or too short',
      autoFixAvailable: false,
    });
    categoryScores.content_completeness -= 25;
  }

  // Description check
  const descriptionLength = (shopifyProduct.body_html || '').replace(/<[^>]*>/g, '').length;
  if (descriptionLength < config.minDescriptionLength) {
    issues.push({
      id: `desc_short_${Date.now()}`,
      category: 'content_completeness',
      severity: 'high',
      field: 'body_html',
      message: `Description too short (${descriptionLength} chars)`,
      autoFixAvailable: true,
      fixAction: 'generate_description',
    });
    categoryScores.content_completeness -= 20;
  }

  // Image check
  const images = shopifyProduct.images || [];
  if (images.length < config.minImageCount) {
    issues.push({
      id: `img_count_${Date.now()}`,
      category: 'image_optimization',
      severity: 'high',
      field: 'images',
      message: `Insufficient images (${images.length}/${config.minImageCount})`,
      autoFixAvailable: false,
    });
    categoryScores.image_optimization -= 20;
  }

  // Check for alt text
  const missingAltText = images.filter(img => !img.alt || img.alt.trim() === '').length;
  if (missingAltText > 0) {
    issues.push({
      id: `img_alt_${Date.now()}`,
      category: 'seo_quality',
      severity: 'medium',
      field: 'images.alt',
      message: `${missingAltText} image(s) missing alt text`,
      autoFixAvailable: true,
      fixAction: 'generate_alt_text',
    });
    categoryScores.seo_quality -= 10;
  }

  // Brand terms check
  const bodyText = (shopifyProduct.body_html || '').toLowerCase();
  const titleText = (shopifyProduct.title || '').toLowerCase();
  const combinedText = `${titleText} ${bodyText}`;

  config.brandTerms.prohibited.forEach(term => {
    if (combinedText.includes(term.toLowerCase())) {
      issues.push({
        id: `brand_prohibited_${term}_${Date.now()}`,
        category: 'brand_consistency',
        severity: 'high',
        field: 'content',
        message: `Contains prohibited term: "${term}"`,
        autoFixAvailable: false,
      });
      categoryScores.brand_consistency -= 15;
    }
  });

  // Ensure scores don't go below 0
  Object.keys(categoryScores).forEach(key => {
    categoryScores[key] = Math.max(0, categoryScores[key]);
  });

  // Calculate weighted overall score
  const weights = {
    content_completeness: 0.30,
    seo_quality: 0.25,
    image_optimization: 0.20,
    schema_data: 0.10,
    brand_consistency: 0.15,
  };

  let overallScore = 0;
  Object.entries(weights).forEach(([category, weight]) => {
    overallScore += categoryScores[category] * weight;
  });
  overallScore = Math.round(overallScore);

  return {
    overallScore,
    categoryScores,
    issues,
    recommendations: issues
      .filter(i => i.severity === 'critical' || i.severity === 'high')
      .slice(0, 5)
      .map(i => `${i.severity.toUpperCase()}: ${i.message}`),
  };
}

/**
 * Default audit configuration
 */
function getDefaultAuditConfig() {
  return {
    minDescriptionLength: 100,
    maxDescriptionLength: 5000,
    minImageCount: 3,
    brandTerms: {
      required: ['Dawin', 'custom', 'crafted'],
      prohibited: ['cheap', 'discount', 'knockoff'],
    },
  };
}

/**
 * Shopify product update webhook handler
 */
exports.shopifyProductUpdate = onRequest(
  {
    cors: ALLOWED_ORIGINS,
  },
  async (req, res) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const db = getFirestore();
    console.log('Received Shopify product webhook');

    try {
      // Get webhook secret from config
      const configDoc = await db.doc('systemConfig/shopifyConfig').get();
      if (!configDoc.exists) {
        console.log('Shopify not configured');
        res.status(200).send('OK'); // Acknowledge but don't process
        return;
      }

      const shopConfig = configDoc.data();

      // Verify webhook signature if secret is configured
      if (shopConfig.webhookSecret) {
        if (!verifyShopifyWebhook(req, shopConfig.webhookSecret)) {
          console.error('Invalid webhook signature');
          res.status(401).send('Unauthorized');
          return;
        }
      }

      const product = req.body;
      if (!product || !product.id) {
        res.status(400).send('Invalid product data');
        return;
      }

      console.log(`Processing webhook for product: ${product.id} - ${product.title}`);

      // Find internal product
      const productQuery = await db
        .collection('launchProducts')
        .where('shopifySync.shopifyProductId', '==', product.id.toString())
        .limit(1)
        .get();

      if (productQuery.empty) {
        console.log(`No internal product found for Shopify ID ${product.id}`);
        res.status(200).send('OK'); // Product not tracked internally
        return;
      }

      const internalProduct = productQuery.docs[0];
      const config = getDefaultAuditConfig();

      // Run audit
      const auditResult = runProductAudit(product, config);

      // Save audit result
      await db.collection('productAudits').add({
        productId: internalProduct.id,
        shopifyProductId: product.id.toString(),
        auditedAt: new Date(),
        auditType: 'webhook',
        productStatus: product.status || 'active',
        ...auditResult,
      });

      // Update product's lastAudit reference
      await internalProduct.ref.update({
        lastAudit: {
          overallScore: auditResult.overallScore,
          auditedAt: new Date(),
          issueCount: auditResult.issues.length,
        },
        'shopifySync.lastSynced': new Date(),
      });

      console.log(`Audit complete for product ${product.id}: score ${auditResult.overallScore}`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
);

/**
 * Shopify product delete webhook handler
 */
exports.shopifyProductDelete = onRequest(
  {
    cors: ALLOWED_ORIGINS,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const db = getFirestore();
    console.log('Received Shopify product delete webhook');

    try {
      const product = req.body;
      if (!product || !product.id) {
        res.status(400).send('Invalid product data');
        return;
      }

      // Find internal product and update sync status
      const productQuery = await db
        .collection('launchProducts')
        .where('shopifySync.shopifyProductId', '==', product.id.toString())
        .limit(1)
        .get();

      if (!productQuery.empty) {
        const internalProduct = productQuery.docs[0];
        await internalProduct.ref.update({
          'shopifySync.status': 'deleted',
          'shopifySync.deletedAt': new Date(),
        });
        console.log(`Marked product ${internalProduct.id} as deleted from Shopify`);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Delete webhook error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
);
