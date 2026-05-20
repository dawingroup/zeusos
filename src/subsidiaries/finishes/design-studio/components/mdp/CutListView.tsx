/**
 * CutListView — Panel cut list with dimensions, grain, and edge banding
 */
import type { CutListEntry } from '../../types/mdp.types';

interface CutListViewProps {
  cutList: CutListEntry[];
}

export function CutListView({ cutList }: CutListViewProps) {
  if (cutList.length === 0) {
    return <p className="text-sm text-gray-500">No cut list data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-3">Part</th>
            <th className="py-2 pr-3">Material</th>
            <th className="py-2 pr-3">L x W x T</th>
            <th className="py-2 pr-3">Qty</th>
            <th className="py-2 pr-3">Grain</th>
            <th className="py-2 pr-3">Edges</th>
          </tr>
        </thead>
        <tbody>
          {cutList.map((entry, idx) => (
            <tr key={`${entry.partName}-${idx}`} className="border-b">
              <td className="py-2 pr-3">{entry.partName}</td>
              <td className="py-2 pr-3">{entry.material}</td>
              <td className="py-2 pr-3">
                {entry.length} x {entry.width} x {entry.thickness}
              </td>
              <td className="py-2 pr-3">{entry.quantity}</td>
              <td className="py-2 pr-3 capitalize">{entry.grainDirection}</td>
              <td className="py-2 pr-3 text-xs">
                {['top', 'bottom', 'left', 'right']
                  .filter(e => entry.edgeBanding[e as keyof typeof entry.edgeBanding])
                  .join(', ') || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
