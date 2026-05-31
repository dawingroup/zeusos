/**
 * QBO ledger source — quarantined stub (HYBRID backbone, Phase 1.1).
 *
 * ZeusOS runs on its native ledger; QuickBooks is OFF (see CLAUDE.md open
 * decision #3 + empty env in functions/.env.zeusos). This stub preserves the
 * seam so a future per-brand QBO mirror can be revived without reshaping the
 * consolidation engines: it satisfies the ledgerSource contract but returns
 * empty/zero results and never touches QBO collections.
 *
 * When the mirror is built, port DawinOS's QBO report-tree parsing
 * (loadQboReports + *FromQBO classifiers from its groupRollup.js) HERE, behind
 * the `finance_config/integrations.qboMirrorEnabled` flag that index.js reads.
 */

function zeroPnLBase() {
  return { revenue: 0, otherIncome: 0, costOfSales: 0, operatingExpenses: 0, otherExpenses: 0, taxExpense: 0 };
}
function zeroBSBase() {
  return { cash: 0, ar: 0, inventory: 0, prepaidOtherCA: 0, nonCurrentAssets: 0, ap: 0, taxPayable: 0, accruedOtherCL: 0, longTermLiabilities: 0, shareCapital: 0, reserves: 0, retainedEarnings: 0 };
}
function zeroCFBase() {
  return { operatingCashFlow: 0, investingCashFlow: 0, financingCashFlow: 0, netIncome: 0, depreciation: 0, measuredCashChange: 0, openingCash: 0, closingCash: 0 };
}

async function getStatementBases({ orgId } = {}) {
  return { pnlBase: zeroPnLBase(), bsBase: zeroBSBase(), cfBase: zeroCFBase(), currency: 'UGX', _stub: true };
}
async function getArInvoices() { return []; }
async function getApBills() { return []; }
async function getCashPosition() { return { balanceMinor: 0, currency: 'UGX', _stub: true }; }
async function getExpenditureQueue() { return []; }

module.exports = {
  getStatementBases,
  getArInvoices,
  getApBills,
  getCashPosition,
  getExpenditureQueue,
};
