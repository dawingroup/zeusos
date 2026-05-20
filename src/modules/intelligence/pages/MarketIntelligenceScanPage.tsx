// ============================================================================
// MARKET INTELLIGENCE SCAN PAGE
// DawinOS v2.0 - AI-Driven Competitive Intelligence
// Configure, run, and view AI-powered market intelligence scans
// ============================================================================

import { useState, useEffect } from 'react';
import {
  Radar,
  Brain,
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Target,
  Zap,
  Eye,
  BarChart3,
  Activity,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lightbulb,
  Globe,
  Users,
  DollarSign,
  Megaphone,
  Cpu,
  UserPlus,
  Gavel,
  Rocket,
  Link2,
  MapPin,
  History,
} from 'lucide-react';
import { useMarketIntelligenceScan } from '../hooks/useMarketIntelligenceScan';
import type {
  MarketIntelSubsidiaryId,
  ScanDepth,
  TimeHorizon,
  FocusArea,
  MarketIntelligenceReport,
  CompetitorAnalysis,
  CompetitorFinding,
  StrategicRecommendation,
  RiskAlert,
  IndustryTrend,
  StoredMarketIntelligenceReport,
} from '../types/market-intelligence.types';
import {
  SUBSIDIARY_OPTIONS,
  FOCUS_AREA_OPTIONS,
  TIME_HORIZON_OPTIONS,
  SCAN_DEPTH_OPTIONS,
  THREAT_LEVEL_CONFIG,
  SIGNIFICANCE_CONFIG,
  PRIORITY_CONFIG,
  ALERT_SEVERITY_CONFIG,
} from '../types/market-intelligence.types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const FINDING_ICONS: Record<string, React.ElementType> = {
  product_launch: Rocket,
  partnership: Link2,
  expansion: MapPin,
  pricing: DollarSign,
  hiring: UserPlus,
  marketing: Megaphone,
  technology: Cpu,
  leadership: Users,
  funding: DollarSign,
  regulatory: Gavel,
  other: Globe,
};

function SectionCard({ title, icon: Icon, children, className = '' }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
        <Icon className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color} ${bg}`}>
      {label}
    </span>
  );
}

// ============================================================================
// SCAN CONFIGURATION PANEL
// ============================================================================

function ScanConfigPanel({ onScan, isScanning }: {
  onScan: (config: {
    subsidiaryId: MarketIntelSubsidiaryId;
    focusAreas: FocusArea[];
    timeHorizon: TimeHorizon;
    depth: ScanDepth;
  }) => void;
  isScanning: boolean;
}) {
  const [subsidiaryId, setSubsidiaryId] = useState<MarketIntelSubsidiaryId>('finishes');
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('last_quarter');
  const [depth, setDepth] = useState<ScanDepth>('standard');

  const toggleFocusArea = (area: FocusArea) => {
    setFocusAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  return (
    <div className="space-y-6">
      {/* Subsidiary Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Subsidiary</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUBSIDIARY_OPTIONS.map(sub => (
            <button
              key={sub.id}
              onClick={() => setSubsidiaryId(sub.id)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                subsidiaryId === sub.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <p className={`text-sm font-semibold ${subsidiaryId === sub.id ? 'text-blue-700' : 'text-gray-800'}`}>
                {sub.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Time Horizon */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Time Horizon</label>
        <div className="flex flex-wrap gap-2">
          {TIME_HORIZON_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setTimeHorizon(opt.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                timeHorizon === opt.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scan Depth */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Depth</label>
        <div className="grid grid-cols-3 gap-2">
          {SCAN_DEPTH_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setDepth(opt.id)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                depth === opt.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`text-sm font-semibold ${depth === opt.id ? 'text-blue-700' : 'text-gray-700'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Focus Areas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Focus Areas <span className="text-gray-400 font-normal">(optional - leave empty for all)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREA_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => toggleFocusArea(opt.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                focusAreas.includes(opt.id)
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scan Button */}
      <button
        onClick={() => onScan({ subsidiaryId, focusAreas, timeHorizon, depth })}
        disabled={isScanning}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {isScanning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Running AI Intelligence Scan...
          </>
        ) : (
          <>
            <Brain className="w-4 h-4" />
            Run Market Intelligence Scan
          </>
        )}
      </button>

      {isScanning && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Radar className="w-5 h-5 text-blue-600 animate-pulse mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">AI Analysis in Progress</p>
              <p className="text-xs text-blue-600 mt-1">
                Gemini AI is scrubbing competitor digital profiles using real-time web search.
                This typically takes 30-90 seconds depending on the number of competitors and depth selected.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REPORT VIEWER COMPONENTS
// ============================================================================

function ExecutiveSummarySection({ report }: { report: MarketIntelligenceReport }) {
  const threatConfig = THREAT_LEVEL_CONFIG[report.overallThreatLevel] || THREAT_LEVEL_CONFIG.moderate;

  return (
    <div className="space-y-4">
      {/* Headline Stats */}
      <KPIGrid cols={4}>
        <KPICard
          label="Competitors Analyzed"
          value={report.metadata?.competitorsAnalyzed || report.competitorAnalyses?.length || 0}
        />
        <KPICard label="Findings" value={report.metadata?.totalFindings || 0} />
        <KPICard label="Risk Alerts" value={report.riskAlerts?.length || 0} />
        <KPICard label="Recommendations" value={report.strategicRecommendations?.length || 0} />
      </KPIGrid>

      {/* Threat & Sentiment */}
      <div className="flex flex-wrap gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${threatConfig.bg}`}>
          <Shield className={`w-4 h-4 ${threatConfig.color}`} />
          <span className={`text-sm font-semibold ${threatConfig.color}`}>
            Overall Threat: {threatConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100">
          {report.marketSentiment === 'bullish' ? (
            <TrendingUp className="w-4 h-4 text-green-600" />
          ) : report.marketSentiment === 'bearish' ? (
            <TrendingDown className="w-4 h-4 text-red-600" />
          ) : (
            <Activity className="w-4 h-4 text-gray-600" />
          )}
          <span className="text-sm font-medium text-gray-700">
            Market: {report.marketSentiment?.charAt(0).toUpperCase()}{report.marketSentiment?.slice(1)}
          </span>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {report.executiveSummary}
        </p>
      </div>
    </div>
  );
}

function CompetitorAnalysisCard({ analysis }: { analysis: CompetitorAnalysis }) {
  const [expanded, setExpanded] = useState(false);

  const threatColor = analysis.updatedThreatLevel === 'critical' || analysis.updatedThreatLevel === 'high'
    ? 'text-red-700 bg-red-100'
    : analysis.updatedThreatLevel === 'moderate'
    ? 'text-yellow-700 bg-yellow-100'
    : 'text-green-700 bg-green-100';

  const changeIcon = analysis.threatLevelChange === 'increased'
    ? <TrendingUp className="w-3 h-3 text-red-500" />
    : analysis.threatLevelChange === 'decreased'
    ? <TrendingDown className="w-3 h-3 text-green-500" />
    : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {analysis.competitorName?.charAt(0) || '?'}
            </span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{analysis.competitorName}</p>
              {changeIcon}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge label={analysis.updatedThreatLevel || 'unknown'} color={threatColor.split(' ')[0]} bg={threatColor.split(' ')[1]} />
              <Badge label={analysis.activityLevel || 'unknown'} color="text-blue-700" bg="bg-blue-100" />
              <span className="text-xs text-gray-400">{analysis.findings?.length || 0} findings</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {analysis.digitalPresenceScore != null && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">Digital Score</p>
              <p className="text-sm font-bold text-gray-700">{analysis.digitalPresenceScore}/100</p>
            </div>
          )}
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Assessment */}
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-blue-800">{analysis.overallAssessment}</p>
          </div>

          {/* Findings */}
          {analysis.findings?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Findings</p>
              <div className="space-y-2">
                {analysis.findings.map((finding, idx) => (
                  <FindingCard key={idx} finding={finding} />
                ))}
              </div>
            </div>
          )}

          {/* Watch Items */}
          {analysis.watchItems?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Watch Items</p>
              <ul className="space-y-1">
                {analysis.watchItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                    <Eye className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: CompetitorFinding }) {
  const Icon = FINDING_ICONS[finding.category] || Globe;
  const sigConfig = SIGNIFICANCE_CONFIG[finding.significance] || SIGNIFICANCE_CONFIG.moderate;

  return (
    <div className="flex gap-3 p-3 bg-white border border-gray-100 rounded-lg">
      <div className="mt-0.5">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-800">{finding.title}</p>
          <Badge label={finding.significance} color={sigConfig.color} bg={sigConfig.bg} />
        </div>
        <p className="text-xs text-gray-600 mt-1">{finding.description}</p>
        {finding.implications && (
          <p className="text-xs text-blue-600 mt-1 flex items-start gap-1">
            <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
            {finding.implications}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {finding.confidence != null && (
            <span className="text-xs text-gray-400">Confidence: {Math.round(finding.confidence * 100)}%</span>
          )}
          {finding.dateObserved && (
            <span className="text-xs text-gray-400">{finding.dateObserved}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TrendSection({ trends }: { trends: IndustryTrend[] }) {
  if (!trends?.length) return null;

  return (
    <div className="space-y-3">
      {trends.map((trend, idx) => {
        const relevanceColors: Record<string, string> = {
          critical: 'border-l-red-500',
          high: 'border-l-orange-500',
          medium: 'border-l-yellow-500',
          low: 'border-l-green-500',
        };

        return (
          <div
            key={idx}
            className={`bg-white border border-gray-100 border-l-4 ${relevanceColors[trend.relevance] || 'border-l-gray-300'} rounded-lg p-4`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">{trend.trend}</p>
              <div className="flex gap-2">
                <Badge label={trend.adoptionRate} color="text-purple-700" bg="bg-purple-100" />
                <Badge label={`${trend.relevance} relevance`} color="text-gray-600" bg="bg-gray-100" />
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-1">{trend.description}</p>
            {trend.competitorsRiding?.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                <span className="font-medium">Competitors riding this:</span> {trend.competitorsRiding.join(', ')}
              </p>
            )}
            {trend.opportunityForUs && (
              <div className="flex items-start gap-1.5 mt-2 text-xs text-green-700 bg-green-50 rounded p-2">
                <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {trend.opportunityForUs}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: StrategicRecommendation }) {
  const prioConfig = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.medium;
  const categoryLabels: Record<string, string> = {
    offensive: 'Offensive',
    defensive: 'Defensive',
    monitoring: 'Monitor',
    investment: 'Invest',
  };

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge label={rec.priority} color={prioConfig.color} bg={prioConfig.bg} />
          <Badge label={categoryLabels[rec.category] || rec.category} color="text-gray-600" bg="bg-gray-100" />
        </div>
        <span className="text-xs text-gray-400">{rec.estimatedTimeframe?.replace('_', ' ')}</span>
      </div>
      <p className="text-sm font-semibold text-gray-800">{rec.title}</p>
      <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
      {rec.rationale && (
        <p className="text-xs text-blue-600 mt-2 italic">{rec.rationale}</p>
      )}
      {rec.targetCompetitors?.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          <span className="font-medium">Targets:</span> {rec.targetCompetitors.join(', ')}
        </p>
      )}
    </div>
  );
}

function RiskAlertCard({ alert }: { alert: RiskAlert }) {
  const config = ALERT_SEVERITY_CONFIG[alert.severity] || ALERT_SEVERITY_CONFIG.warning;
  const Icon = alert.severity === 'critical' ? ShieldAlert : alert.severity === 'elevated' ? AlertCircle : AlertTriangle;

  return (
    <div className={`border rounded-lg p-4 ${config.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.color} mt-0.5 shrink-0`} />
        <div>
          <p className={`text-sm font-semibold ${config.color}`}>{alert.title}</p>
          <p className="text-xs text-gray-600 mt-1">{alert.description}</p>
          {alert.suggestedAction && (
            <p className="text-xs font-medium text-gray-700 mt-2 flex items-start gap-1">
              <Zap className="w-3 h-3 mt-0.5 shrink-0" />
              {alert.suggestedAction}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// REPORT HISTORY PANEL
// ============================================================================

function ReportHistoryPanel({ reports, onSelect, isLoading }: {
  reports: StoredMarketIntelligenceReport[];
  onSelect: (report: StoredMarketIntelligenceReport) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading reports...
      </div>
    );
  }

  if (!reports.length) {
    return (
      <div className="text-center py-8 text-gray-400">
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No previous reports found for this subsidiary.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map(report => {
        const threatConfig = THREAT_LEVEL_CONFIG[report.overallThreatLevel] || THREAT_LEVEL_CONFIG.moderate;
        return (
          <button
            key={report.id}
            onClick={() => onSelect(report)}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-medium text-gray-800">{report.reportTitle}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge label={threatConfig.label} color={threatConfig.color} bg={threatConfig.bg} />
                <span className="text-xs text-gray-400">
                  {report.metadata?.competitorsAnalyzed || 0} competitors
                </span>
                <span className="text-xs text-gray-400">
                  {report.metadata?.totalFindings || 0} findings
                </span>
              </div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-xs text-gray-400">
                {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Unknown'}
              </p>
              <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-1" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// FULL REPORT VIEWER
// ============================================================================

function ReportViewer({ report, onBack }: {
  report: MarketIntelligenceReport;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'competitors' | 'trends' | 'strategy' | 'risks'>('overview');

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'competitors' as const, label: `Competitors (${report.competitorAnalyses?.length || 0})`, icon: Target },
    { id: 'trends' as const, label: 'Trends', icon: TrendingUp },
    { id: 'strategy' as const, label: 'Recommendations', icon: Lightbulb },
    { id: 'risks' as const, label: `Alerts (${report.riskAlerts?.length || 0})`, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-4">
      {/* Report Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1"
          >
            <ChevronRight className="w-3 h-3 rotate-180" />
            Back to scan config
          </button>
          <h2 className="text-lg font-bold text-gray-900">{report.reportTitle}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Generated {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'just now'}
            {report.metadata?.analysisDepth && ` | ${report.metadata.analysisDepth} analysis`}
            {report.metadata?.searchGroundingUsed && ' | Web-grounded'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <SectionCard title="Executive Summary" icon={FileText}>
          <ExecutiveSummarySection report={report} />
        </SectionCard>
      )}

      {activeTab === 'competitors' && (
        <SectionCard title="Competitor Analysis" icon={Target}>
          <div className="space-y-3">
            {report.competitorAnalyses?.length > 0 ? (
              report.competitorAnalyses.map((analysis, idx) => (
                <CompetitorAnalysisCard key={idx} analysis={analysis} />
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No competitor analyses available.</p>
            )}
          </div>
        </SectionCard>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-4">
          <SectionCard title="Industry Trends" icon={TrendingUp}>
            <TrendSection trends={report.trendAnalysis?.industryTrends || []} />
          </SectionCard>
          {report.trendAnalysis?.emergingPatterns?.length > 0 && (
            <SectionCard title="Emerging Patterns" icon={Radar}>
              <div className="space-y-2">
                {report.trendAnalysis.emergingPatterns.map((pattern, idx) => (
                  <div key={idx} className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-purple-800">{pattern.pattern}</p>
                      <div className="flex gap-2">
                        <Badge label={`${pattern.signalStrength} signal`} color="text-purple-700" bg="bg-purple-100" />
                        <Badge label={pattern.timeToImpact?.replace('_', ' ')} color="text-gray-600" bg="bg-gray-100" />
                      </div>
                    </div>
                    <p className="text-xs text-purple-700">{pattern.description}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {activeTab === 'strategy' && (
        <SectionCard title="Strategic Recommendations" icon={Lightbulb}>
          <div className="space-y-3">
            {report.strategicRecommendations?.length > 0 ? (
              report.strategicRecommendations
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
                })
                .map((rec, idx) => <RecommendationCard key={idx} rec={rec} />)
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No recommendations available.</p>
            )}
          </div>
        </SectionCard>
      )}

      {activeTab === 'risks' && (
        <SectionCard title="Risk Alerts" icon={AlertTriangle}>
          <div className="space-y-3">
            {report.riskAlerts?.length > 0 ? (
              report.riskAlerts
                .sort((a, b) => {
                  const order = { critical: 0, elevated: 1, warning: 2 };
                  return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
                })
                .map((alert, idx) => <RiskAlertCard key={idx} alert={alert} />)
            ) : (
              <p className="text-sm text-green-600 text-center py-4 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                No active risk alerts. The competitive landscape appears stable.
              </p>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function MarketIntelligenceScanPage() {
  const {
    isScanning,
    scanResult,
    scanError,
    runScan,
    clearScan,
    reports,
    isLoadingReports,
    loadReports,
    activeReport,
    setActiveReport,
  } = useMarketIntelligenceScan();

  const [showHistory, setShowHistory] = useState(false);
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<MarketIntelSubsidiaryId>('finishes');

  // Load reports when subsidiary changes and history is open
  useEffect(() => {
    if (showHistory) {
      loadReports(selectedSubsidiary);
    }
  }, [showHistory, selectedSubsidiary, loadReports]);

  const handleScan = async (config: {
    subsidiaryId: MarketIntelSubsidiaryId;
    focusAreas: FocusArea[];
    timeHorizon: TimeHorizon;
    depth: ScanDepth;
  }) => {
    setSelectedSubsidiary(config.subsidiaryId);
    await runScan(config);
  };

  const handleViewHistorical = (report: StoredMarketIntelligenceReport) => {
    setActiveReport(report);
    setShowHistory(false);
  };

  // If there's an active report, show the report viewer
  if (activeReport) {
    return (
      <div>
        <ReportViewer
          report={activeReport}
          onBack={() => {
            setActiveReport(null);
            clearScan();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
            <Radar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Market Intelligence</h1>
            <p className="text-sm text-gray-500">AI-powered competitive landscape analysis</p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <History className="w-4 h-4" />
          {showHistory ? 'New Scan' : 'Past Reports'}
        </button>
      </div>

      {/* Error Display */}
      {scanError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Scan Failed</p>
            <p className="text-xs text-red-600 mt-1">{scanError}</p>
            <button
              onClick={clearScan}
              className="text-xs text-red-700 underline mt-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Success Notice */}
      {scanResult?.success && !activeReport && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Scan Complete</p>
            <p className="text-xs text-green-600 mt-1">
              Analyzed {scanResult.competitorsAnalyzed} competitors with {scanResult.totalFindings} findings.
              {scanResult.movesCreated ? ` ${scanResult.movesCreated} major competitive moves auto-tracked.` : ''}
            </p>
            {scanResult.report && (
              <button
                onClick={() => setActiveReport(scanResult.report!)}
                className="text-xs text-green-700 underline mt-2 flex items-center gap-1"
              >
                View Report <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      {showHistory ? (
        <SectionCard title="Report History" icon={History}>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Subsidiary</label>
            <div className="flex gap-2 flex-wrap">
              {SUBSIDIARY_OPTIONS.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubsidiary(sub.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedSubsidiary === sub.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
          <ReportHistoryPanel
            reports={reports}
            onSelect={handleViewHistorical}
            isLoading={isLoadingReports}
          />
        </SectionCard>
      ) : (
        <SectionCard title="Configure Intelligence Scan" icon={Brain}>
          <ScanConfigPanel onScan={handleScan} isScanning={isScanning} />
        </SectionCard>
      )}

      {/* How it works */}
      {!showHistory && !activeReport && !isScanning && (
        <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-blue-600" />
            How Market Intelligence Scan Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: '1', title: 'Fetch Competitors', desc: 'Loads tracked competitors for the selected subsidiary from your database.' },
              { step: '2', title: 'Web Intelligence', desc: 'Gemini AI with Google Search grounding scrubs digital profiles, news, and social media.' },
              { step: '3', title: 'AI Analysis', desc: 'Identifies new activities, trends, strategic moves, and risk signals across competitors.' },
              { step: '4', title: 'Auto-Track', desc: 'Major findings are automatically logged as competitive moves for ongoing monitoring.' },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketIntelligenceScanPage;
