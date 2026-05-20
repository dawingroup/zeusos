/**
 * PartForm Component
 * Form for adding/editing a single part
 * Supports: sheet, bar, timber, slab, fabric, component part types
 */

import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import type { PartEntry } from '../../types';
import type { MaterialType, MaterialPaletteEntry } from '@/shared/types';

type PartType = NonNullable<PartEntry['partType']>;

const PART_TYPE_OPTIONS: { value: PartType; label: string; description: string }[] = [
  { value: 'sheet', label: 'Sheet / Panel', description: 'Plywood, MDF, melamine, etc.' },
  { value: 'timber', label: 'Timber / Lumber', description: 'Solid wood sections — volumetric (m³) costing' },
  { value: 'bar', label: 'Bar / Section', description: 'Metal/aluminium sections — linear meter costing' },
  { value: 'slab', label: 'Stone Slab', description: 'Granite, quartz, marble worktops' },
  { value: 'fabric', label: 'Fabric / Upholstery', description: 'Leather, fabric, foam panels' },
  { value: 'component', label: 'Component', description: 'Bought-out items, priced per piece' },
];

// Common materials suggested per part type. These are suggestions, not constraints —
// the field remains free-text so palette-driven lookups still work.
const MATERIAL_PRESETS: Record<PartType, string[]> = {
  sheet: [
    '18mm Birch Plywood',
    '18mm MDF',
    '18mm White Melamine',
    '18mm Oak Melamine',
    '12mm Birch Plywood',
    '12mm MDF',
    '6mm MDF Backing',
    '25mm MDF',
    '18mm Chipboard',
    '4mm Hardboard',
  ],
  timber: [
    'Musizi',
    'Mahogany',
    'Mvule (Iroko)',
    'Mukebu',
    'Mpafu',
    'Pine (Kiln Dried)',
    'Eucalyptus',
    'Elgon Olive',
    'Podo',
    'Oak',
  ],
  bar: [
    '40x40 Mild Steel SHS',
    '25x25 Mild Steel SHS',
    '60x40x3 Mild Steel RHS',
    '25x3 Mild Steel Flat Bar',
    '12mm Mild Steel Round Bar',
    '40x40 Aluminium Profile',
    '20x20 Aluminium Profile',
    '30x30 Aluminium Extrusion',
  ],
  slab: [
    'Granite Nero',
    'Granite Absolute Black',
    'Quartz White',
    'Quartz Calacatta',
    'Marble Carrara',
    'Marble Travertine',
    'Porcelain Slab',
  ],
  fabric: [
    'Italian Leather Tan',
    'Italian Leather Black',
    'Velvet Grey',
    'Velvet Navy',
    'Linen Beige',
    'Bonded Leather',
    'Foam 50mm HD',
    'Foam 25mm Medium',
  ],
  component: [
    'Soft-close Hinge',
    'Drawer Slide 450mm',
    'Gas Strut Mechanism',
    'Cabinet Handle',
    'Lazy Susan',
    'Wire Basket',
    'LED Strip Light',
    'Recessed Spotlight',
  ],
};

const MATERIAL_TYPE_COLORS: Record<string, string> = {
  TIMBER: 'bg-green-100 text-green-700',
  PANEL: 'bg-blue-100 text-blue-700',
  FABRIC: 'bg-violet-100 text-violet-700',
  STONE: 'bg-orange-100 text-orange-700',
  METAL_BAR: 'bg-teal-100 text-teal-700',
  ALUMINIUM: 'bg-teal-100 text-teal-700',
  GLASS: 'bg-cyan-100 text-cyan-700',
  COMPONENT: 'bg-slate-100 text-slate-700',
  EDGE: 'bg-amber-100 text-amber-700',
  SOLID: 'bg-green-100 text-green-700',
  VENEER: 'bg-yellow-100 text-yellow-700',
};

/**
 * Parse a timber cross-section string like "45x20" into thickness/width (mm).
 * Convention: first number = thickness, second = width. Supports separators "x", "X", "×".
 * Returns null if the input is not a valid two-number cross-section.
 */
function parseCrossSection(cs: string): { thickness: number; width: number } | null {
  const match = cs.trim().match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const thickness = parseFloat(match[1]);
  const width = parseFloat(match[2]);
  if (!Number.isFinite(thickness) || !Number.isFinite(width) || thickness <= 0 || width <= 0) return null;
  return { thickness, width };
}

function resolveMaterialTypeFromPalette(
  materialName: string,
  thickness: number,
  palette?: MaterialPaletteEntry[]
): MaterialType | null {
  if (!palette || !materialName) return null;
  const normalized = materialName.toLowerCase().trim();
  const entry = palette.find(e => {
    const entryName = (e.designName || e.normalizedName || '').toLowerCase().trim();
    return entryName === normalized && Math.abs((e.thickness || 0) - thickness) < 0.1;
  });
  return entry?.materialType ?? null;
}

interface PartFormProps {
  part?: PartEntry;
  defaultPartType?: PartType;
  materialPalette?: MaterialPaletteEntry[];
  onSave: (data: Partial<PartEntry>) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function PartForm({ part, defaultPartType, materialPalette, onSave, onClose, loading }: PartFormProps) {
  const [partType, setPartType] = useState<PartType>(part?.partType || defaultPartType || 'sheet');
  const [formData, setFormData] = useState({
    name: '',
    length: '',
    width: '',
    thickness: '18',
    quantity: '1',
    materialName: '',
    grainDirection: 'none' as 'length' | 'width' | 'none',
    edgeBanding: { top: false, bottom: false, left: false, right: false },
    notes: '',
    // Bar-specific
    barProfile: '',
    // Slab-specific
    slabLength: '3000',
    slabWidth: '1500',
    // Fabric-specific
    rollWidth: '1400',
    // Component-specific
    componentUnitCost: '',
  });

  useEffect(() => {
    if (part) {
      setPartType(part.partType || 'sheet');
      setFormData({
        name: part.name,
        length: part.length.toString(),
        width: part.width.toString(),
        thickness: part.thickness.toString(),
        quantity: part.quantity.toString(),
        materialName: part.materialName,
        grainDirection: part.grainDirection,
        edgeBanding: { ...part.edgeBanding },
        notes: part.notes || '',
        barProfile: part.barProfile || '',
        slabLength: (part as any).slabSize?.length?.toString() || '3000',
        slabWidth: (part as any).slabSize?.width?.toString() || '1500',
        rollWidth: (part as any).rollWidth?.toString() || '1400',
        componentUnitCost: (part as any).componentUnitCost?.toString() || '',
      });
    }
  }, [part]);

  const resolvedMaterialType = useMemo(
    () => resolveMaterialTypeFromPalette(
      formData.materialName,
      parseFloat(formData.thickness) || 0,
      materialPalette
    ),
    [formData.materialName, formData.thickness, materialPalette]
  );

  const isAreaBased = partType === 'sheet' || partType === 'slab' || partType === 'fabric';
  const needsDimensions = partType !== 'component';
  const needsThickness = partType === 'sheet' || partType === 'slab';

  // For timber, the cross-section drives width/thickness so BOM volume
  // (length × width × thickness) is accurate without asking the user twice.
  const timberCrossSection = partType === 'timber'
    ? parseCrossSection(formData.barProfile)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<PartEntry> = {
      name: formData.name,
      length: needsDimensions ? parseFloat(formData.length) : 0,
      width: partType === 'timber'
        ? (timberCrossSection?.width ?? 0)
        : (isAreaBased ? parseFloat(formData.width) : 0),
      thickness: partType === 'timber'
        ? (timberCrossSection?.thickness ?? 0)
        : (needsThickness ? parseFloat(formData.thickness) : 0),
      quantity: parseInt(formData.quantity, 10),
      materialName: formData.materialName,
      grainDirection: formData.grainDirection,
      edgeBanding: formData.edgeBanding,
      source: 'manual',
      hasCNCOperations: false,
      partType,
    };

    // Type-specific fields
    if (partType === 'bar' || partType === 'timber') {
      data.barProfile = formData.barProfile || undefined;
    }
    if (partType === 'slab') {
      (data as any).slabSize = {
        length: parseInt(formData.slabLength, 10) || 3000,
        width: parseInt(formData.slabWidth, 10) || 1500,
      };
    }
    if (partType === 'fabric') {
      (data as any).rollWidth = parseInt(formData.rollWidth, 10) || 1400;
    }
    if (partType === 'component') {
      (data as any).componentUnitCost = parseFloat(formData.componentUnitCost) || 0;
    }

    if (formData.notes) {
      data.notes = formData.notes;
    }
    await onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {part ? 'Edit Part' : 'Add Part'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Part Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Part Type</label>
            <select
              value={partType}
              onChange={(e) => setPartType(e.target.value as PartType)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {PART_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Part Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
              placeholder={partType === 'component' ? 'e.g., Chair Mechanism Assembly' : 'e.g., Left Side Panel'}
            />
          </div>

          {/* Dimensions — hidden for component parts */}
          {needsDimensions && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {partType === 'bar' ? 'Length (mm) *' : 'Length (mm) *'}
                </label>
                <input
                  type="number"
                  value={formData.length}
                  onChange={(e) => setFormData((f) => ({ ...f, length: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  min="1"
                />
              </div>
              {isAreaBased && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width (mm) *</label>
                  <input
                    type="number"
                    value={formData.width}
                    onChange={(e) => setFormData((f) => ({ ...f, width: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                    min="1"
                  />
                </div>
              )}
              {needsThickness && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thickness (mm)</label>
                  <input
                    type="number"
                    value={formData.thickness}
                    onChange={(e) => setFormData((f) => ({ ...f, thickness: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    min="1"
                  />
                </div>
              )}
            </div>
          )}

          {/* Bar Profile / Timber Cross-Section */}
          {(partType === 'bar' || partType === 'timber') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {partType === 'timber' ? 'Cross-Section — thickness × width (mm)' : 'Bar Profile'}
              </label>
              <input
                type="text"
                value={formData.barProfile}
                onChange={(e) => setFormData((f) => ({ ...f, barProfile: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={partType === 'timber' ? 'e.g., 45x20, 75x50, 100x25' : 'e.g., 40x40, 25x3, 60x40x3'}
              />
              {partType === 'timber' && (
                <p className="mt-1 text-xs text-gray-500">
                  {timberCrossSection
                    ? <>Parsed: <strong>{timberCrossSection.thickness}mm</strong> thick × <strong>{timberCrossSection.width}mm</strong> wide — used for BOM volume calculation.</>
                    : formData.barProfile
                      ? <span className="text-amber-600">Cross-section not recognised — use <code>thicknessXwidth</code> (e.g., 45x20).</span>
                      : <>Used to compute BOM volume (length × thickness × width). Enter two numbers separated by <code>x</code>.</>
                  }
                </p>
              )}
              {partType === 'bar' && (
                <p className="mt-1 text-xs text-gray-500">
                  Use <strong>Bar / Section</strong> for metal/aluminium profiles only. For wood sections, choose <strong>Timber / Lumber</strong> so downstream services keep volumetric pricing.
                </p>
              )}
            </div>
          )}

          {/* Slab Stock Size */}
          {partType === 'slab' && (
            <div className="bg-orange-50 rounded-lg p-3">
              <label className="block text-sm font-medium text-orange-800 mb-2">Stock Slab Size (for yield calculation)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-orange-600 mb-1">Slab Length (mm)</label>
                  <input
                    type="number"
                    value={formData.slabLength}
                    onChange={(e) => setFormData((f) => ({ ...f, slabLength: e.target.value }))}
                    className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-orange-600 mb-1">Slab Width (mm)</label>
                  <input
                    type="number"
                    value={formData.slabWidth}
                    onChange={(e) => setFormData((f) => ({ ...f, slabWidth: e.target.value }))}
                    className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Fabric Roll Width */}
          {partType === 'fabric' && (
            <div className="bg-violet-50 rounded-lg p-3">
              <label className="block text-sm font-medium text-violet-800 mb-1">Roll Width (mm)</label>
              <input
                type="number"
                value={formData.rollWidth}
                onChange={(e) => setFormData((f) => ({ ...f, rollWidth: e.target.value }))}
                className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                placeholder="e.g., 1400"
              />
              <p className="text-xs text-violet-600 mt-1">Used to convert area to linear meters for purchasing</p>
            </div>
          )}

          {/* Component Unit Cost */}
          {partType === 'component' && (
            <div className="bg-slate-50 rounded-lg p-3">
              <label className="block text-sm font-medium text-slate-800 mb-1">Unit Cost (UGX)</label>
              <input
                type="number"
                value={formData.componentUnitCost}
                onChange={(e) => setFormData((f) => ({ ...f, componentUnitCost: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Cost per piece"
                min="0"
              />
            </div>
          )}

          {/* Quantity and Material */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData((f) => ({ ...f, quantity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
              <input
                type="text"
                value={formData.materialName}
                onChange={(e) => setFormData((f) => ({ ...f, materialName: e.target.value }))}
                list={`material-presets-${partType}`}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
                placeholder={
                  partType === 'timber' ? 'e.g., Musizi, Mahogany, Pine' :
                  partType === 'slab' ? 'e.g., Granite Nero' :
                  partType === 'fabric' ? 'e.g., Italian Leather Tan' :
                  partType === 'component' ? 'e.g., Gas Strut Mechanism' :
                  partType === 'bar' ? 'e.g., 40x40 Mild Steel SHS' :
                  'e.g., 18mm Birch Plywood'
                }
              />
              <datalist id={`material-presets-${partType}`}>
                {MATERIAL_PRESETS[partType].map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
              {materialPalette && formData.materialName && (
                <div className="mt-1">
                  {resolvedMaterialType ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${MATERIAL_TYPE_COLORS[resolvedMaterialType] || 'bg-gray-100 text-gray-500'}`}>
                      {resolvedMaterialType.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No palette match</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Grain Direction — for sheet/slab/timber (wood & stone have grain; metal bars don't) */}
          {(partType === 'sheet' || partType === 'slab' || partType === 'timber') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grain Direction</label>
              <div className="flex gap-4">
                {(['none', 'length', 'width'] as const).map((dir) => (
                  <label key={dir} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="grain"
                      checked={formData.grainDirection === dir}
                      onChange={() => setFormData((f) => ({ ...f, grainDirection: dir }))}
                      className="text-primary"
                    />
                    <span className="text-sm text-gray-700 capitalize">{dir}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Edge Banding — only for sheet */}
          {partType === 'sheet' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Edge Banding</label>
              <div className="flex gap-4">
                {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
                  <label key={edge} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.edgeBanding[edge]}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          edgeBanding: { ...f.edgeBanding, [edge]: e.target.checked },
                        }))
                      }
                      className="rounded border-gray-300 text-primary"
                    />
                    <span className="text-sm text-gray-700 capitalize">{edge}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : part ? 'Save Changes' : 'Add Part'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PartForm;
