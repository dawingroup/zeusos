/**
 * Strategy Report Generator Cloud Function (Gen 2)
 * Uses Gemini with Google Search grounding to generate design strategy reports
 * that match current trends to available manufacturing features
 *
 * Using v2 API (firebase-functions v4.x)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Define secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();


/**
 * Generate a strategy report for a design project
 * Step 1: Search for design trends
 * Step 2: Fetch available features from Feature Library
 * Step 3: Match trends to available features
 * Step 4: Return structured JSON for PDF report
 */
exports.generateStrategyReport = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 300,
    secrets: [GEMINI_API_KEY],
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    // Get API key from secrets
    const apiKey = GEMINI_API_KEY.value();

    const {
      projectName,
      projectType,
      clientBrief,
      location = 'East Africa',
      year = new Date().getFullYear(),
      // Enhanced inputs
      constraints = [],
      painPoints = [],
      goals = [],
      budgetTier,
      spaceDetails,
      researchFindings = [],
      researchExcerpts = [],
      // Scoping context from ProjectScopingAI
      scopingContext,
      // Enhanced project context from ProjectContextSection
      projectContext,
      // Selected product recommendations
      recommendedProducts = [],
    } = request.data;

    // Validate input
    if (!projectName || !clientBrief) {
      throw new HttpsError('invalid-argument', 'projectName and clientBrief are required');
    }

    console.log(`Generating strategy report for: ${projectName}`);
    console.log(`Enhanced inputs: ${constraints.length} constraints, ${painPoints.length} pain points, ${goals.length} goals, ${researchFindings.length} findings`);
    console.log(`Product recommendations: ${recommendedProducts.length}, Scoping context: ${scopingContext ? 'yes' : 'no'}, Project context: ${projectContext ? 'yes' : 'no'}`);

    try {
      // ============================================
      // Step 1: Fetch Available Features from Firestore
      // ============================================
      console.log('Step 1: Fetching available features...');

      // Use consolidated featureLibrary collection (migrated from legacy 'features')
      const featuresSnapshot = await db
        .collection('featureLibrary')
        .where('status', '==', 'active')
        .get();

      const availableFeatures = [];
      const featureAssetMap = new Map();

      for (const doc of featuresSnapshot.docs) {
        const feature = { id: doc.id, ...doc.data() };
        availableFeatures.push(feature);

        // Fetch asset details for each feature
        if (feature.requiredAssetIds && feature.requiredAssetIds.length > 0) {
          const assets = [];
          for (const assetId of feature.requiredAssetIds) {
            const assetDoc = await db.collection('assets').doc(assetId).get();
            if (assetDoc.exists) {
              const assetData = assetDoc.data();
              assets.push({
                id: assetId,
                name: assetData.nickname || `${assetData.brand} ${assetData.model}`,
                status: assetData.status,
              });
            }
          }
          featureAssetMap.set(feature.id, assets);
        }
      }

      console.log(`Found ${availableFeatures.length} available features`);

      // ============================================
      // Step 1b: Fetch Relevant Products and Inspirations
      // ============================================
      console.log('Step 1b: Fetching products and inspirations...');

      // Fetch products from launch pipeline for recommendations
      const productsSnapshot = await db
        .collection('launchProducts')
        .where('currentStage', 'in', ['launched', 'ready', 'photoshoot', 'seo'])
        .limit(30)
        .get();

      const catalogProducts = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        category: doc.data().category,
        description: doc.data().description?.substring(0, 150),
        materials: doc.data().specifications?.materials || [],
        tags: doc.data().tags || [],
      }));

      console.log(`Found ${catalogProducts.length} catalog products`);

      // Fetch design inspirations
      const clipsSnapshot = await db
        .collection('designClips')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const inspirations = clipsSnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        tags: doc.data().tags || [],
        imageUrl: doc.data().imageUrl,
        notes: doc.data().notes?.substring(0, 100),
      }));

      console.log(`Found ${inspirations.length} inspirations`);

      // Build feature list for prompt
      const featureListForPrompt = availableFeatures.map(f => ({
        id: f.id,
        name: f.name,
        category: f.category,
        description: f.description,
        tags: f.tags || [],
      }));

      // ============================================
      // Step 2: Generate Strategy with Google Search Grounding
      // ============================================
      console.log('Step 2: Generating strategy with AI...');

      const genAI = new GoogleGenerativeAI(apiKey);

      // Try with Google Search grounding first, fallback to non-grounded if it fails
      let model;
      let useGrounding = true;

      try {
        model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 4096,
          },
          // Enable Google Search grounding for trend research
          tools: [{ googleSearch: {} }]
        });
      } catch (groundingError) {
        console.warn('Google Search grounding not available, using standard model:', groundingError.message);
        useGrounding = false;
        model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 4096,
          },
        });
      }

      // Build context sections
      const constraintsSection = constraints.length > 0
        ? `\n**CLIENT CONSTRAINTS:**\n${constraints.map(c => `- ${c}`).join('\n')}`
        : '';

      const painPointsSection = painPoints.length > 0
        ? `\n**PAIN POINTS TO ADDRESS:**\n${painPoints.map(p => `- ${p}`).join('\n')}`
        : '';

      const goalsSection = goals.length > 0
        ? `\n**PROJECT GOALS:**\n${goals.map(g => `- ${g}`).join('\n')}`
        : '';

      const budgetSection = budgetTier
        ? `\n**BUDGET TIER:** ${budgetTier}`
        : '';

      const spaceSection = spaceDetails
        ? `\n**SPACE DETAILS:** ${spaceDetails}`
        : '';

      const findingsSection = researchFindings.length > 0
        ? `\n**PRIOR RESEARCH FINDINGS:**\n${researchFindings.map(f => `- ${f.title}: ${f.content.substring(0, 200)}`).join('\n')}`
        : '';

      const excerptSection = researchExcerpts.length > 0
        ? `\n**RESEARCH ASSISTANT INSIGHTS:**\n${researchExcerpts.map((e, i) => `[Insight ${i+1}]: ${e}`).join('\n\n')}`
        : '';

      // Project context section
      const projectContextSection = projectContext ? `
**ENHANCED PROJECT CONTEXT:**
${projectContext.customer?.name ? `- Customer: ${projectContext.customer.name} (${projectContext.customer.company || 'Individual'})` : ''}
${projectContext.customer?.industry ? `- Industry: ${projectContext.customer.industry}` : ''}
${projectContext.timeline?.urgency ? `- Urgency: ${projectContext.timeline.urgency}` : ''}
${projectContext.style?.primary ? `- Primary Style: ${projectContext.style.primary}` : ''}
${projectContext.style?.secondary ? `- Secondary Style: ${projectContext.style.secondary}` : ''}
${projectContext.style?.materialPreferences?.length ? `- Material Preferences: ${projectContext.style.materialPreferences.join(', ')}` : ''}
${projectContext.style?.colorPreferences?.length ? `- Color Preferences: ${projectContext.style.colorPreferences.join(', ')}` : ''}
${projectContext.targetUsers?.demographics ? `- Target Users: ${projectContext.targetUsers.demographics}` : ''}
${projectContext.requirements?.sustainability ? '- Sustainability: Required' : ''}
${projectContext.requirements?.localSourcing ? '- Local Sourcing: Required' : ''}
` : '';

      // Recommended products section (user-selected from catalog)
      const recommendedProductsSection = recommendedProducts.length > 0
        ? `\n**PRE-SELECTED PRODUCT RECOMMENDATIONS:**\nThe following products have been selected from our catalog for this project:\n${recommendedProducts.map(p => `- ${p.productName} (${p.category}): ${p.reason || 'No reason provided'}`).join('\n')}`
        : '';

      // Catalog products section (for AI to consider)
      const catalogSection = catalogProducts.length > 0
        ? `\n**AVAILABLE CATALOG PRODUCTS:**\nThese products from our catalog may be relevant:\n${catalogProducts.slice(0, 15).map(p => `- ${p.name} (${p.category}): ${p.description || 'No description'}`).join('\n')}`
        : '';

      // Inspirations section
      const inspirationsSection = inspirations.length > 0
        ? `\n**SAVED DESIGN INSPIRATIONS:**\n${inspirations.slice(0, 10).map(i => `- ${i.title || 'Untitled'}: ${i.notes || 'No notes'}${i.tags?.length ? ` [Tags: ${i.tags.join(', ')}]` : ''}`).join('\n')}`
        : '';

      const prompt = `You are a Senior Interior Design Strategist for a custom millwork and furniture manufacturing company in ${location}.

**PROJECT CONTEXT:**
- Project Name: ${projectName}
- Project Type: ${projectType || 'Custom Millwork'}
- Client Brief: ${clientBrief}
- Year: ${year}
- Location: ${location}
${budgetSection}
${spaceSection}
${constraintsSection}
${painPointsSection}
${goalsSection}
${findingsSection}
${excerptSection}
${projectContextSection}
${recommendedProductsSection}
${catalogSection}
${inspirationsSection}

**STEP 1 - RESEARCH:**
Using Google Search, research current interior design trends for ${year} relevant to ${location} and ${projectType || 'custom millwork'}. Focus on:
- Material trends (wood species, finishes, textures)
- Color palettes trending in the region
- Design styles (modern, transitional, African contemporary, etc.)
- Functional features in demand
- Sustainability and local sourcing considerations

**STEP 2 - MATCH TO AVAILABLE CAPABILITIES:**
Here are the manufacturing features we can currently produce (all equipment is operational):

${JSON.stringify(featureListForPrompt, null, 2)}

**STEP 3 - GENERATE STRATEGY:**
Create a comprehensive design strategy that:
1. Identifies 3-5 key trends that match the client brief AND address their pain points
2. Maps each trend to specific features from our available capabilities
3. Provides implementation recommendations that respect constraints
4. Estimates complexity and timeline considering the budget tier

**OUTPUT FORMAT:**
Return ONLY valid JSON matching this exact schema:

{
  "reportTitle": "Strategy Report: [Project Name]",
  "generatedAt": "ISO date string",
  "executiveSummary": "2-3 paragraph summary of the strategy",
  "trends": [
    {
      "name": "Trend name",
      "description": "Description of the trend",
      "relevanceScore": 85,
      "source": "Source of the trend info"
    }
  ],
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Detailed recommendation",
      "trendName": "Related trend name",
      "matchedFeatures": [
        {
          "featureId": "feature-id-from-list",
          "featureName": "Feature name",
          "rationale": "Why this feature supports this recommendation"
        }
      ],
      "complexity": "simple" | "moderate" | "complex",
      "estimatedDays": 5,
      "priority": "high" | "medium" | "low"
    }
  ],
  "materialPalette": [
    {
      "material": "Material name",
      "application": "Where to use it",
      "finish": "Suggested finish"
    }
  ],
  "colorScheme": {
    "primary": "#hexcode",
    "secondary": "#hexcode",
    "accent": "#hexcode",
    "description": "Color scheme rationale"
  },
  "productionFeasibility": {
    "overallScore": 85,
    "notes": "Feasibility assessment",
    "requiredFeatures": ["Feature names"],
    "estimatedTotalDays": 30
  },
  "nextSteps": [
    "Step 1 description",
    "Step 2 description"
  ],
  "productRecommendations": [
    {
      "productId": "product-id-from-catalog",
      "productName": "Product name",
      "category": "Product category",
      "rationale": "Why this product fits the project",
      "priority": "essential" | "recommended" | "optional"
    }
  ],
  "inspirationGallery": [
    {
      "title": "Inspiration title",
      "relevance": "How this inspiration relates to the project",
      "designElements": ["Element 1", "Element 2"]
    }
  ]
}`;

      let result;
      let text;

      try {
        result = await model.generateContent(prompt);
        const response = result.response;
        text = response.text();
      } catch (genError) {
        console.warn('Generation with grounding failed, retrying without:', genError.message);
        // Retry without grounding
        const fallbackModel = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 4096,
          },
        });
        result = await fallbackModel.generateContent(prompt);
        text = result.response.text();
      }

      console.log('AI response received, length:', text.length);
      console.log('AI response preview:', text.substring(0, 500));

      // Parse JSON response - try multiple extraction methods
      let jsonStr = text;

      // Method 1: Extract from code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // Method 2: Find JSON object directly
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonStr = text.substring(jsonStart, jsonEnd + 1);
        }
      }

      console.log('Extracted JSON length:', jsonStr.length);

      let strategyData;
      try {
        strategyData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError.message);
        console.error('JSON string preview:', jsonStr.substring(0, 300));
        throw new HttpsError('internal', `Failed to parse strategy response: ${parseError.message}`);
      }

      // ============================================
      // Step 3: Enrich with Asset Details
      // ============================================
      console.log('Step 3: Enriching with asset details...');

      // Add asset details to matched features
      if (strategyData.recommendations) {
        for (const rec of strategyData.recommendations) {
          if (rec.matchedFeatures) {
            for (const mf of rec.matchedFeatures) {
              const assets = featureAssetMap.get(mf.featureId);
              if (assets) {
                mf.requiredAssets = assets;
              }
            }
          }
        }
      }

      // Build production feasibility section with full asset list
      const allMatchedFeatureIds = new Set();
      if (strategyData.recommendations) {
        for (const rec of strategyData.recommendations) {
          if (rec.matchedFeatures) {
            for (const mf of rec.matchedFeatures) {
              allMatchedFeatureIds.add(mf.featureId);
            }
          }
        }
      }

      const productionDetails = [];
      for (const featureId of allMatchedFeatureIds) {
        const feature = availableFeatures.find(f => f.id === featureId);
        const assets = featureAssetMap.get(featureId) || [];

        if (feature) {
          productionDetails.push({
            featureId,
            featureName: feature.name,
            category: feature.category,
            estimatedMinutes: feature.estimatedMinutes || 30,
            requiredAssets: assets,
          });
        }
      }

      strategyData.productionDetails = productionDetails;

      // ============================================
      // Step 4: Enrich Product Recommendations
      // ============================================
      console.log('Step 4: Enriching product recommendations...');

      // Merge AI-suggested products with user-selected products
      const allProductRecommendations = [
        // User-selected products take priority
        ...recommendedProducts.map(p => ({
          productId: p.productId,
          productName: p.productName,
          category: p.category,
          rationale: p.reason || 'User selected',
          priority: 'essential',
          source: 'user-selected',
        })),
        // Add AI recommendations (avoiding duplicates)
        ...(strategyData.productRecommendations || [])
          .filter(p => !recommendedProducts.some(rp => rp.productId === p.productId))
          .map(p => ({ ...p, source: 'ai-recommended' })),
      ];

      strategyData.productRecommendations = allProductRecommendations;

      // Add full product details for recommendations
      if (strategyData.productRecommendations) {
        for (const rec of strategyData.productRecommendations) {
          const product = catalogProducts.find(p => p.id === rec.productId);
          if (product) {
            rec.productDetails = {
              description: product.description,
              materials: product.materials,
              tags: product.tags,
            };
          }
        }
      }

      // ============================================
      // Step 5: Enrich Inspiration Gallery
      // ============================================
      console.log('Step 5: Enriching inspiration gallery...');

      // Match AI inspiration suggestions with actual clips
      if (strategyData.inspirationGallery) {
        for (const insp of strategyData.inspirationGallery) {
          const clip = inspirations.find(c =>
            c.title?.toLowerCase().includes(insp.title?.toLowerCase()) ||
            insp.title?.toLowerCase().includes(c.title?.toLowerCase())
          );
          if (clip) {
            insp.clipId = clip.id;
            insp.imageUrl = clip.imageUrl;
            insp.tags = clip.tags;
          }
        }
      }

      // Add metadata
      strategyData.metadata = {
        generatedAt: new Date().toISOString(),
        projectName,
        projectType,
        location,
        year,
        totalAvailableFeatures: availableFeatures.length,
        featuresProposed: productionDetails.length,
        catalogProductsConsidered: catalogProducts.length,
        inspirationsConsidered: inspirations.length,
        userSelectedProducts: recommendedProducts.length,
        hasProjectContext: !!projectContext,
        hasScopingContext: !!scopingContext,
      };

      console.log('Strategy report generated successfully');
      return strategyData;

    } catch (error) {
      console.error('Error generating strategy report:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', `Failed to generate strategy report: ${error.message}`);
    }
  }
);
