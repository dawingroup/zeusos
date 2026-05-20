/**
 * ExchangeRateIndicator
 *
 * Small inline component showing the exchange rate applied to a payment.
 * Displays "1 USD = 3,750 UGX" with the rate date in a hover tooltip.
 */

import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import type { TransactionExchangeRate } from '../../types/exchange-rate';
import { formatExchangeRate } from '../../types/exchange-rate';

interface ExchangeRateIndicatorProps {
  exchangeRate?: TransactionExchangeRate;
  className?: string;
}

export function ExchangeRateIndicator({
  exchangeRate,
  className = '',
}: ExchangeRateIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!exchangeRate) return null;

  const rateText = formatExchangeRate(exchangeRate);
  const rateDate = new Date(exchangeRate.rateDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const sourceLabel =
    exchangeRate.source === 'manual'
      ? 'Manual entry'
      : exchangeRate.source === 'reference'
        ? 'Reference rate'
        : 'Bank rate';

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 text-xs text-gray-500 ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span className="whitespace-nowrap">{rateText}</span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
          <p className="font-medium">{rateText}</p>
          <p className="mt-0.5 text-gray-300">
            Rate date: {rateDate}
          </p>
          <p className="text-gray-300">Source: {sourceLabel}</p>
          {exchangeRate.notes && (
            <p className="mt-1 text-gray-400">{exchangeRate.notes}</p>
          )}
          {/* Tooltip arrow */}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
