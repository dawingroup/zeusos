/**
 * Asset Form Component
 * Form for adding/editing assets with AI auto-fill capability
 */

import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';
import type { Asset, AssetCategory, AssetStatus } from '@/shared/types';

interface AssetFormProps {
  asset?: Partial<Asset>;
  onSubmit: (asset: Partial<Asset>) => Promise<void>;
  onCancel: () => void;
}

interface EnrichedData {
  specs: Record<string, string>;
  manualUrl: string | null;
  productPageUrl: string | null;
  maintenanceTasks: string[];
  maintenanceIntervalHours: number;
}

const ASSET_CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: 'STATIONARY_MACHINE', label: 'Stationary Machine' },
  { value: 'POWER_TOOL', label: 'Power Tool' },
  { value: 'HAND_TOOL', label: 'Hand Tool' },
  { value: 'JIG', label: 'Jig / Fixture' },
  { value: 'CNC', label: 'CNC Machine' },
  { value: 'DUST_COLLECTION', label: 'Dust Collection' },
  { value: 'SPRAY_EQUIPMENT', label: 'Spray Equipment' },
  { value: 'SEWING_MACHINE', label: 'Sewing Machine' },
];

const ASSET_STATUSES: { value: AssetStatus; label: string; color: string }[] = [
  { value: 'ACTIVE', label: 'Active', color: 'bg-green-500' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'bg-yellow-500' },
  { value: 'BROKEN', label: 'Broken', color: 'bg-red-500' },
  { value: 'CHECKED_OUT', label: 'Checked Out', color: 'bg-blue-500' },
  { value: 'RETIRED', label: 'Retired', color: 'bg-gray-500' },
];

// Common tool brands
const BRAND_OPTIONS = [
  'Festool',
  'Makita',
  'Bosch',
  'DeWalt',
  'Milwaukee',
  'Jessem',
  'Incra',
  'Incco',
  'Yu Tools',
  'Gazzelle',
  'Rubi',
  'Kreg',
  'Mirka',
  'Graco',
  'Biesse',
  'SCM',
  'Homag',
  'Altendorf',
  'Juki',
  'Brother',
  'Other',
];

// Production zones for furniture/cabinetry/millwork/upholstery
const ZONE_OPTIONS = [
  // Primary Processing
  { group: 'Primary Processing', zones: [
    'Sheet Goods Storage',
    'Panel Saw Area',
    'CNC Nesting Center',
    'Lumber Storage',
    'Rough Milling',
    'Planer/Jointer Station',
  ]},
  // Secondary Processing
  { group: 'Secondary Processing', zones: [
    'Edge Banding Station',
    'Boring/Drilling Center',
    'Router Table Station',
    'Shaper Station',
    'Mortise/Tenon Area',
  ]},
  // Assembly
  { group: 'Assembly', zones: [
    'Case Assembly',
    'Face Frame Assembly',
    'Door Assembly',
    'Drawer Assembly',
    'Final Assembly',
    'Hardware Installation',
  ]},
  // Finishing
  { group: 'Finishing', zones: [
    'Sanding Station',
    'Prep/Cleaning Area',
    'Spray Booth',
    'Drying/Curing Area',
    'Hand Finishing',
    'Touch-Up Station',
  ]},
  // Upholstery
  { group: 'Upholstery', zones: [
    'Cutting Table',
    'Sewing Station',
    'Foam Fabrication',
    'Upholstery Assembly',
    'Fabric Storage',
  ]},
  // Support Areas
  { group: 'Support Areas', zones: [
    'Tool Crib',
    'Maintenance Shop',
    'Quality Control',
    'Packaging/Shipping',
  ]},
  // Special Areas
  { group: 'Special Areas', zones: [
    'Prototyping Lab',
    'Sample Room',
    'Site Installation Kit',
    'Mobile/Field Equipment',
  ]},
];

export function AssetForm({ asset, onSubmit, onCancel }: AssetFormProps) {
  // Form state
  const [brand, setBrand] = useState(asset?.brand || '');
  const [customBrand, setCustomBrand] = useState('');
  const [model, setModel] = useState(asset?.model || '');
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber || '');
  const [nickname, setNickname] = useState(asset?.nickname || '');
  const [category, setCategory] = useState<AssetCategory>(asset?.category || 'POWER_TOOL');
  const [status, setStatus] = useState<AssetStatus>(asset?.status || 'ACTIVE');
  const [zone, setZone] = useState(asset?.location?.zone || 'Workshop');
  
  // AI-enriched fields
  const [specs, setSpecs] = useState<Record<string, string>>(asset?.specs || {});
  const [manualUrl, setManualUrl] = useState(asset?.manualUrl || '');
  const [productPageUrl, setProductPageUrl] = useState(asset?.productPageUrl || '');
  const [maintenanceTasks, setMaintenanceTasks] = useState<string[]>(
    asset?.maintenance?.tasks || []
  );
  const [maintenanceInterval, setMaintenanceInterval] = useState(
    asset?.maintenance?.intervalHours || 200
  );

  // UI state
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill using AI
  const handleAutoFill = async () => {
    if (!brand || !model) {
      setEnrichError('Please enter both Brand and Model to auto-fill');
      return;
    }

    setIsEnriching(true);
    setEnrichError(null);

    try {
      const enrichAssetData = httpsCallable<
        { brand: string; model: string },
        EnrichedData
      >(functions, 'enrichAssetData');

      const result = await enrichAssetData({ brand, model });
      const data = result.data;

      // Update form with enriched data
      setSpecs(data.specs);
      if (data.manualUrl) setManualUrl(data.manualUrl);
      if (data.productPageUrl) setProductPageUrl(data.productPageUrl);
      setMaintenanceTasks(data.maintenanceTasks);
      setMaintenanceInterval(data.maintenanceIntervalHours);

    } catch (error) {
      console.error('Auto-fill error:', error);
      setEnrichError(
        error instanceof Error ? error.message : 'Failed to auto-fill. Please try again.'
      );
    } finally {
      setIsEnriching(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const assetData: Partial<Asset> = {
        ...(asset?.id && { id: asset.id }),
        brand,
        model,
        serialNumber: serialNumber || undefined,
        nickname: nickname || undefined,
        category,
        specs,
        manualUrl: manualUrl || undefined,
        productPageUrl: productPageUrl || undefined,
        maintenance: {
          intervalHours: maintenanceInterval,
          tasks: maintenanceTasks,
          nextServiceDue: new Date(Date.now() + maintenanceInterval * 60 * 60 * 1000),
          history: asset?.maintenance?.history || [],
        },
        status,
        location: {
          zone,
          checkedOutBy: asset?.location?.checkedOutBy,
        },
      };

      await onSubmit(assetData);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add/remove spec entry
  const addSpec = () => {
    setSpecs({ ...specs, '': '' });
  };

  const updateSpecKey = (oldKey: string, newKey: string) => {
    const newSpecs = { ...specs };
    const value = newSpecs[oldKey];
    delete newSpecs[oldKey];
    newSpecs[newKey] = value;
    setSpecs(newSpecs);
  };

  const updateSpecValue = (key: string, value: string) => {
    setSpecs({ ...specs, [key]: value });
  };

  const removeSpec = (key: string) => {
    const newSpecs = { ...specs };
    delete newSpecs[key];
    setSpecs(newSpecs);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identity Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Asset Identity</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand *
            </label>
            <div className="flex gap-2">
              <select
                value={BRAND_OPTIONS.includes(brand) ? brand : 'Other'}
                onChange={(e) => {
                  if (e.target.value === 'Other') {
                    setBrand(customBrand || '');
                  } else {
                    setBrand(e.target.value);
                    setCustomBrand('');
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select brand...</option>
                {BRAND_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {(!BRAND_OPTIONS.includes(brand) || brand === '') && (
                <input
                  type="text"
                  value={BRAND_OPTIONS.includes(brand) ? '' : brand}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    setCustomBrand(e.target.value);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter custom brand"
                />
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model *
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., OF 1400 EQ, RP2301FC"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serial Number
            </label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Optional"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Big Blue, Old Faithful"
            />
          </div>
        </div>

        {/* Auto-Fill Button */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={isEnriching || !brand || !model}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEnriching ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto-Fill with AI
              </>
            )}
          </button>
          {enrichError && (
            <p className="mt-2 text-sm text-red-600">{enrichError}</p>
          )}
        </div>
      </div>

      {/* Classification Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Classification</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ASSET_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AssetStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ASSET_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location / Zone
            </label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select zone...</option>
              {ZONE_OPTIONS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.zones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Technical Specs Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Technical Specifications</h3>
          <button
            type="button"
            onClick={addSpec}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Add Spec
          </button>
        </div>
        
        <div className="space-y-2">
          {Object.entries(specs).map(([key, value], index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={key}
                onChange={(e) => updateSpecKey(key, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Spec name (e.g., Power)"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => updateSpecValue(key, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Value (e.g., 2200W)"
              />
              <button
                type="button"
                onClick={() => removeSpec(key)}
                className="p-2 text-red-500 hover:text-red-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {Object.keys(specs).length === 0 && (
            <p className="text-gray-500 text-sm italic">
              No specs added. Click "Auto-Fill with AI" or add manually.
            </p>
          )}
        </div>
      </div>

      {/* Resources Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Resources</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manual URL
            </label>
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Page URL
            </label>
            <input
              type="url"
              value={productPageUrl}
              onChange={(e) => setProductPageUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Maintenance Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Maintenance</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Service Interval (hours)
          </label>
          <input
            type="number"
            value={maintenanceInterval}
            onChange={(e) => setMaintenanceInterval(parseInt(e.target.value) || 200)}
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maintenance Tasks
          </label>
          <div className="space-y-2">
            {maintenanceTasks.map((task, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="text-gray-400 text-sm w-6">{index + 1}.</span>
                <input
                  type="text"
                  value={task}
                  onChange={(e) => {
                    const newTasks = [...maintenanceTasks];
                    newTasks[index] = e.target.value;
                    setMaintenanceTasks(newTasks);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMaintenanceTasks(maintenanceTasks.filter((_, i) => i !== index));
                  }}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMaintenanceTasks([...maintenanceTasks, ''])}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Add Task
            </button>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !brand || !model}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : asset?.id ? 'Update Asset' : 'Add Asset'}
        </button>
      </div>
    </form>
  );
}
