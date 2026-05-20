/**
 * Parameters Editor Component
 * Design specifications form - dimensions, finish, construction, and requirements
 * Note: Materials and hardware are managed in the Parts & Costing tab
 */

import { useState } from 'react';
import { Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { 
  DesignParameters, 
  FinishSpec, 
  ConstructionMethod,
  JoineryType 
} from '../../types';

export interface ParametersEditorProps {
  parameters: DesignParameters;
  onSave: (parameters: DesignParameters) => Promise<void>;
  isReadOnly?: boolean;
  className?: string;
}

// Default empty parameters
const DEFAULT_PARAMETERS: DesignParameters = {
  dimensions: { width: null, height: null, depth: null, unit: 'mm' },
  primaryMaterial: null,
  secondaryMaterials: [],
  edgeBanding: null,
  hardware: [],
  finish: null,
  constructionMethod: 'frameless',
  joineryTypes: [],
  awiGrade: 'custom',
  specialRequirements: [],
};

// Note: Materials and hardware are now managed in Parts & Costing tab

// Options for dropdowns
const CONSTRUCTION_METHODS: { value: ConstructionMethod; label: string }[] = [
  { value: 'frameless', label: 'Frameless (European/32mm)' },
  { value: 'face-frame', label: 'Face Frame (Traditional)' },
  { value: 'post-and-rail', label: 'Post and Rail' },
  { value: 'solid-wood', label: 'Solid Wood' },
  { value: 'mixed', label: 'Mixed Construction' },
];

const JOINERY_TYPES: { value: JoineryType; label: string }[] = [
  { value: 'dowel', label: 'Dowel' },
  { value: 'biscuit', label: 'Biscuit' },
  { value: 'pocket-screw', label: 'Pocket Screw' },
  { value: 'mortise-tenon', label: 'Mortise & Tenon' },
  { value: 'dovetail', label: 'Dovetail' },
  { value: 'rabbet-dado', label: 'Rabbet & Dado' },
  { value: 'cam-lock', label: 'Cam Lock' },
  { value: 'confirmat', label: 'Confirmat Screw' },
  { value: 'glue-only', label: 'Glue Only' },
];

const FINISH_TYPES = ['paint', 'stain', 'lacquer', 'oil', 'veneer', 'laminate', 'none'] as const;
const SHEEN_OPTIONS = ['flat', 'matte', 'satin', 'semi-gloss', 'gloss'] as const;
const AWI_GRADES = [
  { value: 'economy', label: 'Economy' },
  { value: 'custom', label: 'Custom' },
  { value: 'premium', label: 'Premium' },
] as const;

export function ParametersEditor({
  parameters: initialParameters,
  onSave,
  isReadOnly = false,
  className,
}: ParametersEditorProps) {
  const [params, setParams] = useState<DesignParameters>({
    ...DEFAULT_PARAMETERS,
    ...initialParameters,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['dimensions', 'finish', 'construction', 'requirements'])
  );
  const [newRequirement, setNewRequirement] = useState('');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(params);
    } finally {
      setIsSaving(false);
    }
  };

  const updateDimensions = (field: 'width' | 'height' | 'depth', value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setParams(prev => ({
      ...prev,
      dimensions: { ...prev.dimensions, [field]: numValue },
    }));
  };

  const updateFinish = (field: keyof FinishSpec, value: any) => {
    setParams(prev => ({
      ...prev,
      finish: prev.finish
        ? { ...prev.finish, [field]: value }
        : { type: 'paint', color: null, sheen: 'satin', coats: 2, brand: null, productCode: null, [field]: value },
    }));
  };

  const toggleJoinery = (joinery: JoineryType) => {
    setParams(prev => ({
      ...prev,
      joineryTypes: prev.joineryTypes.includes(joinery)
        ? prev.joineryTypes.filter(j => j !== joinery)
        : [...prev.joineryTypes, joinery],
    }));
  };

  const addRequirement = () => {
    if (newRequirement.trim()) {
      setParams(prev => ({
        ...prev,
        specialRequirements: [...prev.specialRequirements, newRequirement.trim()],
      }));
      setNewRequirement('');
    }
  };

  const removeRequirement = (index: number) => {
    setParams(prev => ({
      ...prev,
      specialRequirements: prev.specialRequirements.filter((_, i) => i !== index),
    }));
  };

  const SectionHeader = ({ title, section }: { title: string; section: string }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <h3 className="font-medium text-gray-900">{title}</h3>
      {expandedSections.has(section) ? (
        <ChevronUp className="w-5 h-5 text-gray-500" />
      ) : (
        <ChevronDown className="w-5 h-5 text-gray-500" />
      )}
    </button>
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dimensions Section */}
      <div className="border rounded-lg overflow-hidden">
        <SectionHeader title="📐 Dimensions" section="dimensions" />
        {expandedSections.has('dimensions') && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                <div className="flex">
                  <input
                    type="number"
                    value={params.dimensions.width ?? ''}
                    onChange={e => updateDimensions('width', e.target.value)}
                    disabled={isReadOnly}
                    className="flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent disabled:bg-gray-100"
                    placeholder="0"
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 rounded-r-lg text-gray-600">
                    {params.dimensions.unit}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                <div className="flex">
                  <input
                    type="number"
                    value={params.dimensions.height ?? ''}
                    onChange={e => updateDimensions('height', e.target.value)}
                    disabled={isReadOnly}
                    className="flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent disabled:bg-gray-100"
                    placeholder="0"
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 rounded-r-lg text-gray-600">
                    {params.dimensions.unit}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Depth</label>
                <div className="flex">
                  <input
                    type="number"
                    value={params.dimensions.depth ?? ''}
                    onChange={e => updateDimensions('depth', e.target.value)}
                    disabled={isReadOnly}
                    className="flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent disabled:bg-gray-100"
                    placeholder="0"
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 rounded-r-lg text-gray-600">
                    {params.dimensions.unit}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={params.dimensions.unit}
                onChange={e => setParams(prev => ({ ...prev, dimensions: { ...prev.dimensions, unit: e.target.value as 'mm' | 'inches' } }))}
                disabled={isReadOnly}
                className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent disabled:bg-gray-100"
              >
                <option value="mm">mm</option>
                <option value="inches">inches</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Finish Section */}
      <div className="border rounded-lg overflow-hidden">
        <SectionHeader title="🎨 Finish" section="finish" />
        {expandedSections.has('finish') && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={params.finish?.type ?? 'none'}
                  onChange={e => updateFinish('type', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent disabled:bg-gray-100"
                >
                  {FINISH_TYPES.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input
                  type="text"
                  value={params.finish?.color ?? ''}
                  onChange={e => updateFinish('color', e.target.value || null)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent disabled:bg-gray-100"
                  placeholder="e.g., Benjamin Moore OC-17"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sheen</label>
                <select
                  value={params.finish?.sheen ?? 'satin'}
                  onChange={e => updateFinish('sheen', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent disabled:bg-gray-100"
                >
                  {SHEEN_OPTIONS.map(sheen => (
                    <option key={sheen} value={sheen}>{sheen.charAt(0).toUpperCase() + sheen.slice(1).replace('-', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Coats</label>
                <input
                  type="number"
                  value={params.finish?.coats ?? ''}
                  onChange={e => updateFinish('coats', parseInt(e.target.value) || null)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent disabled:bg-gray-100"
                  placeholder="2"
                  min="1"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Construction Section */}
      <div className="border rounded-lg overflow-hidden">
        <SectionHeader title="🔨 Construction" section="construction" />
        {expandedSections.has('construction') && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Construction Method</label>
              <select
                value={params.constructionMethod}
                onChange={e => setParams(prev => ({ ...prev, constructionMethod: e.target.value as ConstructionMethod }))}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent disabled:bg-gray-100"
              >
                {CONSTRUCTION_METHODS.map(method => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Joinery Types</label>
              <div className="flex flex-wrap gap-2">
                {JOINERY_TYPES.map(joinery => (
                  <button
                    key={joinery.value}
                    onClick={() => !isReadOnly && toggleJoinery(joinery.value)}
                    disabled={isReadOnly}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-full border transition-colors',
                      params.joineryTypes.includes(joinery.value)
                        ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-[#1d1d1f]',
                      isReadOnly && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    {joinery.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AWI Grade</label>
              <div className="flex gap-3">
                {AWI_GRADES.map(grade => (
                  <label key={grade.value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="awiGrade"
                      value={grade.value}
                      checked={params.awiGrade === grade.value}
                      onChange={e => setParams(prev => ({ ...prev, awiGrade: e.target.value as 'economy' | 'custom' | 'premium' }))}
                      disabled={isReadOnly}
                      className="w-4 h-4 text-[#1d1d1f] focus:ring-[#1d1d1f]"
                    />
                    <span className="text-sm text-gray-700">{grade.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Special Requirements Section */}
      <div className="border rounded-lg overflow-hidden">
        <SectionHeader title="⚡ Special Requirements" section="requirements" />
        {expandedSections.has('requirements') && (
          <div className="p-4 space-y-3">
            {params.specialRequirements.map((req, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm">{req}</span>
                {!isReadOnly && (
                  <button
                    onClick={() => removeRequirement(index)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {!isReadOnly && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRequirement}
                  onChange={e => setNewRequirement(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addRequirement()}
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
                  placeholder="Add a special requirement..."
                />
                <button
                  onClick={addRequirement}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note: Materials and inventory are now managed in Parts & Costing tab */}

      {/* Save Button */}
      {!isReadOnly && (
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#1d1d1f] text-white font-medium rounded-lg hover:bg-[#1d1d1f]/90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Parameters'}
          </button>
        </div>
      )}
    </div>
  );
}

export default ParametersEditor;
