/**
 * CurrencyConversionSummary
 *
 * Card showing dual-currency (USD/UGX) exposure: Total USD Budget,
 * Weighted Avg FX Rate, Total UGX Equivalent, Actual UGX Spent,
 * FX Variance (gain/loss). A visual SVG bar compares budget UGX
 * equivalent vs actual UGX spent.
 */

import { ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';
import type { ExchangeRateEntry } from '../../types/exchange-rate';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface CurrencyExposure {
  totalBudgetUSD: number;
  totalBudgetUGXEquivalent: number;
  totalSpentUGX: number;
  totalSpentUSDEquivalent: number;
  weightedAvgRate: number;
  fxVariance: number;
}

interface CurrencyConversionSummaryProps {
  currencyExposure: CurrencyExposure;
  latestRate: ExchangeRateEntry | null;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const fmtUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const fmtUGX = new Intl.NumberFormat('en-UG', {
  style: 'currency',
  currency: 'UGX',
  maximumFractionDigits: 0,
});

const fmtRate = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function CurrencyConversionSummary({
  currencyExposure,
  latestRate,
}: CurrencyConversionSummaryProps) {
  const {
    totalBudgetUSD,
    totalBudgetUGXEquivalent,
    totalSpentUGX,
    weightedAvgRate,
    fxVariance,
  } = currencyExposure;

  const isGain = fxVariance >= 0;

  // Bar comparison: budget UGX equiv vs actual UGX spent
  const maxAmount = Math.max(totalBudgetUGXEquivalent, totalSpentUGX, 1);
  const budgetBarPct = (totalBudgetUGXEquivalent / maxAmount) * 100;
  const spentBarPct = (totalSpentUGX / maxAmount) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="w-5 h-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">Currency Exposure</h3>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {/* Total USD Budget */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Budget (USD)</p>
            <p className="text-lg font-semibold text-gray-900">
              {fmtUSD.format(totalBudgetUSD)}
            </p>
          </div>

          {/* Weighted Avg FX Rate */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Weighted Avg Rate</p>
            <p className="text-lg font-semibold text-gray-900">
              {fmtRate.format(weightedAvgRate)}
            </p>
            <p className="text-xs text-gray-400">USD/UGX</p>
          </div>

          {/* Total UGX Equivalent */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Budget UGX Equiv.</p>
            <p className="text-lg font-semibold text-gray-900">
              {fmtUGX.format(totalBudgetUGXEquivalent)}
            </p>
          </div>

          {/* Actual UGX Spent */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Actual UGX Spent</p>
            <p className="text-lg font-semibold text-gray-900">
              {fmtUGX.format(totalSpentUGX)}
            </p>
          </div>

          {/* FX Variance */}
          <div>
            <p className="text-xs text-gray-500 mb-1">FX Variance</p>
            <div className="flex items-center gap-1.5">
              {isGain ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <p
                className={`text-lg font-semibold ${
                  isGain ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {fmtUGX.format(Math.abs(fxVariance))}
              </p>
            </div>
            <p
              className={`text-xs font-medium ${
                isGain ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {isGain ? 'Gain' : 'Loss'}
            </p>
          </div>
        </div>

        {/* Latest reference rate */}
        {latestRate && (
          <div className="mb-4 text-xs text-gray-500 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>
              Latest rate: 1 {latestRate.fromCurrency} = {fmtRate.format(latestRate.rate)}{' '}
              {latestRate.toCurrency}
              {' '}({latestRate.source})
            </span>
          </div>
        )}

        {/* Visual comparison bar (SVG) */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">
            Budget UGX Equivalent vs Actual UGX Spent
          </p>

          <svg
            viewBox="0 0 400 56"
            className="w-full h-14"
            role="img"
            aria-label="Budget vs Spent comparison"
          >
            {/* Background */}
            <rect x="0" y="0" width="400" height="56" rx="6" fill="#f9fafb" />

            {/* Budget bar */}
            <rect
              x="8"
              y="8"
              width={Math.max((budgetBarPct / 100) * 384, 2)}
              height="16"
              rx="3"
              fill="#93c5fd"
            />
            <text
              x={Math.max((budgetBarPct / 100) * 384, 2) + 14}
              y="20"
              fontSize="9"
              fill="#6b7280"
              dominantBaseline="middle"
            >
              Budget: {fmtUGX.format(totalBudgetUGXEquivalent)}
            </text>

            {/* Spent bar */}
            <rect
              x="8"
              y="32"
              width={Math.max((spentBarPct / 100) * 384, 2)}
              height="16"
              rx="3"
              fill={isGain ? '#86efac' : '#fca5a5'}
            />
            <text
              x={Math.max((spentBarPct / 100) * 384, 2) + 14}
              y="44"
              fontSize="9"
              fill="#6b7280"
              dominantBaseline="middle"
            >
              Spent: {fmtUGX.format(totalSpentUGX)}
            </text>
          </svg>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-sm bg-blue-300" />
              Budget UGX Equiv.
            </span>
            <span className="flex items-center gap-1">
              <span
                className={`inline-block w-3 h-2 rounded-sm ${
                  isGain ? 'bg-green-300' : 'bg-red-300'
                }`}
              />
              Actual UGX Spent
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
