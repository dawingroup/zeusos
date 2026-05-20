/**
 * Holding Detail
 * 
 * Comprehensive view of a single holding including
 * transactions, valuations, and linked entities.
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Link2,
  FileText,
} from 'lucide-react';
import { TransactionHistory } from './TransactionHistory';
import { ValuationHistory } from './ValuationHistory';

interface HoldingData {
  id: string;
  name: string;
  portfolioId: string;
  portfolioName: string;
  type: string;
  status: string;
  sector: string;
  geography: string;
  vintage: number;
  
  costBasis: {
    initialInvestment: number;
    totalCost: number;
  };
  
  currentValue: number;
  
  performance: {
    irr: number;
    moic: number;
    tvpi: number;
    dpi: number;
  };
  
  linkedDealId?: string;
  linkedProjectId?: string;
}

interface HoldingDetailProps {
  holding?: HoldingData;
  loading?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
}

export function HoldingDetail({
  holding,
  loading = false,
  onBack,
  onEdit,
}: HoldingDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'valuations' | 'linked'>(
    'overview'
  );
  
  if (loading) {
    return <HoldingDetailSkeleton />;
  }
  
  if (!holding) {
    return (
      <div className="p-6 bg-red-50 rounded-lg">
        <p className="text-red-600">Holding not found</p>
        <button
          onClick={onBack}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }
  
  const isPositive = holding.performance.irr >= 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{holding.name}</h1>
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                {holding.type}
              </span>
              <StatusBadge status={holding.status} />
            </div>
            <p className="text-gray-500">
              {holding.portfolioName} • {holding.sector} • {holding.vintage}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Current Value"
          value={formatCurrency(holding.currentValue)}
          icon={<DollarSign className="h-5 w-5 text-gray-400" />}
        />
        <SummaryCard
          title="IRR"
          value={formatPercent(holding.performance.irr)}
          icon={
            isPositive ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )
          }
          valueColor={isPositive ? 'text-green-600' : 'text-red-600'}
        />
        <SummaryCard
          title="MOIC"
          value={`${holding.performance.moic.toFixed(2)}x`}
          icon={<TrendingUp className="h-5 w-5 text-gray-400" />}
        />
        <SummaryCard
          title="Cost Basis"
          value={formatCurrency(holding.costBasis.totalCost)}
          icon={<DollarSign className="h-5 w-5 text-gray-400" />}
        />
      </div>
      
      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-8">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<FileText className="h-4 w-4" />}
            label="Overview"
          />
          <TabButton
            active={activeTab === 'transactions'}
            onClick={() => setActiveTab('transactions')}
            icon={<DollarSign className="h-4 w-4" />}
            label="Transactions"
          />
          <TabButton
            active={activeTab === 'valuations'}
            onClick={() => setActiveTab('valuations')}
            icon={<TrendingUp className="h-4 w-4" />}
            label="Valuations"
          />
          <TabButton
            active={activeTab === 'linked'}
            onClick={() => setActiveTab('linked')}
            icon={<Link2 className="h-4 w-4" />}
            label="Linked Entities"
          />
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Holding Information</h3>
              <dl className="space-y-3">
                <InfoRow label="Type" value={holding.type} />
                <InfoRow label="Sector" value={holding.sector} />
                <InfoRow label="Geography" value={holding.geography} />
                <InfoRow label="Vintage Year" value={holding.vintage.toString()} />
                <InfoRow label="Status" value={holding.status} />
              </dl>
            </div>
            
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Performance Metrics</h3>
              <dl className="space-y-3">
                <InfoRow label="IRR" value={formatPercent(holding.performance.irr)} />
                <InfoRow label="MOIC" value={`${holding.performance.moic.toFixed(2)}x`} />
                <InfoRow label="TVPI" value={`${holding.performance.tvpi.toFixed(2)}x`} />
                <InfoRow label="DPI" value={`${holding.performance.dpi.toFixed(2)}x`} />
              </dl>
            </div>
            
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Cost Basis</h3>
              <dl className="space-y-3">
                <InfoRow
                  label="Initial Investment"
                  value={formatCurrency(holding.costBasis.initialInvestment)}
                />
                <InfoRow
                  label="Total Cost"
                  value={formatCurrency(holding.costBasis.totalCost)}
                />
                <InfoRow
                  label="Unrealized Gain/Loss"
                  value={formatCurrency(holding.currentValue - holding.costBasis.totalCost)}
                  valueColor={
                    holding.currentValue >= holding.costBasis.totalCost
                      ? 'text-green-600'
                      : 'text-red-600'
                  }
                />
              </dl>
            </div>
            
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Portfolio</h3>
              <p className="text-gray-900">{holding.portfolioName}</p>
            </div>
          </div>
        )}
        
        {activeTab === 'transactions' && (
          <TransactionHistory holdingId={holding.id} />
        )}
        
        {activeTab === 'valuations' && (
          <ValuationHistory holdingId={holding.id} />
        )}
        
        {activeTab === 'linked' && (
          <div className="space-y-4">
            {holding.linkedDealId && (
              <div className="bg-white rounded-lg border shadow-sm p-4">
                <h4 className="font-medium text-gray-900">Linked Deal</h4>
                <p className="text-sm text-gray-500">Deal ID: {holding.linkedDealId}</p>
              </div>
            )}
            {holding.linkedProjectId && (
              <div className="bg-white rounded-lg border shadow-sm p-4">
                <h4 className="font-medium text-gray-900">Linked Project</h4>
                <p className="text-sm text-gray-500">Project ID: {holding.linkedProjectId}</p>
              </div>
            )}
            {!holding.linkedDealId && !holding.linkedProjectId && (
              <div className="text-center py-12 text-gray-500">
                <Link2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No linked entities</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  valueColor,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className={`text-lg font-semibold ${valueColor || 'text-gray-900'}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <dt className="text-gray-600">{label}</dt>
      <dd className={`font-medium ${valueColor || ''}`}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    committed: 'bg-blue-100 text-blue-800',
    invested: 'bg-green-100 text-green-800',
    realized: 'bg-gray-100 text-gray-800',
    written_off: 'bg-red-100 text-red-800',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function HoldingDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-gray-200 rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-gray-200 rounded-lg" />
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

export default HoldingDetail;
