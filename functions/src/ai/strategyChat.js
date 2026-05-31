/**
 * Strategy AI chat / analysis — Phase 3.4.
 *
 * Replaces the dead DawinOS Cloud Run REST endpoint (`/ai/strategy-review`,
 * `/ai/strategy-parse-document`) that the strategy module's frontend
 * (strategyAI.service.ts) was still calling. These are proper ZeusOS callables.
 *
 *   analyzeStrategySection — conversational strategy analysis: takes the review
 *     context + a question and returns a chat message + typed suggestions
 *     (BMC / SWOT / OKR / KPI / risk / market / financial / roadmap).
 *   parseStrategyDocument  — structures uploaded strategy text into clean
 *     markdown (text files; binary PDF/DOCX extraction is a follow-up).
 *
 * Distinct from assessStrategySection / rewriteStrategySection, which score /
 * rewrite a single stored document_section by id.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { getAnthropic } = require('./_anthropic');

if (!admin.apps.length) admin.initializeApp();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const SUGGESTION_TYPES = ['bmc', 'swot', 'okr', 'kpi', 'risk', 'market', 'financial', 'roadmap', 'general'];

const ANALYSIS_SCHEMA = `{
  "message": "Your conversational answer / analysis (markdown ok)",
  "suggestions": [
    {
      "type": "bmc|swot|okr|kpi|risk|market|financial|roadmap|general",
      "sectionKey": "optional section this applies to",
      "title": "Short suggestion title",
      "content": "The suggestion detail",
      "score": 4,
      "recommendations": ["optional bullet 1"],
      "confidence": 0.8
    }
  ]
}`;

function nowIso() {
  return new Date().toISOString();
}

// Deterministic-ish id without Math.random (kept stable per call index).
function suggestionId(i) {
  return `sug_${Date.now()}_${i}`;
}

exports.analyzeStrategySection = onCall(
  {
    cors: ALLOWED_ORIGINS,
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const {
      section = 'general',
      currentData = {},
      uploadedDocumentContent,
      question,
      conversationHistory = [],
    } = request.data || {};

    try {
      const { client, model } = await getAnthropic();

      const history = Array.isArray(conversationHistory)
        ? conversationHistory.slice(-8).map((m) => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`).join('\n')
        : '';

      const userContent = [
        `STRATEGY SECTION: ${section}`,
        uploadedDocumentContent ? `\nUPLOADED DOCUMENT:\n${String(uploadedDocumentContent).slice(0, 60000)}` : '',
        Object.keys(currentData || {}).length ? `\nCURRENT STRATEGY DATA:\n${JSON.stringify(currentData, null, 2).slice(0, 40000)}` : '',
        history ? `\nCONVERSATION SO FAR:\n${history}` : '',
        `\nREQUEST: ${question || 'Provide a strategic assessment of this section with concrete, actionable suggestions.'}`,
      ].filter(Boolean).join('\n');

      const response = await client.messages.create({
        model,
        max_tokens: 2500,
        system: `You are the strategy advisor for Zeus Group, an East African marketing consortium of five sibling brands.
Give grounded, board-ready strategic analysis. Where useful, return structured suggestions typed as one of: ${SUGGESTION_TYPES.join(', ')}.
Do not invent facts beyond the provided context. Return ONLY valid JSON, no markdown fences, matching:
${ANALYSIS_SCHEMA}`,
        messages: [{ role: 'user', content: userContent }],
      });

      const text = response.content[0]?.text || '{}';
      let parsed;
      try {
        const m = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(m ? m[0] : text);
      } catch {
        parsed = { message: text, suggestions: [] };
      }

      const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).map((s, i) => ({
        id: suggestionId(i),
        type: SUGGESTION_TYPES.includes(s.type) ? s.type : 'general',
        sectionKey: s.sectionKey || section,
        title: s.title || 'Suggestion',
        content: s.content || '',
        score: typeof s.score === 'number' ? s.score : undefined,
        recommendations: Array.isArray(s.recommendations) ? s.recommendations : undefined,
        confidence: typeof s.confidence === 'number' ? s.confidence : 0.7,
        applied: false,
      }));

      const message = parsed.message || '';
      return {
        success: true,
        message,
        suggestions,
        memoryCount: 0,
        conversationMessage: {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: message,
          timestamp: nowIso(),
          section,
          suggestions,
        },
      };
    } catch (error) {
      if (error && error.code === 'NOT_CONFIGURED') {
        throw new HttpsError('failed-precondition', error.message);
      }
      logger.error('[StrategyChat] error:', error);
      throw new HttpsError('internal', error.message || 'Strategy analysis failed');
    }
  },
);

exports.parseStrategyDocument = onCall(
  {
    cors: ALLOWED_ORIGINS,
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const { textContent, fileBase64, fileName } = request.data || {};

    // Binary (PDF/DOCX) server-side extraction is a follow-up — guide the user
    // to paste text or upload .txt/.md for now.
    if (!textContent && fileBase64) {
      throw new HttpsError(
        'unimplemented',
        `Binary document extraction for ${fileName || 'this file'} isn't available yet. Paste the text or upload a .txt/.md file.`,
      );
    }
    if (!textContent) {
      throw new HttpsError('invalid-argument', 'No document text provided');
    }

    try {
      const { client, model } = await getAnthropic();
      const response = await client.messages.create({
        model,
        max_tokens: 4000,
        system: `You structure raw strategy-document text into clean, well-organised markdown for Zeus Group.
Preserve the original substance; add clear headings/sections. Return ONLY the markdown, no commentary.`,
        messages: [{ role: 'user', content: String(textContent).slice(0, 80000) }],
      });
      const content = response.content[0]?.text || String(textContent);
      return { success: true, content };
    } catch (error) {
      if (error && error.code === 'NOT_CONFIGURED') {
        throw new HttpsError('failed-precondition', error.message);
      }
      logger.error('[StrategyChat] parse error:', error);
      throw new HttpsError('internal', error.message || 'Document parsing failed');
    }
  },
);
