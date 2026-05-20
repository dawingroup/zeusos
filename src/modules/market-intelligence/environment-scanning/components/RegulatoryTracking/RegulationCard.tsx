// ============================================================================
// REGULATION CARD COMPONENT
// DawinOS v2.0 - Market Intelligence Module
// Displays a single regulatory item with compliance status
// ============================================================================

import React from 'react';
import {
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import { RegulatoryItem } from '../../types/scanning.types';
import {
  REGULATORY_CATEGORY_CONFIG,
  REGULATORY_STATUS_CONFIG,
  COMPLIANCE_STATUS_CONFIG,
  IMPACT_LEVEL_CONFIG,
  AFFECTED_BUSINESS_AREA_LABELS,
  RegulatoryCategory,
  RegulatoryStatus,
  ComplianceStatus,
} from '../../constants/scanning.constants';

interface RegulationCardProps {
  regulation: RegulatoryItem;
  onSelect?: (regulation: RegulatoryItem) => void;
  compact?: boolean;
}

export const RegulationCard: React.FC<RegulationCardProps> = ({
  regulation,
  onSelect,
  compact = false,
}) => {
  const categoryConfig = REGULATORY_CATEGORY_CONFIG[regulation.category as RegulatoryCategory];
  const statusConfig = REGULATORY_STATUS_CONFIG[regulation.status as RegulatoryStatus];
  const complianceConfig = COMPLIANCE_STATUS_CONFIG[regulation.compliance.status as ComplianceStatus];
  const impactConfig = IMPACT_LEVEL_CONFIG[regulation.impact.level];

  const formatDate = (timestamp: any) => {
    if (!timestamp) return null;
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysUntilEffective = () => {
    if (!regulation.dates.effectiveDate) return null;
    const now = Date.now();
    const effective = regulation.dates.effectiveDate.seconds * 1000;
    const days = Math.ceil((effective - now) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  };

  const daysUntil = getDaysUntilEffective();

  if (compact) {
    return (
      <div
        className="p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-all"
        onClick={() => onSelect?.(regulation)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: categoryConfig?.color }}
              />
              <span className="text-xs text-gray-500">{categoryConfig?.label}</span>
            </div>
            <h4 className="font-medium text-sm text-gray-900 truncate">
              {regulation.title}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="px-1.5 py-0.5 text-xs rounded"
                style={{
                  backgroundColor: `${statusConfig?.color}20`,
                  color: statusConfig?.color,
                }}
              >
                {statusConfig?.label}
              </span>
              <span
                className="px-1.5 py-0.5 text-xs rounded"
                style={{
                  backgroundColor: `${complianceConfig?.color}20`,
                  color: complianceConfig?.color,
                }}
              >
                {complianceConfig?.label}
              </span>
            </div>
          </div>
          {daysUntil && daysUntil <= 90 && (
            <span className={`text-xs font-medium ${daysUntil <= 30 ? 'text-red-600' : 'text-orange-600'}`}>
              {daysUntil}d
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                style={{ backgroundColor: categoryConfig?.color }}
              >
                {categoryConfig?.label}
              </span>
              <span
                className="px-2 py-0.5 text-xs font-medium rounded"
                style={{
                  backgroundColor: `${statusConfig?.color}20`,
                  color: statusConfig?.color,
                }}
              >
                {statusConfig?.label}
              </span>
              {statusConfig?.requiresAction && (
                <span className="flex items-center gap-1 text-xs text-orange-600">
                  <AlertTriangle className="w-3 h-3" />
                  Action Required
                </span>
              )}
            </div>
            <h4 className="font-semibold text-gray-900">{regulation.title}</h4>
            <p className="text-sm text-gray-500 mt-0.5">{regulation.officialName}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(regulation);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
          {regulation.description}
        </p>
      </div>

      {/* Dates & Authority */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <FileText className="w-4 h-4" />
            <span>{regulation.issuingAuthority}</span>
          </div>
          {regulation.dates.effectiveDate && (
            <div className="flex items-center gap-1 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Effective: {formatDate(regulation.dates.effectiveDate)}</span>
            </div>
          )}
        </div>
        {daysUntil && (
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            daysUntil <= 30 ? 'bg-red-100 text-red-700' :
            daysUntil <= 60 ? 'bg-orange-100 text-orange-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            <Clock className="w-3 h-3 inline mr-1" />
            {daysUntil} days until effective
          </span>
        )}
      </div>

      {/* Impact & Compliance */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Impact */}
        <div>
          <h5 className="text-xs font-medium text-gray-500 mb-2">Impact Level</h5>
          <div className="flex items-center gap-2">
            <div
              className="px-2 py-1 text-sm font-medium rounded"
              style={{
                backgroundColor: `${impactConfig?.color}20`,
                color: impactConfig?.color,
              }}
            >
              {impactConfig?.label}
            </div>
            {regulation.impact.financialImpact?.estimatedCost && (
              <span className="text-sm text-gray-600">
                Est. {regulation.impact.financialImpact.currency} {regulation.impact.financialImpact.estimatedCost.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Compliance Status */}
        <div>
          <h5 className="text-xs font-medium text-gray-500 mb-2">Compliance Status</h5>
          <div className="flex items-center gap-2">
            {regulation.compliance.status === 'compliant' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : regulation.compliance.status === 'non_compliant' ? (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            ) : (
              <Clock className="w-5 h-5 text-yellow-600" />
            )}
            <span
              className="text-sm font-medium"
              style={{ color: complianceConfig?.color }}
            >
              {complianceConfig?.label}
            </span>
          </div>
          {regulation.compliance.requirements.length > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              {regulation.compliance.requirements.filter(r => r.complianceStatus === 'compliant').length}/
              {regulation.compliance.requirements.length} requirements met
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {regulation.impact.affectedAreas.slice(0, 3).map((area) => (
            <span
              key={area}
              className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded"
            >
              {AFFECTED_BUSINESS_AREA_LABELS[area] || area}
            </span>
          ))}
          {regulation.impact.affectedAreas.length > 3 && (
            <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
              +{regulation.impact.affectedAreas.length - 3}
            </span>
          )}
        </div>
        {regulation.documents.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-blue-600">
            <FileText className="w-3 h-3" />
            {regulation.documents.length} documents
            <ExternalLink className="w-3 h-3" />
          </div>
        )}
      </div>
    </div>
  );
};

export default RegulationCard;
