// ============================================================================
// SIGNAL FEED COMPONENT
// ZeusOS v2.0 - Market Intelligence Module
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
          <h2 className="text-xl font-bold text-foreground">Signal Detection</h2>
          <p className="text-sm text-muted-foreground">
            Monitor and analyze environmental signals for early warning
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-2 text-sm font-medium text-muted-foreground bg-card border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-sunken)] disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onCreateSignal}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--rag-blue)] rounded-lg hover:bg-[var(--rag-blue)] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Log Signal
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-foreground">{stats.total}</span>
          <span className="text-sm text-muted-foreground">Total Signals</span>
        </div>
        <div className="h-8 w-px bg-[var(--bg-sunken)]" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded" style={{ backgroundColor: `${SIGNAL_TYPE_CONFIG.weak.color}30` }}>
              <Radio className="w-4 h-4" style={{ color: SIGNAL_TYPE_CONFIG.weak.color }} />
            </div>
            <span className="text-sm font-medium">{stats.weak}</span>
            <span className="text-xs text-muted-foreground">Weak</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded" style={{ backgroundColor: `${SIGNAL_TYPE_CONFIG.moderate.color}30` }}>
              <Activity className="w-4 h-4" style={{ color: SIGNAL_TYPE_CONFIG.moderate.color }} />
            </div>
            <span className="text-sm font-medium">{stats.moderate}</span>
            <span className="text-xs text-muted-foreground">Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded" style={{ backgroundColor: `${SIGNAL_TYPE_CONFIG.strong.color}30` }}>
              <Zap className="w-4 h-4" style={{ color: SIGNAL_TYPE_CONFIG.strong.color }} />
            </div>
            <span className="text-sm font-medium">{stats.strong}</span>
            <span className="text-xs text-muted-foreground">Strong</span>
          </div>
        </div>
        <div className="h-8 w-px bg-[var(--bg-sunken)]" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[var(--rag-blue)]">{stats.new}</span>
          <span className="text-sm text-muted-foreground">New</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--fg-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search signals..."
            className="w-full pl-10 pr-4 py-2 border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--rag-blue)] focus:border-[var(--rag-blue)]"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 text-sm font-medium border rounded-lg flex items-center gap-2 ${
            showFilters || selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedDimensions.length > 0
              ? 'bg-[var(--rag-blue-soft)] border-[var(--rag-blue)] text-[var(--rag-blue)]'
              : 'bg-card border-[var(--border-default)] text-muted-foreground hover:bg-[var(--bg-sunken)]'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filter
          {(selectedTypes.length + selectedStatuses.length + selectedDimensions.length) > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-[var(--rag-blue)] text-white rounded-full">
              {selectedTypes.length + selectedStatuses.length + selectedDimensions.length}
            </span>
          )}
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-card focus:ring-2 focus:ring-[var(--rag-blue)]"
        >
          <option value="date">Sort by Date</option>
          <option value="strength">Sort by Strength</option>
          <option value="impact">Sort by Impact</option>
        </select>
        <button className="px-3 py-2 text-sm font-medium text-muted-foreground bg-card border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-sunken)] flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-foreground">Filters</span>
            </div>
            <button
              onClick={clearFilters}
              className="text-sm text-[var(--rag-blue)] hover:text-[var(--rag-blue)]"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Signal Type */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Signal Type</h4>
              <div className="space-y-2">
                {Object.entries(SIGNAL_TYPES).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(value as SignalType)}
                      onChange={() => toggleType(value as SignalType)}
                      className="rounded border-[var(--border-default)] text-[var(--rag-blue)] focus:ring-[var(--rag-blue)]"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: SIGNAL_TYPE_CONFIG[value as SignalType].color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {SIGNAL_TYPE_CONFIG[value as SignalType].label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Status</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {Object.entries(SIGNAL_STATUSES).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(value as SignalStatus)}
                      onChange={() => toggleStatus(value as SignalStatus)}
                      className="rounded border-[var(--border-default)] text-[var(--rag-blue)] focus:ring-[var(--rag-blue)]"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: SIGNAL_STATUS_CONFIG[value as SignalStatus].color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {SIGNAL_STATUS_CONFIG[value as SignalStatus].label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* PESTEL Dimension */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">PESTEL Dimension</h4>
              <div className="space-y-2">
                {Object.entries(PESTEL_DIMENSIONS).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDimensions.includes(value as PESTELDimension)}
                      onChange={() => toggleDimension(value as PESTELDimension)}
                      className="rounded border-[var(--border-default)] text-[var(--rag-blue)] focus:ring-[var(--rag-blue)]"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PESTEL_DIMENSION_CONFIG[value as PESTELDimension].color }}
                    />
                    <span className="text-sm text-muted-foreground">
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--rag-blue)]" />
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-12 text-center">
            <Radio className="w-12 h-12 mx-auto text-[var(--fg-tertiary)] mb-4" />
            <h3 className="font-medium text-foreground mb-1">No signals found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {signals.length === 0
                ? 'Start monitoring your environment by logging your first signal'
                : 'Try adjusting your filters to see more signals'}
            </p>
            {signals.length === 0 && (
              <button
                onClick={onCreateSignal}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--rag-blue)] rounded-lg hover:bg-[var(--rag-blue)]"
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
