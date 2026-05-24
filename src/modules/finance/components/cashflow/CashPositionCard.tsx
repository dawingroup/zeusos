// ============================================================================
// CASH POSITION CARD
// ZeusOS v2.0 - Financial Management Module
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
        return 'bg-[var(--rag-red-soft)] text-[var(--rag-red)] border-[var(--rag-red)]';
      case 'warning':
        return 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)] border-[var(--rag-amber)]';
      case 'healthy':
        return 'bg-[var(--rag-green-soft)] text-[var(--rag-green)] border-[var(--rag-green)]';
      case 'excess':
        return 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] border-[var(--rag-blue)]';
      default:
        return 'bg-[var(--bg-sunken)] text-foreground border-[var(--border-subtle)]';
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
    <div className="bg-card rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#872E5C]" />
            <h3 className="font-semibold text-foreground">Cash Position</h3>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-muted-foreground hover:text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
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
        <p className="text-sm text-muted-foreground mb-1">Total Cash Available</p>
        <p className="text-3xl font-bold text-foreground">
          {formatCurrency(position.totalCash, currency)}
        </p>
        
        {/* Status Badge */}
        <div className="flex items-center gap-2 mt-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
            {getStatusIcon()}
            {getStatusLabel()}
          </span>
          <span className="text-sm text-muted-foreground">
            {position.daysOfCashOnHand} days of cash on hand
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="px-6 py-4 border-t border-[var(--border-subtle)]">
        <p className="text-xs font-medium text-muted-foreground uppercase mb-3">Breakdown</p>
        <div className="space-y-3">
          {/* Cash on Hand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--rag-green-soft)] flex items-center justify-center">
                <Wallet className="w-4 h-4 text-[var(--rag-green)]" />
              </div>
              <span className="text-sm text-muted-foreground">Cash on Hand</span>
            </div>
            <span className="font-medium text-foreground">
              {formatCurrency(position.cashOnHand, currency)}
            </span>
          </div>

          {/* Bank Balances */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--rag-blue-soft)] flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[var(--rag-blue)]" />
              </div>
              <span className="text-sm text-muted-foreground">Bank Accounts</span>
            </div>
            <span className="font-medium text-foreground">
              {formatCurrency(position.bankBalances, currency)}
            </span>
          </div>

          {/* Mobile Money */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--rag-amber-soft)] flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-[var(--rag-amber)]" />
              </div>
              <span className="text-sm text-muted-foreground">Mobile Money</span>
            </div>
            <span className="font-medium text-foreground">
              {formatCurrency(position.mobileMoneyBalances, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Period Changes */}
      <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-sunken)]">
        <p className="text-xs font-medium text-muted-foreground uppercase mb-3">Last 30 Days</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Inflows</p>
            <p className="text-sm font-medium text-[var(--rag-green)] flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +{formatCurrency(position.periodInflows, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outflows</p>
            <p className="text-sm font-medium text-[var(--rag-red)] flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              -{formatCurrency(position.periodOutflows, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net Flow</p>
            <p className={`text-sm font-medium ${position.netCashFlow >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}`}>
              {position.netCashFlow >= 0 ? '+' : ''}
              {formatCurrency(position.netCashFlow, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison */}
      {position.priorPeriodBalance !== undefined && (
        <div className="px-6 py-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">vs Prior Period</span>
            <span className={`font-medium ${(position.changePercent || 0) >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}`}>
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
