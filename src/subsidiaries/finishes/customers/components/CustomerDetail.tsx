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
  FolderPlus,
  Loader2,
} from 'lucide-react';
import { useCustomer, useCustomerMutations } from '../hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useRecordTracker } from '@/core/hooks/useRecordTracker';
import { useDriveService } from '@/services/driveService';
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
  // Log this record for the Global Search palette's recency boost + empty state.
  useRecordTracker({
    type: 'customer',
    id: customer?.id,
    title: customer?.name ?? '',
    subtitle: customer?.code,
    module: 'crm',
  });
  const { remove, update, deleteState } = useCustomerMutations();
  const { createCustomerFolder } = useDriveService();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [syncingQuickBooks, setSyncingQuickBooks] = useState(false);
  const [qbError, setQbError] = useState<string | null>(null);

  const handleCreateDriveFolder = async () => {
    if (!customer || !user?.email || !customerId) return;
    
    setCreatingFolder(true);
    setFolderError(null);
    
    try {
      const result = await createCustomerFolder(customer.name, customer.code);
      if (result.success) {
        await update(customerId, { driveFolderLink: result.customerFolderLink }, user.email);
      } else {
        setFolderError(result.error || 'Failed to create folder');
      }
    } catch (err: any) {
      setFolderError(err.message || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleSyncQuickBooks = async () => {
    if (!customerId) return;
    
    setSyncingQuickBooks(true);
    setQbError(null);
    
    try {
      const response = await fetch('https://api-okekivpl2a-uc.a.run.app/quickbooks/sync-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (err: any) {
      if (err.message.includes('not connected')) {
        // Redirect to connect QuickBooks
        const authResponse = await fetch('https://api-okekivpl2a-uc.a.run.app/quickbooks/auth-url');
        const { url } = await authResponse.json();
        window.location.href = url;
      } else {
        setQbError(err.message || 'Failed to sync');
      }
    } finally {
      setSyncingQuickBooks(false);
    }
  };

  const handleDelete = async () => {
    if (!customerId || !user?.email) return;
    try {
      await remove(customerId, user.email, true); // Hard delete - permanently remove from database
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
            {!customer.email && !customer.phone && !customer.website && (
              <p className="text-sm text-gray-500">No contact information</p>
            )}
          </div>
        </div>

        {/* External Systems */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">External Systems</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">QuickBooks</span>
              {customer.externalIds?.quickbooksId ? (
                <span className="text-green-600">{customer.externalIds.quickbooksId}</span>
              ) : (
                <button
                  onClick={handleSyncQuickBooks}
                  disabled={syncingQuickBooks}
                  className="flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
                >
                  {syncingQuickBooks ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    'Sync to QuickBooks'
                  )}
                </button>
              )}
            </div>
            {qbError && (
              <p className="text-xs text-red-600 mt-1">{qbError}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Google Drive</span>
              {customer.driveFolderLink ? (
                <a
                  href={customer.driveFolderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Open Folder
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <button
                  onClick={handleCreateDriveFolder}
                  disabled={creatingFolder}
                  className="flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
                >
                  {creatingFolder ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FolderPlus className="h-3 w-3" />
                      Create Folder
                    </>
                  )}
                </button>
              )}
            </div>
            {folderError && (
              <p className="text-xs text-red-600 mt-1">{folderError}</p>
            )}
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
          <Link 
            to={`/design?customerId=${customerId}`}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>
        
        <div className="text-center py-8 text-gray-500">
          <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No projects yet</p>
          <p className="text-xs text-gray-400 mt-1">Projects will appear here once created</p>
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
