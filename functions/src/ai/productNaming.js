/**
 * Product Naming Cloud Function
 * 
 * Generates AI-powered product name candidates for the Launch Pipeline.
 * Uses Gemini to create brand-appropriate, SEO-friendly names.
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
 * Generate Product Names
 *
 * @param {Object} request.data
 * @param {Object} request.data.context - Naming context (category, materials, features, etc.)
 * @param {string} request.data.namingStrategy - Strategy guide for naming
 * @param {string[]} request.data.existingNames - Existing names to avoid duplicates
 */
const generateProductNames = onCall(
  {
    cors: ALLOWED_ORIGINS,
    secrets: [GEMINI_API_KEY], 
    memory: '1GiB', 
    timeoutSeconds: 120,
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { context, namingStrategy, existingNames = [] } = request.data;

    if (!context || !context.category) {
      throw new HttpsError('invalid-argument', 'Product context with category is required');
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { 
          maxOutputTokens: 2048, 
          temperature: 0.8,
          responseMimeType: 'application/json',
        },
      });

      const prompt = `You are a product naming specialist for Dawin Finishes, a custom millwork and cabinet manufacturer.

NAMING STRATEGY:
${namingStrategy || 'Create elegant, memorable names that reflect craftsmanship and quality.'}

EXISTING PRODUCT NAMES (avoid duplicates):
${existingNames.length > 0 ? existingNames.join(', ') : 'None yet'}

PRODUCT CONTEXT:
- Category: ${context.category}
- Materials: ${context.materials?.join(', ') || 'Custom materials'}
- Features: ${context.features?.join(', ') || 'Handcrafted quality'}
- Target Market: ${context.targetMarket || 'Design professionals and homeowners'}
${context.dimensions ? `- Dimensions: ${context.dimensions}` : ''}
${context.collectionHint ? `- Collection Hint: ${context.collectionHint}` : ''}

Generate exactly 5 product name candidates. For each, provide:
1. The name (2-4 words, evocative and memorable)
2. A URL-friendly handle (lowercase, hyphens only)
3. Brief rationale (1 sentence explaining why this name works)
4. Scores 0-100 for: brandFit, seoScore, uniqueness

Respond in this exact JSON format:
{
  "candidates": [
    {
      "name": "Product Name",
      "handle": "product-name",
      "rationale": "Why this name works for the brand",
      "scores": { "brandFit": 85, "seoScore": 78, "uniqueness": 92 }
    }
  ]
}`;

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
          // Try raw JSON extraction
          const rawMatch = responseText.match(/\{[\s\S]*\}/);
          if (rawMatch) {
            parsed = JSON.parse(rawMatch[0]);
          } else {
            throw new HttpsError('internal', 'Failed to parse AI response');
          }
        }
      }

      // Validate response structure
      if (!parsed.candidates || !Array.isArray(parsed.candidates)) {
        throw new HttpsError('internal', 'Invalid response structure from AI');
      }

      // Add timestamps to candidates
      const now = new Date().toISOString();
      parsed.candidates = parsed.candidates.map(candidate => ({
        ...candidate,
        generatedAt: now,
      }));

      return parsed;
    } catch (error) {
      console.error('Product naming error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', `Failed to generate names: ${error.message}`);
    }
  }
);

module.exports = { generateProductNames };
