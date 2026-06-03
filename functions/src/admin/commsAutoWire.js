/**
 * Comms credential auto-wiring — pure helpers (no Firebase/GCP deps).
 *
 * Splitting these out of `secrets.js` keeps them unit-testable without
 * standing up the Secret Manager / firebase-functions runtime. `secrets.js`
 * imports + uses them after a credential write; the comms send/receive
 * functions reuse `WHATSAPP_REQUIRED_IDS` to know which keys to resolve.
 */

/** The WhatsApp channel is "configured" once these three credentials exist. */
const WHATSAPP_REQUIRED_IDS = [
  'META_WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
];

/**
 * Pure derivation of the `commsConfig/whatsapp` doc from the current WhatsApp
 * credential values. The secret access TOKEN is never copied into the result
 * (it stays in Secret Manager) — only `enabled` + the non-secret IDs, which
 * are safe to store in Firestore for the UI gate + functions to read.
 */
function deriveWhatsAppConfig({ token, phoneNumberId, businessAccountId }) {
  return {
    enabled: Boolean(token && phoneNumberId && businessAccountId),
    activeProvider: 'meta',
    phoneNumberId: phoneNumberId || null,
    businessAccountId: businessAccountId || null,
    autoWiredFrom: 'api-keys',
  };
}

module.exports = { WHATSAPP_REQUIRED_IDS, deriveWhatsAppConfig };
