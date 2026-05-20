/**
 * Inline Recommendations Component
 * Compact, contextual recommendation display for use throughout the app
 * Shows relevant products, parts, inspirations, and features based on context
 */

import { useState } from 'react';
import { 
  Sparkles, 
  Package, 
  Wrench, 
  Image, 
  Layers,
  ChevronRight,
  Plus,
  X,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';
import type { RecommendationItem, ContextualRecommendations, RecommendationType } from '../../services/recommendationService';

interface InlineRecommendationsProps {
  recommendations: ContextualRecommendations;
  isLoading?: boolean;
  showTypes?: RecommendationType[];
  onSelect?: (item: RecommendationItem) => void;
  onDismiss?: (item: RecommendationItem) => void;
  compact?: boolean;
  title?: string;
  maxVisible?: number;
}

const TYPE_CONFIG: Record<RecommendationType, { 
  icon: typeof Package; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  product: { 
    icon: Package, 
    label: 'Product', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  part: { 
    icon: Wrench, 
    label: 'Part', 
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  inspiration: { 
    icon: Image, 
    label: 'Inspiration', 
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 border-pink-200',
  },
  feature: { 
    icon: Layers, 
    label: 'Feature', 
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
  },
};

export function InlineRecommendations({
  recommendations,
  isLoading = false,
  showTypes = ['product', 'part', 'inspiration', 'feature'],
  onSelect,
  onDismiss,
  compact = false,
  title = 'Recommendations',
  maxVisible = 3,
}: InlineRecommendationsProps) {
  const [expandedType, setExpandedType] = useState<RecommendationType | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Combine all recommendations
  const allItems: RecommendationItem[] = [];
  if (showTypes.includes('product')) allItems.push(...recommendations.products);
  if (showTypes.includes('part')) allItems.push(...recommendations.parts);
  if (showTypes.includes('inspiration')) allItems.push(...recommendations.inspirations);
  if (showTypes.includes('feature')) allItems.push(...recommendations.features);

  // Filter dismissed items
  const visibleItems = allItems
    .filter(item => !dismissed.has(item.id))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const handleDismiss = (item: RecommendationItem) => {
    setDismissed(prev => new Set([...prev, item.id]));
    onDismiss?.(item);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg animate-pulse">
        <Sparkles className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-400">Finding recommendations...</span>
      </div>
    );
  }

  if (visibleItems.length === 0) {
    return null;
  }

  // Compact view - single line with overflow
  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
        <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        {visibleItems.slice(0, maxVisible).map(item => {
          const config = TYPE_CONFIG[item.type];
          const Icon = config.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSelect?.(item)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-colors hover:opacity-80 flex-shrink-0 ${config.bgColor}`}
            >
              <Icon className={`w-3 h-3 ${config.color}`} />
              <span className="truncate max-w-[120px]">{item.name}</span>
            </button>
          );
        })}
        {visibleItems.length > maxVisible && (
          <span className="text-xs text-gray-400 flex-shrink-0">
            +{visibleItems.length - maxVisible} more
          </span>
        )}
      </div>
    );
  }

  // Full view - grouped by type
  const groupedItems = {
    products: recommendations.products.filter(i => !dismissed.has(i.id)),
    parts: recommendations.parts.filter(i => !dismissed.has(i.id)),
    inspirations: recommendations.inspirations.filter(i => !dismissed.has(i.id)),
    features: recommendations.features.filter(i => !dismissed.has(i.id)),
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <span className="text-xs text-gray-400">({visibleItems.length})</span>
      </div>

      {/* Grouped Sections */}
      {showTypes.includes('product') && groupedItems.products.length > 0 && (
        <RecommendationGroup
          type="product"
          items={groupedItems.products}
          maxVisible={maxVisible}
          expanded={expandedType === 'product'}
          onToggleExpand={() => setExpandedType(expandedType === 'product' ? null : 'product')}
          onSelect={onSelect}
          onDismiss={handleDismiss}
        />
      )}

      {showTypes.includes('part') && groupedItems.parts.length > 0 && (
        <RecommendationGroup
          type="part"
          items={groupedItems.parts}
          maxVisible={maxVisible}
          expanded={expandedType === 'part'}
          onToggleExpand={() => setExpandedType(expandedType === 'part' ? null : 'part')}
          onSelect={onSelect}
          onDismiss={handleDismiss}
        />
      )}

      {showTypes.includes('inspiration') && groupedItems.inspirations.length > 0 && (
        <RecommendationGroup
          type="inspiration"
          items={groupedItems.inspirations}
          maxVisible={maxVisible}
          expanded={expandedType === 'inspiration'}
          onToggleExpand={() => setExpandedType(expandedType === 'inspiration' ? null : 'inspiration')}
          onSelect={onSelect}
          onDismiss={handleDismiss}
        />
      )}

      {showTypes.includes('feature') && groupedItems.features.length > 0 && (
        <RecommendationGroup
          type="feature"
          items={groupedItems.features}
          maxVisible={maxVisible}
          expanded={expandedType === 'feature'}
          onToggleExpand={() => setExpandedType(expandedType === 'feature' ? null : 'feature')}
          onSelect={onSelect}
          onDismiss={handleDismiss}
        />
      )}

      {/* Suggested Actions */}
      {recommendations.suggestedActions && recommendations.suggestedActions.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <Lightbulb className="w-3 h-3" />
            <span>Suggestions</span>
          </div>
          <div className="space-y-1">
            {recommendations.suggestedActions.slice(0, 3).map((action, i) => (
              <p key={i} className="text-xs text-gray-600 pl-4">• {action}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Recommendation Group Component
interface RecommendationGroupProps {
  type: RecommendationType;
  items: RecommendationItem[];
  maxVisible: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelect?: (item: RecommendationItem) => void;
  onDismiss?: (item: RecommendationItem) => void;
}

function RecommendationGroup({
  type,
  items,
  maxVisible,
  expanded,
  onToggleExpand,
  onSelect,
  onDismiss,
}: RecommendationGroupProps) {
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;
  const visibleItems = expanded ? items : items.slice(0, maxVisible);
  const hasMore = items.length > maxVisible;

  return (
    <div className={`rounded-lg border p-3 ${config.bgColor}`}>
      {/* Group Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}s ({items.length})
          </span>
        </div>
        {hasMore && (
          <button
            onClick={onToggleExpand}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-0.5"
          >
            {expanded ? 'Show less' : `+${items.length - maxVisible} more`}
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {visibleItems.map(item => (
          <RecommendationCard
            key={item.id}
            item={item}
            onSelect={onSelect}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}

// Individual Recommendation Card
interface RecommendationCardProps {
  item: RecommendationItem;
  onSelect?: (item: RecommendationItem) => void;
  onDismiss?: (item: RecommendationItem) => void;
}

function RecommendationCard({ item, onSelect, onDismiss }: RecommendationCardProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-md border border-gray-100 group">
      {/* Image Thumbnail */}
      {item.imageUrl ? (
        <img 
          src={item.imageUrl} 
          alt={item.name}
          className="w-10 h-10 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
          {(() => {
            const config = TYPE_CONFIG[item.type];
            if (!config) return null;
            const IconComponent = config.icon;
            return <IconComponent className="w-4 h-4 text-gray-400" />;
          })()}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 truncate">{item.matchReason}</span>
          <span className="text-xs text-green-600 font-medium">{item.relevanceScore}%</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSelect && (
          <button
            onClick={() => onSelect(item)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Add"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        )}
        {typeof item.metadata?.sourceUrl === 'string' && (
          <a
            href={item.metadata.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-gray-100 rounded"
            title="View source"
          >
            <ExternalLink className="w-4 h-4 text-gray-600" />
          </a>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(item)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Dismiss"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// Floating Recommendation Badge (for minimal inline hints)
interface RecommendationBadgeProps {
  count: number;
  onClick: () => void;
  type?: RecommendationType;
}

export function RecommendationBadge({ count, onClick, type }: RecommendationBadgeProps) {
  if (count === 0) return null;

  const Icon = type ? TYPE_CONFIG[type].icon : Sparkles;
  const color = type ? TYPE_CONFIG[type].color : 'text-indigo-600';

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
    >
      <Icon className={`w-3 h-3 ${color}`} />
      <span>{count} suggestion{count !== 1 ? 's' : ''}</span>
    </button>
  );
}
