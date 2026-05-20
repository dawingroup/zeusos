/**
 * Program Form - Create/Edit programs
 */

import { useState } from 'react';
import { 
  Save, 
  Plus, 
  Trash2,
  Calendar,
  DollarSign,
  Users,
  MapPin,
} from 'lucide-react';
import { ClientSelector } from './ClientSelector';

interface ProgramFormData {
  name: string;
  code: string;
  description: string;
  clientId: string | null;
  fundingSource: string;
  implementingAgency: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  currency: string;
  regions: string[];
  objectives: string[];
}

interface ProgramFormProps {
  initialData?: Partial<ProgramFormData>;
  onSubmit: (data: ProgramFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

const CURRENCIES = ['UGX', 'USD', 'EUR', 'GBP', 'KES', 'TZS', 'RWF'];

const UGANDA_REGIONS = [
  'Central Region',
  'Eastern Region',
  'Northern Region',
  'Western Region',
  'Kampala',
];

export function ProgramForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isEditing = false 
}: ProgramFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<ProgramFormData>({
    name: initialData?.name || '',
    code: initialData?.code || '',
    description: initialData?.description || '',
    clientId: initialData?.clientId || null,
    fundingSource: initialData?.fundingSource || '',
    implementingAgency: initialData?.implementingAgency || '',
    startDate: initialData?.startDate || '',
    endDate: initialData?.endDate || '',
    totalBudget: initialData?.totalBudget || 0,
    currency: initialData?.currency || 'UGX',
    regions: initialData?.regions || [],
    objectives: initialData?.objectives || [''],
  });

  const handleChange = (field: keyof ProgramFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddObjective = () => {
    setFormData(prev => ({
      ...prev,
      objectives: [...prev.objectives, ''],
    }));
  };

  const handleRemoveObjective = (index: number) => {
    setFormData(prev => ({
      ...prev,
      objectives: prev.objectives.filter((_, i) => i !== index),
    }));
  };

  const handleObjectiveChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      objectives: prev.objectives.map((obj, i) => i === index ? value : obj),
    }));
  };

  const toggleRegion = (region: string) => {
    setFormData(prev => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter(r => r !== region)
        : [...prev.regions, region],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validation
      if (!formData.name.trim()) throw new Error('Program name is required');
      if (!formData.code.trim()) throw new Error('Program code is required');
      if (!formData.clientId) throw new Error('Client is required');
      if (!formData.startDate) throw new Error('Start date is required');
      if (!formData.endDate) throw new Error('End date is required');
      if (formData.totalBudget <= 0) throw new Error('Budget must be greater than 0');

      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save program');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium mb-4">Basic Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Program Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., ARISE Health Centers Phase II"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Program Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
              placeholder="e.g., ARISE-2024"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              placeholder="Describe the program objectives and scope..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Client & Stakeholders */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Client & Stakeholders
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <ClientSelector
              selectedClientId={formData.clientId}
              onSelect={(id) => handleChange('clientId', id)}
              label="Client / Funder"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Funding Source
            </label>
            <input
              type="text"
              value={formData.fundingSource}
              onChange={(e) => handleChange('fundingSource', e.target.value)}
              placeholder="e.g., World Bank IDA Credit"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Implementing Agency
            </label>
            <input
              type="text"
              value={formData.implementingAgency}
              onChange={(e) => handleChange('implementingAgency', e.target.value)}
              placeholder="e.g., Ministry of Health"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Timeline & Budget */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Timeline & Budget
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Budget <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={formData.totalBudget || ''}
                onChange={(e) => handleChange('totalBudget', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {CURRENCIES.map(currency => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Geographic Coverage */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Geographic Coverage
        </h3>
        
        <div className="flex flex-wrap gap-2">
          {UGANDA_REGIONS.map(region => (
            <button
              key={region}
              type="button"
              onClick={() => toggleRegion(region)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                formData.regions.includes(region)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      {/* Objectives */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium mb-4">Program Objectives</h3>
        
        <div className="space-y-3">
          {formData.objectives.map((objective, index) => (
            <div key={index} className="flex gap-2">
              <span className="flex items-center justify-center w-8 h-10 bg-gray-100 rounded-lg text-sm font-medium text-gray-600">
                {index + 1}
              </span>
              <input
                type="text"
                value={objective}
                onChange={(e) => handleObjectiveChange(index, e.target.value)}
                placeholder={`Objective ${index + 1}`}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {formData.objectives.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveObjective(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          
          <button
            type="button"
            onClick={handleAddObjective}
            className="flex items-center gap-2 px-4 py-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Objective
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : isEditing ? 'Update Program' : 'Create Program'}
        </button>
      </div>
    </form>
  );
}
