/**
 * BOMTable — BOM table with stock badges, grouped by category
 */
import { StockBadge } from '../configurator/StockBadge';
import type { ComputedBOMLine, StockStatus } from '../../types/constraintEngine.types';

interface BOMTableProps {
  bom: ComputedBOMLine[];
  stockAvailability?: Record<string, StockStatus>;
}

export function BOMTable({ bom, stockAvailability = {} }: BOMTableProps) {
  if (bom.length === 0) {
    return <p className="text-sm text-gray-500">No BOM data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-4">Material</th>
            <th className="py-2 pr-4">Qty</th>
            <th className="py-2 pr-4">Unit</th>
            <th className="py-2 pr-4">Wastage</th>
            <th className="py-2 pr-4">Stock</th>
          </tr>
        </thead>
        <tbody>
          {bom.map((line, idx) => (
            <tr key={`${line.bomTemplateLineKey}-${idx}`} className="border-b">
              <td className="py-2 pr-4">{line.description}</td>
              <td className="py-2 pr-4">{line.quantity.toFixed(2)}</td>
              <td className="py-2 pr-4">{line.unit}</td>
              <td className="py-2 pr-4">{line.wastageApplied}%</td>
              <td className="py-2 pr-4">
                {stockAvailability[line.bomTemplateLineKey] && (
                  <StockBadge status={stockAvailability[line.bomTemplateLineKey]} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
