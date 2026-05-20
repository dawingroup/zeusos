/**
 * FinishSelector — Swatch grid grouped by finish group with stock badges
 */
import { StockBadge } from './StockBadge';
import type { StockStatus } from '../../types/constraintEngine.types';

interface FinishOption {
  id: string;
  name: string;
  hexColor?: string;
  category: string;
  thumbnailUrl?: string;
}

interface FinishSelectorProps {
  validFinishes: FinishOption[];
  finishGroupLabels: Record<string, string>;
  selections: Record<string, string>;
  onSelect: (group: string, finishId: string) => void;
  stockIndicators?: Record<string, StockStatus>;
}

export function FinishSelector({
  validFinishes,
  finishGroupLabels,
  selections,
  onSelect,
  stockIndicators = {},
}: FinishSelectorProps) {
  // Group finishes by category
  const groups = new Map<string, FinishOption[]>();
  for (const finish of validFinishes) {
    const group = finish.category;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(finish);
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([groupKey, finishes]) => (
        <div key={groupKey}>
          <h4 className="text-sm font-medium mb-2">
            {finishGroupLabels[groupKey] || groupKey}
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {finishes.map(finish => {
              const isSelected = selections[groupKey] === finish.id;
              const stock = stockIndicators[finish.id];

              return (
                <button
                  key={finish.id}
                  type="button"
                  onClick={() => onSelect(groupKey, finish.id)}
                  className={`relative rounded-lg p-1 border-2 transition-all ${
                    isSelected
                      ? 'border-blue-600 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  title={finish.name}
                >
                  {finish.thumbnailUrl ? (
                    <img
                      src={finish.thumbnailUrl}
                      alt={finish.name}
                      className="w-full h-12 rounded object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-12 rounded"
                      style={{ backgroundColor: finish.hexColor || '#e5e7eb' }}
                    />
                  )}
                  <p className="text-xs mt-1 truncate">{finish.name}</p>
                  {stock && <StockBadge status={stock} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
