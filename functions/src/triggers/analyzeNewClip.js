/**
 * Firestore Trigger: Analyze New Clips
 * 
 * Automatically triggers AI analysis when a new clip is created
 * with analysisStatus: 'pending'
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineString } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Environment variable (from .env.dawinos)
const GEMINI_API_KEY = defineString('GEMINI_API_KEY');

// Clip Analysis Prompt (simplified for background processing)
const CLIP_ANALYSIS_PROMPT = `You are a furniture and design analyst for Dawin Group, a custom millwork and furniture manufacturing company.

Analyze this product/furniture image and extract:

1. **Product Type**: What is this? (cabinet, table, chair, sideboard, etc.)
2. **Design Style**: Modern, traditional, mid-century, Scandinavian, industrial, etc.
3. **Materials**: Primary materials visible (wood species, metal, stone, fabric, etc.)
4. **Colors**: 3-5 dominant colors as hex codes
5. **Millwork Assessment**:
   - Is this a good candidate for custom manufacturing? (yes/no)
   - Complexity: simple, moderate, complex, or highly-complex
   - Key construction features
6. **Tags**: 5-10 relevant tags for organizing

Return as JSON:
{
  "productType": "category",
  "style": "design style",
  "primaryMaterials": ["material1", "material2"],
  "colors": ["#hex1", "#hex2"],
  "millworkAssessment": {
    "isCustomCandidate": true|false,
    "complexity": "simple|moderate|complex|highly-complex",
    "keyFeatures": ["feature1", "feature2"]
  },
  "suggestedTags": ["tag1", "tag2"],
  "confidence": 0.0-1.0
}`;

/**
 * Firestore Trigger: onClipCreated
 * Triggers when a new document is created in designClips collection
 */
const onDesignClipCreated = onDocumentCreated({
  document: 'designClips/{clipId}',
  memory: '1GiB',
  timeoutSeconds: 120,
}, async (event) => {
  const clipId = event.params.clipId;
  const clipData = event.data?.data();

  if (!clipData) {
    console.log(`No data found for clip ${clipId}`);
    return;
  }

  // Only process clips with pending analysis status
  if (clipData.analysisStatus !== 'pending') {
    console.log(`Clip ${clipId} analysisStatus is '${clipData.analysisStatus}', skipping`);
    return;
  }

  console.log(`Starting AI analysis for clip ${clipId}`);

  const clipRef = db.collection('designClips').doc(clipId);

  try {
    // Update status to 'analyzing'
    await clipRef.update({
      analysisStatus: 'analyzing',
      analysisStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Get image URL - prefer HTTP URL over data URL for fetching
    const thumbnailUrl = clipData.thumbnailUrl || '';
    const httpImageUrl = clipData.imageUrl || '';
    
    // Check if we have a data URL (base64) or HTTP URL
    const isDataUrl = thumbnailUrl.startsWith('data:');
    const imageUrl = isDataUrl ? thumbnailUrl : (httpImageUrl || thumbnailUrl);
    
    if (!imageUrl) {
      throw new Error('No image URL available for analysis');
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    // Build prompt with context
    let fullPrompt = CLIP_ANALYSIS_PROMPT;
    if (clipData.title) {
      fullPrompt += `\n\nPRODUCT TITLE: ${clipData.title}`;
    }
    if (clipData.sourceUrl) {
      fullPrompt += `\n\nSOURCE URL: ${clipData.sourceUrl}`;
    }
    if (clipData.clipType) {
      fullPrompt += `\n\nCLIP PURPOSE: ${clipData.clipType}`;
    }

    // Get image as base64
    let imageBase64;
    let mimeType = 'image/jpeg';
    
    if (isDataUrl) {
      // Extract base64 from data URL
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        imageBase64 = matches[2];
        console.log(`Using data URL for clip ${clipId}, mimeType: ${mimeType}`);
      } else {
        throw new Error('Invalid data URL format');
      }
    } else {
      // Fetch HTTP URL
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        mimeType = contentType.split(';')[0];
        const buffer = await response.buffer();
        imageBase64 = buffer.toString('base64');
        console.log(`Fetched HTTP image for clip ${clipId}, mimeType: ${mimeType}`);
      } catch (fetchError) {
        console.error(`Failed to fetch image for clip ${clipId}:`, fetchError);
        throw new Error(`Image fetch failed: ${fetchError.message}`);
      }
    }

    // Call Gemini with image
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: fullPrompt },
        ],
      }],
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = result.response.usageMetadata || {};

    console.log(`Gemini response received for clip ${clipId}`);

    // Parse JSON response
    let analysisResult = null;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
        analysisResult.analyzedAt = new Date().toISOString();
      }
    } catch (parseError) {
      console.warn(`Failed to parse analysis JSON for clip ${clipId}:`, parseError.message);
    }

    if (!analysisResult) {
      throw new Error('Failed to parse AI response');
    }

    // Update clip with analysis results
    const updateData = {
      aiAnalysis: analysisResult,
      analysisStatus: 'completed',
      analysisCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      analysisTokens: {
        input: usageMetadata.promptTokenCount || 0,
        output: usageMetadata.candidatesTokenCount || 0,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Auto-populate empty fields from analysis
    if ((!clipData.materials || clipData.materials.length === 0) && analysisResult.primaryMaterials) {
      updateData.materials = analysisResult.primaryMaterials;
    }
    if ((!clipData.colors || clipData.colors.length === 0) && analysisResult.colors) {
      updateData.colors = analysisResult.colors;
    }
    // Merge suggested tags with existing
    if (analysisResult.suggestedTags) {
      updateData.tags = [...new Set([
        ...(clipData.tags || []),
        ...analysisResult.suggestedTags,
      ])];
    }

    await clipRef.update(updateData);

    console.log(`Successfully analyzed clip ${clipId}: ${analysisResult.productType} (${analysisResult.style})`);

  } catch (error) {
    console.error(`Analysis failed for clip ${clipId}:`, error);

    // Update status to failed
    await clipRef.update({
      analysisStatus: 'failed',
      analysisError: error.message,
      analysisFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});

module.exports = {
  onDesignClipCreated,
};
