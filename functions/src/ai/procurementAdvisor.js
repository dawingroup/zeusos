/**
 * Procurement Advisor Cloud Function
 *
 * Two-stage AI pipeline:
 * 1. Gemini 2.0 Flash with Google Search grounding — web lookup for supplier
 *    addresses, websites, certifications, news, reviews.
 * 2. Claude Sonnet — analyzes supplier performance, generates procurement
 *    recommendations, price trend analysis, and risk assessment.
 *
 * Actions:
 *   'enrich'       — Stage 1 only (Gemini web search)
 *   'analyze'      — Stage 2 only (Claude analysis)
 *   'full-analysis' — Stage 1 + Stage 2
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

function buildSupplierEnrichmentPrompt(supplier) {
  const name = supplier.name || supplier.tradeName || 'Unknown';
  const location = supplier.address?.country || supplier.address?.city || '';
  const categories = (supplier.categories || []).join(', ');

  return `You are a business intelligence researcher.

Search for the company "${name}"${location ? ` based in or near ${location}` : ''}.
${categories ? `They supply: ${categories}.` : ''}
${supplier.website ? `Known website: ${supplier.website}` : ''}
${supplier.email ? `Known email: ${supplier.email}` : ''}
${supplier.registrationNumber ? `Registration: ${supplier.registrationNumber}` : ''}

Find and return comprehensive company information as valid JSON:
{
  "website": "https://..." or null,
  "addresses": [
    {
      "type": "headquarters",
      "line1": "...",
      "line2": null,
      "city": "...",
      "region": "...",
      "country": "...",
      "postalCode": "...",
      "phone": "...",
      "email": "..."
    }
  ],
  "socialMedia": [{ "platform": "LinkedIn", "url": "https://..." }],
  "certifications": ["ISO 9001", "FSC Certified"],
  "yearEstablished": 2005,
  "employeeCount": "50-200",
  "annualRevenue": "$1M-$5M",
  "specializations": ["hardwood lumber", "custom millwork"],
  "brands": ["Brand A", "Brand B"],
  "serviceAreas": ["East Africa", "Uganda"],
  "reviews": [{ "source": "Google", "rating": 4.2, "reviewCount": 35 }],
  "newsAlerts": [
    {
      "title": "...",
      "date": "2025-01-15",
      "summary": "...",
      "sentiment": "positive"
    }
  ]
}

Guidelines:
- Only include information you can verify through search
- Use null for fields where no data is found
- For addresses, include all locations found (HQ, branches, warehouses)
- For certifications, only include officially verifiable ones
- Include recent news (last 12 months) if available
- For reviews, include Google, Trustpilot, or industry-specific review sources

Return ONLY valid JSON, no markdown.`;
}

function buildSupplierAnalysisPrompt(supplier) {
  return `You are a procurement strategy advisor for a manufacturing company.

Analyze this supplier and provide recommendations, risk assessment, and market insights.

## Supplier Profile
- Name: ${supplier.name || 'Unknown'}
- Trade Name: ${supplier.tradeName || 'N/A'}
- Status: ${supplier.status || 'active'}
- Rating: ${supplier.rating ?? 'Not rated'}/5
- Total Orders: ${supplier.totalOrders ?? 0}
- Total Value: $${supplier.totalValue ?? 0}
- On-Time Delivery Rate: ${supplier.onTimeDeliveryRate ?? 'Unknown'}%
- Quality Score: ${supplier.qualityScore ?? 'Unknown'}%
- Payment Terms: ${supplier.paymentTerms || 'Not specified'}
- Categories: ${(supplier.categories || []).join(', ') || 'Not specified'}
- Location: ${supplier.address?.city || ''}, ${supplier.address?.country || 'Unknown'}
- Materials: ${(supplier.materials || []).slice(0, 10).join(', ') || 'Not specified'}

Return your analysis as valid JSON:
{
  "recommendations": [
    {
      "itemId": "",
      "itemName": "General",
      "currentSupplierId": "${supplier.id || ''}",
      "currentSupplierName": "${supplier.name || ''}",
      "recommendedSupplierId": "${supplier.id || ''}",
      "recommendedSupplierName": "${supplier.name || ''}",
      "reason": "...",
      "potentialSavings": { "amount": 0, "currency": "USD", "percentage": 0 },
      "action": "keep",
      "confidence": 80
    }
  ],
  "priceTrends": [
    {
      "supplierId": "${supplier.id || ''}",
      "supplierName": "${supplier.name || ''}",
      "trend": "stable",
      "avgChangePercent": 0,
      "dataPoints": [],
      "forecast": [],
      "renegotiationWindow": null
    }
  ],
  "riskAlerts": [
    {
      "supplierId": "${supplier.id || ''}",
      "supplierName": "${supplier.name || ''}",
      "riskType": "delivery",
      "severity": "low",
      "description": "...",
      "recommendation": "..."
    }
  ],
  "marketInsights": [
    "Insight about the supplier's market position..."
  ]
}

Guidelines:
- recommendations: 1-3 actionable procurement recommendations (keep, switch, renegotiate, add-backup)
- riskAlerts: Assess delivery, quality, financial, concentration, and geopolitical risks
- marketInsights: 2-4 insights about market position, competitive landscape, pricing context
- Base your analysis on the available data; flag where more data would improve accuracy

Return ONLY valid JSON, no markdown.`;
}

// ============================================================================
// CLOUD FUNCTION
// ============================================================================

const procurementAdvisor = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 120,
    cors: ALLOWED_ORIGINS,
    secrets: [GEMINI_API_KEY, ANTHROPIC_API_KEY],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { action, supplier } = request.data;

    if (!action || !supplier) {
      throw new HttpsError('invalid-argument', 'action and supplier are required');
    }

    if (!supplier.name && !supplier.tradeName) {
      throw new HttpsError('invalid-argument', 'Supplier must have a name');
    }

    console.log(`Procurement Advisor [${action}]: ${supplier.name || supplier.tradeName}`);

    try {
      let enrichment = null;
      let analysis = null;

      // Stage 1: Gemini with Google Search grounding for enrichment
      if (action === 'enrich' || action === 'full-analysis') {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
          tools: [{ googleSearch: {} }],
        });

        const prompt = buildSupplierEnrichmentPrompt(supplier);
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('Gemini supplier enrichment response length:', responseText.length);

        try {
          const { parseJsonResponse } = require('../utils/geminiClient');
          enrichment = parseJsonResponse(responseText);
        } catch (parseErr) {
          console.warn('Failed to parse supplier enrichment JSON:', parseErr.message);
          enrichment = {};
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

      // Return enrichment only
      if (action === 'enrich') {
        return { enrichment };
      }

      // Stage 2: Claude for analysis
      if (action === 'analyze' || action === 'full-analysis') {
        const analysisPrompt = buildSupplierAnalysisPrompt(supplier);

        const claudeResponse = await claudeClient.createMessageWithRetry(
          ANTHROPIC_API_KEY.value(),
          'standard',
          'You are a procurement strategy advisor. Always respond with valid JSON only, no explanations or markdown.',
          analysisPrompt,
        );

        try {
          analysis = claudeClient.parseJsonFromResponse(claudeResponse);
        } catch (parseErr) {
          console.warn('Failed to parse Claude analysis JSON:', parseErr.message);
          analysis = {
            recommendations: [],
            priceTrends: [],
            riskAlerts: [],
            marketInsights: [],
          };
        }
      }

      // Compose response
      if (action === 'analyze') {
        return {
          recommendations: analysis?.recommendations || [],
          priceTrends: analysis?.priceTrends || [],
          riskAlerts: analysis?.riskAlerts || [],
          marketInsights: analysis?.marketInsights || [],
        };
      }

      // full-analysis
      return {
        enrichment,
        recommendations: analysis?.recommendations || [],
        priceTrends: analysis?.priceTrends || [],
        riskAlerts: analysis?.riskAlerts || [],
        marketInsights: analysis?.marketInsights || [],
      };
    } catch (error) {
      console.error('Procurement Advisor error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', `Procurement advisor failed: ${error.message}`);
    }
  }
);

module.exports = { procurementAdvisor };
