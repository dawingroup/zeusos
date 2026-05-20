// ============================================================================
// ENVIRONMENT SCANNING DASHBOARD
// DawinOS v2.0 - Market Intelligence Module
// Main dashboard for environment scanning functionality
// ============================================================================

import React from 'react';
import {
  Radar,
  Radio,
  Scale,
  Map,
  Bell,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import {
  PESTELAnalysis,
  EnvironmentSignal,
  RegulatoryItem,
  Scenario,
  EarlyWarningAlert,
  TrackedIndicator,
  EnvironmentScanningAnalytics,
} from '../types/scanning.types';
import {
  PESTEL_DIMENSION_CONFIG,
  SIGNAL_TYPE_CONFIG,
  SignalType,
  PESTELDimension,
} from '../constants/scanning.constants';
import { RiskRadar } from './EarlyWarning';

interface EnvironmentScanningDashboardProps {
  analytics: EnvironmentScanningAnalytics | null;
  pestelAnalyses: PESTELAnalysis[];
  signals: EnvironmentSignal[];
  regulations: RegulatoryItem[];
  scenarios: Scenario[];
  alerts: EarlyWarningAlert[];
  indicators: TrackedIndicator[];
  isLoading: boolean;
  onRefresh: () => void;
  onNavigate: (section: 'pestel' | 'signals' | 'regulatory' | 'scenarios' | 'alerts') => void;
}

export const EnvironmentScanningDashboard: React.FC<EnvironmentScanningDashboardProps> = ({
  analytics,
  pestelAnalyses,
  signals,
  regulations,
  scenarios,
  alerts,
  indicators,
  isLoading,
  onRefresh,
  onNavigate,
}) => {
  const activeAlerts = alerts.filter(a => a.status === 'active');
  const criticalAlerts = activeAlerts.filter(a => a.priority === 'critical');
  const newSignals = signals.filter(s => s.status === 'new');
  const upcomingRegulations = regulations.filter(r => {
    if (!r.dates.effectiveDate) return false;
    const daysUntil = Math.ceil((r.dates.effectiveDate.seconds * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntil > 0 && daysUntil <= 90;
  });

  const modules = [
    {
      id: 'pestel',
      title: 'PESTEL Analysis',
      description: 'Macro-environment factor analysis',
      icon: Radar,
      color: '#3B82F6',
      count: pestelAnalyses.length,
      label: 'analyses',
    },
    {
      id: 'signals',
      title: 'Signal Detection',
      description: 'Weak signal monitoring',
      icon: Radio,
      color: '#10B981',
      count: signals.length,
      label: 'signals',
      badge: newSignals.length > 0 ? `${newSignals.length} new` : undefined,
    },
    {
      id: 'regulatory',
      title: 'Regulatory Tracking',
      description: 'Compliance monitoring',
      icon: Scale,
      color: '#8B5CF6',
      count: regulations.length,
      label: 'tracked',
      badge: upcomingRegulations.length > 0 ? `${upcomingRegulations.length} upcoming` : undefined,
    },
    {
      id: 'scenarios',
      title: 'Scenario Planning',
      description: 'Future state projections',
      icon: Map,
      color: '#F59E0B',
      count: scenarios.length,
      label: 'scenarios',
    },
    {
      id: 'alerts',
      title: 'Early Warning',
      description: 'Alert management',
      icon: Bell,
      color: '#EF4444',
      count: activeAlerts.length,
      label: 'active',
      badge: criticalAlerts.length > 0 ? `${criticalAlerts.length} critical` : undefined,
      badgeColor: '#EF4444',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Environment Scanning</h1>
          <p className="text-sm text-gray-500">
            Monitor macro-environment factors, detect signals, track regulations, and plan for scenarios
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alert Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <h4 className="font-semibold text-red-900">
                {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''} Active
              </h4>
              <p className="text-sm text-red-700">
                Immediate attention required
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('alerts')}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            View Alerts
          </button>
        </div>
      )}

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {modules.map(module => {
          const Icon = module.icon;
          return (
            <div
              key={module.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all group"
              onClick={() => onNavigate(module.id as any)}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${module.color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: module.color }} />
                </div>
                {'badge' in module && module.badge && (
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                    style={{ backgroundColor: ('badgeColor' in module ? module.badgeColor : module.color) as string }}
                  >
                    {module.badge}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {module.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{module.description}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold" style={{ color: module.color }}>
                    {module.count}
                  </span>
                  <span className="text-xs text-gray-500">{module.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Risk Radar & Indicators */}
        <div className="space-y-6">
          {/* Risk Radar */}
          <RiskRadar alerts={alerts} />

          {/* Key Indicators */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Key Indicators</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {indicators.slice(0, 5).map(indicator => (
                <div key={indicator.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {indicator.indicator.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-xs text-gray-500">{indicator.source}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${
                        indicator.alertStatus === 'critical' ? 'text-red-600' :
                        indicator.alertStatus === 'warning' ? 'text-yellow-600' :
                        'text-gray-900'
                      }`}>
                        {indicator.currentValue.toLocaleString()}
                      </span>
                      {indicator.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                      {indicator.trend === 'down' && <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />}
                    </div>
                    <span className={`text-xs ${
                      indicator.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {indicator.changePercent >= 0 ? '+' : ''}{indicator.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
              {indicators.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <BarChart3 className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">No indicators tracked yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column - Recent Signals & PESTEL */}
        <div className="space-y-6">
          {/* Recent Signals */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent Signals</h3>
              <button
                onClick={() => onNavigate('signals')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {signals.slice(0, 5).map(signal => {
                const typeConfig = SIGNAL_TYPE_CONFIG[signal.signalType as SignalType];
                return (
                  <div key={signal.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="p-1.5 rounded"
                        style={{ backgroundColor: `${typeConfig?.color}20` }}
                      >
                        <Radio className="w-4 h-4" style={{ color: typeConfig?.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {signal.title}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                          {signal.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="px-1.5 py-0.5 text-xs rounded"
                            style={{ backgroundColor: typeConfig?.color, color: 'white' }}
                          >
                            {typeConfig?.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            Strength: {signal.assessment.strengthScore}/10
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {signals.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Radio className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">No signals detected yet</p>
                </div>
              )}
            </div>
          </div>

          {/* PESTEL Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">PESTEL Dimensions</h3>
              <button
                onClick={() => onNavigate('pestel')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(PESTEL_DIMENSION_CONFIG).map(([key, config]) => {
                  const count = analytics?.pestelSummary.byDimension[key as PESTELDimension] || 0;
                  return (
                    <div
                      key={key}
                      className="text-center p-3 rounded-lg"
                      style={{ backgroundColor: `${config.color}10` }}
                    >
                      <div
                        className="text-lg font-bold"
                        style={{ color: config.color }}
                      >
                        {count}
                      </div>
                      <div className="text-xs text-gray-600">{config.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Regulations & Scenarios */}
        <div className="space-y-6">
          {/* Upcoming Regulations */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Upcoming Regulations</h3>
              <button
                onClick={() => onNavigate('regulatory')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {upcomingRegulations.slice(0, 4).map(reg => {
                const daysUntil = reg.dates.effectiveDate
                  ? Math.ceil((reg.dates.effectiveDate.seconds * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;
                return (
                  <div key={reg.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {reg.title}
                        </h4>
                        <p className="text-xs text-gray-500">{reg.issuingAuthority}</p>
                      </div>
                      {daysUntil && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          daysUntil <= 30 ? 'bg-red-100 text-red-700' :
                          daysUntil <= 60 ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {daysUntil}d
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {upcomingRegulations.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Scale className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">No upcoming deadlines</p>
                </div>
              )}
            </div>
          </div>

          {/* Active Scenarios */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Active Scenarios</h3>
              <button
                onClick={() => onNavigate('scenarios')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {scenarios.filter(s => s.status === 'approved').slice(0, 4).map(scenario => {
                const triggeredSignposts = scenario.signposts.filter(s => s.status === 'triggered').length;
                return (
                  <div key={scenario.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {scenario.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-blue-600 font-medium">
                            {scenario.probability}% likely
                          </span>
                          {triggeredSignposts > 0 && (
                            <span className="text-xs text-red-600">
                              {triggeredSignposts} signpost triggered
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {scenarios.filter(s => s.status === 'approved').length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Map className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">No approved scenarios</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentScanningDashboard;
