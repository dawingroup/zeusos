/**
 * Minimal ULID generator — Crockford-base32 timestamp + randomness.
 *
 * Used by every IWO state transition to give the domain_events outbox a
 * monotonically-sortable id. We avoid pulling a dependency for this and
 * keep it self-contained for testability.
 *
 * Format: 26 chars, 10 chars time (ms since epoch) + 16 chars random.
 * Per the ULID spec (https://github.com/ulid/spec).
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now, len) {
  let mod;
  let out = '';
  for (let i = len; i > 0; i--) {
    mod = now % ENCODING_LEN;
    out = ENCODING.charAt(mod) + out;
    now = (now - mod) / ENCODING_LEN;
  }
  return out;
}

function encodeRandom(len) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ENCODING.charAt(Math.floor(Math.random() * ENCODING_LEN));
  }
  return out;
}

function ulid(now) {
  const t = typeof now === 'number' ? now : Date.now();
  return encodeTime(t, TIME_LEN) + encodeRandom(RANDOM_LEN);
}

module.exports = { ulid };
