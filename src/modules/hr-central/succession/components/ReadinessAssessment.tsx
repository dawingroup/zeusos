// ============================================================================
// READINESS ASSESSMENT
// DawinOS v2.0 - HR Module
// Displays readiness assessment details for a successor
// ============================================================================

import React from 'react';
import { ReadinessAssessmentDetail } from '../types/succession.types';

interface ReadinessAssessmentProps {
  assessment: ReadinessAssessmentDetail;
  showLabels?: boolean;
}

interface AssessmentBar {
  label: string;
  value: number;
  key: keyof ReadinessAssessmentDetail;
}

const ASSESSMENT_BARS: AssessmentBar[] = [
  { label: 'Leadership Competencies', value: 0, key: 'leadershipCompetencies' },
  { label: 'Technical Expertise', value: 0, key: 'technicalExpertise' },
  { label: 'Business Acumen', value: 0, key: 'businessAcumen' },
  { label: 'Stakeholder Management', value: 0, key: 'stakeholderManagement' },
  { label: 'Strategic Thinking', value: 0, key: 'strategicThinking' },
  { label: 'Team Management', value: 0, key: 'teamManagement' },
];

export const ReadinessAssessment: React.FC<ReadinessAssessmentProps> = ({
  assessment,
  showLabels = true,
}) => {
  const getBarColor = (value: number): string => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-emerald-400';
    if (value >= 40) return 'bg-amber-400';
    if (value >= 20) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const getOverallColor = (value: number): string => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-emerald-600';
    if (value >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Overall Score */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">Readiness Assessment</h4>
        <div className="text-right">
          <span className={`text-2xl font-bold ${getOverallColor(assessment.overallReadiness)}`}>
            {assessment.overallReadiness}%
          </span>
          <p className="text-xs text-gray-500">Overall</p>
        </div>
      </div>

      {/* Assessment Bars */}
      <div className="space-y-3">
        {ASSESSMENT_BARS.map((bar) => {
          const value = assessment[bar.key] as number;
          return (
            <div key={bar.key}>
              {showLabels && (
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{bar.label}</span>
                  <span className="font-medium text-gray-900">{value}%</span>
                </div>
              )}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getBarColor(value)}`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Uganda Market Knowledge (if applicable) */}
        {assessment.ugandaMarketKnowledge !== undefined && (
          <div>
            {showLabels && (
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Uganda Market Knowledge</span>
                <span className="font-medium text-gray-900">{assessment.ugandaMarketKnowledge}%</span>
              </div>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getBarColor(
                  assessment.ugandaMarketKnowledge
                )}`}
                style={{ width: `${assessment.ugandaMarketKnowledge}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Assessment Notes */}
      {assessment.assessmentNotes && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Assessment Notes</p>
          <p className="text-sm text-gray-700">{assessment.assessmentNotes}</p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-gray-600">Excellent (80+)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-400" />
            <span className="text-gray-600">Good (60-79)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-400" />
            <span className="text-gray-600">Developing (40-59)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-400" />
            <span className="text-gray-600">Needs Work (&lt;40)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadinessAssessment;
