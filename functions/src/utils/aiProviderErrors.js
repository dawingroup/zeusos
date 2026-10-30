/**
 * Translate a model provider's failure into something the caller can act on.
 *
 * `onCall` renders any plain Error as INTERNAL, so the browser sees a bare 500
 * while the real answer ("Your credit balance is too low") sits in a Cloud
 * Logging stack trace. This module holds the classification for both
 * providers so the two client boundaries (`claudeClient.js`, `geminiClient.js`)
 * behave identically.
 *
 * Two rules: only PROVIDER problems are translated (the account, the key, the
 * service) — a prompt-level failure is returned untouched because its detail
 * is the debugging signal; and `status` is copied onto the replacement so the
 * retry gates that read `error.status` still see it.
 *
 * NO top-level requires, deliberately: reachable from modules that must load
 * without firebase-functions.
 */

'use strict';

function toHttpsError(classified, original) {
  const { HttpsError } = require('firebase-functions/v2/https');
  const status = original && original.status;
  const mapped = new HttpsError(classified.code, classified.message, {
    provider: classified.provider,
    type: classified.type,
    ...(status === undefined ? {} : { status }),
  });
  if (status !== undefined) mapped.status = status;
  mapped.cause = original;
  return mapped;
}

/** Classify an Anthropic SDK failure; null for a prompt-level one. */
function classifyAnthropicError(error) {
  const status = Number(error && error.status);
  if (!Number.isFinite(status)) return null;
  const type = (error.error && error.error.error && error.error.error.type) || (error.error && error.error.type) || '';
  const detail = String((error.error && error.error.error && error.error.error.message) || error.message || '');
  const at = (code, t, message) => ({ provider: 'anthropic', code, type: type || t, message });

  // Out of credit arrives as a 400 invalid_request_error, NOT a 402 or 429.
  if (/credit balance is too low|insufficient credit/i.test(detail)) {
    return at('resource-exhausted', 'credit_exhausted',
      'The Anthropic account has run out of credit, so AI features are paused. Top it up under Plans & Billing in the Anthropic console — everything else in ZeusOS is unaffected.');
  }
  if (status === 401 || status === 403) {
    return at('failed-precondition', 'authentication_error',
      'The Anthropic API key is missing, invalid, or lacks access to this model. Check ANTHROPIC_API_KEY under Settings → API Keys.');
  }
  if (status === 429) {
    return at('resource-exhausted', 'rate_limit_error', 'The AI provider is rate-limiting ZeusOS right now. Wait a minute and try again.');
  }
  if (status === 529 || status >= 500) {
    return at('unavailable', 'api_error', `The AI provider is temporarily unavailable (${status}). Try again shortly.`);
  }
  return null;
}

/** Classify a Google Generative AI failure — text FIRST, status second (the SDK does not always set one). */
function classifyGoogleError(error) {
  const raw = Number(error && (error.status !== undefined ? error.status : error.statusCode));
  const status = Number.isFinite(raw) ? raw : undefined;
  const detail = String((error && error.message) || error || '');
  if (!detail && status === undefined) return null;
  const at = (code, type, message) => ({ provider: 'google', code, type, message });

  if (/dunning/i.test(detail) || /PERMISSION_DENIED/.test(detail) || status === 403) {
    return at('failed-precondition', 'permission_denied',
      'The Google Cloud project that owns GEMINI_API_KEY has billing disabled, the Generative Language API turned off, or the key lacks permission. Settle billing on that project — the key itself does not need replacing.');
  }
  if (/API_KEY_INVALID/.test(detail) || /API key not valid/i.test(detail) || status === 401) {
    return at('failed-precondition', 'api_key_invalid', 'The Gemini API key is missing or invalid. Check GEMINI_API_KEY under Settings → API Keys.');
  }
  if (/RESOURCE_EXHAUSTED/.test(detail) || /\bquota\b/i.test(detail) || /rate limit/i.test(detail) || status === 429) {
    return at('resource-exhausted', 'resource_exhausted', 'Gemini is rate-limiting ZeusOS or the project quota is spent. Wait a minute and try again.');
  }
  if (/UNAVAILABLE/.test(detail) || /overloaded/i.test(detail) || (status !== undefined && status >= 500)) {
    return at('unavailable', 'api_error', 'Gemini is temporarily unavailable or overloaded. Try again shortly.');
  }
  if (status === undefined && /\[5\d\d\b/.test(detail)) {
    return at('unavailable', 'api_error', 'Gemini is temporarily unavailable. Try again shortly.');
  }
  return null;
}

function mapAnthropicError(error) {
  const classified = classifyAnthropicError(error);
  return classified ? toHttpsError(classified, error) : error;
}

function mapGoogleError(error) {
  const classified = classifyGoogleError(error);
  return classified ? toHttpsError(classified, error) : error;
}

module.exports = { toHttpsError, classifyAnthropicError, classifyGoogleError, mapAnthropicError, mapGoogleError };
