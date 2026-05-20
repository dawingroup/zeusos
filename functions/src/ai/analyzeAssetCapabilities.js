/**
 * Asset Capabilities Analysis Cloud Function
 * Uses Gemini AI to analyze an asset and suggest features it can produce
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Use Gemini API key from Firebase secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

/**
 * Analyzes an asset from the registry and suggests manufacturing features it can produce
 */
exports.analyzeAssetCapabilities = onCall(
  { 
    secrets: [GEMINI_API_KEY]
  },
  async (request) => {
    const { asset } = request.data;

    // Validate input
    if (!asset || !asset.brand || !asset.model) {
      throw new HttpsError('invalid-argument', 'Asset with brand and model is required');
    }

    console.log(`Analyzing capabilities for: ${asset.brand} ${asset.model}`);

    try {
      // Initialize Gemini client
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.4,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 4096,
        },
      });

      const prompt = `You are a Manufacturing Capabilities Analyst for a custom millwork, furniture, and upholstery production shop.

Analyze this workshop asset and identify ALL manufacturing features/capabilities it enables:

**Asset Information:**
- Brand: ${asset.brand}
- Model: ${asset.model}
- Category: ${asset.category || 'Unknown'}
- Nickname: ${asset.nickname || 'None'}
- Specifications: ${JSON.stringify(asset.specs || {})}
- Location/Zone: ${asset.location?.zone || 'Workshop'}

**Your Task:**
Identify 3-8 specific manufacturing FEATURES this tool/machine can produce. A feature is a specific manufacturing capability or operation that creates a particular result on a workpiece.

For each feature, provide:
1. **name**: Specific feature name (e.g., "Pocket Hole Joinery", "Dado Joint", "Edge Profile - Ogee", "Panel Sizing", "Hinge Boring")
2. **description**: What this feature produces and quality considerations
3. **category**: Choose ONE: JOINERY | EDGE_TREATMENT | DRILLING | SHAPING | ASSEMBLY | FINISHING | CUTTING | SPECIALTY
4. **tags**: 3-5 searchable tags (e.g., ["cabinet", "drawer", "concealed"])
5. **estimatedMinutes**: Typical time per application
6. **complexity**: simple | moderate | complex

Return ONLY valid JSON array:
[
  {
    "name": "Feature Name",
    "description": "Detailed description...",
    "category": "CATEGORY",
    "tags": ["tag1", "tag2"],
    "estimatedMinutes": 15,
    "complexity": "moderate"
  }
]

Think about:
- What joints can this tool create?
- What edge treatments?
- What holes/boring patterns?
- What shaping operations?
- What assembly support?
- What finishing prep?

Be specific to ${asset.brand} ${asset.model}'s actual capabilities based on its specs and common use cases.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      console.log('Gemini response:', text);

      // Parse the JSON response
      let jsonStr = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      let features;
      try {
        features = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError);
        throw new HttpsError('internal', 'Failed to parse AI response. Please try again.');
      }

      // Validate and normalize features
      if (!Array.isArray(features)) {
        features = [features];
      }

      const validCategories = [
        'JOINERY', 'EDGE_TREATMENT', 'DRILLING', 'SHAPING',
        'ASSEMBLY', 'FINISHING', 'CUTTING', 'SPECIALTY'
      ];

      const normalizedFeatures = features.map((f, index) => ({
        name: f.name || `Feature ${index + 1}`,
        description: f.description || '',
        category: validCategories.includes(f.category) ? f.category : 'SPECIALTY',
        tags: Array.isArray(f.tags) ? f.tags : [],
        estimatedMinutes: typeof f.estimatedMinutes === 'number' ? f.estimatedMinutes : 15,
        complexity: ['simple', 'moderate', 'complex'].includes(f.complexity) ? f.complexity : 'moderate',
        // Link back to the source asset
        sourceAssetId: asset.id,
        sourceAssetName: asset.nickname || `${asset.brand} ${asset.model}`,
      }));

      console.log(`Found ${normalizedFeatures.length} capabilities for ${asset.brand} ${asset.model}`);

      return {
        asset: {
          id: asset.id,
          name: asset.nickname || `${asset.brand} ${asset.model}`,
          brand: asset.brand,
          model: asset.model,
        },
        suggestedFeatures: normalizedFeatures,
        analyzedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Error analyzing asset capabilities:', error);
      throw new HttpsError('internal', `Failed to analyze asset: ${error.message}`);
    }
  }
);
