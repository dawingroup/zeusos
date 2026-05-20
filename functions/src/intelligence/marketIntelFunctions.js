/**
 * Market Intelligence Cloud Functions
 * DawinOS v2.0 - Enhance Competitor Profiles, Scan News, Generate Insights
 * Uses Gemini 2.0 Flash with Google Search grounding
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const {
  parseGeminiJSON,
  findBestCompetitorMatch,
} = require('./intelligenceUtils');
// cors: true allows all origins; security is enforced via Firebase Auth tokens

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Helper functions are now imported from intelligenceUtils.js

// ============================================================================
// 1. ENHANCE COMPETITOR PROFILE
// ============================================================================
const enhanceCompetitorProfile = onCall({
  secrets: [GEMINI_API_KEY],
  cors: true,
  timeoutSeconds: 120,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { competitorId } = request.data;
  if (!competitorId) {
    throw new HttpsError('invalid-argument', 'competitorId is required');
  }

  const apiKey = GEMINI_API_KEY.value();
  const userId = request.auth.uid;

  // Load existing competitor data
  const competitorDoc = await db.collection('competitors').doc(competitorId).get();
  if (!competitorDoc.exists) {
    throw new HttpsError('not-found', 'Competitor not found');
  }

  const competitor = { id: competitorDoc.id, ...competitorDoc.data() };
  console.log(`Enhancing profile for: ${competitor.name}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  let model;
  try {
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }],
    });
  } catch (e) {
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.warn('Google Search grounding not available:', e.message);
  }

  const prompt = `You are a competitive intelligence analyst. Research the company "${competitor.name}"${competitor.website ? ` (website: ${competitor.website})` : ''} operating in ${competitor.headquarters?.country || 'East Africa'}.

Using Google Search, find and verify the following information about this company:

1. **Company Overview**: Updated description, founding year, legal name
2. **Financial Data**: Estimated annual revenue (USD), employee count, company size category
3. **Products & Services**: List of main products and services they offer
4. **Key Executives**: Names, titles of top 3-5 executives (CEO, CTO, CFO, etc.)
5. **Social Media Profiles**: LinkedIn company URL, Twitter/X handle, Facebook page, Instagram, YouTube channel
6. **Market Position**: Estimated market share in their primary market, key differentiators, target customer segments
7. **Strengths**: Top 3-5 competitive strengths
8. **Weaknesses**: Top 3-5 competitive weaknesses
9. **Recent News**: 2-3 most recent notable news items about the company

Return ONLY a valid JSON object (no markdown, no explanation) with this structure:
{
  "description": "Updated company description (2-3 sentences)",
  "legalName": "Official legal name or null",
  "foundedYear": 2010,
  "estimatedRevenue": 5000000,
  "employeeCount": 150,
  "companySize": "medium",
  "products": ["Product A", "Product B"],
  "services": ["Service A", "Service B"],
  "keyExecutives": [
    {"name": "John Doe", "title": "CEO", "linkedinUrl": "https://linkedin.com/in/..."}
  ],
  "socialProfiles": {
    "linkedin": "https://linkedin.com/company/...",
    "twitter": "https://x.com/...",
    "facebook": "https://facebook.com/...",
    "instagram": "https://instagram.com/...",
    "youtube": "https://youtube.com/..."
  },
  "estimatedMarketShare": 12.5,
  "differentiators": ["Differentiator 1", "Differentiator 2"],
  "targetSegments": ["Segment 1", "Segment 2"],
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "recentNews": [
    {"title": "News headline", "url": "https://...", "date": "2024-01-15", "summary": "Brief summary"}
  ],
  "confidence": 0.85
}

If you cannot find information for a field, use null. Be factual and cite real data only.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiJSON(responseText);

    if (!parsed) {
      throw new HttpsError('internal', 'Failed to parse AI response');
    }

    // Build Firestore update object (only non-null fields)
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (parsed.description) updates.description = parsed.description;
    if (parsed.legalName) updates.legalName = parsed.legalName;
    if (parsed.foundedYear) updates.foundedYear = parsed.foundedYear;
    if (parsed.estimatedRevenue) updates.estimatedRevenue = parsed.estimatedRevenue;
    if (parsed.employeeCount) updates.employeeCount = parsed.employeeCount;
    if (parsed.products?.length) updates.products = parsed.products;
    if (parsed.services?.length) updates.services = parsed.services;
    if (parsed.socialProfiles) updates.socialProfiles = parsed.socialProfiles;
    if (parsed.estimatedMarketShare) updates.estimatedMarketShare = parsed.estimatedMarketShare;

    // Update key executives
    if (parsed.keyExecutives?.length) {
      updates.keyExecutives = parsed.keyExecutives.map(exec => ({
        name: exec.name || '',
        title: exec.title || '',
        linkedinUrl: exec.linkedinUrl || '',
      }));
    }

    // Update positioning
    if (parsed.differentiators?.length || parsed.targetSegments?.length || parsed.strengths?.length || parsed.weaknesses?.length) {
      const existingPositioning = competitor.positioning || {};
      updates.positioning = {
        ...existingPositioning,
        differentiators: parsed.differentiators || existingPositioning.differentiators || [],
        targetSegments: parsed.targetSegments || existingPositioning.targetSegments || [],
        weaknessAreas: parsed.weaknesses || existingPositioning.weaknessAreas || [],
      };
    }

    // Save enhancement metadata
    updates.lastEnhancedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.lastEnhancedBy = userId;
    updates.enhancementConfidence = parsed.confidence || 0;

    await db.collection('competitors').doc(competitorId).update(updates);

    console.log(`Enhanced profile for ${competitor.name} with ${Object.keys(updates).length} fields`);

    return {
      success: true,
      fieldsUpdated: Object.keys(updates).length,
      enhancedData: parsed,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Enhance competitor error:', error);
    throw new HttpsError('internal', `Enhancement failed: ${error.message}`);
  }
});

// ============================================================================
// 2. SCAN MARKET NEWS
// ============================================================================
const scanMarketNews = onCall({
  secrets: [GEMINI_API_KEY],
  cors: true,
  timeoutSeconds: 180,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { sector, region, competitorNames, limit: articleLimit } = request.data;
  const maxArticles = articleLimit || 15;
  const targetSector = sector || 'general business';
  const targetRegion = region || 'Uganda and East Africa';

  const apiKey = GEMINI_API_KEY.value();
  const userId = request.auth.uid;

  const genAI = new GoogleGenerativeAI(apiKey);
  let model;
  try {
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }],
    });
  } catch (e) {
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.warn('Google Search grounding not available:', e.message);
  }

  const competitorContext = competitorNames?.length
    ? `\nAlso specifically search for news about these companies: ${competitorNames.join(', ')}.`
    : '';

  const prompt = `You are a market intelligence news analyst focused on ${targetRegion}.

Using Google Search, find the ${maxArticles} most recent and relevant news articles about the ${targetSector} sector in ${targetRegion}.${competitorContext}

Focus on:
- Industry developments, mergers, acquisitions
- Regulatory changes and government policies
- Funding rounds and investments
- New product launches and partnerships
- Market trends and competitive moves
- Economic indicators affecting the sector

For each article, provide:
- The actual headline and source name
- A real URL (must be a real article URL from a real news source)
- Publication date (best estimate if exact date unavailable)
- A 1-2 sentence summary
- Category: one of "regulatory", "competitor_news", "funding", "market_trend", "product_launch", "partnership", "economic", "general"
- Sentiment: "very_positive", "positive", "neutral", "negative", "very_negative"
- Sentiment score: -1.0 to 1.0
- Relevance score: 0-100
- Tags: 3-5 relevant keywords
- Mentioned competitor names (if any)

Return ONLY a valid JSON array (no markdown):
[
  {
    "title": "Headline",
    "summary": "Brief summary",
    "sourceName": "Publication Name",
    "sourceUrl": "https://real-article-url.com/...",
    "sourceType": "news",
    "category": "competitor_news",
    "sentiment": "positive",
    "sentimentScore": 0.65,
    "relevanceScore": 88,
    "tags": ["fintech", "mobile money"],
    "sectors": ["fintech"],
    "mentionedCompetitors": ["MTN Uganda"],
    "publishedAt": "2025-02-10T08:00:00Z",
    "imageUrl": null
  }
]

Return real articles only. Do not fabricate sources.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    let articles = parseGeminiJSON(responseText);

    if (!articles || !Array.isArray(articles)) {
      console.error('Failed to parse news articles');
      return { success: false, articles: [], articlesFound: 0 };
    }

    // Validate and save to Firestore
    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const savedArticles = [];

    for (const article of articles.slice(0, maxArticles)) {
      if (!article.title || !article.sourceUrl) continue;

      // Deduplicate by URL
      const existing = await db.collection('news_articles')
        .where('sourceUrl', '==', article.sourceUrl)
        .limit(1)
        .get();

      if (!existing.empty) continue;

      const docRef = db.collection('news_articles').doc();
      const articleData = {
        title: article.title || '',
        summary: article.summary || '',
        sourceName: article.sourceName || 'Unknown',
        sourceUrl: article.sourceUrl || '',
        sourceType: article.sourceType || 'news',
        category: article.category || 'general',
        sentiment: article.sentiment || 'neutral',
        sentimentScore: article.sentimentScore || 0,
        relevanceScore: article.relevanceScore || 50,
        tags: article.tags || [],
        sectors: article.sectors || [targetSector],
        mentionedCompetitors: article.mentionedCompetitors || [],
        publishedAt: article.publishedAt || new Date().toISOString(),
        imageUrl: article.imageUrl || null,
        fetchedAt: now,
        isRead: false,
        isBookmarked: false,
        isFlagged: false,
        scannedBy: userId,
        scanRegion: targetRegion,
        scanSector: targetSector,
      };

      batch.set(docRef, articleData);
      savedArticles.push({ id: docRef.id, ...articleData });
    }

    await batch.commit();
    console.log(`Saved ${savedArticles.length} news articles for ${targetSector} in ${targetRegion}`);

    return {
      success: true,
      articles: savedArticles,
      articlesFound: savedArticles.length,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Scan market news error:', error);
    throw new HttpsError('internal', `News scan failed: ${error.message}`);
  }
});

// ============================================================================
// 3. GENERATE MARKET INSIGHTS
// ============================================================================
const generateMarketInsights = onCall({
  secrets: [GEMINI_API_KEY],
  cors: true,
  timeoutSeconds: 180,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { sector, topic, competitorContext } = request.data;
  const targetSector = sector || 'general business';
  const apiKey = GEMINI_API_KEY.value();
  const userId = request.auth.uid;

  // Load recent news for context
  let recentNewsContext = '';
  try {
    const recentNews = await db.collection('news_articles')
      .orderBy('fetchedAt', 'desc')
      .limit(10)
      .get();
    if (!recentNews.empty) {
      const headlines = recentNews.docs.map(d => `- ${d.data().title} (${d.data().sourceName})`).join('\n');
      recentNewsContext = `\n\nRecent news for context:\n${headlines}`;
    }
  } catch (e) {
    console.warn('Could not load recent news:', e.message);
  }

  // Load competitors for context
  let competitorListContext = '';
  try {
    const competitors = await db.collection('competitors')
      .where('status', '==', 'active')
      .limit(10)
      .get();
    if (!competitors.empty) {
      const names = competitors.docs.map(d => d.data().name).join(', ');
      competitorListContext = `\nTracked competitors: ${names}`;
    }
  } catch (e) {
    console.warn('Could not load competitors:', e.message);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let model;
  try {
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }],
    });
  } catch (e) {
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  const topicContext = topic ? `\nSpecific focus: ${topic}` : '';

  const prompt = `You are a senior market intelligence analyst specializing in ${targetSector} in Uganda and East Africa.${competitorListContext}${recentNewsContext}${topicContext}${competitorContext ? `\nAdditional context: ${competitorContext}` : ''}

Using Google Search for the latest data, generate 5-8 actionable market intelligence insights. Each insight should be based on real, current market information.

Categories of insights to generate:
- **opportunity**: Market opportunities or growth areas
- **threat**: Competitive threats or market risks
- **trend**: Industry trends and shifts
- **anomaly**: Unusual market activities or patterns
- **recommendation**: Strategic recommendations based on data

For each insight provide:
- A clear, specific title
- Detailed description with supporting data points
- Type (opportunity/threat/trend/anomaly/recommendation)
- Priority (high/medium/low)
- Whether it's actionable
- Related sector
- Confidence score (0-1)
- Number of data points supporting the insight
- 2-4 specific, actionable recommendations

Return ONLY a valid JSON array:
[
  {
    "title": "Clear insight title",
    "description": "Detailed 2-3 sentence description with specific data",
    "type": "opportunity",
    "priority": "high",
    "isActionable": true,
    "sector": "${targetSector}",
    "competitorIds": [],
    "recommendations": ["Specific action 1", "Specific action 2"],
    "confidence": 0.85,
    "dataPoints": 12,
    "sources": ["Source 1", "Source 2"]
  }
]

Generate insights based on REAL current market data. Do not fabricate statistics.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    let insights = parseGeminiJSON(responseText);

    if (!insights || !Array.isArray(insights)) {
      console.error('Failed to parse insights');
      return { success: false, insights: [], insightsGenerated: 0 };
    }

    // Save to Firestore
    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const savedInsights = [];

    for (const insight of insights) {
      if (!insight.title) continue;

      const docRef = db.collection('ai_insights').doc();
      const insightData = {
        title: insight.title,
        description: insight.description || '',
        type: insight.type || 'trend',
        priority: insight.priority || 'medium',
        isActionable: insight.isActionable !== false,
        sector: insight.sector || targetSector,
        competitorIds: insight.competitorIds || [],
        recommendations: insight.recommendations || [],
        confidence: insight.confidence || 0.5,
        dataPoints: insight.dataPoints || 0,
        sources: insight.sources || [],
        generatedBy: 'ai',
        modelVersion: 'gemini-2.0-flash',
        status: 'new',
        createdAt: now,
        createdBy: userId,
      };

      batch.set(docRef, insightData);
      savedInsights.push({ id: docRef.id, ...insightData });
    }

    await batch.commit();
    console.log(`Generated ${savedInsights.length} market insights for ${targetSector}`);

    return {
      success: true,
      insights: savedInsights,
      insightsGenerated: savedInsights.length,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Generate insights error:', error);
    throw new HttpsError('internal', `Insight generation failed: ${error.message}`);
  }
});

// ============================================================================
// 4. ANALYZE MARKET SECTOR
// ============================================================================
const analyzeMarketSector = onCall({
  secrets: [GEMINI_API_KEY],
  cors: true,
  timeoutSeconds: 180,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { sector, region } = request.data;
  const targetSector = sector || 'general business';
  const targetRegion = region || 'Uganda and East Africa';
  const apiKey = GEMINI_API_KEY.value();
  const userId = request.auth.uid;

  const genAI = new GoogleGenerativeAI(apiKey);
  let model;
  try {
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }],
    });
  } catch (e) {
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  const prompt = `You are a market research analyst. Using Google Search, provide a comprehensive market analysis for the **${targetSector}** sector in **${targetRegion}**.

Research and provide:

1. **Market Overview**: Total market size (USD), growth rate, projected growth, market sentiment
2. **Market Segments**: Top 3-5 segments with size, growth rate, market share, competitor count, concentration level, entry barriers
3. **Industry Trends**: Top 3-5 trends with direction, strength, maturity, impact level
4. **Economic Indicators**: Key macroeconomic indicators for Uganda (GDP growth, inflation, interest rate, exchange rate, FDI)
5. **Key Players**: Top 5 companies with estimated market share
6. **Opportunities**: Top 4 market opportunities
7. **Threats**: Top 4 market threats

Return ONLY a valid JSON object:
{
  "marketData": {
    "sector": "${targetSector}",
    "region": "${targetRegion}",
    "marketSizeUSD": 2500000000,
    "growthRate": 15.5,
    "projectedGrowthRate": 18.2,
    "trend": "up",
    "sentiment": "positive",
    "period": "2025",
    "confidence": 0.82
  },
  "segments": [
    {
      "name": "Segment Name",
      "description": "Brief description",
      "sizeUSD": 1200000000,
      "growthRate": 22.5,
      "share": 48,
      "competitorCount": 8,
      "concentration": "high",
      "attractivenessScore": 85,
      "entryBarriers": "high"
    }
  ],
  "trends": [
    {
      "title": "Trend Title",
      "description": "Description",
      "direction": "strong_up",
      "strength": 85,
      "maturity": "emerging",
      "impactLevel": "transformative",
      "affectedSegments": ["Segment 1"],
      "timeframe": "medium_term"
    }
  ],
  "indicators": [
    { "key": "gdp_growth", "label": "GDP Growth Rate", "value": 5.3, "previousValue": 4.8, "change": 0.5, "unit": "%", "date": "2025-Q1" }
  ],
  "keyPlayers": [
    { "name": "Company Name", "marketShare": 45 }
  ],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "threats": ["Threat 1", "Threat 2"]
}

Use real, current data from Google Search. Do not fabricate statistics.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiJSON(responseText);

    if (!parsed) {
      throw new HttpsError('internal', 'Failed to parse market analysis');
    }

    // Save to Firestore
    const analysisDoc = {
      ...parsed,
      sector: targetSector,
      region: targetRegion,
      analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
      analyzedBy: userId,
    };

    const docRef = await db.collection('market_analyses').add(analysisDoc);
    console.log(`Market analysis saved for ${targetSector}: ${docRef.id}`);

    return {
      success: true,
      analysisId: docRef.id,
      ...parsed,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Market analysis error:', error);
    throw new HttpsError('internal', `Market analysis failed: ${error.message}`);
  }
});

// ============================================================================
// 5. DISCOVER COMPETITORS (AI-driven scan)
// Uses Gemini + Google Search grounding to find direct and indirect competitors
// based on the user's business context. Returns candidates for user review.
// ============================================================================
const discoverCompetitors = onCall({
  secrets: [GEMINI_API_KEY],
  cors: true,
  timeoutSeconds: 180,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const {
    companyName,
    industry,
    products,
    services,
    region,
    description,
    existingCompetitorNames,
  } = request.data;

  if (!companyName || !industry) {
    throw new HttpsError('invalid-argument', 'companyName and industry are required');
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');
  }

  const targetRegion = region || 'Uganda and East Africa';
  const excludeList = (existingCompetitorNames || []).join(', ');

  const genAI = new GoogleGenerativeAI(apiKey);
  let model;
  try {
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.3 },
      tools: [{ googleSearch: {} }],
    });
  } catch (err) {
    console.warn('Google Search grounding not available, using standard model:', err.message);
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.3 },
    });
  }

  const prompt = `You are a competitive intelligence analyst specializing in ${targetRegion} markets.

COMPANY CONTEXT:
- Company Name: ${companyName}
- Industry: ${industry}
- Products: ${(products || []).join(', ') || 'Not specified'}
- Services: ${(services || []).join(', ') || 'Not specified'}
- Description: ${description || 'Not provided'}
- Region: ${targetRegion}
${excludeList ? `- ALREADY TRACKED (do NOT include these): ${excludeList}` : ''}

TASK:
Using Google Search, identify up to 15 competitors for this company operating in or relevant to ${targetRegion}. Include BOTH:

1. **Direct competitors** (same products/services, same market) — label as "direct"
2. **Indirect competitors** (substitute products, adjacent markets, potential entrants) — label as "indirect"
3. **Emerging/potential competitors** (startups, new entrants, companies expanding into this space) — label as "emerging"

For each competitor found, provide detailed information.

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{
  "competitors": [
    {
      "name": "Company Name",
      "legalName": "Official Legal Name or null",
      "type": "direct" | "indirect" | "emerging",
      "description": "2-3 sentence description of what they do and why they compete",
      "website": "https://...",
      "threatLevel": "critical" | "high" | "moderate" | "low",
      "industries": ["industry1", "industry2"],
      "products": ["product1", "product2"],
      "services": ["service1", "service2"],
      "headquarters": { "city": "City", "country": "Country" },
      "companySize": "micro" | "small" | "medium" | "large" | "enterprise",
      "estimatedEmployeeCount": 100,
      "estimatedRevenue": 1000000,
      "foundedYear": 2015,
      "competitiveOverlap": "Explanation of where/how they overlap with ${companyName}",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "confidence": 0.85
    }
  ],
  "marketSummary": "Brief summary of the competitive landscape",
  "totalFound": 15
}

Be factual. Only include real companies you can verify via search. Use null for fields you cannot confirm.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiJSON(responseText);

    if (!parsed || !parsed.competitors) {
      throw new HttpsError('internal', 'Failed to parse competitor discovery results');
    }

    // Normalize and validate each candidate
    const candidates = parsed.competitors.map((c, index) => ({
      id: `candidate_${Date.now()}_${index}`,
      name: c.name || 'Unknown',
      legalName: c.legalName || null,
      type: ['direct', 'indirect', 'emerging'].includes(c.type) ? c.type : 'indirect',
      description: c.description || '',
      website: c.website || '',
      threatLevel: ['critical', 'high', 'moderate', 'low'].includes(c.threatLevel) ? c.threatLevel : 'moderate',
      industries: Array.isArray(c.industries) ? c.industries : [],
      products: Array.isArray(c.products) ? c.products : [],
      services: Array.isArray(c.services) ? c.services : [],
      headquarters: c.headquarters || { city: '', country: '' },
      companySize: c.companySize || 'medium',
      estimatedEmployeeCount: typeof c.estimatedEmployeeCount === 'number' ? c.estimatedEmployeeCount : null,
      estimatedRevenue: typeof c.estimatedRevenue === 'number' ? c.estimatedRevenue : null,
      foundedYear: typeof c.foundedYear === 'number' ? c.foundedYear : null,
      competitiveOverlap: c.competitiveOverlap || '',
      strengths: Array.isArray(c.strengths) ? c.strengths : [],
      weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : [],
      confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
    }));

    console.log(`Discovered ${candidates.length} competitor candidates for ${companyName}`);

    return {
      success: true,
      candidates,
      marketSummary: parsed.marketSummary || '',
      totalFound: candidates.length,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Discover competitors error:', error);
    throw new HttpsError('internal', `Competitor discovery failed: ${error.message}`);
  }
});

module.exports = {
  enhanceCompetitorProfile,
  scanMarketNews,
  generateMarketInsights,
  analyzeMarketSector,
  discoverCompetitors,
};
