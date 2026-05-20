/**
 * Strategy Research Cloud Function
 * 
 * Provides focused research capabilities using Gemini with Google Search grounding.
 * Supports different research types: trends, capacity, budget, competitors.
 * Returns structured findings with verifiable citations.
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

// Use Gemini API key from Firebase secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Import rate limiter
const { checkRateLimit } = require('../utils/rateLimiter');

// Import memory loader
const { getMemoryContext } = require('../utils/memoryLoader');

// ============================================
// Type Definitions (for documentation)
// ============================================

/**
 * @typedef {Object} StrategyResearchRequest
 * @property {string} projectId - Project ID for context
 * @property {'trends'|'capacity'|'budget'|'competitors'} researchType - Type of research
 * @property {Object} context - Research context
 * @property {string} [context.projectType] - restaurant, hotel, office, retail
 * @property {string} [context.location] - Geographic location
 * @property {number} [context.budget] - Budget amount
 * @property {number} [context.squareMeters] - Space size
 * @property {string} query - Specific research query
 */

/**
 * @typedef {Object} StrategyResearchResponse
 * @property {string} findings - Main research findings
 * @property {Array<Citation>} sources - Cited sources
 * @property {Array<string>} searchQueries - Queries used for search
 * @property {Array<StructuredInsight>} insights - Parsed structured insights
 * @property {Object} usageMetadata - Token usage info
 */

/**
 * @typedef {Object} Citation
 * @property {string} url - Source URL
 * @property {string} title - Source title
 * @property {string} domain - Source domain
 * @property {number} relevance - Relevance score 0-1
 */

/**
 * @typedef {Object} StructuredInsight
 * @property {string} category - Insight category
 * @property {string} title - Insight title
 * @property {string} content - Insight content
 * @property {string} [source] - Source reference
 */

// ============================================
// Research Prompt Builders
// ============================================

/**
 * Build research prompt based on type and context
 * @param {'trends'|'capacity'|'budget'|'competitors'} type
 * @param {Object} context
 * @param {string} query
 * @returns {string}
 */
function buildResearchPrompt(type, context, query) {
  const location = context.location || 'East Africa';
  const projectType = context.projectType || 'hospitality';
  const year = new Date().getFullYear();

  const prompts = {
    trends: `You are a design trends researcher for custom furniture and millwork.

Research current ${year} interior design trends for ${projectType} projects in ${location}.

Focus on:
1. **Material Trends**: Wood species, finishes, textures, sustainable options
2. **Color Palettes**: Trending colors for ${projectType} spaces
3. **Design Styles**: Modern, transitional, African contemporary, industrial, etc.
4. **Fixture Styles**: Hardware, lighting integration, functional elements
5. **Spatial Layouts**: Open concepts, modular systems, flexible spaces

Specific Query: ${query}

Provide your findings with:
- Clear trend names and descriptions
- Relevance to ${location} market
- Implementation considerations for custom millwork
- Source citations for each trend`,

    capacity: `You are a space planning expert for ${projectType} environments.

Calculate recommended seating/workspace capacity for a ${context.squareMeters || 'TBD'}m² ${projectType} space.

Consider:
1. **Local Regulations**: Building codes, fire safety requirements for ${location}
2. **Comfort Standards**: Industry benchmarks for ${projectType}
3. **Traffic Flow**: Circulation paths, service areas, accessibility
4. **Furniture Footprints**: Standard sizes for ${projectType} furniture
5. **Zoning**: Different use areas within the space

Reference Standards:
- Fine Dining: 15-20 sqft (1.4-1.9 m²) per seat
- Casual Dining: 12-15 sqft (1.1-1.4 m²) per seat
- Fast Casual: 10-12 sqft (0.9-1.1 m²) per seat
- Hotel Lobby: 25-35 sqft (2.3-3.3 m²) per seat
- Office: 100-150 sqft (9-14 m²) per workstation

Query: ${query}

Provide capacity calculations with justification and regulatory references.`,

    budget: `You are a project budgeting specialist for custom millwork and furniture.

Analyze typical budgets for ${projectType} fitouts in ${location}.

Context:
- Project Budget: $${context.budget?.toLocaleString() || 'Not specified'}
- Space Size: ${context.squareMeters || 'TBD'} m²
- Location: ${location}

Research:
1. **Market Benchmarks**: Typical $/m² or $/sqft for ${projectType} millwork
2. **Tier Classification**: Where does this budget fit?
   - Economy: Basic materials, standard designs
   - Standard: Quality materials, custom designs
   - Premium: High-end materials, complex designs
   - Luxury: Top-tier everything, bespoke craftsmanship
3. **Cost Breakdown**: Typical allocation (materials, labor, finishing)
4. **Regional Factors**: East African market considerations
5. **Value Engineering**: Suggestions to optimize budget

Query: ${query}

Provide budget analysis with market comparisons and tier recommendations.`,

    competitors: `You are a market research analyst for custom furniture and millwork.

Research competitor offerings and market positioning for ${projectType} furniture and millwork in ${location}.

Focus on:
1. **Key Players**: Major millwork/furniture manufacturers in the region
2. **Market Positioning**: Premium vs. value offerings
3. **Unique Selling Points**: What differentiates competitors
4. **Pricing Strategies**: Typical pricing structures
5. **Capabilities Comparison**: Common vs. unique capabilities
6. **Market Gaps**: Underserved segments or capabilities

Query: ${query}

Provide competitive analysis with specific company names and market insights where available.`,
  };

  return prompts[type] || `Research the following for ${projectType} in ${location}:\n\n${query}`;
}

/**
 * Extract citations from grounding metadata
 * @param {Object} groundingMetadata - Gemini grounding metadata
 * @returns {Array<Citation>}
 */
function extractCitations(groundingMetadata) {
  if (!groundingMetadata) return [];

  const citations = [];

  // Extract from grounding chunks (web search results)
  if (groundingMetadata.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web) {
        citations.push({
          url: chunk.web.uri || '',
          title: chunk.web.title || 'Untitled',
          domain: extractDomain(chunk.web.uri),
          relevance: 0.8, // Default relevance
        });
      }
    }
  }

  // Calculate relevance from grounding supports if available
  if (groundingMetadata.groundingSupports && citations.length > 0) {
    const supportCounts = new Map();
    
    for (const support of groundingMetadata.groundingSupports) {
      if (support.groundingChunkIndices) {
        for (const idx of support.groundingChunkIndices) {
          supportCounts.set(idx, (supportCounts.get(idx) || 0) + 1);
        }
      }
    }

    // Normalize relevance scores
    const maxCount = Math.max(...supportCounts.values(), 1);
    for (let i = 0; i < citations.length; i++) {
      const count = supportCounts.get(i) || 0;
      citations[i].relevance = Math.round((count / maxCount) * 100) / 100;
    }
  }

  // Remove duplicates by URL
  const unique = [];
  const seen = new Set();
  for (const citation of citations) {
    if (citation.url && !seen.has(citation.url)) {
      seen.add(citation.url);
      unique.push(citation);
    }
  }

  return unique;
}

/**
 * Extract domain from URL
 * @param {string} url
 * @returns {string}
 */
function extractDomain(url) {
  if (!url) return 'unknown';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Parse structured insights from response text
 * @param {string} text - AI response text
 * @param {'trends'|'capacity'|'budget'|'competitors'} researchType
 * @returns {Array<StructuredInsight>}
 */
function parseInsights(text, researchType) {
  const insights = [];

  // Category mapping based on research type
  const categoryPatterns = {
    trends: [
      { pattern: /Material Trend[s]?:?\s*([^]*?)(?=Color|Design|Fixture|Spatial|$)/gi, category: 'materials' },
      { pattern: /Color Palette[s]?:?\s*([^]*?)(?=Material|Design|Fixture|Spatial|$)/gi, category: 'colors' },
      { pattern: /Design Style[s]?:?\s*([^]*?)(?=Material|Color|Fixture|Spatial|$)/gi, category: 'styles' },
    ],
    capacity: [
      { pattern: /Capacity:?\s*([^]*?)(?=Regulation|Traffic|Zone|$)/gi, category: 'capacity' },
      { pattern: /Regulation[s]?:?\s*([^]*?)(?=Capacity|Traffic|Zone|$)/gi, category: 'regulations' },
    ],
    budget: [
      { pattern: /Tier:?\s*([^]*?)(?=Cost|Benchmark|Value|$)/gi, category: 'tier' },
      { pattern: /Cost Breakdown:?\s*([^]*?)(?=Tier|Benchmark|Value|$)/gi, category: 'costs' },
    ],
    competitors: [
      { pattern: /Competitor[s]?:?\s*([^]*?)(?=Market|Pricing|Gap|$)/gi, category: 'competitors' },
      { pattern: /Market Gap[s]?:?\s*([^]*?)(?=Competitor|Pricing|$)/gi, category: 'opportunities' },
    ],
  };

  // Extract numbered or bulleted items as insights
  const itemPattern = /(?:^|\n)\s*(?:\d+\.|\*|\-)\s*\*?\*?([^:*]+)\*?\*?:?\s*([^\n]+)/g;
  let match;
  
  while ((match = itemPattern.exec(text)) !== null) {
    const title = match[1].trim();
    const content = match[2].trim();
    
    if (title.length > 3 && content.length > 10) {
      insights.push({
        category: researchType,
        title: title,
        content: content,
        source: null,
      });
    }
  }

  return insights.slice(0, 10); // Limit to 10 insights
}

// ============================================
// RAG Context Retrieval
// ============================================

/**
 * Retrieve relevant context from knowledge base for RAG injection
 * @param {string} query - User query
 * @param {Object} context - Research context
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @returns {Promise<string>} - Formatted context string
 */
async function retrieveKnowledgeContext(query, context, db) {
  const sections = [];
  
  try {
    // Build search terms from query and context
    const searchTerms = [
      query,
      context.projectType,
      context.location,
      ...(context.styleKeywords || []),
      ...(context.materials || []),
    ].filter(Boolean).join(' ').toLowerCase();
    
    // 1. Search products from launch pipeline
    const productsSnapshot = await db.collection('launchProducts')
      .where('currentStage', 'in', ['launched', 'ready', 'photoshoot', 'seo'])
      .limit(50)
      .get();
    
    const matchedProducts = productsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(product => {
        const productText = [
          product.name,
          product.description,
          product.category,
          ...(product.tags || []),
          ...(product.specifications?.materials || []),
        ].filter(Boolean).join(' ').toLowerCase();
        
        // Simple keyword matching
        const terms = searchTerms.split(/\s+/);
        const matchCount = terms.filter(term => productText.includes(term)).length;
        return matchCount >= 2; // At least 2 matching terms
      })
      .slice(0, 5);
    
    if (matchedProducts.length > 0) {
      sections.push('### Relevant Products from Our Catalog');
      for (const product of matchedProducts) {
        sections.push(`- **${product.name}** (${product.category || 'General'})`);
        if (product.description) {
          sections.push(`  ${product.description.substring(0, 150)}...`);
        }
        if (product.specifications?.materials?.length) {
          sections.push(`  Materials: ${product.specifications.materials.join(', ')}`);
        }
      }
      sections.push('');
    }
    
    // 2. Search design inspirations
    const clipsSnapshot = await db.collection('designClips')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();
    
    const matchedClips = clipsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(clip => {
        const clipText = [
          clip.title,
          clip.notes,
          ...(clip.tags || []),
        ].filter(Boolean).join(' ').toLowerCase();
        
        const terms = searchTerms.split(/\s+/);
        const matchCount = terms.filter(term => clipText.includes(term)).length;
        return matchCount >= 1;
      })
      .slice(0, 3);
    
    if (matchedClips.length > 0) {
      sections.push('### Saved Design Inspirations');
      for (const clip of matchedClips) {
        sections.push(`- **${clip.title || 'Inspiration'}**`);
        if (clip.notes) {
          sections.push(`  ${clip.notes.substring(0, 100)}...`);
        }
        if (clip.tags?.length) {
          sections.push(`  Tags: ${clip.tags.join(', ')}`);
        }
      }
      sections.push('');
    }
    
    // 3. Search features library
    const featuresSnapshot = await db.collection('features')
      .where('status', '==', 'active')
      .limit(30)
      .get();
    
    const matchedFeatures = featuresSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(feature => {
        const featureText = [
          feature.name,
          feature.description,
          feature.category,
          ...(feature.tags || []),
        ].filter(Boolean).join(' ').toLowerCase();
        
        const terms = searchTerms.split(/\s+/);
        const matchCount = terms.filter(term => featureText.includes(term)).length;
        return matchCount >= 1;
      })
      .slice(0, 3);
    
    if (matchedFeatures.length > 0) {
      sections.push('### Available Standard Features');
      for (const feature of matchedFeatures) {
        sections.push(`- **${feature.name}** (${feature.category || 'General'})`);
        if (feature.description) {
          sections.push(`  ${feature.description.substring(0, 100)}...`);
        }
      }
      sections.push('');
    }
    
  } catch (error) {
    console.warn('Error retrieving knowledge context:', error.message);
  }
  
  return sections.join('\n');
}

// ============================================
// Main Cloud Function
// ============================================

/**
 * Strategy Research Cloud Function
 * Uses Gemini with Google Search grounding for verifiable research
 */
const strategyResearch = onCall({
  memory: '1GiB',
  timeoutSeconds: 120,
  secrets: [GEMINI_API_KEY],
}, async (request) => {
  // 1. Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const userId = request.auth.uid;
  const { projectId, researchType, context = {}, query, companyId } = request.data;

  // 2. Validate input
  if (!query || typeof query !== 'string' || query.length < 10) {
    throw new HttpsError('invalid-argument', 'Query must be at least 10 characters');
  }

  const validTypes = ['trends', 'capacity', 'budget', 'competitors'];
  if (!validTypes.includes(researchType)) {
    throw new HttpsError('invalid-argument', `Research type must be one of: ${validTypes.join(', ')}`);
  }

  // 3. Rate limiting for grounded search (20/hour)
  try {
    const rateResult = await checkRateLimit(userId, 'search', db);
    if (!rateResult.allowed) {
      throw new HttpsError('resource-exhausted', 
        `Grounded search rate limit exceeded (20/hour). Resets at ${rateResult.resetAt.toISOString()}`);
    }
    console.log(`Rate limit check: ${rateResult.remaining} grounded searches remaining`);
  } catch (error) {
    if (error.code === 'resource-exhausted') throw error;
    console.warn('Rate limit check failed, proceeding:', error.message);
  }

  console.log('Strategy Research request:', { 
    projectId, 
    researchType, 
    queryLength: query.length,
    context: Object.keys(context),
  });

  try {
    // 4. Retrieve relevant knowledge base context (RAG) + business memory
    let knowledgeContext = '';
    let memoryContext = { prompt: '', count: 0 };

    const [ragResult, memResult] = await Promise.allSettled([
      retrieveKnowledgeContext(query, context, db),
      companyId ? getMemoryContext(companyId, 'strategy_research', 10) : Promise.resolve({ prompt: '', count: 0 }),
    ]);

    if (ragResult.status === 'fulfilled' && ragResult.value) {
      knowledgeContext = ragResult.value;
      console.log('Knowledge context retrieved for RAG injection');
    } else if (ragResult.status === 'rejected') {
      console.warn('RAG context retrieval failed:', ragResult.reason?.message);
    }

    if (memResult.status === 'fulfilled') {
      memoryContext = memResult.value;
      if (memoryContext.count > 0) {
        console.log(`Business memory loaded: ${memoryContext.count} memories injected`);
      }
    }

    // 5. Initialize Gemini with Search Grounding
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
      // Enable Google Search grounding
      tools: [{
        googleSearch: {}
      }]
    });

    // 6. Build research prompt with knowledge context
    let prompt = buildResearchPrompt(researchType, context, query);
    
    // Inject knowledge base context if available
    if (knowledgeContext) {
      prompt = `${prompt}\n\n---\n\n## Internal Knowledge Base Context\nThe following information is from our internal catalog and may be relevant to your research:\n\n${knowledgeContext}\n\nPlease incorporate relevant products, inspirations, or features from our catalog in your recommendations where appropriate.`;
    }

    // Inject business memory context if available
    if (memoryContext.prompt) {
      prompt = `${prompt}${memoryContext.prompt}`;
    }

    // 6. Generate response with grounding
    const startTime = Date.now();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseTime = Date.now() - startTime;
    const response = result.response;
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const usageMetadata = response.usageMetadata || {};

    console.log(`Strategy Research response in ${responseTime}ms`);
    console.log(`Grounding: ${groundingMetadata?.groundingChunks?.length || 0} sources found`);

    // 7. Extract citations from grounding metadata
    const citations = extractCitations(groundingMetadata);

    // 8. Extract search queries used
    const searchQueries = groundingMetadata?.webSearchQueries || [];

    // 9. Parse structured insights
    const insights = parseInsights(responseText, researchType);

    // 10. Save research to project if projectId provided
    if (projectId) {
      try {
        await db.collection('designProjects').doc(projectId)
          .collection('researchHistory').add({
            userId,
            researchType,
            query,
            context,
            findings: responseText.substring(0, 2000), // Truncate for storage
            citationCount: citations.length,
            searchQueries,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      } catch (saveError) {
        console.error('Error saving research history:', saveError);
      }
    }

    // 11. Return structured response
    return {
      findings: responseText,
      sources: citations,
      searchQueries,
      insights,
      memoryCount: memoryContext.count,
      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
        responseTimeMs: responseTime,
        modelUsed: 'gemini-2.0-flash',
        groundedSearch: true,
      },
    };

  } catch (error) {
    console.error('Strategy Research error:', error);
    throw new HttpsError('internal', `Research failed: ${error.message}`);
  }
});

// ============================================
// Exports
// ============================================

module.exports = {
  strategyResearch,
  // Export helpers for testing
  buildResearchPrompt,
  extractCitations,
  parseInsights,
};
