/**
 * Enhanced Project Form - Create/Edit projects with client selection and full Uganda administrative boundaries
 */

import { useState, useEffect } from 'react';
import {
  Save,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  MapPin,
  Building2,
  Loader2,
  UserPlus,
  X,
  Sparkles,
} from 'lucide-react';
import { db } from '@/core/services/firebase';
import { collection, addDoc, Timestamp, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { useAuth } from '@/shared/hooks';
import { useClients } from '../../hooks/client-hooks';
import {
  REGIONS,
  DISTRICTS_BY_REGION,
  SUBCOUNTIES_BY_DISTRICT
} from '../../data/uganda-admin-boundaries';

interface ProjectFormData {
  name: string;
  code: string;
  description: string;
  programId: string;
  clientId: string;
  projectType: string;
  implementationType: 'contractor' | 'direct';
  // Location
  siteName: string;
  region: string;
  district: string;
  subcounty: string;
  // Timeline
  startDate: string;
  endDate: string;
  // Budget
  totalBudget: number;
  currency: string;
  contingencyPercent: number;
  // Scope
  majorWorks: string[];
  expectedDeliverables: string[];
}

interface ProjectFormProps {
  programId?: string;
  programName?: string;
  programCode?: string;
  initialData?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

interface NewClientFormData {
  name: string;
  email: string;
  phone: string;
  type: 'individual' | 'organization' | 'government' | 'ngo';
}

const PROJECT_TYPES = [
  { value: 'new_construction', label: 'New Construction' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'expansion', label: 'Expansion' },
  { value: 'equipment_installation', label: 'Equipment Installation' },
  { value: 'mixed', label: 'Mixed Works' },
];

const CURRENCIES = ['UGX', 'USD', 'EUR'];

const CLIENT_TYPES = [
  { value: 'government', label: 'Government' },
  { value: 'organization', label: 'Organization' },
  { value: 'ngo', label: 'NGO' },
  { value: 'individual', label: 'Individual' },
];

export function ProjectFormEnhanced({
  programId,
  programName,
  programCode,
  initialData,
  onSubmit,
  onCancel,
  isEditing = false
}: ProjectFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Load clients
  const { clients, loading: loadingClients, refetch: refetchClients } = useClients(db);

  const [formData, setFormData] = useState<ProjectFormData>({
    name: initialData?.name || '',
    code: initialData?.code || '',
    description: initialData?.description || '',
    programId: programId || initialData?.programId || '',
    clientId: initialData?.clientId || '',
    projectType: initialData?.projectType || 'new_construction',
    implementationType: initialData?.implementationType || 'contractor',
    siteName: initialData?.siteName || '',
    region: initialData?.region || '',
    district: initialData?.district || '',
    subcounty: initialData?.subcounty || '',
    startDate: initialData?.startDate || '',
    endDate: initialData?.endDate || '',
    totalBudget: initialData?.totalBudget || 0,
    currency: initialData?.currency || 'UGX',
    contingencyPercent: initialData?.contingencyPercent || 5,
    majorWorks: initialData?.majorWorks || [''],
    expectedDeliverables: initialData?.expectedDeliverables || [''],
  });

  const [newClientData, setNewClientData] = useState<NewClientFormData>({
    name: '',
    email: '',
    phone: '',
    type: 'organization',
  });

  // Auto-generate project code when not editing
  useEffect(() => {
    if (!isEditing && !formData.code && programCode && programId) {
      generateProjectCode();
    }
  }, [programCode, programId, isEditing]);

  // Sync programId prop with form state when it changes
  useEffect(() => {
    if (programId) {
      setFormData(prev => ({ ...prev, programId }));
    }
  }, [programId]);

  const generateProjectCode = async () => {
    if (!programCode) return;

    setGeneratingCode(true);
    try {
      const year = new Date().getFullYear().toString().slice(-2);
      const prefix = `${programCode}-${year}-`;

      // Query for existing codes with this prefix
      const projectsRef = collection(db, 'projects');
      const q = query(
        projectsRef,
        where('projectCode', '>=', prefix),
        where('projectCode', '<', prefix + '\uf8ff'),
        orderBy('projectCode', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);

      let newCode: string;
      if (snapshot.empty) {
        newCode = `${prefix}001`;
      } else {
        const lastCode = snapshot.docs[0].data().projectCode;
        const lastNumber = parseInt(lastCode.split('-').pop() || '0', 10);
        newCode = `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
      }

      setFormData(prev => ({ ...prev, code: newCode }));
    } catch (err) {
      console.error('Error generating project code:', err);
      setError('Failed to generate project code. Please enter manually.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleChange = (field: keyof ProjectFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Reset district when region changes
    if (field === 'region') {
      setFormData(prev => ({ ...prev, district: '', subcounty: '', [field]: value }));
    }

    // Reset sub-county when district changes
    if (field === 'district') {
      setFormData(prev => ({ ...prev, subcounty: '', [field]: value }));
    }
  };

  const handleArrayAdd = (field: 'majorWorks' | 'expectedDeliverables') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  const handleArrayRemove = (field: 'majorWorks' | 'expectedDeliverables', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleArrayChange = (field: 'majorWorks' | 'expectedDeliverables', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item),
    }));
  };

  const handleCreateClient = async () => {
    if (!newClientData.name.trim()) {
      alert('Client name is required');
      return;
    }

    setCreatingClient(true);
    try {
      const clientsRef = collection(db, 'customers');
      const newClient = {
        ...newClientData,
        status: 'active' as const,
        createdAt: Timestamp.now(),
        createdBy: user?.uid || 'system',
      };

      const docRef = await addDoc(clientsRef, newClient);

      // Refresh clients list
      await refetchClients();

      // Select the newly created client
      setFormData(prev => ({ ...prev, clientId: docRef.id }));

      // Reset form and close modal
      setNewClientData({
        name: '',
        email: '',
        phone: '',
        type: 'organization',
      });
      setShowClientModal(false);
    } catch (err) {
      console.error('Error creating client:', err);
      alert('Failed to create client. Please try again.');
    } finally {
      setCreatingClient(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.name.trim()) throw new Error('Project name is required');
      if (!formData.code.trim()) throw new Error('Project code is required');
      if (!formData.programId) throw new Error('Program is required');
      if (!formData.clientId) throw new Error('Client is required');
      if (!formData.region) throw new Error('Region is required');
      if (!formData.district) throw new Error('District is required');
      if (!formData.startDate) throw new Error('Start date is required');
      if (!formData.endDate) throw new Error('End date is required');
      if (formData.totalBudget <= 0) throw new Error('Budget must be greater than 0');

      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const availableDistricts = formData.region ? DISTRICTS_BY_REGION[formData.region] || [] : [];
  const availableSubCounties = formData.district ? SUBCOUNTIES_BY_DISTRICT[formData.district] || [] : [];
  const selectedClient = clients.find(c => c.id === formData.clientId);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Program Info */}
        {programName && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Creating project under:</div>
            <div className="text-lg font-semibold text-blue-900">{programName}</div>
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Rushoroza Health Center IV"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.code}
                  readOnly={!isEditing}
                  onChange={(e) => isEditing && handleChange('code', e.target.value.toUpperCase())}
                  placeholder={generatingCode ? 'Generating...' : 'Auto-generated'}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono bg-gray-50"
                  title="Project code is auto-generated based on program code and year"
                />
                {generatingCode && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                )}
                {!generatingCode && formData.code && (
                  <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Auto-generated: {programCode ? `${programCode}-YY-###` : 'Select program first'}
              </p>
            </div>

            {/* Client Selection */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {loadingClients ? (
                  <div className="flex-1 flex items-center gap-2 px-4 py-2 border rounded-lg bg-gray-50">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-gray-500">Loading clients...</span>
                  </div>
                ) : (
                  <select
                    value={formData.clientId}
                    onChange={(e) => handleChange('clientId', e.target.value)}
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">-- Select a client --</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setShowClientModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  New Client
                </button>
              </div>
              {selectedClient && (
                <p className="mt-1 text-xs text-gray-500">
                  {selectedClient.type} • {selectedClient.email || 'No email'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.projectType}
                onChange={(e) => handleChange('projectType', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {PROJECT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Implementation Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="implementationType"
                    value="contractor"
                    checked={formData.implementationType === 'contractor'}
                    onChange={(e) => handleChange('implementationType', e.target.value)}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Contractor</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="implementationType"
                    value="direct"
                    checked={formData.implementationType === 'direct'}
                    onChange={(e) => handleChange('implementationType', e.target.value)}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Direct Implementation</span>
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                placeholder="Describe the project scope..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Location Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.siteName}
                onChange={(e) => handleChange('siteName', e.target.value)}
                placeholder="e.g., Rushoroza HC IV"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Region <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.region}
                onChange={(e) => handleChange('region', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">-- Select region --</option>
                {REGIONS.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                District <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.district}
                onChange={(e) => handleChange('district', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                disabled={!formData.region}
              >
                <option value="">-- Select district --</option>
                {availableDistricts.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
              {!formData.region && (
                <p className="mt-1 text-xs text-gray-400">Select region first</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sub-county
              </label>
              <select
                value={formData.subcounty}
                onChange={(e) => handleChange('subcounty', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                disabled={!formData.district}
              >
                <option value="">-- Select sub-county --</option>
                {availableSubCounties.map(subcounty => (
                  <option key={subcounty} value={subcounty}>{subcounty}</option>
                ))}
              </select>
              {!formData.district && (
                <p className="mt-1 text-xs text-gray-400">Select district first</p>
              )}
              {formData.district && availableSubCounties.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">No sub-counties available for this district</p>
              )}
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

        {/* Scope */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-medium mb-4">Scope of Works</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Major Works */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Major Works
              </label>
              <div className="space-y-2">
                {formData.majorWorks.map((work, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={work}
                      onChange={(e) => handleArrayChange('majorWorks', index, e.target.value)}
                      placeholder={`Work item ${index + 1}`}
                      className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    {formData.majorWorks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleArrayRemove('majorWorks', index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleArrayAdd('majorWorks')}
                  className="flex items-center gap-2 px-4 py-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Work Item
                </button>
              </div>
            </div>

            {/* Expected Deliverables */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Deliverables
              </label>
              <div className="space-y-2">
                {formData.expectedDeliverables.map((deliverable, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={deliverable}
                      onChange={(e) => handleArrayChange('expectedDeliverables', index, e.target.value)}
                      placeholder={`Deliverable ${index + 1}`}
                      className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    {formData.expectedDeliverables.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleArrayRemove('expectedDeliverables', index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleArrayAdd('expectedDeliverables')}
                  className="flex items-center gap-2 px-4 py-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Deliverable
                </button>
              </div>
            </div>
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
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Update Project' : 'Create Project'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* New Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create New Client</h3>
              <button
                onClick={() => setShowClientModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientData.name}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Ministry of Health"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newClientData.type}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {CLIENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="client@example.com"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+256 XXX XXX XXX"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowClientModal(false)}
                disabled={creatingClient}
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateClient}
                disabled={creatingClient || !newClientData.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {creatingClient ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create Client
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
