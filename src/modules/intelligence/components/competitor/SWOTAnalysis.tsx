// ============================================================================
// SWOT ANALYSIS
// DawinOS v2.0 - Market Intelligence Module
// Displays SWOT analysis in 2x2 grid format
// ============================================================================

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
} from 'lucide-react';
import { SWOTAnalysis as SWOTAnalysisType, SWOTFactor } from '../../types/competitor.types';
import {
  SWOT_CATEGORY_COLORS,
  SWOT_FACTOR_TYPE_LABELS,
  SWOTCategory,
  SWOTFactorType,
} from '../../constants/competitor.constants';

interface SWOTAnalysisProps {
  analysis: SWOTAnalysisType;
  onApprove?: () => void;
  showActions?: boolean;
}

const getTimeframeLabel = (timeframe: SWOTFactor['timeframe']) => {
  switch (timeframe) {
    case 'immediate': return 'Immediate';
    case 'short_term': return '0-6 months';
    case 'medium_term': return '6-18 months';
    case 'long_term': return '18+ months';
  }
};

const getImpactBars = (impact: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <div
      key={i}
      className={`w-2 h-4 rounded-sm ${
        i < impact ? 'bg-current' : 'bg-gray-200'
      }`}
    />
  ));
};

const FactorCard: React.FC<{ factor: SWOTFactor; category: SWOTCategory }> = ({
  factor,
  category,
}) => {
  const color = SWOT_CATEGORY_COLORS[category];

  return (
    <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">
          {SWOT_FACTOR_TYPE_LABELS[factor.factorType as SWOTFactorType]}
        </span>
        <div className="flex items-center gap-0.5" style={{ color }}>
          {getImpactBars(factor.impact)}
        </div>
      </div>
      <p className="text-sm text-gray-800 mb-2">{factor.description}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{getTimeframeLabel(factor.timeframe)}</span>
        <span>{factor.confidence}% confidence</span>
      </div>
    </div>
  );
};

const QuadrantSection: React.FC<{
  title: string;
  category: SWOTCategory;
  factors: SWOTFactor[];
  icon: React.ReactNode;
}> = ({ title, category, factors, icon }) => {
  const color = SWOT_CATEGORY_COLORS[category];

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-t-lg"
        style={{ backgroundColor: `${color}15` }}
      >
        <span style={{ color }}>{icon}</span>
        <h3 className="font-semibold" style={{ color }}>
          {title}
        </h3>
        <span
          className="ml-auto px-1.5 py-0.5 text-xs font-medium rounded-full"
          style={{ backgroundColor: color, color: 'white' }}
        >
          {factors.length}
        </span>
      </div>
      <div
        className="flex-1 p-3 space-y-2 rounded-b-lg overflow-y-auto"
        style={{ backgroundColor: `${color}05`, minHeight: '200px' }}
      >
        {factors.length > 0 ? (
          factors.map((factor) => (
            <FactorCard key={factor.id} factor={factor} category={category} />
          ))
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            No {title.toLowerCase()} identified
          </p>
        )}
      </div>
    </div>
  );
};

export const SWOTAnalysis: React.FC<SWOTAnalysisProps> = ({
  analysis,
  onApprove,
  showActions = true,
}) => {
  const formatDate = (timestamp: { toDate: () => Date }) => {
    return timestamp.toDate().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              SWOT Analysis: {analysis.competitorName}
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formatDate(analysis.analysisDate)}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>v{analysis.version}</span>
              </div>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  analysis.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : analysis.status === 'draft'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}
              </span>
            </div>
          </div>
          {showActions && analysis.status === 'draft' && onApprove && (
            <button
              onClick={onApprove}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
          )}
        </div>
      </div>

      {/* SWOT Grid */}
      <div className="grid grid-cols-2 gap-4 p-4">
        <QuadrantSection
          title="Strengths"
          category="strength"
          factors={analysis.strengths}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <QuadrantSection
          title="Weaknesses"
          category="weakness"
          factors={analysis.weaknesses}
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <QuadrantSection
          title="Opportunities"
          category="opportunity"
          factors={analysis.opportunities}
          icon={<Target className="w-5 h-5" />}
        />
        <QuadrantSection
          title="Threats"
          category="threat"
          factors={analysis.threats}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      {/* Assessment Section */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-2">Overall Assessment</h3>
        <p className="text-sm text-gray-700 mb-4">{analysis.overallAssessment}</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Strategic Implications
            </h4>
            <ul className="space-y-1">
              {analysis.strategicImplications.map((imp, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  {imp}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Recommended Actions
            </h4>
            <ul className="space-y-1">
              {analysis.recommendedActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                  {action}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SWOTAnalysis;
