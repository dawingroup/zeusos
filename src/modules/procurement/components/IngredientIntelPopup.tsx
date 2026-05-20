/**
 * IngredientIntelPopup
 * Popover showing detailed stock and cost information for a single OPO recipe ingredient.
 * Wraps a trigger element (typically the availability dot) in the ingredient row.
 */

import { Popover, PopoverTrigger, PopoverContent } from '@/core/components/ui/popover';
import type { OPORecipeRow, OPOIngredientAvailability } from '../types/purchaseOrder';

interface Props {
  ingredient: OPORecipeRow;
  currency: string;
  children: React.ReactNode;
}

const AVAILABILITY_LABEL: Record<OPOIngredientAvailability, string> = {
  in_stock: 'In Stock',
  partial: 'Partial',
  not_available: 'Not Available',
  no_recipe: 'No Recipe',
  not_applicable: 'N/A',
};

const AVAILABILITY_COLOR: Record<OPOIngredientAvailability, string> = {
  in_stock: 'bg-green-500',
  partial: 'bg-yellow-500',
  not_available: 'bg-red-500',
  no_recipe: 'bg-gray-300',
  not_applicable: 'bg-gray-200',
};

const AVAILABILITY_TEXT_COLOR: Record<OPOIngredientAvailability, string> = {
  in_stock: 'text-green-700',
  partial: 'text-yellow-700',
  not_available: 'text-red-700',
  no_recipe: 'text-gray-500',
  not_applicable: 'text-gray-400',
};

function fmt(amount: number | undefined, currency: string): string {
  return `${currency} ${(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function IngredientIntelPopup({ ingredient, currency, children }: Props) {
  const r = ingredient;
  const shortfall =
    r.availability !== 'in_stock' && r.availableQuantity != null
      ? Math.max(0, r.totalQuantity - r.availableQuantity)
      : null;

  const costChanged =
    r.unitCostAtSnapshot !== r.currentUnitCost &&
    r.unitCostAtSnapshot > 0 &&
    r.currentUnitCost > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 p-3 text-xs space-y-2.5">
        {/* Header: name + SKU */}
        <div>
          <p className="font-semibold text-sm leading-tight">{r.ingredientName}</p>
          {r.ingredientSku && (
            <p className="text-muted-foreground mt-0.5">SKU: {r.ingredientSku}</p>
          )}
        </div>

        {/* Availability status */}
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${AVAILABILITY_COLOR[r.availability]}`} />
          <span className={`font-medium ${AVAILABILITY_TEXT_COLOR[r.availability]}`}>
            {AVAILABILITY_LABEL[r.availability]}
          </span>
        </div>

        {/* Quantities */}
        <div className="space-y-1 border-t pt-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Required</span>
            <span className="font-medium">{r.totalQuantity} {r.unit}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Available</span>
            <span className="font-medium">
              {r.availableQuantity != null ? `${r.availableQuantity} ${r.unit}` : '--'}
            </span>
          </div>
          {shortfall != null && shortfall > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Shortfall</span>
              <span className="font-medium">{shortfall} {r.unit}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Per unit</span>
            <span>{r.quantityPerUnit} {r.unit}/unit</span>
          </div>
        </div>

        {/* Costs */}
        <div className="space-y-1 border-t pt-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Snapshot cost</span>
            <span>{fmt(r.unitCostAtSnapshot, currency)}/{r.unit}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current cost</span>
            <span className={costChanged ? 'font-semibold text-amber-600' : ''}>
              {fmt(r.currentUnitCost, currency)}/{r.unit}
            </span>
          </div>
          {costChanged && (
            <p className="text-amber-600 text-[10px]">
              Cost changed since snapshot
            </p>
          )}
          <div className="flex justify-between font-medium border-t pt-1 mt-1">
            <span>Total cost</span>
            <span>{fmt(r.totalCost, currency)}</span>
          </div>
        </div>

        {/* Source warehouse */}
        {r.warehouseId && (
          <div className="border-t pt-2 text-muted-foreground">
            Source warehouse: <span className="text-foreground">{r.warehouseId}</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
