// ============================================================================
// SIGNAL FEED COMPONENT
// DawinOS v2.0 - Market Intelligence Module
// Real-time feed of detected environment signals
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Filter,
  Search,
  Radio,
  Activity,
  Zap,
  RefreshCw,
  Download,
  SlidersHorizontal,
} from 'lucide-react';
import { EnvironmentSignal } from '../../types/scanning.types';
import {
  SIGNAL_TYPES,
  SIGNAL_TYPE_CONFIG,
  SIGNAL_STATUSES,
  SIGNAL_STATUS_CONFIG,
  PESTEL_DIMENSIONS,
  PESTEL_DIMENSION_CONFIG,
  SignalType,
  SignalStatus,
  PESTELDimension,
} from '../../constants/scanning.constants';
import { SignalCard } from './SignalCard';

interface SignalFeedProps {
  signals: EnvironmentSignal[];
  isLoading: boolean;
  onSelectSignal: (signal: EnvironmentSignal) => void;
  onCreateSignal: () => void;
  onRefresh: () => void;
  onStatusChange?: (signal: EnvironmentSignal, newStatus: SignalStatus) => void;
}

export const SignalFeed: React.FC<SignalFeedProps> = ({
  signals,
  isLoading,
  onSelectSignal,
  onCreateSignal,
  onRefresh,
  onStatusChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<SignalType[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<SignalStatus[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<PESTELDimension[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'strength' | 'impact'>('date');

  const filteredSignals = useMemo(() => {
    let result = [...signals];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    if (selectedTypes.length > 0) {
      result = result.filter(s => selectedTypes.includes(s.signalType as SignalType));
    }

    if (selectedStatuses.length > 0) {
      result = result.filter(s => selectedStatuses.includes(s.status as SignalStatus));
    }

    if (selectedDimensions.length > 0) {
      result = result.filter(s => selectedDimensions.includes(s.pestelDimension as PESTELDimension));
    }

    switch (sortBy) {
      case 'strength':
        result.sort((a, b) => b.assessment.strengthScore - a.assessment.strengthScore);
        break;
      case 'impact':
        result.sort((a, b) => {
          const impactOrder = ['very_high', 'high', 'medium', 'low', 'very_low'];
          return impactOrder.indexOf(a.assessment.impactLevel) - impactOrder.indexOf(b.assessment.impactLevel);
        });
        break;
      default:
        result.sort((a, b) => b.detectedAt.seconds - a.detectedAt.seconds);
    }

    return result;
  }, [signals, searchQuery, selectedTypes, selectedStatuses, selectedDimensions, sortBy]);

  const stats = useMemo(() => ({
    total: signals.length,
    weak: signals.filter(s => s.signalType === 'weak').length,
    moderate: signals.filter(s => s.signalType === 'moderate').length,
    strong: signals.filter(s => s.signalType === 'strong').length,
    new: signals.filter(s => s.status === 'new').length,
  }), [signals]);

  const toggleType = (type: SignalType) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleStatus = (status: SignalStatus) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleDimension = (dim: PESTELDimension) => {
    setSelectedDimensions(prev =>
      prev.includes(dim)
        ? prev.filter(d => d !== dim)
        : [...prev, dim]
    );
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSelectedDimensions([]);
    setSearchQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Signal Detection</h2>
          <p className="text-sm text-gray-500">
            Monitor and analyze environmental signals for early warning
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onCreateSignal}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Log Signal
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
          <span className="text-sm text-gray-500">Total Signals</span>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded" style={{ backgroundColor: `${SIGNAL_TYPE_CONFIG.weak.color}30` }}>
              <Radio className="w-4 h-4" style={{ color: SIGNAL_TYPE_CONFIG.weak.color }} />
            </div>
            <span className="text-sm font-medium">{stats.weak}</span>
            <span className="text-xs text-gray-500">Weak</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded" style={{ backgroundColor: `${SIGNAL_TYPE_CONFIG.moderate.color}30` }}>
              <Activity className="w-4 h-4" style={{ color: SIGNAL_TYPE_CONFIG.moderate.color }} />
            </div>
            <span className="text-sm font-medium">{stats.moderate}</span>
            <span className="text-xs text-gray-500">Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded" style={{ backgroundColor: `${SIGNAL_TYPE_CONFIG.strong.color}30` }}>
              <Zap className="w-4 h-4" style={{ color: SIGNAL_TYPE_CONFIG.strong.color }} />
            </div>
            <span className="text-sm font-medium">{stats.strong}</span>
            <span className="text-xs text-gray-500">Strong</span>
          </div>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-blue-600">{stats.new}</span>
          <span className="text-sm text-gray-500">New</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search signals..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 text-sm font-medium border rounded-lg flex items-center gap-2 ${
            showFilters || selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedDimensions.length > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filter
          {(selectedTypes.length + selectedStatuses.length + selectedDimensions.length) > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
              {selectedTypes.length + selectedStatuses.length + selectedDimensions.length}
            </span>
          )}
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="date">Sort by Date</option>
          <option value="strength">Sort by Strength</option>
          <option value="impact">Sort by Impact</option>
        </select>
        <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900">Filters</span>
            </div>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Signal Type */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Signal Type</h4>
              <div className="space-y-2">
                {Object.entries(SIGNAL_TYPES).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(value as SignalType)}
                      onChange={() => toggleType(value as SignalType)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: SIGNAL_TYPE_CONFIG[value as SignalType].color }}
                    />
                    <span className="text-sm text-gray-600">
                      {SIGNAL_TYPE_CONFIG[value as SignalType].label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Status</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {Object.entries(SIGNAL_STATUSES).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(value as SignalStatus)}
                      onChange={() => toggleStatus(value as SignalStatus)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: SIGNAL_STATUS_CONFIG[value as SignalStatus].color }}
                    />
                    <span className="text-sm text-gray-600">
                      {SIGNAL_STATUS_CONFIG[value as SignalStatus].label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* PESTEL Dimension */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">PESTEL Dimension</h4>
              <div className="space-y-2">
                {Object.entries(PESTEL_DIMENSIONS).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDimensions.includes(value as PESTELDimension)}
                      onChange={() => toggleDimension(value as PESTELDimension)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PESTEL_DIMENSION_CONFIG[value as PESTELDimension].color }}
                    />
                    <span className="text-sm text-gray-600">
                      {PESTEL_DIMENSION_CONFIG[value as PESTELDimension].label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signal List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Radio className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="font-medium text-gray-900 mb-1">No signals found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {signals.length === 0
                ? 'Start monitoring your environment by logging your first signal'
                : 'Try adjusting your filters to see more signals'}
            </p>
            {signals.length === 0 && (
              <button
                onClick={onCreateSignal}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Log First Signal
              </button>
            )}
          </div>
        ) : (
          filteredSignals.map(signal => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onSelect={onSelectSignal}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default SignalFeed;
