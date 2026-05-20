/**
 * PartDetailDialog — Edit individual part properties
 *
 * Dimensions, edge banding rules, material override, notes.
 * For panels, shows live edge banding overlay.
 */
import { useState, useCallback } from 'react';
import type { ScenePart } from '../../types/assembly.types';

interface PartDetailDialogProps {
  part: ScenePart;
  onSave: (updated: Partial<ScenePart>) => void;
  onClose: () => void;
}

export function PartDetailDialog({ part, onSave, onClose }: PartDetailDialogProps) {
  const [length, setLength] = useState(part.dimensions?.length ?? 0);
  const [width, setWidth] = useState(part.dimensions?.width ?? 0);
  const [thickness, setThickness] = useState(part.dimensions?.thickness ?? 0);
  const [grainDirection, setGrainDirection] = useState(part.dimensions?.grainDirection ?? 'none');
  const [quantity, setQuantity] = useState(part.quantity);
  const [material, setMaterial] = useState(part.materialDescription);
  const [notes, setNotes] = useState(part.notes ?? '');

  const [edgeTop, setEdgeTop] = useState(part.edgeBanding?.top?.type ?? '');
  const [edgeBottom, setEdgeBottom] = useState(part.edgeBanding?.bottom?.type ?? '');
  const [edgeLeft, setEdgeLeft] = useState(part.edgeBanding?.left?.type ?? '');
  const [edgeRight, setEdgeRight] = useState(part.edgeBanding?.right?.type ?? '');
  const [edgeFront, setEdgeFront] = useState(part.edgeBanding?.front?.type ?? '');

  const handleSave = useCallback(() => {
    const updated: Partial<ScenePart> = {
      quantity,
      materialDescription: material,
      notes,
    };

    if (part.partCategory === 'panel') {
      updated.dimensions = {
        length,
        width,
        thickness,
        grainDirection: grainDirection as 'length' | 'width' | 'none',
      };
      updated.edgeBanding = {
        top: edgeTop ? { type: edgeTop, length } : null,
        bottom: edgeBottom ? { type: edgeBottom, length } : null,
        left: edgeLeft ? { type: edgeLeft, length: width } : null,
        right: edgeRight ? { type: edgeRight, length: width } : null,
        front: edgeFront ? { type: edgeFront, length } : null,
      };
    }

    onSave(updated);
  }, [part, length, width, thickness, grainDirection, quantity, material, notes,
    edgeTop, edgeBottom, edgeLeft, edgeRight, edgeFront, onSave]);

  const isPanel = part.partCategory === 'panel';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <span className="text-xs font-mono text-gray-400">{part.partCode}</span>
            <h3 className="text-sm font-semibold">{part.partName}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Dimensions (panels only) */}
          {isPanel && (
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dimensions (mm)</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Length</label>
                  <input type="number" value={length} onChange={e => setLength(Number(e.target.value))}
                    className="w-full border rounded px-2 py-1 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Width</label>
                  <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))}
                    className="w-full border rounded px-2 py-1 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Thickness</label>
                  <input type="number" value={thickness} onChange={e => setThickness(Number(e.target.value))}
                    className="w-full border rounded px-2 py-1 text-sm font-mono" />
                </div>
              </div>
              <div className="mt-2">
                <label className="text-xs text-gray-500">Grain Direction</label>
                <select value={grainDirection} onChange={e => setGrainDirection(e.target.value as 'length' | 'width' | 'none')}
                  className="w-full border rounded px-2 py-1 text-sm">
                  <option value="length">Length</option>
                  <option value="width">Width</option>
                  <option value="none">None</option>
                </select>
              </div>
            </section>
          )}

          {/* Edge Banding Preview (panels only) */}
          {isPanel && (
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Edge Banding</h4>
              <div className="relative mx-auto" style={{ width: 160, height: 120 }}>
                {/* Panel rectangle */}
                <div className="absolute inset-4 border-2 border-gray-300 bg-gray-50 flex items-center justify-center">
                  <span className="text-[10px] text-gray-400">{length}×{width}</span>
                </div>
                {/* Edge labels */}
                <EdgeInput label="T" value={edgeTop} onChange={setEdgeTop}
                  style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }} />
                <EdgeInput label="B" value={edgeBottom} onChange={setEdgeBottom}
                  style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }} />
                <EdgeInput label="L" value={edgeLeft} onChange={setEdgeLeft}
                  style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)' }} />
                <EdgeInput label="R" value={edgeRight} onChange={setEdgeRight}
                  style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <div className="mt-1">
                <label className="text-xs text-gray-500">Front Edge</label>
                <input type="text" value={edgeFront} onChange={e => setEdgeFront(e.target.value)}
                  placeholder="e.g. pvc_2mm" className="w-full border rounded px-2 py-1 text-xs" />
              </div>
            </section>
          )}

          {/* Quantity */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</label>
            <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))}
              min={1} className="w-full border rounded px-2 py-1 text-sm mt-1" />
          </div>

          {/* Material */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Material</label>
            <input type="text" value={material} onChange={e => setMaterial(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm mt-1" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} className="w-full border rounded px-2 py-1 text-sm mt-1" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
          <button type="button" onClick={onClose} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm">Cancel</button>
          <button type="button" onClick={handleSave}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EdgeInput({ label, value, onChange, style }: {
  label: string; value: string; onChange: (v: string) => void; style: React.CSSProperties;
}) {
  const hasEdge = !!value;
  return (
    <button
      type="button"
      style={style}
      onClick={() => onChange(hasEdge ? '' : 'pvc_04mm')}
      className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
        hasEdge ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'
      }`}
      title={hasEdge ? `${label}: ${value} (click to remove)` : `${label}: none (click to add)`}
    >
      {label}
    </button>
  );
}
