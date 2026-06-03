/**
 * Auto-wire derivation tests — deriveWhatsAppConfig.
 *
 * Verifies the rule that flips the WhatsApp channel live: enabled iff the
 * access token + phone-number ID + business-account ID are all present, and
 * the token is never copied into the derived (Firestore-bound) config.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { deriveWhatsAppConfig, WHATSAPP_REQUIRED_IDS } = require('../src/admin/commsAutoWire');

const it = test;
const expect = (actual) => ({
  toBe: (e) => assert.strictEqual(actual, e),
  toEqual: (e) => assert.deepStrictEqual(actual, e),
  toContain: (e) => assert.ok(String(actual).includes(e)),
  not: {
    toContain: (e) => assert.ok(!String(actual).includes(e)),
    toHaveProperty: (p) => assert.ok(!Object.prototype.hasOwnProperty.call(actual, p)),
  },
});

describe('deriveWhatsAppConfig', () => {
  it('is enabled only when token + phoneNumberId + businessAccountId are all present', () => {
    const d = deriveWhatsAppConfig({
      token: 'EAAG...secret',
      phoneNumberId: '1234567890',
      businessAccountId: '9876543210',
    });
    expect(d.enabled).toBe(true);
    expect(d.phoneNumberId).toBe('1234567890');
    expect(d.businessAccountId).toBe('9876543210');
    expect(d.activeProvider).toBe('meta');
    expect(d.autoWiredFrom).toBe('api-keys');
  });

  it('is disabled when the token is missing', () => {
    expect(
      deriveWhatsAppConfig({ token: null, phoneNumberId: 'p', businessAccountId: 'b' }).enabled,
    ).toBe(false);
  });

  it('is disabled when the phone-number ID is missing', () => {
    expect(
      deriveWhatsAppConfig({ token: 't', phoneNumberId: null, businessAccountId: 'b' }).enabled,
    ).toBe(false);
  });

  it('is disabled when the business-account ID is missing', () => {
    expect(
      deriveWhatsAppConfig({ token: 't', phoneNumberId: 'p', businessAccountId: null }).enabled,
    ).toBe(false);
  });

  it('NEVER copies the secret token into the derived config', () => {
    const d = deriveWhatsAppConfig({
      token: 'EAAG-super-secret-token',
      phoneNumberId: 'p',
      businessAccountId: 'b',
    });
    expect(JSON.stringify(d)).not.toContain('EAAG-super-secret-token');
    expect(d).not.toHaveProperty('token');
    expect(d).not.toHaveProperty('accessToken');
  });

  it('still records the non-secret IDs even when disabled (partial config)', () => {
    const d = deriveWhatsAppConfig({ token: null, phoneNumberId: 'p123', businessAccountId: null });
    expect(d.enabled).toBe(false);
    expect(d.phoneNumberId).toBe('p123');
    expect(d.businessAccountId).toBe(null);
  });

  it('requires exactly the three WhatsApp credential ids', () => {
    expect(WHATSAPP_REQUIRED_IDS).toEqual([
      'META_WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_BUSINESS_ACCOUNT_ID',
    ]);
  });
});
