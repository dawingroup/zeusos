/**
 * Burn check helper — spec §6.1.1 (post_cost guard) + §11.2.
 *
 * Hard block at 100% (BUDGET_EXCEEDED), soft warning event at 80%.
 * Helper is pure-ish — it takes the prior cumulative, the new amount, the
 * budget, and returns a directive object the callable uses to drive the
 * transaction's updates + events.
 */

/**
 * @param {object} args
 * @param {number} args.previousCumulativeMinor — cumulative cost BEFORE this entry
 * @param {number} args.entryAmountMinor       — cost of the entry being posted
 * @param {number} args.budgetMinor            — IWO budget cap
 * @param {boolean} [args.thresholdAlreadyCrossed80] — whether the 80% event was already emitted
 * @returns {{ ok: boolean, error?: object,
 *             newCumulative: number,
 *             crossed80: boolean,
 *             crossed100: boolean }}
 */
function burnCheck({
  previousCumulativeMinor,
  entryAmountMinor,
  budgetMinor,
  thresholdAlreadyCrossed80,
}) {
  if (!Number.isInteger(previousCumulativeMinor) || previousCumulativeMinor < 0) {
    throw new Error('burnCheck: previousCumulativeMinor must be a non-negative integer.');
  }
  if (!Number.isInteger(entryAmountMinor) || entryAmountMinor <= 0) {
    throw new Error('burnCheck: entryAmountMinor must be a positive integer.');
  }
  if (!Number.isInteger(budgetMinor) || budgetMinor <= 0) {
    throw new Error('burnCheck: budgetMinor must be a positive integer.');
  }

  const newCumulative = previousCumulativeMinor + entryAmountMinor;
  if (newCumulative > budgetMinor) {
    return {
      ok: false,
      error: {
        code: 'BUDGET_EXCEEDED',
        message: `BUDGET_EXCEEDED: cumulative ${newCumulative} > budget ${budgetMinor}.`,
        details: { cumulativeMinor: newCumulative, budgetMinor },
      },
      newCumulative,
      crossed80: false,
      crossed100: false,
    };
  }

  const burnPct = (newCumulative / budgetMinor) * 100;
  const crossed80 =
    !thresholdAlreadyCrossed80
    && burnPct >= 80
    && previousCumulativeMinor / budgetMinor * 100 < 80;
  const crossed100 = newCumulative === budgetMinor;

  return { ok: true, newCumulative, crossed80, crossed100 };
}

module.exports = { burnCheck };
