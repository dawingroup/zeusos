/**
 * FurnitureTypeSelector — Compact grid of furniture type cards
 *
 * Shown in the PartRecognitionPanel before clicking "Recognize Parts".
 * User selects the item type so the AI gets type-specific context.
 */

import { useState, useEffect } from 'react';
import { Settings2 } from 'lucide-react';
import { getFurnitureTypes } from '../services/furnitureTypeService';
import type { FurnitureType, FurnitureCategory } from '../types/furniture-type.types';

interface FurnitureTypeSelectorProps {
  selectedTypeId: string | null;
  onSelect: (typeId: string | null) => void;
  onOpenAdmin?: () => void;
}

const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  cabinet: 'Cabinets',
  bed: 'Beds',
  chair: 'Seating',
  table: 'Tables',
  storage: 'Storage',
  desk: 'Desks',
  other: 'Other',
};

const CATEGORY_ORDER: FurnitureCategory[] = ['cabinet', 'storage', 'bed', 'desk', 'table', 'chair', 'other'];

export default function FurnitureTypeSelector({
  selectedTypeId,
  onSelect,
  onOpenAdmin,
}: FurnitureTypeSelectorProps) {
  const [types, setTypes] = useState<FurnitureType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFurnitureTypes()
      .then(setTypes)
      .catch(() => setTypes([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading types...</div>;
  }

  if (types.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No furniture types configured. Ask an admin to seed the knowledge base.
      </div>
    );
  }

  // Group by category
  const grouped = new Map<FurnitureCategory, FurnitureType[]>();
  for (const t of types) {
    const cat = t.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(t);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Select item type
        </span>
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="text-muted-foreground hover:text-foreground"
            title="Manage types"
          >
            <Settings2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {CATEGORY_ORDER.map(cat => {
        const catTypes = grouped.get(cat);
        if (!catTypes || catTypes.length === 0) return null;

        return (
          <div key={cat}>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
              {CATEGORY_LABELS[cat]}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {catTypes.map(t => {
                const isSelected = selectedTypeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelect(isSelected ? null : t.id)}
                    className={`
                      px-2 py-1.5 rounded-md text-left text-[11px] leading-tight
                      border transition-colors
                      ${isSelected
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border bg-background hover:bg-muted text-foreground'
                      }
                    `}
                    title={t.description}
                  >
                    <div className="truncate">{t.name}</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {t.expectedParts.length} parts
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
