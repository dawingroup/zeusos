/**
 * Feature Vision Analysis Cloud Function
 * Uses Gemini 2.0 Pro Vision to analyze jig/setup photos and identify design features
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Use Gemini API key from Firebase secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

/**
 * Analyzes an image of a workshop jig or setup to identify the design feature it produces
 */
exports.analyzeFeatureFromAsset = onCall(
  {
    cors: ALLOWED_ORIGINS,
    secrets: [GEMINI_API_KEY]
  },
  async (request) => {
    const { imageBase64, mimeType = 'image/jpeg' } = request.data;

    // Validate input
    if (!imageBase64) {
      throw new HttpsError(
        'invalid-argument',
        'imageBase64 is required'
      );
    }

    console.log('Analyzing feature from image...');

    try {
      // Initialize Gemini client
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      
      // Use Gemini 2.0 Pro for vision tasks
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        },
      });

      const prompt = `You are a Workshop Feature Analyst for a custom millwork and furniture manufacturing shop.

Analyze this image of a workshop jig, fixture, or machine setup. Your goal is to identify the **Design Feature** this tool/setup produces.

Extract and return the following information in JSON format:

1. **name**: A concise name for the design feature this produces (e.g., "Fluted Panel", "Dovetail Joint", "Edge Profile - Ogee", "Pocket Hole Joinery")

2. **description**: A detailed description of:
   - What this feature looks like when applied to a workpiece
   - The visual/functional characteristics it creates
   - Any quality considerations

3. **category**: The feature category. Choose ONE:
   - JOINERY (joints, connections)
   - EDGE_TREATMENT (edge profiles, banding)
   - DRILLING (holes, boring patterns)
   - SHAPING (routing, carving, molding)
   - ASSEMBLY (clamping, fastening setups)
   - FINISHING (sanding, coating jigs)
   - CUTTING (sizing, mitering, beveling)
   - SPECIALTY (custom/unique operations)

4. **tags**: Array of 3-5 style/search tags (e.g., ["modern", "cabinet", "drawer-front", "decorative"])

5. **suggestedAssets**: Array of tool types that would typically be needed for this feature (e.g., ["CNC Router", "Edge Bander", "Drill Press"])

6. **estimatedMinutes**: Approximate time to apply this feature once (number)

7. **complexity**: 'simple' | 'moderate' | 'complex'

8. **notes**: Any additional observations about the setup, safety considerations, or tips

Return ONLY valid JSON matching this schema:
{
  "name": "Feature Name",
  "description": "Detailed description...",
  "category": "CATEGORY",
  "tags": ["tag1", "tag2", "tag3"],
  "suggestedAssets": ["Tool 1", "Tool 2"],
  "estimatedMinutes": 15,
  "complexity": "moderate",
  "notes": "Any additional observations..."
}

If you cannot clearly identify the feature, make your best educated guess based on visible elements and note your uncertainty in the notes field.`;

      // Create the image part for vision
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = result.response;
      const text = response.text();

      console.log('Gemini Vision response:', text);

      // Parse the JSON response
      let jsonStr = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      let analysisResult;
      try {
        analysisResult = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError);
        throw new HttpsError(
          'internal',
          'Failed to parse AI response. Please try again with a clearer image.'
        );
      }

      // Validate and normalize the response
      const normalizedResult = {
        name: analysisResult.name || 'Unknown Feature',
        description: analysisResult.description || '',
        category: validateCategory(analysisResult.category),
        tags: Array.isArray(analysisResult.tags) ? analysisResult.tags : [],
        suggestedAssets: Array.isArray(analysisResult.suggestedAssets) 
          ? analysisResult.suggestedAssets 
          : [],
        estimatedMinutes: typeof analysisResult.estimatedMinutes === 'number'
          ? analysisResult.estimatedMinutes
          : 15,
        complexity: validateComplexity(analysisResult.complexity),
        notes: analysisResult.notes || '',
        // Metadata
        analyzedAt: new Date().toISOString(),
        analyzedBy: 'gemini-2.0-flash-vision',
        confidence: analysisResult.notes?.includes('uncertain') ? 0.6 : 0.85,
      };

      console.log('Analysis result:', normalizedResult);
      return normalizedResult;

    } catch (error) {
      console.error('Error analyzing feature:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        'internal',
        `Failed to analyze image: ${error.message}`
      );
    }
  }
);

/**
 * Validate category value
 */
function validateCategory(category) {
  const validCategories = [
    'JOINERY', 'EDGE_TREATMENT', 'DRILLING', 'SHAPING',
    'ASSEMBLY', 'FINISHING', 'CUTTING', 'SPECIALTY'
  ];
  return validCategories.includes(category) ? category : 'SPECIALTY';
}

/**
 * Validate complexity value
 */
function validateComplexity(complexity) {
  const validComplexity = ['simple', 'moderate', 'complex'];
  return validComplexity.includes(complexity) ? complexity : 'moderate';
}
