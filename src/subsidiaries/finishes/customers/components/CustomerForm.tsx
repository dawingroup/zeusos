/**
 * CustomerForm Component
 * Form for creating and editing customers
 */

import { useState, useEffect } from 'react';
import { X, RefreshCw, FolderPlus } from 'lucide-react';
import { useCustomerMutations } from '../hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useDriveService } from '@/services/driveService';
import type { Customer, CustomerFormData, CustomerType, CustomerStatus } from '../types';

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
