// ============================================================================
// COMPETITOR DASHBOARD
// ZeusOS v2.0 - Market Intelligence Module
// Executive overview of competitive landscape
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useCompetitor } from '../../hooks/useCompetitor';
import { CompetitorCard } from './CompetitorCard';
import { CompetitiveMoveTracker } from './CompetitiveMoveTracker';
import { WinLossAnalysis } from './WinLossAnalysis';
import {
  COMPETITOR_TYPES,
  THREAT_LEVELS,
  INDUSTRIES,
  GEOGRAPHIES,
  COMPETITOR_TYPE_LABELS,
  THREAT_LEVEL_LABELS,
  INDUSTRY_LABELS,
  GEOGRAPHY_LABELS,
  CompetitorType,
  ThreatLevel,
  Industry,
  Geography,
} from '../../constants/competitor.constants';
import { Competitor, CompetitorFilters } from '../../types/competitor.types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface CompetitorDashboardProps {
  onAddCompetitor?: () => void;
  onViewCompetitor?: (competitor: Competitor) => void;
  onEditCompetitor?: (competitor: Competitor) => void;
}

export const CompetitorDashboard: React.FC<CompetitorDashboardProps> = ({
  onAddCompetitor,
  onViewCompetitor,
  onEditCompetitor,
}) => {
  const {
    competitors,
    competitiveMoves,
    winLossRecords,
    analytics,
    isLoading,
    error,
    loadCompetitors,
    loadMoves,
    loadWinLossRecords,
    loadAnalytics,
  } = useCompetitor();

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<CompetitorFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'competitors' | 'moves' | 'winloss'>('competitors');

  useEffect(() => {
    loadCompetitors();
    loadMoves();
    loadWinLossRecords();
    loadAnalytics();
  }, [loadCompetitors, loadMoves, loadWinLossRecords, loadAnalytics]);

  const handleRefresh = () => {
    loadCompetitors(filters);
    loadMoves();
    loadWinLossRecords();
    loadAnalytics();
  };

  const handleFilterChange = (key: keyof CompetitorFilters, value: string) => {
    const newFilters = { ...filters };
    if (value) {
      (newFilters as Record<string, unknown>)[key] = value;
    } else {
      delete (newFilters as Record<string, unknown>)[key];
    }
    setFilters(newFilters);
    loadCompetitors(newFilters);
  };

  const filteredCompetitors = competitors.filter(competitor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      competitor.name.toLowerCase().includes(query) ||
      competitor.description.toLowerCase().includes(query)
    );
  });

  const highThreatCount = competitors.filter(
    c => c.threatLevel === 'high' || c.threatLevel === 'critical'
  ).length;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competitor Analysis</h1>
          <p className="text-gray-500">Track and analyze competitive landscape</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onAddCompetitor}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Competitor
          </button>
        </div>
      </div>

      {/* Analytics Summary */}
      {analytics && (
        <KPIGrid cols={6}>
          <KPICard label="Total" value={analytics.totalCompetitors} />
          <KPICard label="Active" value={analytics.activeCompetitors} />
          <KPICard label="High Threat" value={highThreatCount} trend={highThreatCount > 0 ? 'down' : undefined} />
          <KPICard label="Recent Moves" value={analytics.recentMoves} />
          <KPICard label="Win Rate" value={`${analytics.winRate.toFixed(0)}%`} trend="up" />
          <KPICard label="Pending" value={analytics.pendingResponses} />
        </KPIGrid>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'competitors', label: 'Competitors', count: competitors.length },
            { id: 'moves', label: 'Competitive Moves', count: competitiveMoves.length },
            { id: 'winloss', label: 'Win/Loss', count: winLossRecords.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Competitors Tab */}
      {activeTab === 'competitors' && (
        <>
          {/* Search and Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search competitors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${
                  showFilters ? 'border-indigo-500 text-indigo-600 bg-indigo-50' : 'border-gray-300 text-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {Object.keys(filters).length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-indigo-600 text-white rounded-full">
                    {Object.keys(filters).length}
                  </span>
                )}
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={filters.type || ''}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">All Types</option>
                    {Object.values(COMPETITOR_TYPES).map((type) => (
                      <option key={type} value={type}>
                        {COMPETITOR_TYPE_LABELS[type as CompetitorType]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Threat Level</label>
                  <select
                    value={filters.threatLevel || ''}
                    onChange={(e) => handleFilterChange('threatLevel', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">All Levels</option>
                    {Object.values(THREAT_LEVELS).map((level) => (
                      <option key={level} value={level}>
                        {THREAT_LEVEL_LABELS[level as ThreatLevel]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <select
                    value={filters.industry || ''}
                    onChange={(e) => handleFilterChange('industry', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">All Industries</option>
                    {Object.values(INDUSTRIES).map((ind) => (
                      <option key={ind} value={ind}>
                        {INDUSTRY_LABELS[ind as Industry]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Geography</label>
                  <select
                    value={filters.geography || ''}
                    onChange={(e) => handleFilterChange('geography', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">All Regions</option>
                    {Object.values(GEOGRAPHIES).map((geo) => (
                      <option key={geo} value={geo}>
                        {GEOGRAPHY_LABELS[geo as Geography]}
                      </option>
                    ))}
                  </select>
                </div>

                {Object.keys(filters).length > 0 && (
                  <div className="sm:col-span-2 md:col-span-4 flex justify-end">
                    <button
                      onClick={() => {
                        setFilters({});
                        loadCompetitors({});
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Competitor Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-gray-100 rounded-lg h-64 animate-pulse" />
              ))}
            </div>
          ) : filteredCompetitors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompetitors.map((competitor) => (
                <CompetitorCard
                  key={competitor.id}
                  competitor={competitor}
                  onSelect={onViewCompetitor}
                  onEdit={onEditCompetitor}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No competitors found</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery || Object.keys(filters).length > 0
                  ? 'Try adjusting your search or filters'
                  : 'Add your first competitor to get started'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Moves Tab */}
      {activeTab === 'moves' && (
        <CompetitiveMoveTracker moves={competitiveMoves} />
      )}

      {/* Win/Loss Tab */}
      {activeTab === 'winloss' && (
        <WinLossAnalysis records={winLossRecords} />
      )}
    </div>
  );
};

export default CompetitorDashboard;
