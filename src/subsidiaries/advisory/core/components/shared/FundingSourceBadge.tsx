/**
 * FUNDING SOURCE BADGE
 * 
 * Displays funding source with type, amount, and status indicators.
 */

import React from 'react';
import {
  Landmark,
  Globe,
  Building2,
  TrendingUp,
  Wallet,
  Banknote,
  Shield,
  DollarSign,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// ============================================================================
// Types
// ============================================================================

type FundingInstrumentType =
  | 'grant'
  | 'project_grant'
  | 'program_grant'
  | 'concessional_loan'
  | 'commercial_loan'
  | 'senior_debt'
  | 'equity'
  | 'preferred_equity'
  | 'common_equity'
  | 'guarantee'
  | 'partial_guarantee'
  | 'budget_allocation'
  | 'counterpart_funding'
  | 'technical_assistance'
  | 'in_kind';

type FundingStatus =
  | 'pipeline'
  | 'negotiating'
  | 'committed'
  | 'signed'
  | 'effective'
  | 'disbursing'
  | 'fully_disbursed'
  | 'closed'
  | 'cancelled';

interface FundingSource {
  id: string;
  funderId?: string;
  funderName?: string;
  instrumentType: FundingInstrumentType;
  status: FundingStatus;
  committedAmount?: number;
  disbursedAmount?: number;
  currency: string;
  agreementReference?: string;
}

interface FundingSourceBadgeProps {
  source: FundingSource;
  variant?: 'badge' | 'card' | 'inline';
  showAmount?: boolean;
  showStatus?: boolean;
  showDisbursement?: boolean;
  onClick?: (source: FundingSource) => void;
  className?: string;
}

interface InstrumentConfig {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}

interface StatusConfig {
  color: string;
  bgColor: string;
  label: string;
}

// ============================================================================
// Configuration
// ============================================================================

const INSTRUMENT_CONFIG: Partial<Record<FundingInstrumentType, InstrumentConfig>> = {
  grant: { icon: Wallet, color: 'text-green-700', bgColor: 'bg-green-100', label: 'Grant' },
  project_grant: { icon: Wallet, color: 'text-green-700', bgColor: 'bg-green-100', label: 'Project Grant' },
  program_grant: { icon: Wallet, color: 'text-green-700', bgColor: 'bg-green-100', label: 'Program Grant' },
  concessional_loan: { icon: Banknote, color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'Concessional Loan' },
  commercial_loan: { icon: Banknote, color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'Commercial Loan' },
  senior_debt: { icon: Banknote, color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'Senior Debt' },
  equity: { icon: TrendingUp, color: 'text-purple-700', bgColor: 'bg-purple-100', label: 'Equity' },
  preferred_equity: { icon: TrendingUp, color: 'text-purple-700', bgColor: 'bg-purple-100', label: 'Preferred Equity' },
  common_equity: { icon: TrendingUp, color: 'text-purple-700', bgColor: 'bg-purple-100', label: 'Common Equity' },
  guarantee: { icon: Shield, color: 'text-amber-700', bgColor: 'bg-amber-100', label: 'Guarantee' },
  partial_guarantee: { icon: Shield, color: 'text-amber-700', bgColor: 'bg-amber-100', label: 'Partial Guarantee' },
  budget_allocation: { icon: Landmark, color: 'text-slate-700', bgColor: 'bg-slate-100', label: 'Budget Allocation' },
  counterpart_funding: { icon: Landmark, color: 'text-slate-700', bgColor: 'bg-slate-100', label: 'Counterpart' },
  technical_assistance: { icon: Globe, color: 'text-cyan-700', bgColor: 'bg-cyan-100', label: 'Technical Assistance' },
  in_kind: { icon: Building2, color: 'text-gray-700', bgColor: 'bg-gray-100', label: 'In-Kind' },
};

const STATUS_CONFIG: Record<FundingStatus, StatusConfig> = {
  pipeline: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Pipeline' },
  negotiating: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Negotiating' },
  committed: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Committed' },
  signed: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Signed' },
  effective: { color: 'text-green-700', bgColor: 'bg-green-100', label: 'Effective' },
  disbursing: { color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Disbursing' },
  fully_disbursed: { color: 'text-teal-600', bgColor: 'bg-teal-100', label: 'Fully Disbursed' },
  closed: { color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'Closed' },
  cancelled: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Cancelled' },
};

const DEFAULT_INSTRUMENT_CONFIG: InstrumentConfig = {
  icon: DollarSign,
  color: 'text-gray-700',
  bgColor: 'bg-gray-100',
  label: 'Funding',
};

// ============================================================================
// Sub-components
// ============================================================================

const DisbursementBar: React.FC<{ 
  disbursed: number; 
  committed: number; 
}> = ({ disbursed, committed }) => {
  const percentage = committed > 0 ? (disbursed / committed) * 100 : 0;
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Disbursed</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-green-500"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const FundingSourceBadge: React.FC<FundingSourceBadgeProps> = ({
  source,
  variant = 'badge',
  showAmount = true,
  showStatus = true,
  showDisbursement = false,
  onClick,
  className = '',
}) => {
  const instrumentConfig = INSTRUMENT_CONFIG[source.instrumentType] || DEFAULT_INSTRUMENT_CONFIG;
  const statusConfig = STATUS_CONFIG[source.status];
  const Icon = instrumentConfig.icon;
  
  // Badge variant - compact inline display
  if (variant === 'badge') {
    return (
      <span
        onClick={() => onClick?.(source)}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          ${instrumentConfig.bgColor} ${instrumentConfig.color}
          ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
          ${className}
        `}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{source.funderName || instrumentConfig.label}</span>
        {showAmount && source.committedAmount && (
          <span className="font-semibold">
            {formatCurrency(source.committedAmount, source.currency)}
          </span>
        )}
      </span>
    );
  }
  
  // Inline variant - single line display
  if (variant === 'inline') {
    return (
      <div
        onClick={() => onClick?.(source)}
        className={`
          flex items-center gap-3 p-2 rounded-lg
          ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}
          ${className}
        `}
      >
        <div className={`p-2 rounded-full ${instrumentConfig.bgColor}`}>
          <Icon className={`w-4 h-4 ${instrumentConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {source.funderName || 'Unknown Funder'}
          </div>
          <div className="text-xs text-gray-500">
            {instrumentConfig.label}
          </div>
        </div>
        {showAmount && (
          <div className="text-right">
            <div className="font-semibold text-gray-900">
              {formatCurrency(source.committedAmount || 0, source.currency)}
            </div>
            {showStatus && (
              <span className={`text-xs ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Card variant - detailed display
  return (
    <div
      onClick={() => onClick?.(source)}
      className={`
        bg-white border border-gray-200 rounded-xl p-4 
        ${onClick ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm' : ''}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${instrumentConfig.bgColor}`}>
            <Icon className={`w-5 h-5 ${instrumentConfig.color}`} />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">
              {source.funderName || 'Unknown Funder'}
            </h4>
            <p className="text-sm text-gray-500">{instrumentConfig.label}</p>
          </div>
        </div>
        {showStatus && (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        )}
      </div>
      
      {/* Amount */}
      {showAmount && (
        <div className="mb-3">
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(source.committedAmount || 0, source.currency)}
          </div>
          <p className="text-sm text-gray-500">Committed Amount</p>
        </div>
      )}
      
      {/* Disbursement progress */}
      {showDisbursement && source.disbursedAmount !== undefined && (
        <DisbursementBar 
          disbursed={source.disbursedAmount} 
          committed={source.committedAmount || 0} 
        />
      )}
      
      {/* Additional info */}
      {source.agreementReference && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Agreement: <span className="text-gray-700">{source.agreementReference}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default FundingSourceBadge;
