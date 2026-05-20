/**
 * ShortageAlertPanel — Shortage alerts with "Create PO" action
 */
import type { ShortageAlert } from '../../types/mdp.types';

interface ShortageAlertPanelProps {
  shortages: ShortageAlert[];
  onCreatePO?: (shortages: ShortageAlert[]) => void;
}

export function ShortageAlertPanel({ shortages, onCreatePO }: ShortageAlertPanelProps) {
  if (shortages.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-800 mb-2">
        Material Shortages ({shortages.length})
      </h3>
      <div className="space-y-2">
        {shortages.map(shortage => (
          <div key={shortage.inventoryItemId} className="flex justify-between items-center text-sm">
            <div>
              <span className="font-medium">{shortage.itemName}</span>
              <span className="text-amber-700 ml-2">
                Need {shortage.requiredQuantity}, have {shortage.availableQuantity} (short {shortage.shortfall})
              </span>
            </div>
            {shortage.estimatedRestockDays != null && (
              <span className="text-xs text-amber-600">~{shortage.estimatedRestockDays} days</span>
            )}
          </div>
        ))}
      </div>
      {onCreatePO && (
        <button
          type="button"
          onClick={() => onCreatePO(shortages)}
          className="mt-3 px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700"
        >
          Create Purchase Order
        </button>
      )}
    </div>
  );
}
