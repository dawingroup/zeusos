/**
 * New Deal Form - Create a new investment deal
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  X,
  Building2,
  MapPin,
  DollarSign,
  Users,
  FileText,
  Loader2
} from 'lucide-react';
import { dealService } from '../services/deal-service';
import { useAuth } from '@/shared/hooks';

interface DealFormData {
  name: string;
  dealType: string;
  sector: string;
  subsector: string;
  country: string;
  region: string;
  city: string;
  targetInvestment: string;
  currency: string;
  investmentType: string;
  equityPercentage: string;
  expectedCloseDate: string;
  priority: string;
  description: string;
  investmentThesis: string;
  dealLead: string;
}

const initialFormData: DealFormData = {
  name: '',
  dealType: 'greenfield',
  sector: '',
  subsector: '',
  country: '',
  region: '',
  city: '',
  targetInvestment: '',
  currency: 'USD',
  investmentType: 'equity',
  equityPercentage: '',
  expectedCloseDate: '',
  priority: 'medium',
  description: '',
  investmentThesis: '',
  dealLead: '',
};

const sectors = [
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'energy', label: 'Energy' },
  { value: 'transport', label: 'Transport' },
  { value: 'water', label: 'Water & Sanitation' },
  { value: 'digital', label: 'Digital Infrastructure' },
  { value: 'social', label: 'Social Infrastructure' },
  { value: 'financial', label: 'Financial Services' },
];

const countries = [
  { value: 'UG', label: 'Uganda' },
  { value: 'KE', label: 'Kenya' },
  { value: 'TZ', label: 'Tanzania' },
  { value: 'RW', label: 'Rwanda' },
  { value: 'ET', label: 'Ethiopia' },
  { value: 'GH', label: 'Ghana' },
  { value: 'NG', label: 'Nigeria' },
];

const dealTypes = [
  { value: 'greenfield', label: 'Greenfield' },
  { value: 'brownfield', label: 'Brownfield' },
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'expansion', label: 'Expansion' },
  { value: 'refinancing', label: 'Refinancing' },
];

const investmentTypes = [
  { value: 'equity', label: 'Equity' },
  { value: 'debt', label: 'Debt' },
  { value: 'mezzanine', label: 'Mezzanine' },
  { value: 'hybrid', label: 'Hybrid' },
];

export function NewDeal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState<DealFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof DealFormData, string>>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (field: keyof DealFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof DealFormData, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Deal name is required';
    }
    if (!formData.sector) {
      newErrors.sector = 'Sector is required';
    }
    if (!formData.country) {
      newErrors.country = 'Country is required';
    }
    if (!formData.targetInvestment) {
      newErrors.targetInvestment = 'Target investment is required';
    } else if (isNaN(Number(formData.targetInvestment))) {
      newErrors.targetInvestment = 'Must be a valid number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    if (!user) {
      setSubmitError('You must be logged in to create a deal');
      return;
    }
    
    setSaving(true);
    setSubmitError(null);
    
    try {
      // Transform form data to match DealFormData type expected by service
      // Note: Firestore does not accept undefined values, use null instead
      const dealData = {
        name: formData.name,
        description: formData.description || '',
        dealType: formData.dealType as any,
        sector: formData.sector as any,
        subsector: formData.subsector || '',
        expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate) : null,
        targetAmount: {
          amount: parseFloat(formData.targetInvestment) || 0,
          currency: formData.currency,
        },
        investmentStructure: {
          primaryType: formData.investmentType as any,
          equityPercentage: formData.equityPercentage ? parseFloat(formData.equityPercentage) : null,
        },
        geography: {
          country: formData.country,
          region: formData.region || '',
          city: formData.city || '',
        },
      };
      
      // Create deal using service - using empty engagementId for now
      await dealService.createDeal('', dealData as any, user.uid);
      
      navigate('/advisory/investment/deals');
    } catch (err: any) {
      console.error('Error creating deal:', err);
      setSubmitError(err.message || 'Failed to create deal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Error Display */}
      {submitError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {submitError}
        </div>
      )}

      {/* Loading State */}
      {saving && (
        <div className="mb-4 flex items-center gap-2 text-emerald-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Creating deal...</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Deal</h1>
            <p className="text-sm text-gray-500">Create a new investment opportunity</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Create Deal'}
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold">Basic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Kampala Hospital Expansion"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-200'
                }`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deal Type
              </label>
              <select
                value={formData.dealType}
                onChange={(e) => handleChange('dealType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {dealTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sector <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.sector}
                onChange={(e) => handleChange('sector', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                  errors.sector ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <option value="">Select sector...</option>
                {sectors.map(sector => (
                  <option key={sector.value} value={sector.value}>{sector.label}</option>
                ))}
              </select>
              {errors.sector && <p className="text-xs text-red-500 mt-1">{errors.sector}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subsector
              </label>
              <input
                type="text"
                value={formData.subsector}
                onChange={(e) => handleChange('subsector', e.target.value)}
                placeholder="e.g., Secondary Healthcare"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Geography */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold">Geography</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                  errors.country ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <option value="">Select country...</option>
                {countries.map(country => (
                  <option key={country.value} value={country.value}>{country.label}</option>
                ))}
              </select>
              {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Region
              </label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) => handleChange('region', e.target.value)}
                placeholder="e.g., Central"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="e.g., Kampala"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Investment Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold">Investment Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Investment <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <select
                  value={formData.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="px-3 py-2 border border-r-0 border-gray-200 rounded-l-lg text-sm bg-gray-50"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <input
                  type="text"
                  value={formData.targetInvestment}
                  onChange={(e) => handleChange('targetInvestment', e.target.value)}
                  placeholder="e.g., 15000000"
                  className={`flex-1 px-3 py-2 border rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.targetInvestment ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
              </div>
              {errors.targetInvestment && <p className="text-xs text-red-500 mt-1">{errors.targetInvestment}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Investment Type
              </label>
              <select
                value={formData.investmentType}
                onChange={(e) => handleChange('investmentType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {investmentTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            
            {formData.investmentType === 'equity' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Equity %
                </label>
                <input
                  type="text"
                  value={formData.equityPercentage}
                  onChange={(e) => handleChange('equityPercentage', e.target.value)}
                  placeholder="e.g., 35"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Close Date
              </label>
              <input
                type="date"
                value={formData.expectedCloseDate}
                onChange={(e) => handleChange('expectedCloseDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Team */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold">Team</h2>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal Lead
            </label>
            <input
              type="text"
              value={formData.dealLead}
              onChange={(e) => handleChange('dealLead', e.target.value)}
              placeholder="Select or enter deal lead name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Description & Thesis */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold">Description & Thesis</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                placeholder="Brief description of the deal..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Investment Thesis
              </label>
              <textarea
                value={formData.investmentThesis}
                onChange={(e) => handleChange('investmentThesis', e.target.value)}
                rows={4}
                placeholder="Why is this a compelling investment opportunity?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Deal'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewDeal;
