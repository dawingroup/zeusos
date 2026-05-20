/**
 * generateSocialCopy — Gemini-powered caption + variant generator.
 *
 * Input: { brief, subsidiaryId, platforms, tone?, mediaUrls? }
 * Output: { variants: [{ platform, caption, hashtags[], cta? }, ...] }
 *
 * Pulls a few recent posts from the subsidiary as tone anchors before calling Gemini.
 * Strictly user-initiated (no auto-retries) to keep token cost bounded.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const SUPPORTED_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'youtube'];

// Per-platform conventions baked into the prompt so the LLM doesn't have to guess.
const PLATFORM_GUIDELINES = {
  facebook: 'Conversational, 80–250 chars ideal. 2–3 emojis OK. 0–3 hashtags. Strong opening hook.',
  instagram:
    'Caption up to 2200 chars but front-load the value in the first 125 chars. 8–15 niche hashtags. Emojis welcome. End with a clear CTA.',
  linkedin:
    'Professional tone, no hashtag spam (max 3). 150–600 chars. Lead with insight or outcome. Avoid casual emojis.',
  twitter: 'Under 280 chars total including link. 1–2 hashtags max. Punchy and quotable.',
  tiktok:
    'Energetic, very short caption (under 150 chars). 4–6 trending hashtags. Include a question or open loop.',
  youtube:
    'YouTube *community* post style: 100–300 chars. Friendly. 1–3 hashtags. No timestamps.',
};

function parseGeminiJSON(text) {
  if (!text) return null;
  // Tolerant JSON parse — Gemini sometimes wraps in ```json fences
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find the first JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function fetchRecentPostsForTone(subsidiaryId, limit = 3) {
  if (!subsidiaryId) return [];
  try {
    const snap = await db
      .collection('socialMediaPosts')
      .where('subsidiaryId', '==', subsidiaryId)
      .where('status', '==', 'published')
      .orderBy('publishedAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs
      .map((d) => d.data())
      .map((p) => ({
        platforms: p.platforms || [],
        content: (p.content || '').slice(0, 400),
      }));
  } catch (err) {
    logger.warn('[generateSocialCopy] tone-anchor fetch failed', err?.message || err);
    return [];
  }
}

function buildPrompt({ brief, platforms, tone, recentPosts, hasMedia, subsidiaryName }) {
  const platformBlock = platforms
    .map((p) => `- ${p}: ${PLATFORM_GUIDELINES[p] || ''}`)
    .join('\n');

  const examplesBlock =
    recentPosts.length > 0
      ? `\n\nRecent posts from this subsidiary for tone reference (do not copy):\n${recentPosts
          .map((p, i) => `${i + 1}. (${p.platforms.join(',')}) ${p.content}`)
          .join('\n')}`
      : '';

  return [
    `You are a social media copywriter for ${subsidiaryName || 'Dawin Group'}, a Uganda-based holding company.`,
    `Write organic social media post variants for the platforms below.`,
    tone ? `Desired tone: ${tone}.` : '',
    hasMedia ? 'Media will be attached.' : 'No media; copy must stand alone.',
    '',
    `Brief from marketer:\n"""${brief}"""`,
    '',
    `Per-platform conventions:`,
    platformBlock,
    examplesBlock,
    '',
    `Return STRICT JSON ONLY (no markdown fences) matching this shape:`,
    `{ "variants": [ { "platform": "<one of: ${platforms.join('|')}>",`,
    `                   "caption": "<post text, respecting the platform's char limits>",`,
    `                   "hashtags": ["#tag1", "#tag2"],`,
    `                   "cta": "<optional short call to action, or omit>" } ] }`,
    `Include exactly one variant per requested platform. Do not include placeholders like {{brand}}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

const generateSocialCopy = onCall(
  {
    secrets: [GEMINI_API_KEY],
    cors: true,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const {
      brief,
      subsidiaryId,
      platforms = [],
      tone,
      mediaUrls = [],
      subsidiaryName,
    } = request.data || {};

    if (!brief || typeof brief !== 'string' || brief.trim().length < 5) {
      throw new HttpsError('invalid-argument', 'A short brief is required');
    }
    const requestedPlatforms = (Array.isArray(platforms) ? platforms : [])
      .filter((p) => SUPPORTED_PLATFORMS.includes(p))
      .slice(0, 6);
    if (requestedPlatforms.length === 0) {
      throw new HttpsError('invalid-argument', 'At least one platform required');
    }

    const recentPosts = await fetchRecentPostsForTone(subsidiaryId);
    const prompt = buildPrompt({
      brief: brief.trim(),
      platforms: requestedPlatforms,
      tone,
      recentPosts,
      hasMedia: mediaUrls.length > 0,
      subsidiaryName,
    });

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.85,
        responseMimeType: 'application/json',
      },
    });

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (err) {
      logger.error('[generateSocialCopy] Gemini call failed', err);
      throw new HttpsError('internal', `AI generation failed: ${err?.message || err}`);
    }

    const text = result?.response?.text?.() || '';
    const parsed = parseGeminiJSON(text);
    if (!parsed || !Array.isArray(parsed.variants)) {
      logger.warn('[generateSocialCopy] could not parse Gemini response', { text });
      throw new HttpsError('internal', 'AI response could not be parsed');
    }

    // Normalize + sanity-cap caption lengths
    const variants = parsed.variants
      .filter((v) => v && SUPPORTED_PLATFORMS.includes(v.platform))
      .map((v) => ({
        platform: v.platform,
        caption: String(v.caption || '').slice(0, v.platform === 'twitter' ? 280 : 2200),
        hashtags: Array.isArray(v.hashtags)
          ? v.hashtags
              .filter((h) => typeof h === 'string')
              .map((h) => (h.startsWith('#') ? h : `#${h}`))
              .slice(0, 30)
          : [],
        cta: typeof v.cta === 'string' && v.cta.trim() ? v.cta.trim() : undefined,
      }));

    return { variants, generatedAt: Date.now() };
  }
);

module.exports = { generateSocialCopy };
