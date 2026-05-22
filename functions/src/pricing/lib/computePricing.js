/**
 * Pure pricing compute — CommonJS twin of
 * `src/modules/pricing/services/computePricing.ts`. Keep behaviour byte-for-byte
 * identical: the unit test in `functions/__tests__/pricing/computePricing.test.js`
 * pins this side, and the vitest in `src/modules/pricing/services/__tests__/`
 * pins the TS side. If you change one, change both.
 *
 * Spec §8.1 — authoritative pseudocode reproduced verbatim above the implementation.
 */

const DEFAULT_MARGIN_FLOOR_PCT = 25;

class PricingError extends Error {
  constructor(code, message, detail) {
    super(`[${code}] ${message}`);
    this.name = 'PricingError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * @param {object} args
 * @param {string} args.sowId
 * @param {string} args.clientId
 * @param {Array<{subsidiaryOrgId: string, roleCode: string, unit: string, qty: number, description?: string}>} args.lines
 * @param {number} [args.marginFloorPct]
 * @param {(args:{subsidiaryOrgId:string,roleCode:string,unit:string}) => {rateCardId:string,rateCardLineId:string,costMinor:number,currency:string}} args.lookupRate
 * @param {(args:{subsidiaryOrgId:string,clientId:string}) => number} args.lookupMarkup
 */
function computePricedQuote(args) {
  const {
    sowId,
    clientId,
    lines,
    marginFloorPct = DEFAULT_MARGIN_FLOOR_PCT,
    lookupRate,
    lookupMarkup,
  } = args;

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new PricingError('EMPTY_QUOTE', 'A quote must have at least one line.');
  }

  let totalCostMinor = 0;
  let totalClientMinor = 0;
  let currency = null;

  const priced = lines.map((line, idx) => {
    if (!line.qty || line.qty <= 0) {
      throw new PricingError('INVALID_QTY', `Line ${idx + 1}: qty must be > 0 (got ${line.qty}).`);
    }
    const rate = lookupRate({
      subsidiaryOrgId: line.subsidiaryOrgId,
      roleCode: line.roleCode,
      unit: line.unit,
    });
    if (currency === null) {
      currency = rate.currency;
    } else if (currency !== rate.currency) {
      throw new PricingError(
        'MIXED_CURRENCY',
        `Line ${idx + 1}: currency ${rate.currency} mixes with quote currency ${currency}. ` +
          `Multi-currency quotes are deferred to Phase 3.F.`,
      );
    }
    const costMinor = rate.costMinor * line.qty;
    const markupPct = lookupMarkup({
      subsidiaryOrgId: line.subsidiaryOrgId,
      clientId,
    });
    const clientMinor = Math.round(costMinor * (1 + markupPct / 100));
    totalCostMinor += costMinor;
    totalClientMinor += clientMinor;
    return {
      subsidiaryOrgId: line.subsidiaryOrgId,
      rateCardId: rate.rateCardId,
      rateCardLineId: rate.rateCardLineId,
      roleCode: line.roleCode,
      unit: line.unit,
      qty: line.qty,
      description: line.description || defaultLineDescription(line.roleCode, line.unit, line.qty),
      costMinor,
      markupPct,
      clientMinor,
    };
  });

  const marginPct = totalClientMinor > 0
    ? ((totalClientMinor - totalCostMinor) / totalClientMinor) * 100
    : 0;
  const meetsFloor = marginPct >= marginFloorPct;

  return {
    sowId,
    currency: currency || 'UGX',
    lines: priced,
    totalCostMinor,
    totalClientMinor,
    marginPct,
    marginFloorPct,
    meetsFloor,
  };
}

function defaultLineDescription(roleCode, unit, qty) {
  const friendly = roleCode
    .toLowerCase()
    .split('_')
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
  const unitWord = unit === 'PASS_THROUGH'
    ? 'pass-through'
    : unit.toLowerCase() + (qty === 1 ? '' : 's');
  return `${friendly} — ${qty} ${unitWord}`;
}

module.exports = {
  computePricedQuote,
  PricingError,
  DEFAULT_MARGIN_FLOOR_PCT,
};
