/**
 * Image Analysis Logic Module
 * 
 * Core logic for image analysis that can be used by both
 * the onCall Cloud Function and the Express API endpoint.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Main processing function
 */
async function processImageAnalysis(options) {
  const {
    imageBase64,
    imageMimeType,
    projectId,
    additionalPrompt,
    geminiApiKey,
    db,
  } = options;

  const startTime = Date.now();

  if (!geminiApiKey) {
    throw new Error('Gemini API key is required');
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const systemPrompt = `You are a design analysis expert for custom furniture and millwork.
Analyze this reference image and extract:

1. **Identified Items**: List each piece of furniture/millwork visible
2. **Style Analysis**: Design style (modern, traditional, contemporary, etc.)
3. **Materials**: Visible materials (wood types, metals, fabrics, finishes)
4. **Colors**: Color palette with approximate hex codes
5. **Manufacturing Insights**: How these items might be manufactured
6. **Quality Level**: Estimated quality tier (economy, commercial, premium, luxury)

${additionalPrompt ? `Additional context: ${additionalPrompt}` : ''}

Respond in JSON format with these keys:
{
  "identifiedItems": [{"name": string, "category": string, "confidence": number}],
  "styleAnalysis": {"primaryStyle": string, "influences": [string]},
  "materials": [{"type": string, "location": string, "finish": string}],
  "colorPalette": [{"name": string, "hex": string, "usage": string}],
  "manufacturingInsights": [string],
  "qualityLevel": string,
  "overallDescription": string
}`;

  try {
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: imageMimeType || 'image/jpeg',
      },
    };

    const result = await model.generateContent([systemPrompt, imagePart]);
    const responseText = result.response.text();

    // Parse JSON from response
    let analysis = null;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON:', parseError.message);
      analysis = {
        identifiedItems: [],
        styleAnalysis: { primaryStyle: 'Unknown', influences: [] },
        materials: [],
        colorPalette: [],
        manufacturingInsights: [responseText],
        qualityLevel: 'commercial',
        overallDescription: responseText,
      };
    }

    const processingTime = Date.now() - startTime;

    // Save to Firestore if projectId provided
    if (projectId && db) {
      try {
        await db.collection('aiAnalyses').add({
          type: 'image_analysis',
          projectId,
          analysis,
          createdAt: new Date(),
          processingTimeMs: processingTime,
        });
      } catch (saveError) {
        console.warn('Failed to save analysis:', saveError.message);
      }
    }

    return {
      success: true,
      analysis,
      metadata: {
        processingTimeMs: processingTime,
        model: 'gemini-2.0-flash-exp',
        projectId,
      },
    };
  } catch (error) {
    console.error('Image analysis error:', error);
    throw new Error(`Image analysis failed: ${error.message}`);
  }
}

module.exports = {
  processImageAnalysis,
};
