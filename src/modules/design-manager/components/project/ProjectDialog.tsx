/**
 * Project Dialog
 * Dialog for creating, editing, and deleting design projects
 */

import { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { createProject, updateProject, deleteProject } from '../../services/firestore';
import { formatProjectCode } from '../../utils/formatting';
import { CustomerPicker } from '@/modules/customer-hub/components';
import type { CustomerPickerValue } from '@/modules/customer-hub/types';
import type { DesignProject, ProjectLocation } from '../../types';

export interface ProjectDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  project?: DesignProject | null; // If provided, dialog is in edit mode
  onDeleted?: () => void; // Callback when project is deleted
}

export function ProjectDialog({ open, onClose, userId, project, onDeleted }: ProjectDialogProps) {
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState<CustomerPickerValue | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'on-hold' | 'completed' | 'cancelled'>('active');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteCity, setSiteCity] = useState('');
  const [siteCountry, setSiteCountry] = useState('');
  const [siteGoogleMapsUrl, setSiteGoogleMapsUrl] = useState('');
  const [siteNotes, setSiteNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('');
  const [deliveryGoogleMapsUrl, setDeliveryGoogleMapsUrl] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditMode = !!project;

  // Populate form when editing
  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setCustomer(
        project.customerId
          ? { customerId: project.customerId, customerName: project.customerName || '' }
          : null
      );
      setDescription(project.description || '');
      setStatus(project.status || 'active');
      // Convert Firestore timestamp to date string for input
      if (project.dueDate) {
        const date = new Date(project.dueDate.seconds * 1000);
        setDueDate(date.toISOString().split('T')[0]);
      } else {
        setDueDate('');
      }
      if (project.startDate) {
        const date = new Date(project.startDate.seconds * 1000);
        setStartDate(date.toISOString().split('T')[0]);
      } else {
        setStartDate('');
      }
      // Populate location fields
      setSiteAddress(project.siteLocation?.address || '');
      setSiteCity(project.siteLocation?.city || '');
      setSiteCountry(project.siteLocation?.country || '');
      setSiteGoogleMapsUrl(project.siteLocation?.geoLocation?.googleMapsUrl || '');
      setSiteNotes(project.siteLocation?.notes || '');
      setDeliveryAddress(project.deliveryLocation?.address || '');
      setDeliveryCity(project.deliveryLocation?.city || '');
      setDeliveryCountry(project.deliveryLocation?.country || '');
      setDeliveryGoogleMapsUrl(project.deliveryLocation?.geoLocation?.googleMapsUrl || '');
      setDeliveryNotes(project.deliveryLocation?.notes || '');
    } else {
      setName('');
      setCustomer(null);
      setDescription('');
      setStatus('active');
      setDueDate('');
      setStartDate('');
      setSiteAddress('');
      setSiteCity('');
      setSiteCountry('');
      setSiteGoogleMapsUrl('');
      setSiteNotes('');
      setDeliveryAddress('');
      setDeliveryCity('');
      setDeliveryCountry('');
      setDeliveryGoogleMapsUrl('');
      setDeliveryNotes('');
    }
    setError(null);
    setShowDeleteConfirm(false);
  }, [project, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    // P5: customerId is required on DesignProject. Block both create and
    // update rather than silently clearing a customer link on an edit.
    if (!customer?.customerId || !customer.customerName) {
      setError('Customer is required — every project must be linked to a customer');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build location objects
      const buildLocation = (address: string, city: string, country: string, mapsUrl: string, notes: string): ProjectLocation | undefined => {
        if (!address && !city && !country && !mapsUrl && !notes) return undefined;
        const loc: ProjectLocation = {};
        if (address.trim()) loc.address = address.trim();
        if (city.trim()) loc.city = city.trim();
        if (country.trim()) loc.country = country.trim();
        if (mapsUrl.trim()) loc.geoLocation = { lat: 0, lng: 0, googleMapsUrl: mapsUrl.trim() };
        if (notes.trim()) loc.notes = notes.trim();
        return loc;
      };

      const siteLocation = buildLocation(siteAddress, siteCity, siteCountry, siteGoogleMapsUrl, siteNotes);
      const deliveryLocation = buildLocation(deliveryAddress, deliveryCity, deliveryCountry, deliveryGoogleMapsUrl, deliveryNotes);

      if (isEditMode && project) {
        // Update existing project
        await updateProject(project.id, {
          name: name.trim(),
          description: description.trim(),
          customerId: customer.customerId,
          customerName: customer.customerName,
          status,
          startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : undefined,
          dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : undefined,
          siteLocation,
          deliveryLocation,
        }, userId);
      } else {
        // Create new project
        const year = new Date().getFullYear();
        const sequence = Math.floor(Math.random() * 900) + 100;

        await createProject({
          code: formatProjectCode(year, sequence),
          name: name.trim(),
          description: description.trim(),
          customerId: customer.customerId,
          customerName: customer.customerName,
          status: 'active',
          startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : undefined,
          dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : undefined,
          siteLocation,
          deliveryLocation,
        }, userId);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} project`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;

    try {
      setLoading(true);
      setError(null);
      await deleteProject(project.id);
      onClose();
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditMode ? 'Edit Project' : 'New Project'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm ? (
          <div className="p-4 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800">Delete Project?</h3>
                <p className="text-sm text-red-700 mt-1">
                  This will permanently delete "{project?.name}" and all its design items, 
                  deliverables, and approvals. This action cannot be undone.
                </p>
              </div>
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className={cn(
                  'px-4 py-2 text-sm font-medium text-white rounded-lg',
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                )}
              >
                {loading ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Kitchen Renovation - Smith"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <CustomerPicker
                value={customer}
                onChange={setCustomer}
                placeholder="Search customers..."
              />
              <p className="text-xs text-gray-500 mt-1">
                <a href="/customers" className="text-primary hover:underline">Manage customers</a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                placeholder="Brief description of the project..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {isEditMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            {/* Site Location */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-gray-700">Project Site Location</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={siteAddress}
                    onChange={(e) => setSiteAddress(e.target.value)}
                    placeholder="Street address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <input
                  type="text"
                  value={siteCity}
                  onChange={(e) => setSiteCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <input
                  type="text"
                  value={siteCountry}
                  onChange={(e) => setSiteCountry(e.target.value)}
                  placeholder="Country"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <div className="col-span-2">
                  <input
                    type="url"
                    value={siteGoogleMapsUrl}
                    onChange={(e) => setSiteGoogleMapsUrl(e.target.value)}
                    placeholder="Google Maps link (paste pin URL)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={siteNotes}
                    onChange={(e) => setSiteNotes(e.target.value)}
                    placeholder="Location notes (e.g. gate code, directions)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Location */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Delivery Location</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Street address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <input
                  type="text"
                  value={deliveryCity}
                  onChange={(e) => setDeliveryCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <input
                  type="text"
                  value={deliveryCountry}
                  onChange={(e) => setDeliveryCountry(e.target.value)}
                  placeholder="Country"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <div className="col-span-2">
                  <input
                    type="url"
                    value={deliveryGoogleMapsUrl}
                    onChange={(e) => setDeliveryGoogleMapsUrl(e.target.value)}
                    placeholder="Google Maps link (paste pin URL)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Delivery notes (e.g. loading dock, contact person)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              {isEditMode ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              ) : (
                <div />
              )}
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    'px-4 py-2 text-sm font-medium text-white rounded-lg',
                    loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-primary hover:bg-primary/90'
                  )}
                >
                  {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Project')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ProjectDialog;
