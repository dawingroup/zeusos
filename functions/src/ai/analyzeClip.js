/**
 * Clip Analysis AI
 * 
 * Analyzes design inspiration clips from the Dawin Clipper extension.
 * Optimized for furniture/product images to extract:
 * - Product type and style
 * - Materials and colors
 * - Millwork assessment for custom manufacturing
 * 
 * Uses Gemini 2.0 Flash multi-modal capabilities.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// ============================================
// Clip Analysis Prompt
// ============================================

const CLIP_ANALYSIS_PROMPT = `You are a furniture and design analyst for Dawin Group, a custom millwork and furniture manufacturing company in East Africa.

Analyze this product/furniture image and extract detailed information to help our designers understand if and how we could manufacture something similar.

**PRODUCT IDENTIFICATION:**
- What type of product is this? (e.g., cabinet, table, chair, sideboard, bed, etc.)
- What is the design style? (modern, traditional, mid-century, Scandinavian, industrial, etc.)

**MATERIALS ANALYSIS:**
Identify all visible materials:
- Primary materials (wood species, metal type, stone, etc.)
- Secondary materials
- Finish type (lacquer, oil, stain, paint, natural, etc.)

**COLOR EXTRACTION:**
- Extract 3-5 dominant colors as hex codes
- Note any color patterns or gradients

**MILLWORK ASSESSMENT:**
Evaluate for custom manufacturing:
- Is this a good candidate for custom manufacturing? (yes/no with reasoning)
- Complexity level: simple, moderate, complex, or highly-complex
- Key construction features (joinery, hardware, special techniques)
- Estimated labor hours for similar piece
- Important considerations for manufacturing

**SUGGESTED TAGS:**
Generate 5-10 relevant tags for organizing this clip.

Return as JSON:
{
  "productType": "product category",
  "style": "design style",
  "primaryMaterials": ["material1", "material2"],
  "colors": ["#hex1", "#hex2", "#hex3"],
  "estimatedDimensions": {
    "width": "estimated width with unit",
    "height": "estimated height with unit",
    "depth": "estimated depth with unit",
    "unit": "in|cm|mm"
  },
  "millworkAssessment": {
    "isCustomCandidate": true|false,
    "complexity": "simple|moderate|complex|highly-complex",
    "keyFeatures": ["feature1", "feature2"],
    "estimatedHours": number or null,
    "considerations": ["consideration1", "consideration2"]
  },
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "confidence": 0.0-1.0
}`;

// ============================================
// Main Cloud Function
// ============================================

/**
 * Analyze Clip AI
 * Analyzes design inspiration clips for manufacturing insights
 */
const analyzeClip = onCall({
  memory: '1GiB',
  timeoutSeconds: 60,
  secrets: [GEMINI_API_KEY],
  cors: ALLOWED_ORIGINS,
}, async (request) => {
  // 1. Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const userId = request.auth.uid;
  const { 
    imageBase64,
    imageUrl,
    imageMimeType = 'image/jpeg',
    clipId,
    title,
    sourceUrl,
  } = request.data;

  // 2. Validate input - need either base64 or URL
  if (!imageBase64 && !imageUrl) {
    throw new HttpsError('invalid-argument', 'Image data or URL is required');
  }

  const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (imageBase64 && !validMimeTypes.includes(imageMimeType)) {
    throw new HttpsError('invalid-argument', `Invalid mime type. Supported: ${validMimeTypes.join(', ')}`);
  }

  console.log('Clip Analysis request:', { 
    clipId,
    title,
    hasBase64: !!imageBase64,
    hasUrl: !!imageUrl,
  });

  try {
    const startTime = Date.now();

    // 3. Initialize Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    // 4. Build prompt with context
    let fullPrompt = CLIP_ANALYSIS_PROMPT;
    
    if (title) {
      fullPrompt += `\n\nPRODUCT TITLE FROM SOURCE: ${title}`;
    }
    
    if (sourceUrl) {
      fullPrompt += `\n\nSOURCE URL: ${sourceUrl}`;
    }

    // 5. Prepare image content
    let imageParts;
    if (imageBase64) {
      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageParts = { inlineData: { mimeType: imageMimeType, data: base64Data } };
    } else {
      // Use image URL directly (Gemini can fetch it)
      imageParts = { fileData: { mimeType: imageMimeType, fileUri: imageUrl } };
    }

    // 6. Call Gemini with image
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          imageParts,
          { text: fullPrompt },
        ],
      }],
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = result.response.usageMetadata || {};
    const processingTime = Date.now() - startTime;

    console.log(`Clip analysis completed in ${processingTime}ms`);

    // 7. Parse JSON response
    let analysisResult = null;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
        // Add analyzedAt timestamp
        analysisResult.analyzedAt = new Date().toISOString();
      }
    } catch (e) {
      console.warn('Failed to parse clip analysis JSON:', e.message);
    }

    // 8. Update clip in Firestore if clipId provided
    if (clipId && analysisResult) {
      try {
        const clipRef = db.collection('designClips').doc(clipId);
        const clipDoc = await clipRef.get();
        
        if (clipDoc.exists) {
          // Only update if clip belongs to this user
          const clipData = clipDoc.data();
          if (clipData.createdBy === userId) {
            await clipRef.update({
              aiAnalysis: analysisResult,
              // Auto-populate empty fields
              ...((!clipData.materials || clipData.materials.length === 0) && analysisResult.primaryMaterials 
                ? { materials: analysisResult.primaryMaterials } : {}),
              ...((!clipData.colors || clipData.colors.length === 0) && analysisResult.colors 
                ? { colors: analysisResult.colors } : {}),
              // Merge suggested tags with existing
              tags: [...new Set([
                ...(clipData.tags || []),
                ...(analysisResult.suggestedTags || []),
              ])],
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Updated clip ${clipId} with AI analysis`);
          }
        }
      } catch (saveError) {
        console.error('Error updating clip with analysis:', saveError);
        // Don't throw - still return the analysis
      }
    }

    // 9. Return structured response
    return {
      success: true,
      analysis: analysisResult,
      rawResponse: analysisResult ? null : responseText,
      
      summary: {
        productType: analysisResult?.productType || 'unknown',
        style: analysisResult?.style || 'unknown',
        isCustomCandidate: analysisResult?.millworkAssessment?.isCustomCandidate || false,
        complexity: analysisResult?.millworkAssessment?.complexity || 'unknown',
        confidence: analysisResult?.confidence || 0.5,
      },

      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        responseTimeMs: processingTime,
        modelUsed: 'gemini-2.0-flash',
      },
    };

  } catch (error) {
    console.error('Clip Analysis error:', error);
    throw new HttpsError('internal', `Clip analysis failed: ${error.message}`);
  }
});

// ============================================
// Exports
// ============================================

module.exports = {
  analyzeClip,
  CLIP_ANALYSIS_PROMPT,
};
