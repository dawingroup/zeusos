/**
 * Asset Intelligence Cloud Function
 *
 * Two-stage AI pipeline:
 * 1. Gemini 2.0 Flash with Google Search grounding — back-searches brand+model
 *    to find specs, manuals, pricing, discontinuation status, safety alerts.
 * 2. Claude Sonnet — analyzes maintenance history, predicts failures, evaluates
 *    costs & utilization, and generates actionable recommendations.
 *
 * Actions:
 *   'enrich'  — Stage 1 only (Gemini web search)
 *   'analyze' — Stage 1 + Stage 2 (Gemini + Claude)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ALLOWED_ORIGINS } = require('../config/cors');
const claudeClient = require('../utils/claudeClient');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// ============================================================================
// PROMPTS
// ============================================================================

function buildEnrichmentPrompt(asset) {
  const searchTerm = [asset.brand, asset.model].filter(Boolean).join(' ');
  const category = asset.category || 'equipment';

  return `You are a technical equipment researcher specializing in ${category}.

Search for the ${searchTerm} and gather comprehensive product information.

Return your findings as valid JSON with this exact structure:
{
  "specs": { "key": "value" },
  "manualUrl": "https://..." or null,
  "productPageUrl": "https://..." or null,
  "currentRetailPrice": { "amount": 0, "currency": "USD", "source": "..." } or null,
  "discontinuedStatus": "active" | "discontinued" | "end-of-life" | "unknown",
  "replacementModel": "..." or null,
  "safetyAlerts": ["..."] or [],
  "accessories": ["..."] or [],
  "commonIssues": ["..."] or [],
  "warrantyInfo": "..." or null,
  "yearReleased": 2020 or null,
  "consumablesAndParts": [
    {
      "name": "Part name",
      "type": "cutting-tool" | "abrasive" | "filter" | "lubricant" | "wear-part" | "electrical" | "accessory",
      "partNumber": "Manufacturer part number or null",
      "expectedLifeHours": 100,
      "isCritical": true,
      "replacementTrigger": "When to replace",
      "estimatedCost": { "amount": 25, "currency": "USD" },
      "fitmentNotes": "Compatibility details"
    }
  ]
}

Guidelines:
- specs: Include power, dimensions, weight, RPM/speed, voltage, and any category-specific specs
- manualUrl/productPageUrl: Only include if you find real, verified URLs
- currentRetailPrice: Current market price from a reputable source
- discontinuedStatus: Check if the product is still being manufactured
- replacementModel: If discontinued, what replaced it
- safetyAlerts: Any recalls or safety notices
- commonIssues: Known reliability issues from user reports/forums
- warrantyInfo: Standard warranty terms
- consumablesAndParts: List ALL consumable items and replacement/wear parts this tool requires:
  * Cutting tools (blades, bits, inserts) with expected life in operating hours
  * Filters and bags that need periodic replacement
  * Wear parts (belts, brushes, bearings, seals) that fail over time
  * Lubricants and cleaning agents required for maintenance
  * Electrical parts (carbon brushes, fuses) that wear out
  * For each: name, type (cutting-tool/abrasive/filter/lubricant/wear-part/electrical/accessory), manufacturer part number if known, expected life hours, whether it's critical for operation

${asset.existingSpecs ? `Existing specs to supplement (don't overwrite unless you have better data): ${JSON.stringify(asset.existingSpecs)}` : ''}

Return ONLY valid JSON, no markdown.`;
}

function buildAnalysisPrompt(data) {
  const { asset, enrichment, maintenanceHistory, statusHistory, localMetrics } = data;

  return `You are an equipment lifecycle analyst for a manufacturing/woodworking company.

Analyze this asset and provide maintenance predictions, utilization insights, and recommendations.

## Asset Profile
- Brand: ${asset.brand || 'Unknown'}
- Model: ${asset.model || 'Unknown'}
- Category: ${asset.category || 'General'}
- Current Status: ${asset.status || 'Unknown'}
- Maintenance Interval: ${asset.maintenance?.intervalHours || 'Not set'} hours
- Next Service Due: ${asset.maintenance?.nextServiceDue || 'Not set'}
- Last Serviced: ${asset.maintenance?.lastServicedAt || 'Never'}

${enrichment ? `## Enriched Data
- Discontinued: ${enrichment.discontinuedStatus || 'unknown'}
- Common Issues: ${(enrichment.commonIssues || []).join(', ') || 'None found'}
- Safety Alerts: ${(enrichment.safetyAlerts || []).join(', ') || 'None'}
- Known Consumables/Parts: ${(enrichment.consumablesAndParts || []).map(p => p.name).join(', ') || 'None identified'}
` : ''}

## Maintenance History (${(maintenanceHistory || []).length} records)
${(maintenanceHistory || []).slice(0, 10).map(log =>
    `- ${log.performedAt}: ${log.type} — ${log.description || 'No description'} (Cost: ${log.cost ?? 'N/A'}, Hours: ${log.hoursAtService ?? 'N/A'})`
  ).join('\n') || 'No maintenance records'}

## Status History (${(statusHistory || []).length} changes)
${(statusHistory || []).slice(0, 10).map(sc =>
    `- ${sc.changedAt}: ${sc.fromStatus} → ${sc.toStatus} (${sc.reason || 'No reason'})`
  ).join('\n') || 'No status changes'}

## Computed Metrics
- Total Maintenance Cost: $${localMetrics?.costAnalysis?.totalMaintenanceCost ?? 0}
- Avg Cost Per Service: $${localMetrics?.costAnalysis?.avgCostPerService ?? 0}
- Cost Trend: ${localMetrics?.costAnalysis?.costTrend || 'stable'}
- Projected Annual Cost: $${localMetrics?.costAnalysis?.projectedAnnualCost ?? 0}
- Uptime: ${localMetrics?.utilization?.uptimePercentage ?? 100}%
- Avg Checkout Duration: ${localMetrics?.utilization?.avgCheckoutDuration || 'N/A'}

Return your analysis as valid JSON with this exact structure:
{
  "maintenancePredictions": [
    {
      "nextFailureWindow": { "earliest": "2025-06-01", "latest": "2025-08-01" },
      "confidence": 75,
      "riskLevel": "medium",
      "predictedIssue": "...",
      "recommendedAction": "...",
      "estimatedCost": 150,
      "basedOn": "..."
    }
  ],
  "utilization": {
    "peakUsagePeriods": ["Monday-Friday mornings"],
    "idlePeriods": ["Weekends"],
    "utilizationTrend": "stable",
    "recommendation": "..."
  },
  "costAnalysis": {
    "costPerOperatingHour": 2.50,
    "replacementBreakeven": "In approximately 18 months at current cost trajectory"
  },
  "recommendations": [
    {
      "type": "maintenance",
      "priority": "high",
      "title": "...",
      "description": "...",
      "estimatedImpact": "...",
      "estimatedCost": 200
    }
  ],
  "repairPartsStrategy": {
    "criticalSpares": [
      {
        "part": "Part name",
        "reason": "Why this spare is critical to stock",
        "recommendedStock": 1,
        "estimatedCost": 350,
        "replacementInterval": "Every 3000-5000 hours"
      }
    ],
    "maintenanceKits": [
      {
        "name": "Kit name",
        "parts": ["Part 1", "Part 2"],
        "frequency": "Annually or every 2000 hours",
        "estimatedCost": 180
      }
    ],
    "uptimeRiskAssessment": "Overall uptime risk assessment and key recommendations"
  }
}

Provide 1-3 maintenance predictions, 2-5 recommendations. Be specific and actionable.
For repairPartsStrategy: identify critical spares that would cause extended downtime if not stocked, suggest practical maintenance kits, and assess overall uptime risk.
Return ONLY valid JSON, no markdown.`;
}

// ============================================================================
// CLOUD FUNCTION
// ============================================================================

const assetIntelligence = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 120,
    cors: ALLOWED_ORIGINS,
    secrets: [GEMINI_API_KEY, ANTHROPIC_API_KEY],
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { action, asset, maintenanceHistory, statusHistory, localMetrics } = request.data;

    if (!action || !asset) {
      throw new HttpsError('invalid-argument', 'action and asset are required');
    }

    if (!asset.brand && !asset.model) {
      throw new HttpsError('invalid-argument', 'Asset must have brand or model');
    }

    console.log(`Asset Intelligence [${action}]: ${asset.brand} ${asset.model}`);

    try {
      // Stage 1: Gemini with Google Search grounding for enrichment
      let enrichment = null;

      if (action === 'enrich' || action === 'analyze') {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
          tools: [{ googleSearch: {} }],
        });

        const prompt = buildEnrichmentPrompt(asset);
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('Gemini enrichment response length:', responseText.length);

        // Parse JSON from response
        try {
          const { parseJsonResponse } = require('../utils/geminiClient');
          enrichment = parseJsonResponse(responseText);
        } catch (parseErr) {
          console.warn('Failed to parse enrichment JSON, using empty:', parseErr.message);
          enrichment = { specs: {} };
        }

        // Extract grounding citations
        const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          enrichment._sources = groundingMetadata.groundingChunks
            .filter(c => c.web)
            .map(c => ({ url: c.web.uri, title: c.web.title }))
            .slice(0, 5);
        }

        enrichment._searchQueries = groundingMetadata?.webSearchQueries || [];
      }

      // If enrich-only, return now
      if (action === 'enrich') {
        return { enrichment };
      }

      // Stage 2: Claude for analysis and recommendations
      if (action === 'analyze') {
        const analysisPrompt = buildAnalysisPrompt({
          asset,
          enrichment,
          maintenanceHistory,
          statusHistory,
          localMetrics,
        });

        const claudeResponse = await claudeClient.createMessageWithRetry(
          ANTHROPIC_API_KEY.value(),
          'standard',
          'You are an equipment lifecycle analyst. Always respond with valid JSON only, no explanations or markdown.',
          analysisPrompt,
        );

        let analysis;
        try {
          analysis = claudeClient.parseJsonFromResponse(claudeResponse);
        } catch (parseErr) {
          console.warn('Failed to parse Claude analysis JSON:', parseErr.message);
          analysis = {
            maintenancePredictions: [],
            utilization: {},
            costAnalysis: {},
            recommendations: [],
          };
        }

        return {
          enrichment,
          maintenancePredictions: analysis.maintenancePredictions || [],
          utilization: analysis.utilization || {},
          costAnalysis: analysis.costAnalysis || {},
          recommendations: analysis.recommendations || [],
          repairPartsStrategy: analysis.repairPartsStrategy || null,
        };
      }

      throw new HttpsError('invalid-argument', `Unknown action: ${action}. Use 'enrich' or 'analyze'.`);
    } catch (error) {
      console.error('Asset Intelligence error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', `Asset intelligence failed: ${error.message}`);
    }
  }
);

module.exports = { assetIntelligence };
