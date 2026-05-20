/**
 * Performance Page
 * 
 * Performance analytics page for the Advisory module.
 */

import { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart2, PieChart, Target, Calendar } from 'lucide-react';

type Timeframe = 'mtd' | 'qtd' | 'ytd' | '1y' | '3y' | 'si';

export function PerformancePage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('ytd');
  
  // Mock performance data
  const performanceData = {
    aggregateIRR: 0.168,
    aggregateMOIC: 1.42,
    aggregateTVPI: 1.38,
    aggregateDPI: 0.32,
    aggregateRVPI: 1.06,
    totalAUM: 225000000,
    totalDeployed: 195000000,
    totalDistributed: 62000000,
    
    byStrategy: [
      { name: 'Growth', irr: 0.21, moic: 1.58, aum: 85000000 },
      { name: 'Income', irr: 0.12, moic: 1.24, aum: 65000000 },
      { name: 'Balanced', irr: 0.15, moic: 1.35, aum: 45000000 },
      { name: 'Opportunistic', irr: 0.25, moic: 1.72, aum: 30000000 },
    ],
    
    bySector: [
      { name: 'Healthcare', irr: 0.19, moic: 1.48, allocation: 0.28 },
      { name: 'Energy', irr: 0.22, moic: 1.62, allocation: 0.24 },
      { name: 'Transport', irr: 0.16, moic: 1.38, allocation: 0.18 },
      { name: 'Water', irr: 0.14, moic: 1.28, allocation: 0.15 },
      { name: 'Education', irr: 0.12, moic: 1.22, allocation: 0.15 },
    ],
    
    topPerformers: [
      { name: 'Solar Plant Alpha', irr: 0.28, moic: 1.85 },
      { name: 'Hospital Complex B', irr: 0.24, moic: 1.68 },
      { name: 'Toll Road Alpha', irr: 0.22, moic: 1.58 },
    ],
    
    underperformers: [
      { name: 'Water Treatment C', irr: 0.08, moic: 1.12 },
      { name: 'Education Fund I', irr: 0.10, moic: 1.15 },
    ],
  };
  
  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Analytics</h1>
            <p className="text-gray-500">Portfolio performance across all clients</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['mtd', 'qtd', 'ytd', '1y', '3y', 'si'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    timeframe === tf
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
            
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Calendar className="h-4 w-4 mr-2" />
              Custom Range
            </button>
          </div>
        </div>
        
        {/* Aggregate KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <KPICard
            title="Aggregate IRR"
            value={formatPercent(performanceData.aggregateIRR)}
            positive={performanceData.aggregateIRR >= 0}
          />
          <KPICard
            title="Aggregate MOIC"
            value={`${performanceData.aggregateMOIC.toFixed(2)}x`}
            positive={performanceData.aggregateMOIC >= 1}
          />
          <KPICard
            title="TVPI"
            value={`${performanceData.aggregateTVPI.toFixed(2)}x`}
            positive={performanceData.aggregateTVPI >= 1}
          />
          <KPICard
            title="DPI"
            value={`${performanceData.aggregateDPI.toFixed(2)}x`}
          />
          <KPICard
            title="RVPI"
            value={`${performanceData.aggregateRVPI.toFixed(2)}x`}
            positive={performanceData.aggregateRVPI >= 1}
          />
        </div>
        
        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance by Strategy */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Performance by Strategy</h3>
            </div>
            
            <div className="space-y-4">
              {performanceData.byStrategy.map((strategy) => (
                <div key={strategy.name} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{strategy.name}</span>
                      <span className="text-sm text-gray-500">{formatCurrency(strategy.aum)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={strategy.irr >= 0 ? 'text-green-600' : 'text-red-600'}>
                        IRR: {formatPercent(strategy.irr)}
                      </span>
                      <span className="text-gray-600">
                        MOIC: {strategy.moic.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Allocation by Sector */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Allocation by Sector</h3>
            </div>
            
            <div className="space-y-3">
              {performanceData.bySector.map((sector) => (
                <div key={sector.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{sector.name}</span>
                    <span className="text-gray-500">{formatPercent(sector.allocation)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${sector.allocation * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span>IRR: {formatPercent(sector.irr)}</span>
                    <span>MOIC: {sector.moic.toFixed(2)}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Performance Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-gray-900">Top Performers</h3>
            </div>
            
            <div className="space-y-3">
              {performanceData.topPerformers.map((holding, index) => (
                <div
                  key={holding.name}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-green-600">#{index + 1}</span>
                    <span className="font-medium">{holding.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{formatPercent(holding.irr)}</p>
                    <p className="text-sm text-gray-500">{holding.moic.toFixed(2)}x MOIC</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Underperformers */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold text-gray-900">Attention Needed</h3>
            </div>
            
            <div className="space-y-3">
              {performanceData.underperformers.map((holding) => (
                <div
                  key={holding.name}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                >
                  <span className="font-medium">{holding.name}</span>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{formatPercent(holding.irr)}</p>
                    <p className="text-sm text-gray-500">{holding.moic.toFixed(2)}x MOIC</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Cash Flow Summary */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Cash Flow Summary</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Total AUM</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(performanceData.totalAUM)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Total Deployed</p>
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(performanceData.totalDeployed)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Total Distributed</p>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(performanceData.totalDistributed)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  positive,
}: {
  title: string;
  value: string;
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

export default PerformancePage;
