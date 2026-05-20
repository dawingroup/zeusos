/**
 * Reference Image Analysis AI
 * 
 * Analyzes reference images uploaded by designers to:
 * - Identify furniture items and fixtures
 * - Extract style, materials, and colors
 * - Match to Feature Library capabilities
 * - Generate deliverable suggestions
 * 
 * Uses Gemini 2.0 Flash multi-modal capabilities.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Import utilities
const { getCacheManager } = require('../utils/cacheManager');
const { checkRateLimit } = require('../utils/rateLimiter');

// ============================================
// Image Analysis Prompt
// ============================================

const IMAGE_ANALYSIS_PROMPT = `You are a furniture and millwork design analyst for Dawin Group, a custom manufacturing company.

Analyze this reference image and extract detailed information for manufacturing.

**IDENTIFY ALL ITEMS:**
For each furniture piece, fixture, or millwork element visible:
1. Item name and type
2. Estimated dimensions (width x height x depth in mm)
3. Category: MANUFACTURED (we make it) or PROCURED (we source it)
4. Subcategory: casework, furniture, millwork, fixtures, seating, surfaces

**STYLE ANALYSIS:**
- Primary style: modern, traditional, transitional, industrial, contemporary, rustic, Scandinavian, African contemporary
- Secondary style influences
- Era/period references if applicable

**MATERIALS DETECTED:**
For each material visible:
- Material type (wood species, metal, fabric, stone, etc.)
- Finish type (lacquer, oil, paint, stain, natural, etc.)
- Texture (smooth, brushed, distressed, etc.)
- Estimated quality grade (economy, standard, premium, luxury)

**COLOR PALETTE:**
- Extract 3-5 dominant colors as hex codes
- Identify accent colors
- Note any patterns or textures

**MANUFACTURING ANALYSIS:**
- Joinery types visible or implied
- Edge treatments
- Hardware visible
- Construction complexity (1-10 scale)
- Special techniques required

**DELIVERABLE SUGGESTIONS:**
Based on this image, suggest specific deliverables that could be manufactured.

Return as JSON:
{
  "identifiedItems": [
    {
      "name": "Item name",
      "type": "item_type_key",
      "category": "MANUFACTURED|PROCURED",
      "subcategory": "casework|furniture|millwork|fixtures|seating|surfaces",
      "estimatedDimensions": {"width": mm, "height": mm, "depth": mm},
      "materialGuess": "primary material",
      "finishGuess": "finish type",
      "confidence": 0.0-1.0
    }
  ],
  "styleAnalysis": {
    "primaryStyle": "style name",
    "secondaryInfluences": ["style1", "style2"],
    "eraReferences": "era if applicable or null"
  },
  "materials": [
    {
      "type": "material type",
      "finish": "finish type",
      "quality": "economy|standard|premium|luxury",
      "location": "where in image"
    }
  ],
  "colorPalette": {
    "dominant": ["#hex1", "#hex2", "#hex3"],
    "accent": ["#hex4"],
    "description": "color scheme description"
  },
  "manufacturingAnalysis": {
    "joineryTypes": ["type1", "type2"],
    "edgeTreatments": ["treatment1"],
    "visibleHardware": ["hardware1"],
    "complexityScore": 1-10,
    "specialTechniques": ["technique1"]
  },
  "deliverableSuggestions": [
    {
      "name": "Suggested deliverable name",
      "itemType": "type_key",
      "category": "MANUFACTURED|PROCURED",
      "description": "Brief description",
      "estimatedComplexity": "low|medium|high"
    }
  ],
  "overallConfidence": 0.0-1.0,
  "notes": ["additional observations"]
}`;

// ============================================
// Main Cloud Function
// ============================================

/**
 * Reference Image Analysis AI
 * Analyzes uploaded images for design and manufacturing insights
 */
const imageAnalysis = onCall({
  memory: '2GiB',
  timeoutSeconds: 120,
  secrets: [GEMINI_API_KEY],
}, async (request) => {
  // 1. Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const userId = request.auth.uid;
  const { 
    imageBase64,
    imageMimeType = 'image/jpeg',
    projectId,
    projectContext,
    additionalPrompt,
  } = request.data;

  // 2. Validate input
  if (!imageBase64) {
    throw new HttpsError('invalid-argument', 'Image data is required');
  }

  const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validMimeTypes.includes(imageMimeType)) {
    throw new HttpsError('invalid-argument', `Invalid mime type. Supported: ${validMimeTypes.join(', ')}`);
  }

  // 3. Rate limiting (image analysis counts as 'image' type)
  try {
    const rateResult = await checkRateLimit(userId, 'image', db);
    if (!rateResult.allowed) {
      throw new HttpsError('resource-exhausted', 
        `Image analysis rate limit exceeded (30/hour). Resets at ${rateResult.resetAt.toISOString()}`);
    }
  } catch (error) {
    if (error.code === 'resource-exhausted') throw error;
  }

  console.log('Image Analysis request:', { 
    projectId,
    mimeType: imageMimeType,
    hasAdditionalPrompt: !!additionalPrompt,
  });

  try {
    const startTime = Date.now();

    // 4. Initialize Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    });

    // 5. Get Feature Library context for matching
    const cacheManager = getCacheManager(db);
    const featureContextJson = await cacheManager.getOrCreateCache();

    // 6. Build prompt with context
    let fullPrompt = IMAGE_ANALYSIS_PROMPT;
    
    if (projectContext) {
      fullPrompt += `\n\nPROJECT CONTEXT:\n${JSON.stringify(projectContext, null, 2)}`;
    }
    
    if (featureContextJson) {
      try {
        const featureLibrary = JSON.parse(featureContextJson);
        const featureNames = featureLibrary?.featureLibrary?.features?.slice(0, 20).map(f => f.name) || [];
        fullPrompt += `\n\nAVAILABLE MANUFACTURING FEATURES:\n${featureNames.join(', ')}`;
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    if (additionalPrompt) {
      fullPrompt += `\n\nADDITIONAL REQUIREMENTS:\n${additionalPrompt}`;
    }

    // 7. Call Gemini with image
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
          { text: fullPrompt },
        ],
      }],
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = result.response.usageMetadata || {};
    const processingTime = Date.now() - startTime;

    console.log(`Image analysis completed in ${processingTime}ms`);

    // 8. Parse JSON response
    let analysisResult = null;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse image analysis JSON');
    }

    // 9. Match identified items to Feature Library
    if (analysisResult?.identifiedItems && featureContextJson) {
      try {
        const featureLibrary = JSON.parse(featureContextJson);
        const features = featureLibrary?.featureLibrary?.features || [];
        
        for (const item of analysisResult.identifiedItems) {
          const matches = features.filter(f => {
            const nameMatch = f.name?.toLowerCase().includes(item.type?.replace(/_/g, ' ') || '');
            const categoryMatch = f.category?.toLowerCase() === item.subcategory?.toLowerCase();
            return nameMatch || categoryMatch;
          });
          
          item.featureLibraryMatches = matches.slice(0, 3).map(f => ({
            featureId: f.id,
            featureName: f.name,
          }));
        }
      } catch (e) {
        // Ignore
      }
    }

    // 10. Save analysis if projectId provided
    if (projectId && analysisResult) {
      try {
        await db.collection('designProjects').doc(projectId)
          .collection('imageAnalyses').add({
            userId,
            analysisResult,
            itemsIdentified: analysisResult.identifiedItems?.length || 0,
            primaryStyle: analysisResult.styleAnalysis?.primaryStyle,
            complexityScore: analysisResult.manufacturingAnalysis?.complexityScore,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            processingTimeMs: processingTime,
          });
      } catch (saveError) {
        console.error('Error saving image analysis:', saveError);
      }
    }

    // 11. Return structured response
    return {
      success: true,
      analysis: analysisResult,
      rawResponse: analysisResult ? null : responseText, // Only include raw if parsing failed
      
      summary: {
        itemsIdentified: analysisResult?.identifiedItems?.length || 0,
        primaryStyle: analysisResult?.styleAnalysis?.primaryStyle || 'unknown',
        dominantColors: analysisResult?.colorPalette?.dominant || [],
        complexityScore: analysisResult?.manufacturingAnalysis?.complexityScore || null,
        overallConfidence: analysisResult?.overallConfidence || 0.5,
      },

      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
        responseTimeMs: processingTime,
        modelUsed: 'gemini-2.0-flash',
      },
    };

  } catch (error) {
    console.error('Image Analysis error:', error);
    throw new HttpsError('internal', `Image analysis failed: ${error.message}`);
  }
});

// ============================================
// Exports
// ============================================

module.exports = {
  imageAnalysis,
  IMAGE_ANALYSIS_PROMPT,
};
