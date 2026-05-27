/**
 * Chart of Accounts — Phase 4.1 finance handshake.
 *
 * Maps domain source-doc kinds to the debit/credit account pair that the
 * JE consumer (postJournalEntryOnInvoicePaid) should post against.
 *
 * Source of truth: the Firestore doc `finance_config/chart_of_accounts`
 * (when present). Falls back to the codebase-pinned defaults below so
 * the consumer keeps working even before finance has seeded the doc.
 *
 * Why a Firestore doc:
 *   Phase 4.1 originally inlined this mapping in the consumer (see
 *   `docs/PHASE_4_1_HANDSHAKE.md` §5). Moving it to Firestore lets
 *   the finance team amend account codes — e.g. when they switch
 *   from a Ugandan COA to the IFRS Kenyan COA, or add a new vendor
 *   category — without redeploying Cloud Functions. The defaults
 *   here stay as the "last-known-good" snapshot so a missing or
 *   corrupted config doc never silently swallows a JE.
 *
 * Doc shape (Firestore):
 *   /finance_config/chart_of_accounts
 *     {
 *       version: 1,
 *       updatedAt: <serverTimestamp>,
 *       updatedByUserId: 'u_...',
 *       entries: {
 *         TALENT_FREELANCER: {
 *           debit:  { accountCode: '5010', accountName: '…' },
 *           credit: { accountCode: '2050', accountName: '…' },
 *         },
 *         MEDIA_SUPPLIER:  { debit: …, credit: … },
 *         CLIENT_REVENUE_RECOGNISED: { debit: …, credit: … },
 *         // …add more kinds here as new GL-posting sources land
 *       },
 *     }
 *
 * Merge semantics: `entries.<KIND>` from Firestore overrides the
 * default for that kind. Kinds not present in the Firestore doc keep
 * their default mapping. This lets finance change just one mapping
 * (e.g. media spend account code) without re-stating the whole table.
 */

const DEFAULT_CHART_OF_ACCOUNTS = Object.freeze({
  TALENT_FREELANCER: {
    debit: { accountCode: '5010', accountName: 'Contractor Fees - Talent & Freelancers' },
    credit: { accountCode: '2050', accountName: 'Accounts Payable - Contractors' },
  },
  MEDIA_SUPPLIER: {
    debit: { accountCode: '5020', accountName: 'Media Spend - Agencies & Suppliers' },
    credit: { accountCode: '2051', accountName: 'Accounts Payable - Media' },
  },
  CLIENT_REVENUE_RECOGNISED: {
    debit: { accountCode: '1200', accountName: 'Accounts Receivable - Clients' },
    credit: { accountCode: '4000', accountName: 'Service Revenue - Agencies' },
  },
});

const FINANCE_CONFIG_COLLECTION = 'finance_config';
const CHART_OF_ACCOUNTS_DOC_ID = 'chart_of_accounts';

/**
 * Load the active chart of accounts. Always returns a complete mapping
 * — Firestore entries override defaults, missing kinds keep defaults.
 *
 * The caller must NOT mutate the returned object (it may share refs
 * with the frozen `DEFAULT_CHART_OF_ACCOUNTS`).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Record<string, {debit: {accountCode: string, accountName: string},
 *                                   credit: {accountCode: string, accountName: string}}>>}
 */
async function loadChartOfAccounts(db) {
  try {
    const docRef = db.collection(FINANCE_CONFIG_COLLECTION).doc(CHART_OF_ACCOUNTS_DOC_ID);
    const snap = await docRef.get();
    if (!snap.exists) return DEFAULT_CHART_OF_ACCOUNTS;
    const data = snap.data() || {};
    const overrides = data.entries || {};
    // Merge defaults + overrides at the kind level (not at line level
    // — a partial line in the override would create an invalid mapping).
    const merged = { ...DEFAULT_CHART_OF_ACCOUNTS };
    for (const [kind, mapping] of Object.entries(overrides)) {
      if (
        mapping &&
        mapping.debit && mapping.debit.accountCode && mapping.debit.accountName &&
        mapping.credit && mapping.credit.accountCode && mapping.credit.accountName
      ) {
        merged[kind] = mapping;
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[chart-of-accounts] invalid override for ${kind} in `
          + `finance_config/${CHART_OF_ACCOUNTS_DOC_ID}; falling back to default.`,
        );
      }
    }
    return merged;
  } catch (err) {
    // Don't let a config-read blip take down JE posting. The consumer
    // logs + tags the event, and the operator can re-run after fixing.
    // eslint-disable-next-line no-console
    console.warn(
      '[chart-of-accounts] load failed, using compiled defaults:',
      err && err.message,
    );
    return DEFAULT_CHART_OF_ACCOUNTS;
  }
}

module.exports = {
  DEFAULT_CHART_OF_ACCOUNTS,
  FINANCE_CONFIG_COLLECTION,
  CHART_OF_ACCOUNTS_DOC_ID,
  loadChartOfAccounts,
};
