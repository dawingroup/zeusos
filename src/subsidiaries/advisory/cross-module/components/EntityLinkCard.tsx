import React from 'react';
import { Link2, X, ChevronRight } from 'lucide-react';
import { EntityLink, ModuleType, LinkStrength } from '../types/cross-module';

interface EntityLinkCardProps {
  link: EntityLink;
  onRemove?: (linkId: string) => void;
  onClick?: (link: EntityLink) => void;
  compact?: boolean;
}

const MODULE_COLORS: Record<ModuleType, string> = {
  infrastructure: 'bg-blue-100 text-blue-700 border-blue-200',
  investment: 'bg-green-100 text-green-700 border-green-200',
  advisory: 'bg-purple-100 text-purple-700 border-purple-200',
  matflow: 'bg-orange-100 text-orange-700 border-orange-200'
};

const MODULE_ICONS: Record<ModuleType, string> = {
  infrastructure: '🏗️',
  investment: '💰',
  advisory: '📋',
  matflow: '📦'
};

const STRENGTH_STYLES: Record<LinkStrength, string> = {
  strong: 'border-l-4 border-l-green-500',
  medium: 'border-l-4 border-l-yellow-500',
  weak: 'border-l-4 border-l-gray-400'
};

const LINK_TYPE_LABELS: Record<string, string> = {
  belongs_to: 'Belongs to',
  funded_by: 'Funded by',
  funds: 'Funds',
  related_to: 'Related to',
  includes: 'Includes',
  part_of: 'Part of',
  supplies: 'Supplies',
  delivered_to: 'Delivered to'
};

export const EntityLinkCard: React.FC<EntityLinkCardProps> = ({
  link,
  onRemove,
  onClick,
  compact = false
}) => {
  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-sm ${
          MODULE_COLORS[link.targetEntity.module]
        } cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={() => onClick?.(link)}
      >
        <span>{MODULE_ICONS[link.targetEntity.module]}</span>
        <span className="truncate max-w-[120px]">{link.targetEntity.name}</span>
        {onRemove && (
          <button
            onClick={e => {
              e.stopPropagation();
              onRemove(link.id);
            }}
            className="ml-1 hover:bg-white/30 rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${
        STRENGTH_STYLES[link.strength]
      }`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
            <Link2 className="w-3 h-3" />
            {LINK_TYPE_LABELS[link.linkType] || link.linkType}
          </span>
          {onRemove && (
            <button
              onClick={() => onRemove(link.id)}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div
          className="flex items-start gap-3 cursor-pointer group"
          onClick={() => onClick?.(link)}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
              MODULE_COLORS[link.targetEntity.module]
            }`}
          >
            {MODULE_ICONS[link.targetEntity.module]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 group-hover:text-blue-600 truncate">
              {link.targetEntity.name}
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <span className="capitalize">
                {link.targetEntity.type.replace('_', ' ')}
              </span>
              {link.targetEntity.referenceNumber && (
                <>
                  <span>•</span>
                  <span className="font-mono text-xs">
                    {link.targetEntity.referenceNumber}
                  </span>
                </>
              )}
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 mt-2" />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span className="capitalize">Strength: {link.strength}</span>
          {link.bidirectional && (
            <span className="flex items-center gap-1">
              <span>↔</span> Bidirectional
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntityLinkCard;
