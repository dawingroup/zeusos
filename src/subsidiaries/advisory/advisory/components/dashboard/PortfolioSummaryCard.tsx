/**
 * Portfolio Summary Card
 * 
 * Compact card showing portfolio performance summary.
 */

import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface Portfolio {
  id: string;
  name: string;
  value: number;
  irr: number;
  status: string;
}

interface PortfolioSummaryCardProps {
  portfolio: Portfolio;
  compact?: boolean;
  onClick?: () => void;
}

export function PortfolioSummaryCard({
  portfolio,
  compact = false,
  onClick,
}: PortfolioSummaryCardProps) {
  const isPositive = portfolio.irr >= 0;
  
  if (compact) {
    return (
      <div
        className={`flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors ${
          onClick ? 'cursor-pointer' : ''
        }`}
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              portfolio.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <div>
            <p className="font-medium text-gray-900">{portfolio.name}</p>
            <p className="text-sm text-gray-500">{formatCurrency(portfolio.value)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {formatPercent(portfolio.irr)} IRR
          </div>
          {onClick && <ArrowRight className="h-4 w-4 text-gray-400" />}
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={`bg-white rounded-lg border shadow-sm p-6 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{portfolio.name}</h3>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                portfolio.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {portfolio.status}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatCurrency(portfolio.value)}
          </p>
        </div>
        
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md ${
            isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          <span className="font-medium">{formatPercent(portfolio.irr)}</span>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500">IRR</p>
          <p className="font-medium">{formatPercent(portfolio.irr)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">MOIC</p>
          <p className="font-medium">1.4x</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Holdings</p>
          <p className="font-medium">12</p>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default PortfolioSummaryCard;
