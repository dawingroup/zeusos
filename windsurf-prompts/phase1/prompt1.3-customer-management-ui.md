# Prompt 1.3: Customer Management UI

## Objective
Create React components for customer management including list view, detail view, and create/edit forms following the existing design system.

## Prerequisites
- Completed Prompt 1.1 (Customer Data Model)
- Completed Prompt 1.2 (Customer CRUD Hooks)

## Requirements

### 1. Create CustomerList Component

Create file: `src/modules/customer-hub/components/CustomerList.tsx`

```typescript
/**
 * CustomerList Component
 * Displays filterable list of customers with search and status filters
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Building2, User, Phone, Mail, Filter } from 'lucide-react';
import { useCustomers } from '../hooks';
import type { CustomerStatus, CustomerType } from '../types';

const STATUS_CONFIG: Record<CustomerStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactive' },
  prospect: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Prospect' },
};

const TYPE_LABELS: Record<CustomerType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  contractor: 'Contractor',
  designer: 'Designer',
};

interface CustomerListProps {
  onNewCustomer?: () => void;
}

export function CustomerList({ onNewCustomer }: CustomerListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<CustomerType | ''>('');

  const { filteredCustomers, loading, error } = useCustomers({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    searchQuery,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Error loading customers: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <button
          onClick={onNewCustomer}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Customer
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | '')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="prospect">Prospect</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as CustomerType | '')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Types</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="contractor">Contractor</option>
            <option value="designer">Designer</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
      </div>

      {/* Customer Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No customers found</h3>
          <p className="text-gray-500 mt-1">
            {searchQuery || statusFilter || typeFilter
              ? 'Try adjusting your filters'
              : 'Create your first customer to get started'}
          </p>
          {!searchQuery && !statusFilter && !typeFilter && (
            <button
              onClick={onNewCustomer}
              className="mt-4 text-primary hover:underline"
            >
              Add Customer
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => {
            const statusConfig = STATUS_CONFIG[customer.status];
            return (
              <Link
                key={customer.id}
                to={`/customers/${customer.id}`}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                    <p className="text-sm text-gray-500">{customer.code}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span>{TYPE_LABELS[customer.type]}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomerList;
```

### 2. Create CustomerForm Component

Create file: `src/modules/customer-hub/components/CustomerForm.tsx`

```typescript
/**
 * CustomerForm Component
 * Form for creating and editing customers
 */

import { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { useCustomerMutations } from '../hooks';
import { useAuth } from '@/shared/hooks';
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
  const [formData, setFormData] = useState<CustomerFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      });
    }
  }, [customer]);

  const handleGenerateCode = () => {
    if (formData.name) {
      const code = generateCode(formData.name, formData.type);
      setFormData((prev) => ({ ...prev, code }));
    }
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
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
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
                placeholder="+1 (555) 123-4567"
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
```

### 3. Create CustomerDetail Component

Create file: `src/modules/customer-hub/components/CustomerDetail.tsx`

```typescript
/**
 * CustomerDetail Component
 * Detailed view of a single customer with projects list
 */

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Building2,
  Mail,
  Phone,
  Globe,
  FolderOpen,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { useCustomer, useCustomerMutations } from '../hooks';
import { useAuth } from '@/shared/hooks';
import { CustomerForm } from './CustomerForm';
import type { CustomerStatus, CustomerType } from '../types';

const STATUS_CONFIG: Record<CustomerStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactive' },
  prospect: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Prospect' },
};

const TYPE_LABELS: Record<CustomerType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  contractor: 'Contractor',
  designer: 'Designer',
};

export function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { customer, loading, error } = useCustomer(customerId);
  const { remove, deleteState } = useCustomerMutations();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (!customerId || !user?.email) return;
    try {
      await remove(customerId, user.email, false); // Soft delete
      navigate('/customers');
    } catch (err) {
      // Error handled by mutation state
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-medium text-gray-900">Customer not found</h2>
        <Link to="/customers" className="text-primary hover:underline mt-2 inline-block">
          Back to Customers
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[customer.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            to="/customers"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {customer.code}
              </span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-gray-500 mt-1">{TYPE_LABELS[customer.type]}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditForm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h2>
          <div className="space-y-3">
            {customer.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <a href={`mailto:${customer.email}`} className="text-sm text-primary hover:underline">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${customer.phone}`} className="text-sm text-gray-700">
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.website && (
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-gray-400" />
                <a
                  href={customer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {customer.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* External Systems */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">External Systems</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Katana MRP</span>
              <span className={customer.externalIds.katanaId ? 'text-green-600' : 'text-gray-400'}>
                {customer.externalIds.katanaId || 'Not linked'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">QuickBooks</span>
              <span className={customer.externalIds.quickbooksId ? 'text-green-600' : 'text-gray-400'}>
                {customer.externalIds.quickbooksId || 'Not linked'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Google Drive</span>
              <span className={customer.externalIds.driveFolderId ? 'text-green-600' : 'text-gray-400'}>
                {customer.externalIds.driveFolderId ? 'Linked' : 'Not linked'}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Notes</h2>
          <p className="text-sm text-gray-600">
            {customer.notes || 'No notes added.'}
          </p>
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Projects</h2>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
        
        {/* TODO: Add projects list here after Phase 2 */}
        <div className="text-center py-8 text-gray-500">
          <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No projects yet</p>
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <CustomerForm customer={customer} onClose={() => setShowEditForm(false)} />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Customer?</h3>
            <p className="text-gray-600 mb-4">
              This will mark the customer as inactive. Active projects will remain accessible.
            </p>
            {deleteState.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-4">
                {deleteState.error.message}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                disabled={deleteState.loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={deleteState.loading}
              >
                {deleteState.loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetail;
```

### 4. Create Components Index

Create file: `src/modules/customer-hub/components/index.ts`

```typescript
/**
 * Customer Hub Components
 * Export all customer-related components
 */

export { CustomerList } from './CustomerList';
export { CustomerForm } from './CustomerForm';
export { CustomerDetail } from './CustomerDetail';
```

### 5. Update Module Index

Update file: `src/modules/customer-hub/index.ts`

```typescript
/**
 * Customer Hub Module
 * Exports for customer management functionality
 */

// Types
export * from './types';

// Services
export * from './services/customerService';

// Hooks
export * from './hooks';

// Components
export * from './components';
```

## Validation Checklist

- [ ] CustomerList displays customers in a responsive grid
- [ ] Search filters customers by name, code, and email
- [ ] Status and type filters work correctly
- [ ] CustomerForm validates required fields
- [ ] CustomerForm handles create and edit modes
- [ ] CustomerDetail shows all customer information
- [ ] Delete confirmation works with soft delete
- [ ] All components follow existing design system

## Next Steps

After completing this prompt, proceed to:
- **Prompt 1.4**: Katana Customer Sync - Cloud Function for Katana MRP integration
