/**
 * Portfolio List
 * 
 * Displays a searchable, filterable list of portfolios.
 */

import { useState, useMemo } from 'react';
import { Search, Plus, TrendingUp, TrendingDown, Grid, List } from 'lucide-react';

type PortfolioStatus = 'active' | 'closed' | 'liquidating';
type PortfolioStrategy = 'growth' | 'income' | 'balanced' | 'opportunistic';

interface Portfolio {
  id: string;
  name: string;
  clientName: string;
  status: PortfolioStatus;
  strategy: PortfolioStrategy;
  currentValue: number;
  targetSize: number;
  irr: number;
  moic: number;
  holdingsCount: number;
  inceptionDate: Date;
}

interface PortfolioListProps {
  portfolios?: Portfolio[];
  loading?: boolean;
  onPortfolioClick?: (portfolioId: string) => void;
  onAddPortfolio?: () => void;
}

export function PortfolioList({
  portfolios = [],
  loading = false,
  onPortfolioClick,
  onAddPortfolio,
}: PortfolioListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PortfolioStatus | 'all'>('all');
  const [strategyFilter, setStrategyFilter] = useState<PortfolioStrategy | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const filteredPortfolios = useMemo(() => {
    let result = [...portfolios];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.clientName.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }
    
    if (strategyFilter !== 'all') {
      result = result.filter((p) => p.strategy === strategyFilter);
    }
    
    return result;
  }, [portfolios, searchQuery, statusFilter, strategyFilter]);
  
  const totalValue = filteredPortfolios.reduce((sum, p) => sum + p.currentValue, 0);
  
  if (loading) {
    return <PortfolioListSkeleton />;
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Portfolios</h2>
          <p className="text-sm text-gray-500">
            {portfolios.length} portfolios • {formatCurrency(totalValue)} total value
          </p>
        </div>
        
        <button
          onClick={onAddPortfolio}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Portfolio
        </button>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search portfolios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PortfolioStatus | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="liquidating">Liquidating</option>
        </select>
        
        <select
          value={strategyFilter}
          onChange={(e) => setStrategyFilter(e.target.value as PortfolioStrategy | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All Strategies</option>
          <option value="growth">Growth</option>
          <option value="income">Income</option>
          <option value="balanced">Balanced</option>
          <option value="opportunistic">Opportunistic</option>
        </select>
        
        <div className="flex bg-gray-100 rounded-md p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Portfolio Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPortfolios.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              onClick={() => onPortfolioClick?.(portfolio.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Portfolio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Strategy
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  IRR
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  MOIC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPortfolios.map((portfolio) => (
                <tr
                  key={portfolio.id}
                  onClick={() => onPortfolioClick?.(portfolio.id)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{portfolio.name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {portfolio.clientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {portfolio.strategy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                    {formatCurrency(portfolio.currentValue)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                    portfolio.irr >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercent(portfolio.irr)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {portfolio.moic.toFixed(2)}x
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={portfolio.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {filteredPortfolios.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No portfolios found matching your criteria
        </div>
      )}
    </div>
  );
}

function PortfolioCard({
  portfolio,
  onClick,
}: {
  portfolio: Portfolio;
  onClick?: () => void;
}) {
  const isPositive = portfolio.irr >= 0;
  
  return (
    <div
      className="bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-gray-900">{portfolio.name}</h3>
          <p className="text-sm text-gray-500">{portfolio.clientName}</p>
        </div>
        <StatusBadge status={portfolio.status} />
      </div>
      
      <div className="text-2xl font-bold text-gray-900 mb-3">
        {formatCurrency(portfolio.currentValue)}
      </div>
      
      <div className="grid grid-cols-3 gap-3 pt-3 border-t">
        <div>
          <p className="text-xs text-gray-500">IRR</p>
          <div className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            <span className="font-medium">{formatPercent(portfolio.irr)}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500">MOIC</p>
          <p className="font-medium">{portfolio.moic.toFixed(2)}x</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Holdings</p>
          <p className="font-medium">{portfolio.holdingsCount}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PortfolioStatus }) {
  const colors: Record<PortfolioStatus, string> = {
    active: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
    liquidating: 'bg-yellow-100 text-yellow-800',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colors[status]}`}>
      {status}
    </span>
  );
}

function PortfolioListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/4" />
      <div className="h-10 bg-gray-200 rounded w-1/2" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg" />
        ))}
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

export default PortfolioList;
