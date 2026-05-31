/**
 * AR/AP aging — Phase 1.3.
 *
 * Ported from DawinOS cfoBriefing.js (AGING_BUCKETS / ageBucketKey /
 * daysBetween / DSO·DPO), re-pointed onto Zeus's NATIVE ledger:
 *   - AR from client_invoices (via nativeLedgerSource.getArInvoices)
 *   - AP from intercompany_invoices (via nativeLedgerSource.getApBills)
 *
 * Two adaptations the native ledger forces:
 *   1. ClientInvoice has no `dueDate` today → derive it as
 *      issuedAt + finance_config.defaultPaymentTermsDays.
 *   2. Zeus is multi-currency → every balance is FX-normalised to a single
 *      presentation currency BEFORE bucketing (you cannot sum mixed minors).
 *      A per-brand breakdown is kept via sourceSubsidiaryId.
 *
 * The bucketing/topN/DSO math is a PURE function (computeAging) so it unit-tests
 * without Firestore; thin async wrappers do the I/O + FX.
 */

const { getFirestore } = require('firebase-admin/firestore');
const native = require('./ledger/nativeLedgerSource');
const { resolveFxRate, convertMinor } = require('./lib/fx');

const DEFAULT_PRESENTATION_CURRENCY = 'UGX';
const DEFAULT_PAYMENT_TERMS_DAYS = 30;

const AGING_BUCKETS = [
  { key: 'current', min: -Infinity, max: 0 },
  { key: 'd0_30', min: 0, max: 30 },
  { key: 'd31_60', min: 31, max: 60 },
  { key: 'd61_90', min: 61, max: 90 },
  { key: 'd90_plus', min: 91, max: Infinity },
];

function ageBucketKey(daysOverdue) {
  for (const b of AGING_BUCKETS) {
    if (daysOverdue >= b.min && daysOverdue <= b.max) return b.key;
  }
  return 'current';
}

function daysBetween(fromIso, toDate) {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return null;
  const MS = 1000 * 60 * 60 * 24;
  return Math.floor((toDate - from) / MS);
}

/** Coerce a Firestore Timestamp | Date | ISO string to an ISO date string. */
function toIso(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v._seconds === 'number') return new Date(v._seconds * 1000).toISOString();
  return null;
}

/** Add N days to an ISO date, returning an ISO string. */
function addDays(iso, days) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * PURE: bucket a list of normalised items into aging buckets + topN overdue.
 * @param {Array<{amountMinor:number, dueDate:?string, party:?string, brandId:?string}>} items
 * @param {Date} now
 * @param {{partyKey?:string}} [opts] — label for the top-overdue party (customer/vendor)
 */
function computeAging(items, now, opts = {}) {
  const partyKey = opts.partyKey || 'party';
  const buckets = { current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  const byBrand = {};
  const byParty = new Map();
  let totalOutstanding = 0;
  let overdueCount = 0;

  for (const it of items) {
    const bal = Number(it.amountMinor) || 0;
    if (bal <= 0) continue;
    const daysOver = daysBetween(it.dueDate, now);
    const bucket = daysOver === null ? 'current' : ageBucketKey(daysOver);
    buckets[bucket] += bal;
    totalOutstanding += bal;
    if (daysOver !== null && daysOver > 0) overdueCount += 1;

    const brand = it.brandId || 'unallocated';
    byBrand[brand] = (byBrand[brand] || 0) + bal;

    const party = it.party || 'Unknown';
    const prev = byParty.get(party) || { outstanding: 0, oldestDays: 0, count: 0 };
    prev.outstanding += bal;
    prev.count += 1;
    if (daysOver !== null && daysOver > prev.oldestDays) prev.oldestDays = daysOver;
    byParty.set(party, prev);
  }

  const topOverdue = [...byParty.entries()]
    .filter(([, v]) => v.oldestDays > 0)
    .sort((a, b) => b[1].outstanding - a[1].outstanding)
    .slice(0, 5)
    .map(([party, v]) => ({ [partyKey]: party, outstanding: v.outstanding, oldestDays: v.oldestDays, count: v.count }));

  return { totalOutstanding, buckets, byBrand, overdueCount, topOverdue };
}

async function loadFinanceConfig(db) {
  let presentationCurrency = DEFAULT_PRESENTATION_CURRENCY;
  let termsDays = DEFAULT_PAYMENT_TERMS_DAYS;
  try {
    const [grp, terms] = await Promise.all([
      db.doc('finance_config/group').get(),
      db.doc('finance_config/payment_terms').get(),
    ]);
    if (grp.exists && grp.data().presentationCurrency) presentationCurrency = grp.data().presentationCurrency;
    if (terms.exists && Number.isFinite(terms.data().defaultPaymentTermsDays)) {
      termsDays = terms.data().defaultPaymentTermsDays;
    }
  } catch (_) { /* defaults */ }
  return { presentationCurrency, termsDays };
}

/** Build an FX closure converting (amountMinor, currency) → presentation minor. */
function makeFxResolver(db, presentationCurrency, fxDate) {
  const cache = new Map();
  return async (amountMinor, currency) => {
    if (!currency || currency === presentationCurrency) return amountMinor;
    let rate = cache.get(currency);
    if (rate == null) {
      const r = await resolveFxRate(db, currency, presentationCurrency, fxDate);
      rate = r.rate;
      cache.set(currency, rate);
    }
    return convertMinor(amountMinor, rate);
  };
}

/** AR aging (group, FX-normalised). DSO over a trailing-90d issued window. */
async function getArAging({ now = new Date(), presentationCurrency } = {}) {
  const db = getFirestore();
  const cfg = await loadFinanceConfig(db);
  const pc = presentationCurrency || cfg.presentationCurrency;
  const fxDate = now.toISOString().slice(0, 10);
  const fx = makeFxResolver(db, pc, fxDate);

  const invoices = await native.getArInvoices({});
  const items = [];
  for (const inv of invoices) {
    const issuedIso = toIso(inv.issuedAt);
    const dueIso = toIso(inv.dueDate) || (issuedIso ? addDays(issuedIso, cfg.termsDays) : null);
    const amountMinor = await fx(inv.balanceMinor, inv.currency);
    items.push({ amountMinor, dueDate: dueIso, party: inv.counterparty, brandId: inv.sourceSubsidiaryId });
  }
  const aging = computeAging(items, now, { partyKey: 'customer' });

  // DSO = AR / (trailing-90d issued revenue / 90). Best-effort: sum client
  // invoices issued in the last 90 days (any status), FX-normalised.
  let dso = null;
  try {
    const since = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
    const snap = await db.collection('client_invoices').get();
    let issued90 = 0;
    for (const d of snap.docs) {
      if (d.id.endsWith(':active')) continue;
      const inv = d.data() || {};
      const issuedIso = toIso(inv.issuedAt);
      if (!issuedIso || issuedIso.slice(0, 10) < since) continue;
      issued90 += await fx((inv.total && inv.total.amountMinor) || 0, inv.total && inv.total.currency);
    }
    if (issued90 > 0) dso = Math.round((aging.totalOutstanding / issued90) * 90);
  } catch (_) { /* dso stays null */ }

  return { ...aging, dso, presentationCurrency: pc };
}

/** AP aging (group, FX-normalised). DPO over a trailing-90d booked window. */
async function getApAging({ now = new Date(), presentationCurrency } = {}) {
  const db = getFirestore();
  const cfg = await loadFinanceConfig(db);
  const pc = presentationCurrency || cfg.presentationCurrency;
  const fxDate = now.toISOString().slice(0, 10);
  const fx = makeFxResolver(db, pc, fxDate);

  const bills = await native.getApBills({});
  const items = [];
  for (const b of bills) {
    const raisedIso = toIso(b.raisedAt);
    const dueIso = toIso(b.dueDate) || (raisedIso ? addDays(raisedIso, cfg.termsDays) : null);
    const amountMinor = await fx(b.balanceMinor, b.currency);
    items.push({ amountMinor, dueDate: dueIso, party: b.counterparty });
  }
  const aging = computeAging(items, now, { partyKey: 'vendor' });

  let dpo = null;
  try {
    const since = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
    const snap = await db.collection('intercompany_invoices').get();
    let booked90 = 0;
    for (const d of snap.docs) {
      const inv = d.data() || {};
      const raisedIso = toIso(inv.raisedAt || inv.postedAt || inv.createdAt);
      if (!raisedIso || raisedIso.slice(0, 10) < since) continue;
      booked90 += await fx((inv.amount && inv.amount.amountMinor) || 0, inv.amount && inv.amount.currency);
    }
    if (booked90 > 0) dpo = Math.round((aging.totalOutstanding / booked90) * 90);
  } catch (_) { /* dpo stays null */ }

  return { ...aging, dpo, presentationCurrency: pc };
}

module.exports = {
  AGING_BUCKETS,
  ageBucketKey,
  daysBetween,
  computeAging,
  getArAging,
  getApAging,
  _internals: { toIso, addDays, makeFxResolver, loadFinanceConfig },
};
