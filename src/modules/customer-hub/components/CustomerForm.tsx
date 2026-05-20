/**
 * CustomerForm Component
 * Form for creating and editing customers
 */

import { useState, useEffect } from 'react';
import { X, RefreshCw, FolderPlus, Copy, Plus, Trash2, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { useCustomerMutations } from '../hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useDriveService } from '@/services/driveService';
import type { Customer, CustomerFormData, CustomerType, CustomerStatus, Address, ContactPerson, ContactRole } from '../types';
import { CONTACT_ROLE_LABELS } from '../types';

interface CustomerFormProps {
  customer?: Customer;
  onClose: () => void;
  onSuccess?: (customerId: string) => void;
}

const INITIAL_FORM_DATA: CustomerFormData = {
  code: '',
  name: '',
  type: 'residential',
  status: 'active',
  email: '',
  phone: '',
  website: '',
  contacts: [],
  externalIds: {},
  tags: [],
};

export function CustomerForm({ customer, onClose, onSuccess }: CustomerFormProps) {
  const { user } = useAuth();
  const { create, update, generateCode, createState, updateState } = useCustomerMutations();
  const { createCustomerFolder } = useDriveService();
  const [formData, setFormData] = useState<CustomerFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createDriveFolder, setCreateDriveFolder] = useState(true);
  const [folderStatus, setFolderStatus] = useState<string | null>(null);
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(false);
  const [expandedContactIdx, setExpandedContactIdx] = useState<number | null>(null);

  const isEditing = !!customer;
  const isLoading = createState.loading || updateState.loading;
  const mutationError = createState.error || updateState.error;

  useEffect(() => {
    if (customer) {
      setFormData({
        code: customer.code,
        name: customer.name,
        type: customer.type,
        status: customer.status,
        email: customer.email || '',
        phone: customer.phone || '',
        website: customer.website || '',
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        contacts: customer.contacts,
        externalIds: customer.externalIds,
        notes: customer.notes,
        tags: customer.tags,
        driveFolderLink: customer.driveFolderLink || '',
      });
    }
  }, [customer]);

  const handleGenerateCode = async () => {
    const code = await generateCode();
    setFormData((prev) => ({ ...prev, code }));
  };

  const addContact = () => {
    const newContact: ContactPerson = {
      id: crypto.randomUUID(),
      name: '',
      isPrimary: formData.contacts.length === 0,
    };
    setFormData((prev) => ({ ...prev, contacts: [...prev.contacts, newContact] }));
    setExpandedContactIdx(formData.contacts.length);
  };

  const updateContact = (idx: number, updates: Partial<ContactPerson>) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === idx ? { ...c, ...updates } : c)),
    }));
  };

  const removeContact = (idx: number) => {
    setFormData((prev) => {
      const updated = prev.contacts.filter((_, i) => i !== idx);
      // If we removed the primary and there are others, make first one primary
      if (prev.contacts[idx]?.isPrimary && updated.length > 0) {
        updated[0] = { ...updated[0], isPrimary: true };
      }
      return { ...prev, contacts: updated };
    });
    setExpandedContactIdx(null);
  };

  const setPrimaryContact = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => ({ ...c, isPrimary: i === idx })),
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Customer code is required';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Customer name is required';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !user?.email) return;

    try {
      if (isEditing && customer) {
        await update(customer.id, formData, user.email);
        onSuccess?.(customer.id);
      } else {
        const id = await create(formData, user.email);
        
        // Create Google Drive folder if option is selected
        if (createDriveFolder) {
          setFolderStatus('Creating Google Drive folder...');
          try {
            const folderResult = await createCustomerFolder(formData.name, formData.code);
            if (folderResult.success) {
              // Update customer with folder link
              await update(id, { driveFolderLink: folderResult.customerFolderLink }, user.email);
              setFolderStatus('Folder created successfully!');
            } else {
              console.error('Failed to create folder:', folderResult.error);
              setFolderStatus(`Folder creation failed: ${folderResult.error}`);
            }
          } catch (folderErr) {
            console.error('Drive folder error:', folderErr);
            setFolderStatus('Could not create Drive folder (sign in may be required)');
          }
        }
        
        onSuccess?.(id);
      }
      onClose();
    } catch (err) {
      // Error is handled by mutation state
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Customer' : 'New Customer'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error Banner */}
          {mutationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {mutationError.message}
            </div>
          )}

          {/* Code and Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Code *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                    errors.code ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="SMITH-RES-001"
                />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Generate code from name"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setFormData((prev) => ({ ...prev, name: newName }));
                }}
                onBlur={async () => {
                  // Auto-generate code on blur if empty (new customer only)
                  if (!isEditing && formData.name.trim() && !formData.code) {
                    const code = await generateCode();
                    setFormData((prev) => ({ ...prev, code }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                  errors.name ? 'border-red-300' : 'border-gray-200'
                }`}
                placeholder="John Smith"
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
          </div>

          {/* Type and Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as CustomerType }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="contractor">Contractor</option>
                <option value="designer">Designer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as CustomerStatus }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                  errors.email ? 'border-red-300' : 'border-gray-200'
                }`}
                placeholder="john@example.com"
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="+254 700 000 000"
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="https://example.com"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Additional notes about this customer..."
            />
          </div>

          {/* Contact Persons */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">
                Contact Persons ({formData.contacts.length})
              </h3>
              <button
                type="button"
                onClick={addContact}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Contact
              </button>
            </div>

            {formData.contacts.length === 0 && (
              <p className="text-sm text-gray-500 italic">No contact persons added yet.</p>
            )}

            <div className="space-y-3">
              {formData.contacts.map((contact, idx) => {
                const isExpanded = expandedContactIdx === idx;
                return (
                  <div
                    key={contact.id || idx}
                    className={`border rounded-lg ${
                      contact.isPrimary ? 'border-primary/30 bg-primary/5' : 'border-gray-200'
                    }`}
                  >
                    {/* Contact Header */}
                    <div className="flex items-center justify-between p-3">
                      <button
                        type="button"
                        onClick={() => setExpandedContactIdx(isExpanded ? null : idx)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {contact.name || 'New Contact'}
                        </span>
                        {contact.isPrimary && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                            <Star className="h-3 w-3" />
                            Primary
                          </span>
                        )}
                        {contact.title && (
                          <span className="text-xs text-gray-500">({contact.title})</span>
                        )}
                      </button>
                      <div className="flex items-center gap-1">
                        {!contact.isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryContact(idx)}
                            className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100"
                            title="Set as primary contact"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeContact(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          title="Remove contact"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Contact Fields (expanded) */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                            <input
                              type="text"
                              value={contact.name}
                              onChange={(e) => updateContact(idx, { name: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              placeholder="Full name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                            <input
                              type="text"
                              value={contact.title || ''}
                              onChange={(e) => updateContact(idx, { title: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              placeholder="e.g., Managing Director"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                            <select
                              value={contact.role || ''}
                              onChange={(e) => updateContact(idx, { role: (e.target.value || undefined) as ContactRole | undefined })}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            >
                              <option value="">Select role...</option>
                              {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                            <input
                              type="text"
                              value={contact.department || ''}
                              onChange={(e) => updateContact(idx, { department: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              placeholder="e.g., Procurement, Design"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                            <input
                              type="email"
                              value={contact.email || ''}
                              onChange={(e) => updateContact(idx, { email: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              placeholder="email@example.com"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                            <input
                              type="tel"
                              value={contact.phone || ''}
                              onChange={(e) => updateContact(idx, { phone: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              placeholder="+254 700 000 000"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mobile</label>
                            <input
                              type="tel"
                              value={contact.mobile || ''}
                              onChange={(e) => updateContact(idx, { mobile: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              placeholder="+254 700 000 000"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                          <input
                            type="text"
                            value={contact.notes || ''}
                            onChange={(e) => updateContact(idx, { notes: e.target.value })}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="Additional notes about this contact"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Billing Address */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Billing Address</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={formData.billingAddress?.street1 || ''}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    billingAddress: { ...prev.billingAddress, street1: e.target.value } as Address,
                    ...(shippingSameAsBilling ? { shippingAddress: { ...prev.billingAddress, street1: e.target.value } as Address } : {}),
                  }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Street address, P.O. Box"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address 2</label>
                <input
                  type="text"
                  value={formData.billingAddress?.street2 || ''}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    billingAddress: { ...prev.billingAddress, street2: e.target.value } as Address,
                    ...(shippingSameAsBilling ? { shippingAddress: { ...prev.billingAddress, street2: e.target.value } as Address } : {}),
                  }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Apartment, suite, unit, floor (optional)"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.billingAddress?.city || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      billingAddress: { ...prev.billingAddress, city: e.target.value } as Address,
                      ...(shippingSameAsBilling ? { shippingAddress: { ...prev.billingAddress, city: e.target.value } as Address } : {}),
                    }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State / Region</label>
                  <input
                    type="text"
                    value={formData.billingAddress?.state || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      billingAddress: { ...prev.billingAddress, state: e.target.value } as Address,
                      ...(shippingSameAsBilling ? { shippingAddress: { ...prev.billingAddress, state: e.target.value } as Address } : {}),
                    }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="State or region"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={formData.billingAddress?.postalCode || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      billingAddress: { ...prev.billingAddress, postalCode: e.target.value } as Address,
                      ...(shippingSameAsBilling ? { shippingAddress: { ...prev.billingAddress, postalCode: e.target.value } as Address } : {}),
                    }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Postal code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.billingAddress?.country || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      billingAddress: { ...prev.billingAddress, country: e.target.value } as Address,
                      ...(shippingSameAsBilling ? { shippingAddress: { ...prev.billingAddress, country: e.target.value } as Address } : {}),
                    }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Shipping / Site Address</h3>
              <button
                type="button"
                onClick={() => {
                  setShippingSameAsBilling(!shippingSameAsBilling);
                  if (!shippingSameAsBilling) {
                    setFormData((prev) => ({ ...prev, shippingAddress: prev.billingAddress ? { ...prev.billingAddress } : undefined }));
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${
                  shippingSameAsBilling
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Copy className="h-3 w-3" />
                Same as billing
              </button>
            </div>
            {!shippingSameAsBilling && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.shippingAddress?.street1 || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      shippingAddress: { ...prev.shippingAddress, street1: e.target.value } as Address,
                    }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Street address, P.O. Box"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address 2</label>
                  <input
                    type="text"
                    value={formData.shippingAddress?.street2 || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      shippingAddress: { ...prev.shippingAddress, street2: e.target.value } as Address,
                    }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Apartment, suite, unit, floor (optional)"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.shippingAddress?.city || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        shippingAddress: { ...prev.shippingAddress, city: e.target.value } as Address,
                      }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State / Region</label>
                    <input
                      type="text"
                      value={formData.shippingAddress?.state || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        shippingAddress: { ...prev.shippingAddress, state: e.target.value } as Address,
                      }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="State or region"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={formData.shippingAddress?.postalCode || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        shippingAddress: { ...prev.shippingAddress, postalCode: e.target.value } as Address,
                      }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="Postal code"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={formData.shippingAddress?.country || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        shippingAddress: { ...prev.shippingAddress, country: e.target.value } as Address,
                      }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>
            )}
            {shippingSameAsBilling && (
              <p className="text-sm text-gray-500 italic">Shipping address will be the same as billing address.</p>
            )}
          </div>

          {/* External Integrations */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">External Integrations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shopify Customer ID
                </label>
                <input
                  type="text"
                  value={formData.externalIds?.shopifyId || ''}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    externalIds: { ...prev.externalIds, shopifyId: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g., gid://shopify/Customer/123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  QuickBooks Customer ID
                </label>
                <input
                  type="text"
                  value={formData.externalIds?.quickbooksId || ''}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    externalIds: { ...prev.externalIds, quickbooksId: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g., 12345"
                />
              </div>
            </div>
          </div>

          {/* Google Drive Folder - different UI for new vs edit */}
          {!isEditing ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <input
                type="checkbox"
                id="createDriveFolder"
                checked={createDriveFolder}
                onChange={(e) => setCreateDriveFolder(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <label htmlFor="createDriveFolder" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <FolderPlus className="h-4 w-4 text-blue-600" />
                Create Google Drive folder for this customer
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Drive Folder Link
              </label>
              <input
                type="url"
                value={formData.driveFolderLink || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, driveFolderLink: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="https://drive.google.com/drive/folders/..."
              />
            </div>
          )}

          {/* Folder Status */}
          {folderStatus && (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {folderStatus}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerForm;
