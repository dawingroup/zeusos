// ============================================================================
// CASH POSITION CARD
// DawinOS v2.0 - Financial Management Module
// Displays current cash position and key metrics
// ============================================================================

import React from 'react';
import {
  Wallet,
  Building2,
  Smartphone,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { CashPosition } from '../../types/cashflow.types';
import { formatCurrency, CurrencyCode } from '../../constants/currency.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface CashPositionCardProps {
  position: CashPosition;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const CashPositionCard: React.FC<CashPositionCardProps> = ({
  position,
  onRefresh,
  isLoading = false,
}) => {
  const currency = position.currency as CurrencyCode;

  const getStatusColor = () => {
    switch (position.cashCoverageStatus) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'excess':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (position.cashCoverageStatus) {
      case 'critical':
      case 'warning':
        return <AlertCircle className="w-4 h-4" />;
      case 'healthy':
      case 'excess':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusLabel = () => {
    switch (position.cashCoverageStatus) {
      case 'critical':
        return 'Critical';
      case 'warning':
        return 'Low Balance';
      case 'healthy':
        return 'Healthy';
      case 'excess':
        return 'Excess Cash';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#872E5C]" />
            <h3 className="font-semibold text-gray-900">Cash Position</h3>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          As of {position.asOfDate.toLocaleDateString('en-UG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Total Cash */}
      <div className="px-6 py-4 bg-gradient-to-br from-[#872E5C]/5 to-transparent">
        <p className="text-sm text-gray-600 mb-1">Total Cash Available</p>
        <p className="text-3xl font-bold text-gray-900">
          {formatCurrency(position.totalCash, currency)}
        </p>
        
        {/* Status Badge */}
        <div className="flex items-center gap-2 mt-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
            {getStatusIcon()}
            {getStatusLabel()}
          </span>
          <span className="text-sm text-gray-600">
            {position.daysOfCashOnHand} days of cash on hand
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="px-6 py-4 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase mb-3">Breakdown</p>
        <div className="space-y-3">
          {/* Cash on Hand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">Cash on Hand</span>
            </div>
            <span className="font-medium text-gray-900">
              {formatCurrency(position.cashOnHand, currency)}
            </span>
          </div>

          {/* Bank Balances */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm text-gray-700">Bank Accounts</span>
            </div>
            <span className="font-medium text-gray-900">
              {formatCurrency(position.bankBalances, currency)}
            </span>
          </div>

          {/* Mobile Money */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-sm text-gray-700">Mobile Money</span>
            </div>
            <span className="font-medium text-gray-900">
              {formatCurrency(position.mobileMoneyBalances, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Period Changes */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <p className="text-xs font-medium text-gray-500 uppercase mb-3">Last 30 Days</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Inflows</p>
            <p className="text-sm font-medium text-green-600 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +{formatCurrency(position.periodInflows, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Outflows</p>
            <p className="text-sm font-medium text-red-600 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              -{formatCurrency(position.periodOutflows, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Net Flow</p>
            <p className={`text-sm font-medium ${position.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {position.netCashFlow >= 0 ? '+' : ''}
              {formatCurrency(position.netCashFlow, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison */}
      {position.priorPeriodBalance !== undefined && (
        <div className="px-6 py-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">vs Prior Period</span>
            <span className={`font-medium ${(position.changePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(position.changePercent || 0) >= 0 ? '+' : ''}
              {(position.changePercent || 0).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashPositionCard;
