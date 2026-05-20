// ============================================================================
// DIGITAL PROFILE DISCOVERY & TOPIC SCANNING
// DawinOS v2.0 - Market Intelligence Module
// Uses Gemini 2.0 Flash + Google Search grounding (same pattern as
// marketIntelligence.js, enrichAssetData.js, strategyResearch.js)
// ============================================================================

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ============================================================================
// HELPERS
// ============================================================================

// Platform detection from URL (used as fallback to validate AI output)
function detectPlatform(url) {
  if (!url) return 'other';
  const patterns = [
    { platform: 'linkedin', tests: [/linkedin\.com\/company\//i, /linkedin\.com\/in\//i] },
    { platform: 'twitter', tests: [/twitter\.com\//i, /x\.com\//i] },
    { platform: 'facebook', tests: [/facebook\.com\//i, /fb\.com\//i] },
    { platform: 'instagram', tests: [/instagram\.com\//i] },
    { platform: 'youtube', tests: [/youtube\.com\/(channel|c|user|@)/i] },
    { platform: 'tiktok', tests: [/tiktok\.com\/@/i] },
    { platform: 'github', tests: [/github\.com\//i] },
    { platform: 'crunchbase', tests: [/crunchbase\.com\/organization\//i] },
    { platform: 'glassdoor', tests: [/glassdoor\.(com|co\.\w+)/i] },
    { platform: 'medium', tests: [/medium\.com\//i] },
    { platform: 'reddit', tests: [/reddit\.com\//i] },
    { platform: 'pinterest', tests: [/pinterest\.com\//i] },
    { platform: 'app_store', tests: [/apps\.apple\.com\//i] },
    { platform: 'play_store', tests: [/play\.google\.com\/store\/apps/i] },
    { platform: 'google_business', tests: [/google\.com\/maps/i, /g\.page\//i, /business\.google/i] },
  ];
  for (const { platform, tests } of patterns) {
    if (tests.some(re => re.test(url))) return platform;
  }
  if (/blog\./i.test(url) || /\/blog/i.test(url)) return 'blog';
  return 'website';
}

// Parse JSON from Gemini response (handles markdown code fences)
function parseJsonFromText(text) {
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting array or object
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch { /* fall through */ }
    }
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
    }
    console.error('Failed to parse Gemini JSON:', text.substring(0, 500));
    return null;
  }
}

// Valid platform values for validation
const VALID_PLATFORMS = new Set([
  'website', 'linkedin', 'twitter', 'facebook', 'instagram', 'youtube',
  'tiktok', 'github', 'crunchbase', 'glassdoor', 'google_business',
  'app_store', 'play_store', 'blog', 'medium', 'reddit', 'pinterest', 'other',
]);

// ============================================================================
// DISCOVER DIGITAL PROFILES
// Gemini + Google Search grounding to find and verify competitor profiles
// ============================================================================

const discoverDigitalProfiles = onCall({
  secrets: [GEMINI_API_KEY],
  cors: ALLOWED_ORIGINS,
  timeoutSeconds: 120,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { competitorName, website, competitorId } = request.data;
  if (!competitorName) {
    throw new HttpsError('invalid-argument', 'competitorName is required');
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');
  }

  console.log(`Discovering digital profiles for "${competitorName}"...`);

  // Get already-tracked profile URLs
  let existingUrls = new Set();
  if (competitorId) {
    const existingSnap = await db.collection('digital_profiles')
      .where('competitorId', '==', competitorId)
      .get();
    existingSnap.docs.forEach(d => {
      existingUrls.add(d.data().profileUrl?.toLowerCase());
    });
  }

  // Initialize Gemini with Google Search grounding
  const genAI = new GoogleGenerativeAI(apiKey);
  let model;
  let useGrounding = true;

  try {
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 8192,
      },
      tools: [{ googleSearch: {} }],
    });
  } catch (err) {
    console.warn('Google Search grounding not available, falling back:', err.message);
    useGrounding = false;
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 8192,
      },
    });
  }

  const websiteNote = website ? `Their known website is: ${website}` : '';

  const prompt = `You are a competitive intelligence researcher. Using Google Search, find ALL digital profiles and online presence for the company "${competitorName}". ${websiteNote}

Search thoroughly for their profiles on ALL of these platforms:
- LinkedIn (company page URL)
- Twitter / X (company handle)
- Facebook (company page)
- Instagram (company profile)
- YouTube (channel)
- TikTok (company profile)
- GitHub (organization)
- Crunchbase (organization page)
- Glassdoor (company reviews page)
- Google Business / Google Maps listing
- App Store (iOS app if they have one)
- Play Store (Android app if they have one)
- Medium or company blog
- Reddit (subreddit or active presence)
- Pinterest (if applicable)
- Official website (if not already known)

For each profile you find, provide:
1. The EXACT URL (not a search URL, the actual profile URL)
2. The profile/page name as displayed on the platform
3. A brief description of what you found (e.g. follower count, bio, recent activity)
4. Your confidence (0-100) that this profile genuinely belongs to "${competitorName}"

IMPORTANT: Only include profiles you can verify actually belong to this company. Do not guess or fabricate URLs.

Return ONLY a JSON array (no other text) in this exact format:
[
  {
    "platform": "linkedin",
    "url": "https://www.linkedin.com/company/example",
    "title": "Example Company | LinkedIn",
    "snippet": "5,200 followers. Custom furniture manufacturer based in Kampala.",
    "confidence": 95
  }
]

Use these exact platform values: website, linkedin, twitter, facebook, instagram, youtube, tiktok, github, crunchbase, glassdoor, google_business, app_store, play_store, blog, medium, reddit, pinterest, other

If you cannot find any profiles, return an empty array: []`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('Gemini profile discovery response length:', responseText.length);

    const parsed = parseJsonFromText(responseText);

    if (!parsed || !Array.isArray(parsed)) {
      console.warn('Could not parse profile results, returning empty');
      return {
        results: [],
        competitorName,
        searchedAt: new Date().toISOString(),
        totalFound: 0,
        alreadyTracked: 0,
        groundingUsed: useGrounding,
      };
    }

    // Validate and normalize results
    const results = parsed
      .filter(r => r && r.url && typeof r.url === 'string' && r.url.startsWith('http'))
      .map(r => {
        // Use URL-based detection as fallback if platform value is invalid
        let platform = (r.platform || '').toLowerCase().replace(/\s+/g, '_');
        if (!VALID_PLATFORMS.has(platform)) {
          platform = detectPlatform(r.url);
        }
        return {
          platform,
          url: r.url.trim(),
          title: r.title || '',
          snippet: r.snippet || r.description || '',
          confidence: Math.min(Math.max(parseInt(r.confidence) || 70, 0), 100),
          alreadyTracked: existingUrls.has(r.url.trim().toLowerCase()),
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    console.log(`Discovered ${results.length} profiles for "${competitorName}" (grounding: ${useGrounding})`);

    return {
      results,
      competitorName,
      searchedAt: new Date().toISOString(),
      totalFound: results.length,
      alreadyTracked: results.filter(r => r.alreadyTracked).length,
      groundingUsed: useGrounding,
    };
  } catch (err) {
    console.error('Gemini profile discovery error:', err);
    throw new HttpsError('internal', `Profile discovery failed: ${err.message}`);
  }
});

// ============================================================================
// SCAN TOPIC MENTIONS
// Gemini + Google Search grounding to find and analyze topic discussions
// ============================================================================

const scanTopicMentions = onCall({
  secrets: [GEMINI_API_KEY],
  cors: ALLOWED_ORIGINS,
  timeoutSeconds: 180,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { topicId } = request.data;
  if (!topicId) {
    throw new HttpsError('invalid-argument', 'topicId is required');
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');
  }

  // Load topic from Firestore
  const topicDoc = await db.collection('tracked_topics').doc(topicId).get();
  if (!topicDoc.exists) {
    throw new HttpsError('not-found', 'Topic not found');
  }

  const topic = topicDoc.data();
  const keywords = topic.keywords || [];
  const excludeKeywords = topic.excludeKeywords || [];

  if (keywords.length === 0) {
    throw new HttpsError('invalid-argument', 'Topic has no keywords to search');
  }

  console.log(`Scanning topic "${topic.name}" (scope: ${topic.scope}, keywords: ${keywords.join(', ')})...`);

  // Initialize Gemini with Google Search grounding
  const genAI = new GoogleGenerativeAI(apiKey);
  let model;
  let useGrounding = true;

  try {
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 8192,
      },
      tools: [{ googleSearch: {} }],
    });
  } catch (err) {
    console.warn('Google Search grounding not available:', err.message);
    useGrounding = false;
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 8192,
      },
    });
  }

  // Build scope instructions
  let scopeInstruction = '';
  if (topic.scope === 'local') {
    scopeInstruction = 'Focus SPECIFICALLY on Uganda. Prioritize Ugandan news sources, local media, government publications, and discussions about the Ugandan market.';
  } else if (topic.scope === 'regional') {
    scopeInstruction = 'Focus on East Africa (Uganda, Kenya, Tanzania, Rwanda, Ethiopia). Prioritize regional news sources and discussions about the East African market.';
  } else {
    scopeInstruction = 'Search globally. Include international news, industry publications, and global discussions.';
  }

  const excludeNote = excludeKeywords.length > 0
    ? `EXCLUDE results related to: ${excludeKeywords.join(', ')}`
    : '';

  const prompt = `You are a market intelligence analyst. Using Google Search, find the most recent and relevant discussions, news articles, reports, and social media posts about the following topic.

**Topic:** ${topic.name}
**Description:** ${topic.description || 'N/A'}
**Keywords to search:** ${keywords.join(', ')}
${excludeNote}

**Scope:** ${scopeInstruction}

Search for:
1. Recent news articles (last 7 days preferred, up to 30 days)
2. Social media discussions (Twitter/X, LinkedIn, Reddit, Facebook)
3. Blog posts and opinion pieces
4. Government or regulatory announcements
5. Industry reports or analyses
6. Forum discussions

For EACH mention found, provide:
- The exact source URL
- The article/post title
- A brief summary snippet (2-3 sentences)
- The source name (e.g. "Daily Monitor", "Reuters", "Twitter")
- Source type: one of "news", "social", "forum", "blog", "academic", "government", "other"
- Sentiment: "positive", "neutral", or "negative"
- Sentiment score: -1.0 to 1.0
- Which of the tracked keywords were matched
- The region the article is focused on

Find at least 10-15 relevant mentions if possible. Only include REAL articles with REAL URLs.

Return ONLY a JSON array:
[
  {
    "sourceUrl": "https://example.com/article",
    "title": "Article Title",
    "snippet": "Brief summary of the content...",
    "sourceName": "Daily Monitor",
    "sourceType": "news",
    "sentiment": "positive",
    "sentimentScore": 0.6,
    "matchedKeywords": ["keyword1", "keyword2"],
    "sourceRegion": "Uganda",
    "language": "en"
  }
]

If no relevant mentions are found, return an empty array: []`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('Gemini topic scan response length:', responseText.length);

    const parsed = parseJsonFromText(responseText);

    if (!parsed || !Array.isArray(parsed)) {
      console.warn('Could not parse topic scan results');
      return { mentionsFound: 0, newMentionsSaved: 0, totalMentions: 0 };
    }

    // Valid source types
    const validSourceTypes = new Set(['news', 'social', 'forum', 'blog', 'academic', 'government', 'other']);
    const validSentiments = new Set(['positive', 'neutral', 'negative']);

    // Save mentions to Firestore
    let saved = 0;
    for (const item of parsed) {
      if (!item || !item.sourceUrl || typeof item.sourceUrl !== 'string' || !item.sourceUrl.startsWith('http')) {
        continue;
      }

      // Check if URL already exists for this topic
      const existing = await db.collection('topic_mentions')
        .where('topicId', '==', topicId)
        .where('sourceUrl', '==', item.sourceUrl)
        .limit(1)
        .get();

      if (!existing.empty) continue;

      const sourceType = validSourceTypes.has(item.sourceType) ? item.sourceType : 'other';
      const sentiment = validSentiments.has(item.sentiment) ? item.sentiment : 'neutral';
      const sentimentScore = typeof item.sentimentScore === 'number'
        ? Math.min(Math.max(item.sentimentScore, -1), 1)
        : 0;

      let sourceName = item.sourceName || '';
      if (!sourceName) {
        try { sourceName = new URL(item.sourceUrl).hostname.replace('www.', ''); } catch { sourceName = 'unknown'; }
      }

      const mention = {
        topicId,
        topicName: topic.name,
        sourceType,
        sourceName,
        sourceUrl: item.sourceUrl,
        sourceRegion: item.sourceRegion || (topic.scope === 'local' ? 'Uganda' : topic.scope === 'regional' ? 'East Africa' : 'Global'),
        title: item.title || '',
        snippet: item.snippet || '',
        sentiment,
        sentimentScore,
        relevanceScore: Array.isArray(item.matchedKeywords) ? item.matchedKeywords.length / keywords.length : 0.5,
        matchedKeywords: Array.isArray(item.matchedKeywords) ? item.matchedKeywords : [],
        scope: topic.scope,
        language: item.language || 'en',
        publishedAt: admin.firestore.Timestamp.now(),
        isRead: false,
        isBookmarked: false,
        isFlagged: false,
        discoveredAt: admin.firestore.Timestamp.now(),
      };

      await db.collection('topic_mentions').add(mention);
      saved++;
    }

    // Update topic metrics
    const mentionsSnap = await db.collection('topic_mentions')
      .where('topicId', '==', topicId)
      .get();

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let last24h = 0, last7d = 0, last30d = 0;
    let sentimentSum = 0;
    mentionsSnap.docs.forEach(d => {
      const data = d.data();
      const ts = data.discoveredAt?.toMillis() || 0;
      if (now - ts < day) last24h++;
      if (now - ts < 7 * day) last7d++;
      if (now - ts < 30 * day) last30d++;
      sentimentSum += data.sentimentScore || 0;
    });

    const avgSentiment = mentionsSnap.size > 0 ? sentimentSum / mentionsSnap.size : 0;
    let overallSentiment = 'neutral';
    if (avgSentiment > 0.2) overallSentiment = 'positive';
    else if (avgSentiment < -0.2) overallSentiment = 'negative';
    else if (mentionsSnap.size > 0) overallSentiment = 'mixed';

    // Determine trend direction
    let trendDirection = 'stable';
    if (last7d > last30d / 4) trendDirection = 'rising';
    else if (last7d < last30d / 8 && last30d > 4) trendDirection = 'declining';

    await db.collection('tracked_topics').doc(topicId).update({
      totalMentions: mentionsSnap.size,
      mentionsLast24h: last24h,
      mentionsLast7d: last7d,
      mentionsLast30d: last30d,
      overallSentiment,
      sentimentScore: Math.round(avgSentiment * 100) / 100,
      trendDirection,
      lastScanAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    console.log(`Topic "${topic.name}": found ${parsed.length} results, saved ${saved} new mentions (grounding: ${useGrounding})`);

    return {
      mentionsFound: parsed.length,
      newMentionsSaved: saved,
      totalMentions: mentionsSnap.size,
      groundingUsed: useGrounding,
    };
  } catch (err) {
    console.error('Gemini topic scan error:', err);
    throw new HttpsError('internal', `Topic scan failed: ${err.message}`);
  }
});

module.exports = {
  discoverDigitalProfiles,
  scanTopicMentions,
};
