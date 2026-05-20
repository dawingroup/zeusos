/**
 * Asset Enrichment AI Cloud Function
 * Uses Gemini 2.0 Flash with Google Search Grounding to auto-fill asset specs
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Use Gemini API key from Firebase secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

/**
 * Enriches asset data by searching for technical specifications
 * using Gemini with Google Search grounding
 */
exports.enrichAssetData = onCall(
  {
    cors: ALLOWED_ORIGINS,
    secrets: [GEMINI_API_KEY]
  },
  async (request) => {
    const { brand, model } = request.data;

    // Validate input
    if (!brand || !model) {
      throw new HttpsError(
        'invalid-argument',
        'Both brand and model are required'
      );
    }

    console.log(`Enriching asset data for: ${brand} ${model}`);

    try {
      // Initialize Gemini client
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      
      // Use Gemini 2.0 Flash with Google Search grounding
      const generativeModel = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        },
        // Enable Google Search grounding
        tools: [{
          googleSearch: {}
        }]
      });

      const prompt = `You are a Workshop Librarian specializing in woodworking and manufacturing equipment.

Search for the official technical specifications of the ${brand} ${model}.

Extract and return the following information in JSON format:

1. **specs**: Technical specifications as key-value pairs. Include:
   - Power (watts or HP)
   - Dimensions (L x W x H in mm)
   - Weight (kg)
   - RPM or speed ratings
   - Voltage requirements
   - Any other relevant technical specs

2. **manualUrl**: The official manual download URL or product documentation page. If not found, return null.

3. **productPageUrl**: The official manufacturer product page URL. If not found, return null.

4. **maintenanceTasks**: Array of 5 recommended maintenance tasks specific to this tool. Examples:
   - "Check and replace carbon brushes every 100 hours"
   - "Lubricate guide rails weekly"
   - "Clean dust collection port after each use"
   - "Inspect power cord for damage monthly"
   - "Calibrate fence alignment quarterly"

5. **maintenanceIntervalHours**: Recommended service interval in operating hours (number).

Return ONLY valid JSON matching this exact schema:
{
  "specs": { "Power": "2200W", "RPM": "24000", ... },
  "manualUrl": "https://..." or null,
  "productPageUrl": "https://..." or null,
  "maintenanceTasks": ["task1", "task2", "task3", "task4", "task5"],
  "maintenanceIntervalHours": 200
}

If you cannot find specific information, use reasonable estimates based on similar tools in the same category. Mark estimated values with "(est.)" suffix.`;

      const result = await generativeModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      console.log('Gemini response:', text);

      // Parse the JSON response
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      let enrichedData;
      try {
        enrichedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError);
        // Return a structured error response
        throw new HttpsError(
          'internal',
          'Failed to parse AI response. Please try again.'
        );
      }

      // Validate and normalize the response
      const normalizedData = {
        specs: enrichedData.specs || {},
        manualUrl: enrichedData.manualUrl || null,
        productPageUrl: enrichedData.productPageUrl || null,
        maintenanceTasks: Array.isArray(enrichedData.maintenanceTasks) 
          ? enrichedData.maintenanceTasks.slice(0, 5)
          : generateDefaultMaintenanceTasks(),
        maintenanceIntervalHours: typeof enrichedData.maintenanceIntervalHours === 'number'
          ? enrichedData.maintenanceIntervalHours
          : 200,
        // Metadata
        enrichedAt: new Date().toISOString(),
        enrichedBy: 'gemini-2.0-flash',
        searchQuery: `${brand} ${model}`,
      };

      console.log('Enriched data:', normalizedData);
      return normalizedData;

    } catch (error) {
      console.error('Error enriching asset data:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        'internal',
        `Failed to enrich asset data: ${error.message}`
      );
    }
  }
);

/**
 * Generate default maintenance tasks for common power tools
 */
function generateDefaultMaintenanceTasks() {
  return [
    'Inspect power cord and plug for damage',
    'Clean air vents and cooling system',
    'Check and tighten all fasteners',
    'Lubricate moving parts as per manual',
    'Test safety switches and guards'
  ];
}
