/**
 * PartTable — Tabular part list with configurable grouping
 *
 * Groups by category, material, or assembly. Shows dimensions,
 * edge banding, quantities, costs, and processability issues.
 */
import type { ScenePart } from '../../types/assembly.types';
import { validatePartProcessability } from '../../services/partProcessing.service';

interface PartTableProps {
  parts: ScenePart[];
  groupBy?: 'category' | 'material' | 'none';
  showCost?: boolean;
}

export function PartTable({ parts, groupBy = 'none', showCost = true }: PartTableProps) {
  const groups = groupParts(parts, groupBy);

  return (
    <div className="overflow-x-auto">
      {Array.from(groups.entries()).map(([groupName, groupParts]) => (
        <div key={groupName} className="mb-4">
          {groupBy !== 'none' && (
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 capitalize">
              {groupName.replace('_', ' ')}
            </h4>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-1 pr-2">Code</th>
                <th className="py-1 pr-2">Part</th>
                <th className="py-1 pr-2">Material</th>
                <th className="py-1 pr-2 text-right">L</th>
                <th className="py-1 pr-2 text-right">W</th>
                <th className="py-1 pr-2 text-right">T</th>
                <th className="py-1 pr-2 text-right">Qty</th>
                {showCost && <th className="py-1 text-right">Cost</th>}
                <th className="py-1 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {groupParts.map(part => {
                const { processable, issues } = validatePartProcessability(part);
                return (
                  <tr key={part.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1 pr-2 font-mono text-gray-400">{part.partCode}</td>
                    <td className="py-1 pr-2 truncate max-w-[150px]">{part.partName}</td>
                    <td className="py-1 pr-2 truncate max-w-[120px] text-gray-500">{part.materialDescription}</td>
                    <td className="py-1 pr-2 text-right font-mono">{part.dimensions?.length ?? '—'}</td>
                    <td className="py-1 pr-2 text-right font-mono">{part.dimensions?.width ?? '—'}</td>
                    <td className="py-1 pr-2 text-right font-mono">{part.dimensions?.thickness ?? '—'}</td>
                    <td className="py-1 pr-2 text-right">{part.quantity}</td>
                    {showCost && (
                      <td className="py-1 text-right">
                        {part.totalCost > 0 ? part.totalCost.toLocaleString() : '—'}
                      </td>
                    )}
                    <td className="py-1">
                      {!processable && (
                        <span
                          className="inline-block w-4 h-4 text-amber-500 cursor-help"
                          title={issues.join('\n')}
                        >
                          !
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function groupParts(parts: ScenePart[], groupBy: string): Map<string, ScenePart[]> {
  if (groupBy === 'none') return new Map([['all', parts]]);

  const groups = new Map<string, ScenePart[]>();
  for (const part of parts) {
    const key = groupBy === 'category' ? part.partCategory : part.materialDescription;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(part);
  }
  return groups;
}
