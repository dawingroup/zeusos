/**
 * DesignOptionCard Component
 * Display card for a design option showing inspirations, status, and actions
 */

import {
  Star,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit2,
  Send,
  Archive,
  Sparkles,
  Image,
} from 'lucide-react';
import type { DesignOption, DesignOptionStatus, DesignOptionCategory } from '../../types/designOptions';

interface DesignOptionCardProps {
  option: DesignOption;
  onEdit?: (option: DesignOption) => void;
  onSubmit?: (option: DesignOption) => void;
  onArchive?: (option: DesignOption) => void;
  onClick?: (option: DesignOption) => void;
}

const STATUS_CONFIG: Record<
  DesignOptionStatus,
  { label: string; icon: typeof Clock; color: string; bgColor: string }
> = {
  draft: { label: 'Draft', icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  submitted: { label: 'Submitted', icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  revision: { label: 'Revision', icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  superseded: { label: 'Superseded', icon: Archive, color: 'text-gray-500', bgColor: 'bg-gray-100' },
};

const CATEGORY_CONFIG: Record<DesignOptionCategory, { label: string; color: string }> = {
  material: { label: 'Material', color: 'bg-blue-100 text-blue-700' },
  finish: { label: 'Finish', color: 'bg-purple-100 text-purple-700' },
  style: { label: 'Style', color: 'bg-pink-100 text-pink-700' },
  layout: { label: 'Layout', color: 'bg-green-100 text-green-700' },
  feature: { label: 'Feature', color: 'bg-orange-100 text-orange-700' },
  hardware: { label: 'Hardware', color: 'bg-gray-100 text-gray-700' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-600' },
};

export function DesignOptionCard({
  option,
  onEdit,
  onSubmit,
  onArchive,
  onClick,
}: DesignOptionCardProps) {
  const statusConfig = STATUS_CONFIG[option.status];
  const StatusIcon = statusConfig.icon;
  const categoryConfig = CATEGORY_CONFIG[option.category];

  const formatCurrency = (amount: number, currency: string = 'UGX') => {
    return new Intl.NumberFormat('en-UG', {
      style: 'decimal',
      minimumFractionDigits: 0,
    }).format(amount) + ' ' + currency;
  };

  const canEdit = option.status === 'draft' || option.status === 'revision';
  const canSubmit = option.status === 'draft' || option.status === 'revision';

  return (
    <div
      onClick={() => onClick?.(option)}
      className={`group bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Inspiration Images */}
      <div className="relative aspect-[16/10] bg-gray-100">
        {option.inspirations.length > 0 ? (
          <div className="w-full h-full grid grid-cols-2 gap-0.5">
            {option.inspirations.slice(0, 4).map((insp, idx) => (
              <div
                key={insp.id}
                className={`bg-gray-200 overflow-hidden ${
                  option.inspirations.length === 1 ? 'col-span-2 row-span-2' :
                  option.inspirations.length === 2 ? 'row-span-2' :
                  option.inspirations.length === 3 && idx === 0 ? 'row-span-2' : ''
                }`}
              >
                <img
                  src={insp.thumbnailUrl || insp.imageUrl}
                  alt={insp.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-10 h-10 text-gray-300" />
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {/* Category badge */}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryConfig.color}`}>
            {categoryConfig.label}
          </span>
          {/* Recommended badge */}
          {option.isRecommended && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-500" />
              Recommended
            </span>
          )}
        </div>

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${statusConfig.bgColor} ${statusConfig.color}`}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </span>
        </div>

        {/* More images indicator */}
        {option.inspirations.length > 4 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-xs text-white">
            +{option.inspirations.length - 4} more
          </div>
        )}

        {/* AI analyzed indicator */}
        {option.inspirations.some((i) => i.aiAnalysis) && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-purple-500/90 rounded text-xs text-white flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 line-clamp-1">{option.name}</h3>

        {option.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{option.description}</p>
        )}

        {/* Cost */}
        {option.estimatedCost && (
          <div className="mt-2 text-sm font-medium text-gray-900">
            {formatCurrency(option.estimatedCost, option.currency)}
          </div>
        )}

        {/* Client response */}
        {option.clientResponse && (
          <div className="mt-3 p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">
              Client: {option.clientResponse.status}
              {option.clientResponse.respondedBy && ` by ${option.clientResponse.respondedBy}`}
            </p>
            {option.clientResponse.notes && (
              <p className="text-xs text-gray-600 mt-1">{option.clientResponse.notes}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {canEdit && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(option);
                }}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canSubmit && onSubmit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSubmit(option);
                }}
                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                title="Submit for Approval"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>

          {onArchive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive(option);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DesignOptionCard;
