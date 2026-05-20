/**
 * Portfolio Detail View
 * 
 * Comprehensive view of a single portfolio including
 * holdings, performance, allocations, and activity.
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Download,
  Plus,
  TrendingUp,
  PieChart,
  Calendar,
  FileText,
} from 'lucide-react';
import { HoldingsTable } from './HoldingsTable';
import { AllocationChart } from './AllocationChart';

type PortfolioStatus = 'active' | 'closed' | 'liquidating';

interface Holding {
  id: string;
  name: string;
  type: string;
  value: number;
  irr: number;
  moic: number;
  sector: string;
  vintage: number;
  status: string;
}

interface PortfolioData {
  id: string;
  name: string;
  clientName: string;
  status: PortfolioStatus;
  strategy: string;
  currentValue: number;
  targetSize: number;
  deployedPercentage: number;
  inceptionDate: Date;
  holdings: Holding[];
  performance: {
    irr: number;
    moic: number;
    tvpi: number;
    dpi: number;
    rvpi: number;
  };
}

interface PortfolioDetailProps {
  portfolio?: PortfolioData;
  loading?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
  onAddHolding?: () => void;
  onHoldingClick?: (holdingId: string) => void;
}

export function PortfolioDetail({
  portfolio,
  loading = false,
  onBack,
  onEdit,
  onAddHolding,
  onHoldingClick,
}: PortfolioDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'holdings' | 'performance' | 'transactions'>(
    'overview'
  );
  
  if (loading) {
    return <PortfolioDetailSkeleton />;
  }
  
  if (!portfolio) {
    return (
      <div className="p-6 bg-red-50 rounded-lg">
        <p className="text-red-600">Portfolio not found</p>
        <button
          onClick={onBack}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          Back to Portfolios
        </button>
      </div>
    );
  }
  
  const statusColors: Record<PortfolioStatus, string> = {
    active: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
    liquidating: 'bg-yellow-100 text-yellow-800',
  };
  
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
              <h1 className="text-2xl font-bold text-gray-900">{portfolio.name}</h1>
              <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[portfolio.status]}`}>
                {portfolio.status}
              </span>
            </div>
            <p className="text-gray-500">
              {portfolio.strategy} • {portfolio.clientName}
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
          <button
            onClick={onAddHolding}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Holding
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Value"
          value={formatCurrency(portfolio.currentValue)}
          subtitle={`${portfolio.holdings.length} holdings`}
        />
        <SummaryCard
          title="Since Inception IRR"
          value={formatPercent(portfolio.performance.irr)}
          positive={portfolio.performance.irr >= 0}
        />
        <SummaryCard
          title="MOIC"
          value={`${portfolio.performance.moic.toFixed(2)}x`}
          subtitle={`TVPI: ${portfolio.performance.tvpi.toFixed(2)}x`}
        />
        <SummaryCard
          title="Commitment"
          value={formatCurrency(portfolio.targetSize)}
          subtitle={`${formatPercent(portfolio.deployedPercentage)} deployed`}
        />
      </div>
      
      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-8">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<PieChart className="h-4 w-4" />}
            label="Overview"
          />
          <TabButton
            active={activeTab === 'holdings'}
            onClick={() => setActiveTab('holdings')}
            icon={<FileText className="h-4 w-4" />}
            label="Holdings"
          />
          <TabButton
            active={activeTab === 'performance'}
            onClick={() => setActiveTab('performance')}
            icon={<TrendingUp className="h-4 w-4" />}
            label="Performance"
          />
          <TabButton
            active={activeTab === 'transactions'}
            onClick={() => setActiveTab('transactions')}
            icon={<Calendar className="h-4 w-4" />}
            label="Transactions"
          />
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Allocation</h3>
              <AllocationChart holdings={portfolio.holdings} groupBy="sector" />
            </div>
            
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Performance Summary</h3>
              <div className="space-y-4">
                <PerformanceMetric label="IRR (SI)" value={formatPercent(portfolio.performance.irr)} />
                <PerformanceMetric label="MOIC" value={`${portfolio.performance.moic.toFixed(2)}x`} />
                <PerformanceMetric label="TVPI" value={`${portfolio.performance.tvpi.toFixed(2)}x`} />
                <PerformanceMetric label="DPI" value={`${portfolio.performance.dpi.toFixed(2)}x`} />
                <PerformanceMetric label="RVPI" value={`${portfolio.performance.rvpi.toFixed(2)}x`} />
              </div>
            </div>
            
            <div className="lg:col-span-2 bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Top Holdings</h3>
              <HoldingsTable
                holdings={portfolio.holdings.slice(0, 5)}
                compact
                onHoldingClick={onHoldingClick}
              />
            </div>
          </div>
        )}
        
        {activeTab === 'holdings' && (
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">All Holdings</h3>
              <button
                onClick={onAddHolding}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Holding
              </button>
            </div>
            <HoldingsTable
              holdings={portfolio.holdings}
              onHoldingClick={onHoldingClick}
            />
          </div>
        )}
        
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Performance Chart</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Performance chart placeholder</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">J-Curve Analysis</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>J-Curve visualization placeholder</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'transactions' && (
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Transaction History</h3>
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No transactions yet</p>
            </div>
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
  subtitle,
  positive,
}: {
  title: string;
  value: string;
  subtitle?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p
        className={`text-2xl font-bold ${
          positive !== undefined
            ? positive
              ? 'text-green-600'
              : 'text-red-600'
            : 'text-gray-900'
        }`}
      >
        {value}
      </p>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

function PerformanceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function PortfolioDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg" />
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

export default PortfolioDetail;
