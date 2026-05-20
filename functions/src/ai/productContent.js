/**
 * Product Content Generation Cloud Function
 * 
 * Generates AI-powered product descriptions, SEO content, and FAQs
 * for the Launch Pipeline.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Initialize if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

// Secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

/**
 * Generate Product Content
 * 
 * @param {Object} request.data
 * @param {Object} request.data.product - Product details
 * @param {string[]} request.data.contentTypes - Types to generate: short, full, meta, bullets, faqs
 * @param {string} request.data.tone - Content tone: professional, casual, luxury
 */
const generateProductContent = onCall(
  { 
    cors: ALLOWED_ORIGINS,
    secrets: [GEMINI_API_KEY], 
    memory: '1GiB', 
    timeoutSeconds: 180,
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { product, contentTypes = ['short', 'full', 'meta', 'bullets'], tone = 'professional' } = request.data;

    if (!product || !product.name) {
      throw new HttpsError('invalid-argument', 'Product with name is required');
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { 
          maxOutputTokens: 4096, 
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      });

      // Build dimensions string
      let dimensionsStr = 'Custom sizing available';
      if (product.specifications?.dimensions) {
        const d = product.specifications.dimensions;
        dimensionsStr = `${d.length}x${d.width}x${d.height} ${d.unit || 'mm'}`;
      }

      const prompt = `Generate product content for a custom millwork product from Dawin Finishes.

PRODUCT DETAILS:
- Name: ${product.name}
- Category: ${product.category || 'Custom Millwork'}
- Materials: ${product.specifications?.materials?.join(', ') || 'Premium materials'}
- Finishes: ${product.specifications?.finishes?.join(', ') || 'Custom finish options'}
- Features: ${product.specifications?.features?.join(', ') || 'Handcrafted quality'}
- Dimensions: ${dimensionsStr}
- Description hint: ${product.description || 'High-quality custom piece'}

TONE: ${tone}
- professional: Authoritative, industry-focused, detailed specifications
- casual: Warm, approachable, lifestyle-focused
- luxury: Elegant, exclusive, premium positioning

CONTENT TO GENERATE: ${contentTypes.join(', ')}

Generate the following in JSON format:
{
  "shortDescription": "50-100 word compelling summary highlighting key benefits",
  "fullDescription": "300-500 word HTML description with proper formatting using <p>, <h3>, <ul>, <li>, <strong> tags. Include sections for Overview, Features, Materials, and Craftsmanship.",
  "metaDescription": "Max 155 characters SEO meta description with primary keywords",
  "bulletPoints": ["5-7 key selling points, each 5-15 words"],
  "faqs": [
    {"question": "Common customer question", "answer": "Helpful, detailed answer"},
    {"question": "Another relevant question", "answer": "Clear, informative response"}
  ]
}

Focus on:
- Craftsmanship and quality
- Customization options
- Material benefits
- Design versatility
- Professional installation context`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Parse JSON from response
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        } else {
          const rawMatch = responseText.match(/\{[\s\S]*\}/);
          if (rawMatch) {
            parsed = JSON.parse(rawMatch[0]);
          } else {
            throw new HttpsError('internal', 'Failed to parse AI response');
          }
        }
      }

      // Add metadata
      parsed.generatedAt = new Date().toISOString();
      parsed.modelVersion = 'gemini-1.5-flash';
      parsed.editedByUser = false;

      return parsed;
    } catch (error) {
      console.error('Content generation error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', `Failed to generate content: ${error.message}`);
    }
  }
);

/**
 * Generate Discoverability Data
 * 
 * Creates AI-powered discovery content for better search and recommendations
 */
const generateDiscoverabilityData = onCall(
  { 
    cors: ALLOWED_ORIGINS,
    secrets: [GEMINI_API_KEY], 
    memory: '512MiB', 
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { product } = request.data;

    if (!product || !product.name) {
      throw new HttpsError('invalid-argument', 'Product is required');
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { 
          maxOutputTokens: 2048, 
          temperature: 0.6,
          responseMimeType: 'application/json',
        },
      });

      const prompt = `Generate AI discoverability data for this custom millwork product:

PRODUCT: ${product.name}
CATEGORY: ${product.category || 'Custom Millwork'}
MATERIALS: ${product.specifications?.materials?.join(', ') || 'Various'}
FEATURES: ${product.specifications?.features?.join(', ') || 'Custom'}

Generate discovery content in JSON format:
{
  "whatItIs": "Clear 1-sentence description of the product",
  "bestFor": "Who should buy this and why (1-2 sentences)",
  "comparedTo": "How it compares to alternatives (1 sentence)",
  "uniqueFeatures": ["3-5 standout features that differentiate this product"],
  "useCases": ["4-6 specific use cases or applications"],
  "faqs": [
    {"question": "Buyer question", "answer": "Helpful answer"}
  ],
  "semanticTags": {
    "materialType": ["wood", "veneer", etc.],
    "styleCategory": ["modern", "traditional", "transitional", etc.],
    "roomType": ["kitchen", "bathroom", "office", etc.],
    "colorFamily": ["natural", "white", "dark", etc.]
  },
  "searchKeywords": ["10-15 relevant search terms buyers might use"]
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        } else {
          const rawMatch = responseText.match(/\{[\s\S]*\}/);
          if (rawMatch) {
            parsed = JSON.parse(rawMatch[0]);
          } else {
            throw new HttpsError('internal', 'Failed to parse AI response');
          }
        }
      }

      parsed.generatedAt = new Date().toISOString();
      return parsed;
    } catch (error) {
      console.error('Discoverability generation error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', `Failed to generate discoverability data: ${error.message}`);
    }
  }
);

module.exports = { generateProductContent, generateDiscoverabilityData };
