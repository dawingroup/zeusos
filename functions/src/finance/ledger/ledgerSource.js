/**
 * Ledger-source interface — Phase 1.1 (HYBRID backbone).
 *
 * The finance consolidation engines (group roll-up, AR/AP aging, CFO briefing,
 * cash-flow scenario) all read the ledger through THIS contract rather than
 * touching collections directly. Two implementations satisfy it:
 *   - nativeLedgerSource.js — Zeus's own ledger (client_invoices /
 *     intercompany_invoices / gl_postings). The source of truth today.
 *   - qboLedgerSource.js    — a quarantined stub for the future per-brand
 *     QuickBooks mirror, returned only when the integration flag is on.
 *
 * `index.js` picks the implementation via getLedgerSource(orgId).
 *
 * ── Contract ────────────────────────────────────────────────────────────────
 * All monetary values are MINOR units (cents) in the entity's own
 * `base_currency` unless a method's doc says otherwise. The CALLER (groupRollup)
 * performs FX conversion to a group presentation currency — sources never
 * convert.
 *
 * getStatementBases({ orgId, periodKey }) → Promise<{
 *   pnlBase, bsBase, cfBase, currency
 * }>
 *   Accumulator shapes are IDENTICAL to groupRollup's zeroPnLBase/zeroBSBase/
 *   zeroCFBase so the shared finalise* math consumes them unchanged.
 *   - pnlBase: period-FLOW (movements dated within periodKey)
 *   - bsBase:  cumulative BALANCES as of periodKey month-end
 *   - cfBase:  cash movement derived from opening/closing cash + period netIncome
 *   - currency: the entity's base_currency (for the caller's FX step)
 *
 * getArInvoices({ orgId, asOf }) → Promise<Array<{
 *   id, counterparty, balanceMinor, currency, issuedAt, dueDate, status,
 *   sourceSubsidiaryId
 * }>>   — open receivables (for aging / DSO).
 *
 * getApBills({ orgId, asOf }) → Promise<Array<{
 *   id, counterparty, balanceMinor, currency, raisedAt, dueDate, status
 * }>>   — open payables (for aging / DPO).
 *
 * getCashPosition({ orgId }) → Promise<{ balanceMinor, currency }>
 *   — current cash & equivalents balance (GL 1xxx cash accounts).
 *
 * getExpenditureQueue({ orgId }) → Promise<Array<object>>
 *   — pending payments for the optimizer (passthrough of the queue docs).
 */

// This module is a documentation/contract anchor only — no runtime behaviour.
// Implementations live in nativeLedgerSource.js / qboLedgerSource.js.

/** @typedef {Object} StatementBases
 *  @property {Object} pnlBase
 *  @property {Object} bsBase
 *  @property {Object} cfBase
 *  @property {string} currency
 */

module.exports = {};
