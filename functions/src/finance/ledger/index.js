/**
 * Ledger-source factory — Phase 1.1 (HYBRID backbone).
 *
 * Returns the native ledger source by default. If finance later enables a
 * per-brand QuickBooks mirror by setting
 *   finance_config/integrations { qboMirrorEnabled: true, qboMirrorOrgs?: [...] }
 * this factory hands back the (quarantined) QBO source for those orgs. Today
 * the flag is absent/false everywhere, so every caller gets the native ledger.
 *
 * The flag is read once per process and cached briefly — it changes rarely and
 * a stale read for a minute is harmless.
 */

const { getFirestore } = require('firebase-admin/firestore');
const native = require('./nativeLedgerSource');
const qbo = require('./qboLedgerSource');

const FLAG_TTL_MS = 60 * 1000;
let _flagCache = null; // { value: {enabled, orgs}, fetchedAt }

async function loadQboMirrorFlag() {
  if (_flagCache && Date.now() - _flagCache.fetchedAt < FLAG_TTL_MS) return _flagCache.value;
  let value = { enabled: false, orgs: null };
  try {
    const snap = await getFirestore().doc('finance_config/integrations').get();
    if (snap.exists) {
      const data = snap.data() || {};
      value = {
        enabled: data.qboMirrorEnabled === true,
        orgs: Array.isArray(data.qboMirrorOrgs) ? data.qboMirrorOrgs : null,
      };
    }
  } catch (_) { /* default = native */ }
  _flagCache = { value, fetchedAt: Date.now() };
  return value;
}

/**
 * Resolve the ledger source for an org. Async because the flag lives in
 * Firestore. Defaults to native; returns the QBO stub only when the mirror is
 * explicitly enabled (globally, or for the org's id when an allow-list is set).
 * @param {string} [orgId]
 */
async function getLedgerSource(orgId) {
  const flag = await loadQboMirrorFlag();
  if (flag.enabled && (!flag.orgs || (orgId && flag.orgs.includes(orgId)))) {
    return qbo;
  }
  return native;
}

function _clearFlagCache() {
  _flagCache = null;
}

module.exports = { getLedgerSource, native, qbo, _clearFlagCache };
