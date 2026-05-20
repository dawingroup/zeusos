/**
 * New Project Dialog
 * Dialog for creating a new design project
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { createProject } from '../../services/firestore';
import { formatProjectCode } from '../../utils/formatting';
import { CustomerPicker } from '@/modules/customer-hub/components';
import type { CustomerPickerValue } from '@/modules/customer-hub/types';

export interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export function NewProjectDialog({ open, onClose, userId }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState<CustomerPickerValue | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    // P5: customerId is required on DesignProject. Block submission rather
    // than silently creating an orphan project.
    if (!customer?.customerId || !customer.customerName) {
      setError('Customer is required — every project must be linked to a customer');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const year = new Date().getFullYear();
      const sequence = Math.floor(Math.random() * 900) + 100; // Temporary - should get from DB

      await createProject({
        code: formatProjectCode(year, sequence),
        name: name.trim(),
        description: description.trim(),
        customerId: customer.customerId,
        customerName: customer.customerName,
        status: 'active',
      }, userId);

      // Reset and close
      setName('');
      setCustomer(null);
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
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
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent resize-none"
              placeholder="Brief description of the project..."
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4">
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
                  : 'bg-[#1d1d1f] hover:bg-[#424245]'
              )}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewProjectDialog;
