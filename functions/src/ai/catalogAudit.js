/**
 * Catalog Audit Cloud Function
 * 
 * Audits Shopify products for content quality, SEO, and brand compliance.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Initialize if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Audit Shopify Product
 *
 * @param {Object} request.data
 * @param {Object} request.data.shopifyProduct - Shopify product data
 * @param {Object} request.data.auditConfig - Audit configuration
 */
const auditShopifyProduct = onCall(
  {
    cors: ALLOWED_ORIGINS,
    memory: '512MiB', 
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { shopifyProduct, auditConfig = {} } = request.data;

    if (!shopifyProduct) {
      throw new HttpsError('invalid-argument', 'Shopify product data is required');
    }

    // Default audit config
    const config = {
      minDescriptionLength: auditConfig.minDescriptionLength || 100,
      maxDescriptionLength: auditConfig.maxDescriptionLength || 5000,
      minImageCount: auditConfig.minImageCount || 3,
      requiredBrandTerms: auditConfig.brandTerms?.required || ['Dawin', 'custom', 'crafted'],
      prohibitedTerms: auditConfig.brandTerms?.prohibited || ['cheap', 'discount', 'knockoff'],
      ...auditConfig,
    };

    const issues = [];
    const categoryScores = {
      content_completeness: 100,
      seo_quality: 100,
      image_optimization: 100,
      schema_data: 100,
      brand_consistency: 100,
    };

    // ============================================
    // Content Completeness Checks
    // ============================================

    // Title check
    if (!shopifyProduct.title || shopifyProduct.title.length < 5) {
      issues.push({
        id: `title_${Date.now()}`,
        category: 'content_completeness',
        severity: 'critical',
        field: 'title',
        message: 'Title is missing or too short (min 5 characters)',
        currentValue: shopifyProduct.title || '',
        expectedValue: 'Descriptive product title',
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
        message: `Description too short (${descriptionLength} chars, min ${config.minDescriptionLength})`,
        currentValue: `${descriptionLength} characters`,
        expectedValue: `At least ${config.minDescriptionLength} characters`,
        autoFixAvailable: true,
        fixAction: 'generate_description',
      });
      categoryScores.content_completeness -= 20;
    } else if (descriptionLength > config.maxDescriptionLength) {
      issues.push({
        id: `desc_long_${Date.now()}`,
        category: 'content_completeness',
        severity: 'low',
        field: 'body_html',
        message: `Description may be too long (${descriptionLength} chars)`,
        currentValue: `${descriptionLength} characters`,
        expectedValue: `Under ${config.maxDescriptionLength} characters`,
        autoFixAvailable: false,
      });
      categoryScores.content_completeness -= 5;
    }

    // ============================================
    // Image Optimization Checks
    // ============================================

    const images = shopifyProduct.images || [];
    
    if (images.length < config.minImageCount) {
      issues.push({
        id: `img_count_${Date.now()}`,
        category: 'image_optimization',
        severity: 'high',
        field: 'images',
        message: `Insufficient images (${images.length}/${config.minImageCount} minimum)`,
        currentValue: `${images.length} images`,
        expectedValue: `At least ${config.minImageCount} images`,
        autoFixAvailable: false,
      });
      categoryScores.image_optimization -= 20;
    }

    // Alt text check
    const imagesWithoutAlt = images.filter(img => !img.alt || img.alt.trim() === '');
    if (imagesWithoutAlt.length > 0) {
      issues.push({
        id: `img_alt_${Date.now()}`,
        category: 'image_optimization',
        severity: 'medium',
        field: 'images.alt',
        message: `${imagesWithoutAlt.length} image(s) missing alt text`,
        currentValue: `${imagesWithoutAlt.length} without alt`,
        expectedValue: 'All images should have descriptive alt text',
        autoFixAvailable: true,
        fixAction: 'generate_alt_text',
      });
      categoryScores.image_optimization -= 5 * Math.min(imagesWithoutAlt.length, 4);
    }

    // ============================================
    // SEO Quality Checks
    // ============================================

    const metafields = shopifyProduct.metafields || [];
    const metaTitle = metafields.find(m => m.key === 'title_tag' || m.key === 'meta_title');
    const metaDesc = metafields.find(m => m.key === 'description_tag' || m.key === 'meta_description');

    if (!metaTitle) {
      issues.push({
        id: `seo_title_${Date.now()}`,
        category: 'seo_quality',
        severity: 'medium',
        field: 'metafields.meta_title',
        message: 'SEO meta title not set',
        currentValue: 'Not set',
        expectedValue: 'Keyword-rich title under 60 characters',
        autoFixAvailable: true,
        fixAction: 'generate_meta_title',
      });
      categoryScores.seo_quality -= 15;
    } else if (metaTitle.value && metaTitle.value.length > 60) {
      issues.push({
        id: `seo_title_long_${Date.now()}`,
        category: 'seo_quality',
        severity: 'low',
        field: 'metafields.meta_title',
        message: `Meta title too long (${metaTitle.value.length}/60 chars)`,
        currentValue: `${metaTitle.value.length} characters`,
        expectedValue: 'Under 60 characters',
        autoFixAvailable: false,
      });
      categoryScores.seo_quality -= 5;
    }

    if (!metaDesc) {
      issues.push({
        id: `seo_desc_${Date.now()}`,
        category: 'seo_quality',
        severity: 'medium',
        field: 'metafields.meta_description',
        message: 'SEO meta description not set',
        currentValue: 'Not set',
        expectedValue: 'Compelling description under 155 characters',
        autoFixAvailable: true,
        fixAction: 'generate_meta_description',
      });
      categoryScores.seo_quality -= 15;
    } else if (metaDesc.value && metaDesc.value.length > 155) {
      issues.push({
        id: `seo_desc_long_${Date.now()}`,
        category: 'seo_quality',
        severity: 'low',
        field: 'metafields.meta_description',
        message: `Meta description too long (${metaDesc.value.length}/155 chars)`,
        currentValue: `${metaDesc.value.length} characters`,
        expectedValue: 'Under 155 characters',
        autoFixAvailable: false,
      });
      categoryScores.seo_quality -= 5;
    }

    // ============================================
    // Brand Consistency Checks
    // ============================================

    const fullText = `${shopifyProduct.title || ''} ${shopifyProduct.body_html || ''}`.toLowerCase();

    // Check for prohibited terms
    for (const term of config.prohibitedTerms) {
      if (fullText.includes(term.toLowerCase())) {
        issues.push({
          id: `brand_prohibited_${term}_${Date.now()}`,
          category: 'brand_consistency',
          severity: 'high',
          field: 'content',
          message: `Contains prohibited term: "${term}"`,
          currentValue: `Found "${term}"`,
          expectedValue: 'Remove or replace term',
          autoFixAvailable: false,
        });
        categoryScores.brand_consistency -= 15;
      }
    }

    // ============================================
    // Schema Data Checks
    // ============================================

    const schemaMetafield = metafields.find(m => m.key === 'schema_json_ld' || m.namespace === 'custom');
    if (!schemaMetafield) {
      issues.push({
        id: `schema_missing_${Date.now()}`,
        category: 'schema_data',
        severity: 'medium',
        field: 'metafields.schema',
        message: 'Schema.org JSON-LD data not set',
        currentValue: 'Not set',
        expectedValue: 'Product schema for rich snippets',
        autoFixAvailable: true,
        fixAction: 'generate_schema',
      });
      categoryScores.schema_data -= 20;
    }

    // ============================================
    // Calculate Overall Score
    // ============================================

    // Ensure scores don't go below 0
    Object.keys(categoryScores).forEach(key => {
      categoryScores[key] = Math.max(0, categoryScores[key]);
    });

    // Weighted average
    const weights = {
      content_completeness: 0.3,
      seo_quality: 0.25,
      image_optimization: 0.2,
      schema_data: 0.1,
      brand_consistency: 0.15,
    };

    let overallScore = 0;
    Object.entries(weights).forEach(([category, weight]) => {
      overallScore += categoryScores[category] * weight;
    });
    overallScore = Math.round(overallScore);

    // Generate recommendations
    const recommendations = issues
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 5)
      .map(issue => `${issue.severity.toUpperCase()}: ${issue.message}`);

    return {
      productId: shopifyProduct.id,
      auditedAt: new Date().toISOString(),
      auditType: 'manual',
      productStatus: shopifyProduct.status || 'unknown',
      overallScore,
      categoryScores,
      issues,
      recommendations,
    };
  }
);

module.exports = { auditShopifyProduct };
