// ============================================================================
// CURRENCY DISPLAY COMPONENT
// ZeusOS v2.0 - Capital Hub Module
// Displays currency values with formatting and dual currency support
// ============================================================================

import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';
import { DEFAULT_EXCHANGE_RATE } from '../../constants/capital.constants';

interface CurrencyDisplayProps {
  amount: number;
  currency?: 'USD' | 'UGX';
  showDual?: boolean;
  exchangeRate?: number;
  compact?: boolean;
  colorPositive?: boolean;
  prefix?: string;
  className?: string;
  variant?: 'default' | 'large' | 'small';
}

export const formatCurrency = (
  amount: number,
  currency: 'USD' | 'UGX' = 'USD',
  compact: boolean = false
): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
    minimumFractionDigits: 0,
  });

  return formatter.format(amount);
};

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  currency = 'USD',
  showDual = false,
  exchangeRate = DEFAULT_EXCHANGE_RATE,
  compact = false,
  colorPositive = false,
  prefix = '',
  className,
  variant = 'default',
}) => {
  const primaryValue = formatCurrency(amount, currency, compact);
  const secondaryCurrency = currency === 'USD' ? 'UGX' : 'USD';
  const secondaryAmount = currency === 'USD' 
    ? amount * exchangeRate 
    : amount / exchangeRate;
  const secondaryValue = formatCurrency(secondaryAmount, secondaryCurrency, compact);

  const colorClass = colorPositive 
    ? amount >= 0 ? 'text-green-600' : 'text-red-600'
    : '';

  const sizeClass = variant === 'large' 
    ? 'text-xl font-semibold' 
    : variant === 'small' 
      ? 'text-sm' 
      : 'text-base';

  if (showDual) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`${colorClass} ${sizeClass} ${className || ''}`}>
              {prefix}{primaryValue}
            </span>
          </TooltipTrigger>
          <TooltipContent>{secondaryValue}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <span className={`${colorClass} ${sizeClass} ${className || ''}`}>
      {prefix}{primaryValue}
    </span>
  );
};

export default CurrencyDisplay;
