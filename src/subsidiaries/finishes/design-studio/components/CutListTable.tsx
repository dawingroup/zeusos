/**
 * CutListTable — Bidirectional cut list display with click-to-highlight
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';
import type { CutListEntry, MeshCutListLink, PartTreeNode } from '../types/workshop-viewer.types';

interface CutListTableProps {
  entries: CutListEntry[];
  meshLinks: MeshCutListLink[];
  partTree: PartTreeNode[];
  selectedPartId: string | null;
  onRowClick: (meshName: string) => void;
}

export default function CutListTable({
  entries,
  meshLinks,
  selectedPartId,
  onRowClick,
}: CutListTableProps) {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground text-center">
        Load a CSV cut list to see part data
      </div>
    );
  }

  // Build reverse map: cutListIndex → meshObjectName
  const cutToMesh = new Map<number, string>();
  for (const link of meshLinks) {
    if (link.cutListIndex >= 0) {
      cutToMesh.set(link.cutListIndex, link.meshObjectName);
    }
  }

  // Group by cabinet
  const grouped = new Map<string, { entry: CutListEntry; index: number }[]>();
  entries.forEach((entry, index) => {
    const key = entry.cabinet || 'Ungrouped';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ entry, index });
  });

  return (
    <>
      <div className="hidden sm:block overflow-auto text-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-900">
              <TableHead className="text-white font-bold text-[10px] w-[28%]">Part</TableHead>
              <TableHead className="text-white font-bold text-[10px] w-[18%]">Material</TableHead>
              <TableHead className="text-white font-bold text-[10px] w-[5%] text-right">T</TableHead>
              <TableHead className="text-white font-bold text-[10px] w-[5%] text-right">Qty</TableHead>
              <TableHead className="text-white font-bold text-[10px] w-[10%] text-right">Length</TableHead>
              <TableHead className="text-white font-bold text-[10px] w-[10%] text-right">Width</TableHead>
              <TableHead className="text-white font-bold text-[10px] w-[6%] text-center">L1</TableHead>
              <TableHead className="text-white font-bold text-[10px] w-[6%] text-center">L2</TableHead>
              <TableHead className="text-white font-bold text-[10px] w-[6%] text-center">W1</TableHead>
              <TableHead className="text-white font-bold text-[10px] w-[6%] text-center">W2</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...grouped.entries()].flatMap(([cabinet, items]) => {
              const rows = items.map(({ entry, index }) => {
                const linkedMesh = cutToMesh.get(index);
                const isHighlighted = linkedMesh && selectedPartId
                  ? meshLinks.some(l => l.meshObjectName === linkedMesh && l.cutListIndex === index)
                  : false;

                return (
                  <TableRow
                    key={`row-${cabinet}-${index}`}
                    className={`cursor-pointer hover:bg-muted ${
                      isHighlighted ? 'bg-primary/5' : index % 2 === 0 ? 'bg-background' : 'bg-muted/50'
                    }`}
                    onClick={() => linkedMesh && onRowClick(linkedMesh)}
                  >
                    <TableCell className="font-medium text-slate-900 text-[10px] py-1">
                      {entry.partName}
                      {!linkedMesh && (
                        <span className="ml-1 text-red-400" title="No 3D model match">!</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[10px] py-1">{entry.material}</TableCell>
                    <TableCell className="text-right text-[10px] py-1">{entry.thickness}</TableCell>
                    <TableCell className="text-right font-bold text-[#C8962E] text-[10px] py-1">{entry.qty}</TableCell>
                    <TableCell className="text-right text-[10px] py-1">{entry.length}</TableCell>
                    <TableCell className="text-right text-[10px] py-1">{entry.width}</TableCell>
                    <TableCell className="text-center text-[10px] py-1">
                      <EdgeDot active={entry.edgeBanding.L1} />
                    </TableCell>
                    <TableCell className="text-center text-[10px] py-1">
                      <EdgeDot active={entry.edgeBanding.L2} />
                    </TableCell>
                    <TableCell className="text-center text-[10px] py-1">
                      <EdgeDot active={entry.edgeBanding.W1} />
                    </TableCell>
                    <TableCell className="text-center text-[10px] py-1">
                      <EdgeDot active={entry.edgeBanding.W2} />
                    </TableCell>
                  </TableRow>
                );
              });
              if (grouped.size <= 1) return rows;
              return [
                <TableRow key={`cab-${cabinet}`}>
                  <TableCell
                    colSpan={10}
                    className="bg-muted font-semibold text-muted-foreground text-[10px] py-1"
                  >
                    {cabinet}
                  </TableCell>
                </TableRow>,
                ...rows,
              ];
            })}
          </TableBody>
        </Table>
      </div>

      <div className="sm:hidden space-y-2 p-2 overflow-y-auto">
        {[...grouped.entries()].map(([cabinet, items]) => (
          <div key={cabinet} className="space-y-2">
            {grouped.size > 1 && (
              <div className="text-[10px] font-semibold text-muted-foreground px-1">{cabinet}</div>
            )}
            {items.map(({ entry, index }) => {
              const linkedMesh = cutToMesh.get(index);
              return (
                <button
                  type="button"
                  key={index}
                  onClick={() => linkedMesh && onRowClick(linkedMesh)}
                  className="w-full rounded-md border border-border bg-background p-2 text-left"
                >
                  <div className="text-xs font-medium">{entry.partName}</div>
                  <div className="text-[10px] text-muted-foreground">{entry.material}</div>
                  <div className="mt-1 grid grid-cols-4 gap-1 text-[10px]">
                    <span>T {entry.thickness}</span>
                    <span>Qty {entry.qty}</span>
                    <span>L {entry.length}</span>
                    <span>W {entry.width}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Edges: L1 {entry.edgeBanding.L1 ? '●' : '—'} · L2 {entry.edgeBanding.L2 ? '●' : '—'} · W1 {entry.edgeBanding.W1 ? '●' : '—'} · W2 {entry.edgeBanding.W2 ? '●' : '—'}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

function EdgeDot({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
  ) : (
    <span className="inline-block text-muted-foreground/50">—</span>
  );
}
