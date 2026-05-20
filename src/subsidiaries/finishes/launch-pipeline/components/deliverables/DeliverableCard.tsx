/**
 * Deliverable Card Component
 * Displays a single deliverable with preview and actions
 */

import React from 'react';
import {
  FileText,
  Image,
  File,
  Download,
  ExternalLink,
  Trash2,
  Eye,
  Clock,
} from 'lucide-react';
import type { ProductDeliverable } from '../../types/product.types';
import type { DeliverableType } from '../../types/stage.types';
import { formatTimestamp, formatFileSize, formatDeliverableType } from '../../utils/formatting';

interface DeliverableCardProps {
  deliverable: ProductDeliverable;
  onView?: (deliverable: ProductDeliverable) => void;
  onDownload?: (deliverable: ProductDeliverable) => void;
  onDelete?: (deliverable: ProductDeliverable) => void;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
  return File;
};

const getDeliverableColor = (type: DeliverableType): string => {
  const colorMap: Partial<Record<DeliverableType, string>> = {
    concept_brief: 'bg-purple-50 border-purple-200',
    market_positioning: 'bg-blue-50 border-blue-200',
    competitor_analysis: 'bg-indigo-50 border-indigo-200',
    pricing_strategy: 'bg-emerald-50 border-emerald-200',
    cad_files: 'bg-cyan-50 border-cyan-200',
    technical_drawings: 'bg-teal-50 border-teal-200',
    hero_images: 'bg-red-50 border-red-200',
    detail_shots: 'bg-orange-50 border-orange-200',
    lifestyle_photos: 'bg-pink-50 border-pink-200',
    product_description: 'bg-green-50 border-green-200',
    seo_metadata: 'bg-lime-50 border-lime-200',
  };
  return colorMap[type] || 'bg-gray-50 border-gray-200';
};

export const DeliverableCard: React.FC<DeliverableCardProps> = ({
  deliverable,
  onView,
  onDownload,
  onDelete,
  showActions = true,
  compact = false,
  className = '',
}) => {
  const FileIcon = getFileIcon(deliverable.mimeType);
  const isImage = deliverable.mimeType?.startsWith('image/');

  if (compact) {
    return (
      <div
        className={`
          flex items-center gap-3 p-2 rounded-lg border
          ${getDeliverableColor(deliverable.type)}
          hover:shadow-sm transition-shadow
          ${className}
        `.trim()}
      >
        {isImage && deliverable.url ? (
          <img
            src={deliverable.url}
            alt={deliverable.name}
            className="w-10 h-10 object-cover rounded"
          />
        ) : (
          <div className="w-10 h-10 flex items-center justify-center bg-white rounded">
            <FileIcon className="w-5 h-5 text-gray-500" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {deliverable.name}
          </p>
          <p className="text-xs text-gray-500">
            {formatDeliverableType(deliverable.type)}
          </p>
        </div>

        {showActions && (
          <div className="flex items-center gap-1">
            {onView && (
              <button
                onClick={() => onView(deliverable)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                title="View"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            {onDownload && (
              <button
                onClick={() => onDownload(deliverable)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-lg border overflow-hidden
        ${getDeliverableColor(deliverable.type)}
        hover:shadow-md transition-shadow
        ${className}
      `.trim()}
    >
      {/* Preview area */}
      <div className="aspect-video relative bg-white flex items-center justify-center">
        {isImage && deliverable.url ? (
          <img
            src={deliverable.url}
            alt={deliverable.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <FileIcon className="w-12 h-12 text-gray-400" />
        )}

        {/* Type badge */}
        <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium bg-white/90 rounded">
          {formatDeliverableType(deliverable.type)}
        </span>
      </div>

      {/* Info section */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
          {deliverable.name}
        </h4>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {deliverable.size && (
            <span>{formatFileSize(deliverable.size)}</span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTimestamp(deliverable.uploadedAt)}
          </span>
        </div>

        {/* Alt text if present */}
        {deliverable.metadata?.altText && (
          <p className="mt-2 text-xs text-gray-600 italic line-clamp-2">
            Alt: {deliverable.metadata.altText}
          </p>
        )}

        {/* Actions */}
        {showActions && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {onView && (
                <button
                  onClick={() => onView(deliverable)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  <Eye className="w-3 h-3" />
                  View
                </button>
              )}
              {deliverable.url && (
                <a
                  href={deliverable.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </a>
              )}
              {onDownload && (
                <button
                  onClick={() => onDownload(deliverable)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  <Download className="w-3 h-3" />
                </button>
              )}
            </div>

            {onDelete && (
              <button
                onClick={() => onDelete(deliverable)}
                className="p-1 text-red-400 hover:text-red-600 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliverableCard;
