/**
 * Client Form
 * 
 * Form for creating or editing advisory clients.
 */

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

type ClientType = 'institutional' | 'family_office' | 'individual' | 'sovereign';
type ClientStatus = 'active' | 'prospect' | 'dormant';

interface ClientContact {
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

interface ClientFormData {
  name: string;
  type: ClientType;
  status: ClientStatus;
  jurisdiction: string;
  taxId: string;
  address: string;
  relationshipManager: string;
  contacts: ClientContact[];
  notes: string;
}

interface ClientFormProps {
  initialData?: Partial<ClientFormData>;
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
  loading?: boolean;
}

const defaultContact: ClientContact = {
  name: '',
  role: '',
  email: '',
  phone: '',
  isPrimary: false,
};

const defaultFormData: ClientFormData = {
  name: '',
  type: 'institutional',
  status: 'prospect',
  jurisdiction: '',
  taxId: '',
  address: '',
  relationshipManager: '',
  contacts: [{ ...defaultContact, isPrimary: true }],
  notes: '',
};

export function ClientForm({
  initialData,
  onSubmit,
  onCancel,
  isEditing = false,
  loading = false,
}: ClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>({
    ...defaultFormData,
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const updateField = <K extends keyof ClientFormData>(
    field: K,
    value: ClientFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };
  
  const addContact = () => {
    setFormData((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { ...defaultContact }],
    }));
  };
  
  const updateContact = (index: number, updates: Partial<ClientContact>) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, ...updates } : c)),
    }));
  };
  
  const removeContact = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  };
  
  const setPrimaryContact = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => ({
        ...c,
        isPrimary: i === index,
      })),
    }));
  };
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Client name is required';
    }
    
    if (!formData.type) {
      newErrors.type = 'Client type is required';
    }
    
    const hasValidContact = formData.contacts.some(
      (c) => c.name.trim() && c.email.trim()
    );
    if (!hasValidContact) {
      newErrors.contacts = 'At least one contact with name and email is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {isEditing ? 'Edit Client' : 'New Client'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-md"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Basic Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter client name"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => updateField('type', e.target.value as ClientType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="institutional">Institutional</option>
              <option value="family_office">Family Office</option>
              <option value="individual">Individual</option>
              <option value="sovereign">Sovereign</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value as ClientStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jurisdiction
            </label>
            <input
              type="text"
              value={formData.jurisdiction}
              onChange={(e) => updateField('jurisdiction', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="e.g., United States"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax ID
            </label>
            <input
              type="text"
              value={formData.taxId}
              onChange={(e) => updateField('taxId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Tax identification number"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Relationship Manager
            </label>
            <input
              type="text"
              value={formData.relationshipManager}
              onChange={(e) => updateField('relationshipManager', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Assigned RM"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <textarea
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Full address"
          />
        </div>
      </div>
      
      {/* Contacts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Contacts</h3>
          <button
            type="button"
            onClick={addContact}
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Contact
          </button>
        </div>
        
        {errors.contacts && (
          <p className="text-xs text-red-500">{errors.contacts}</p>
        )}
        
        {formData.contacts.map((contact, index) => (
          <div
            key={index}
            className="p-4 border rounded-lg space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contact.isPrimary}
                  onChange={() => setPrimaryContact(index)}
                  className="rounded"
                />
                <label className="text-sm text-gray-600">Primary Contact</label>
              </div>
              {formData.contacts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeContact(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={contact.name}
                onChange={(e) => updateContact(index, { name: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Contact name"
              />
              <input
                type="text"
                value={contact.role}
                onChange={(e) => updateContact(index, { role: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Role / Title"
              />
              <input
                type="email"
                value={contact.email}
                onChange={(e) => updateContact(index, { email: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Email address"
              />
              <input
                type="tel"
                value={contact.phone}
                onChange={(e) => updateContact(index, { phone: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Phone number"
              />
            </div>
          </div>
        ))}
      </div>
      
      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="Additional notes about the client..."
        />
      </div>
      
      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Client'}
        </button>
      </div>
    </form>
  );
}

export default ClientForm;
