/**
 * Deal Conversion Panel
 * 
 * UI for converting investment deals to portfolio holdings.
 */

import { useState } from 'react';
import {
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
} from 'lucide-react';

type ConversionStatus =
  | 'pending_approval'
  | 'partially_approved'
  | 'fully_approved'
  | 'converting'
  | 'completed'
  | 'cancelled';

interface PortfolioApproval {
  portfolioId: string;
  portfolioName: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

interface Conversion {
  id: string;
  dealId: string;
  dealName: string;
  dealStage: string;
  status: ConversionStatus;
  targetPortfolios: {
    portfolioId: string;
    portfolioName: string;
    allocationAmount: number;
    approved: boolean;
  }[];
  approval: {
    icApproved: boolean;
    icApprovedBy?: string;
    icApprovedAt?: Date;
    portfolioApprovals: PortfolioApproval[];
  };
  createdHoldings: string[];
}

interface DealConversionPanelProps {
  dealId?: string;
  dealName?: string;
  dealValue?: number;
  conversions?: Conversion[];
  portfolios?: { id: string; name: string }[];
  loading?: boolean;
  onInitiateConversion?: (targets: { portfolioId: string; amount: number }[]) => void;
  onApproveIC?: (conversionId: string) => void;
  onApprovePortfolio?: (conversionId: string, portfolioId: string) => void;
  onExecuteConversion?: (conversionId: string) => void;
  onConversionComplete?: (holdingIds: string[]) => void;
}

export function DealConversionPanel({
  dealId,
  dealName,
  dealValue = 0,
  conversions = [],
  portfolios = [],
  loading = false,
  onInitiateConversion,
  onApproveIC,
  onApprovePortfolio,
  onExecuteConversion,
}: DealConversionPanelProps) {
  const [showNewConversion, setShowNewConversion] = useState(false);
  const [targets, setTargets] = useState<{ portfolioId: string; percentage: number }[]>([]);
  
  const addTarget = () => {
    setTargets((prev) => [...prev, { portfolioId: '', percentage: 0 }]);
  };
  
  const updateTarget = (index: number, updates: Partial<{ portfolioId: string; percentage: number }>) => {
    setTargets((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...updates } : t))
    );
  };
  
  const removeTarget = (index: number) => {
    setTargets((prev) => prev.filter((_, i) => i !== index));
  };
  
  const handleInitiate = () => {
    if (onInitiateConversion) {
      onInitiateConversion(
        targets.map((t) => ({
          portfolioId: t.portfolioId,
          amount: (dealValue * t.percentage) / 100,
        }))
      );
    }
    setShowNewConversion(false);
    setTargets([]);
  };
  
  if (loading) {
    return <ConversionPanelSkeleton />;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Deal Conversions</h3>
          <p className="text-sm text-gray-500">Convert deals to portfolio holdings</p>
        </div>
        
        {dealId && !showNewConversion && (
          <button
            onClick={() => setShowNewConversion(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Start Conversion
          </button>
        )}
      </div>
      
      {/* New Conversion Form */}
      {showNewConversion && (
        <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">New Conversion</h4>
            <button
              onClick={() => {
                setShowNewConversion(false);
                setTargets([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          
          {/* Deal Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="font-medium">{dealName || 'Deal'}</p>
            <p className="text-sm text-gray-500">
              Deal Value: {formatCurrency(dealValue)}
            </p>
          </div>
          
          {/* Target Portfolios */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Target Portfolios</label>
              <button
                onClick={addTarget}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Portfolio
              </button>
            </div>
            
            {targets.map((target, index) => (
              <div key={index} className="flex items-center gap-3">
                <select
                  value={target.portfolioId}
                  onChange={(e) => updateTarget(index, { portfolioId: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select portfolio</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={target.percentage}
                    onChange={(e) =>
                      updateTarget(index, { percentage: parseFloat(e.target.value) || 0 })
                    }
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <span className="text-gray-500">%</span>
                </div>
                
                <span className="text-sm text-gray-500 w-24">
                  {formatCurrency((dealValue * target.percentage) / 100)}
                </span>
                
                <button
                  onClick={() => removeTarget(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            
            {targets.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No target portfolios added
              </p>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowNewConversion(false);
                setTargets([]);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleInitiate}
              disabled={targets.length === 0 || targets.some((t) => !t.portfolioId)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Start Conversion
            </button>
          </div>
        </div>
      )}
      
      {/* Existing Conversions */}
      {conversions.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium">Pending Conversions</h4>
          
          {conversions.map((conversion) => (
            <ConversionCard
              key={conversion.id}
              conversion={conversion}
              onApproveIC={() => onApproveIC?.(conversion.id)}
              onApprovePortfolio={(portfolioId) =>
                onApprovePortfolio?.(conversion.id, portfolioId)
              }
              onExecute={() => onExecuteConversion?.(conversion.id)}
            />
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {conversions.length === 0 && !showNewConversion && (
        <div className="text-center py-8 text-gray-500">
          <p>No pending conversions</p>
          {dealId && (
            <button
              onClick={() => setShowNewConversion(true)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Start a new conversion
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ConversionCardProps {
  conversion: Conversion;
  onApproveIC?: () => void;
  onApprovePortfolio?: (portfolioId: string) => void;
  onExecute?: () => void;
}

function ConversionCard({
  conversion,
  onApproveIC,
  onApprovePortfolio,
  onExecute,
}: ConversionCardProps) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{conversion.dealName}</h4>
          <p className="text-sm text-gray-500">Stage: {conversion.dealStage}</p>
        </div>
        <StatusBadge status={conversion.status} />
      </div>
      
      {/* Approval Progress */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {conversion.approval.icApproved ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Clock className="h-4 w-4 text-yellow-500" />
          )}
          <span className="text-sm">
            IC Approval
            {conversion.approval.icApproved && (
              <span className="text-gray-500 ml-2">
                by {conversion.approval.icApprovedBy}
              </span>
            )}
          </span>
          {!conversion.approval.icApproved && onApproveIC && (
            <button
              onClick={onApproveIC}
              className="ml-auto px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
            >
              Approve
            </button>
          )}
        </div>
        
        {conversion.approval.portfolioApprovals.map((pa) => (
          <div key={pa.portfolioId} className="flex items-center gap-2 ml-6">
            {pa.approved ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Clock className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm">
              {pa.portfolioName} Approval
            </span>
            {!pa.approved && conversion.approval.icApproved && onApprovePortfolio && (
              <button
                onClick={() => onApprovePortfolio(pa.portfolioId)}
                className="ml-auto px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Approve
              </button>
            )}
          </div>
        ))}
      </div>
      
      {/* Execute Button */}
      {conversion.status === 'fully_approved' && onExecute && (
        <div className="pt-4 border-t">
          <button
            onClick={onExecute}
            className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Execute Conversion
            <ArrowRight className="h-4 w-4 ml-2" />
          </button>
        </div>
      )}
      
      {/* Completed */}
      {conversion.status === 'completed' && conversion.createdHoldings.length > 0 && (
        <div className="pt-4 border-t">
          <p className="text-sm text-green-600">
            <CheckCircle className="h-4 w-4 inline mr-1" />
            Created {conversion.createdHoldings.length} holding(s)
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ConversionStatus }) {
  const config: Record<ConversionStatus, { label: string; color: string }> = {
    pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
    partially_approved: { label: 'Partially Approved', color: 'bg-yellow-100 text-yellow-800' },
    fully_approved: { label: 'Ready to Convert', color: 'bg-green-100 text-green-800' },
    converting: { label: 'Converting', color: 'bg-blue-100 text-blue-800' },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
  };
  
  const { label, color } = config[status];
  
  return <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>{label}</span>;
}

function ConversionPanelSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/3" />
      <div className="h-32 bg-gray-200 rounded-lg" />
      <div className="h-32 bg-gray-200 rounded-lg" />
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

export default DealConversionPanel;
