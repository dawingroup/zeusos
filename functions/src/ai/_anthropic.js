/**
 * Shared Anthropic client factory — Phase 1.4.
 *
 * Resolves ANTHROPIC_API_KEY at RUNTIME via the integration-secrets resolver
 * (Secret Manager latest → defineSecret/env fallback) so a key set in
 * Settings → API Keys takes effect without a redeploy. Throws a friendly,
 * actionable error (code NOT_CONFIGURED) when no key is configured, which
 * callables map to failed-precondition rather than a generic 500.
 *
 * Model default is overridable per-call or via ANTHROPIC_MODEL env.
 */

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

/**
 * @returns {Promise<{ client: object, model: string }>}
 * @throws {Error} code NOT_CONFIGURED when no API key is available.
 */
async function getAnthropic(model) {
  let key = null;
  try {
    // Lazy require — keeps the heavy Secret Manager client off the module-load
    // path for callers that import this file but never invoke AI.
    const { resolveServiceSecret } = require('../admin/secrets');
    key = await resolveServiceSecret('ANTHROPIC_API_KEY');
  } catch (_) { /* fall through */ }
  if (!key) {
    const err = new Error('ANTHROPIC_API_KEY is not configured. Set it in Settings → API Keys.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const AnthropicModule = require('@anthropic-ai/sdk');
  const Anthropic = AnthropicModule.default || AnthropicModule;
  return { client: new Anthropic({ apiKey: key }), model: model || DEFAULT_MODEL };
}

module.exports = { getAnthropic, DEFAULT_MODEL };
