/**
 * Investment Reports - Analytics and reporting dashboard
 */

import { useState } from 'react';
import { BarChart3, PieChart, TrendingUp, Download, Calendar, RefreshCw } from 'lucide-react';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

type DateRange = 'mtd' | 'qtd' | 'ytd' | '1y' | 'all';

export function Reports() {
  const [dateRange, setDateRange] = useState<DateRange>('ytd');
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Investment analytics and insights</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="text-sm border-none focus:outline-none bg-transparent"
            >
              <option value="mtd">Month to Date</option>
              <option value="qtd">Quarter to Date</option>
              <option value="ytd">Year to Date</option>
              <option value="1y">Last 12 Months</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6">
        <KPIGrid cols={4}>
          <KPICard label="Total Pipeline" value="$125M" delta="+12% vs prev period" trend="up" />
          <KPICard label="Avg Deal Size" value="$5.2M" delta="-3% vs prev period" trend="down" />
          <KPICard label="Win Rate" value="32%" delta="+5% vs prev period" trend="up" />
          <KPICard label="Avg IRR" value="18.5%" delta="+2% vs prev period" trend="up" />
        </KPIGrid>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Pipeline by Stage
          </h3>
          <div className="space-y-3">
            {[
              { stage: 'Screening', count: 5, value: 15, width: 100 },
              { stage: 'Initial Review', count: 4, value: 18, width: 90 },
              { stage: 'Due Diligence', count: 6, value: 47, width: 75 },
              { stage: 'IC Process', count: 3, value: 25, width: 50 },
              { stage: 'Negotiation', count: 2, value: 12, width: 40 },
              { stage: 'Closing', count: 1, value: 8, width: 25 },
            ].map((item) => (
              <div key={item.stage} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-600">{item.stage}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded">
                  <div 
                    className="h-full bg-emerald-500 rounded flex items-center justify-end px-2"
                    style={{ width: `${item.width}%` }}
                  >
                    <span className="text-xs text-white">${item.value}M</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-500" />
            Sector Allocation
          </h3>
          <div className="space-y-3">
            {[
              { sector: 'Healthcare', value: 35, pct: 28, color: 'bg-rose-500' },
              { sector: 'Energy', value: 30, pct: 24, color: 'bg-amber-500' },
              { sector: 'Transport', value: 25, pct: 20, color: 'bg-blue-500' },
              { sector: 'Water', value: 20, pct: 16, color: 'bg-cyan-500' },
              { sector: 'Digital', value: 15, pct: 12, color: 'bg-violet-500' },
            ].map((item) => (
              <div key={item.sector} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="flex-1 text-sm">{item.sector}</span>
                <span className="text-sm font-medium">${item.value}M</span>
                <span className="text-sm text-gray-400 w-12 text-right">{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Portfolio Performance
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Project IRR</p>
              <p className="text-xl font-bold text-green-600">18.5%</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Equity IRR</p>
              <p className="text-xl font-bold text-green-600">24.2%</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">MOIC</p>
              <p className="text-xl font-bold">2.3x</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Total Deployed</p>
              <p className="text-xl font-bold">$85M</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold mb-4">Geographic Distribution</h3>
          <div className="space-y-3">
            {[
              { country: 'Uganda', flag: '🇺🇬', deals: 6, value: 35 },
              { country: 'Kenya', flag: '🇰🇪', deals: 5, value: 30 },
              { country: 'Tanzania', flag: '🇹🇿', deals: 4, value: 25 },
              { country: 'Rwanda', flag: '🇷🇼', deals: 3, value: 18 },
              { country: 'Ethiopia', flag: '🇪🇹', deals: 3, value: 17 },
            ].map((item) => (
              <div key={item.country} className="flex items-center gap-3">
                <span className="text-lg">{item.flag}</span>
                <span className="flex-1 text-sm">{item.country}</span>
                <span className="text-sm text-gray-500">{item.deals} deals</span>
                <span className="text-sm font-medium">${item.value}M</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
