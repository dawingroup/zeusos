/**
 * CreateProjectFromDealDialog
 * Creates a Design Manager project pre-populated from CRM deal data.
 */

import { useState } from 'react';
import { X, FolderOpen, User, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { createProjectFromDeal } from '../../services/dealProjectService';
import type { CRMDeal } from '../../types';

interface CreateProjectFromDealDialogProps {
  deal: CRMDeal;
  open: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

export function CreateProjectFromDealDialog({
  deal,
  open,
  onClose,
  onProjectCreated,
}: CreateProjectFromDealDialogProps) {
  const { user } = useAuth();
  const [projectName, setProjectName] = useState(deal.title);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await createProjectFromDeal(
        deal,
        user.uid,
        user.displayName || user.email || 'Unknown',
        { projectName: projectName.trim(), description: description.trim() || undefined }
      );
      onProjectCreated(result.projectId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const locationStr = [deal.siteLocation?.address, deal.siteLocation?.city, deal.siteLocation?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Create Design Project</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Deal info (read-only) */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">From Deal</p>
            <p className="text-sm text-gray-700 font-medium">{deal.dealNumber}</p>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <User className="h-3.5 w-3.5" />
              <span>{deal.customerName}</span>
            </div>
            {locationStr && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <MapPin className="h-3.5 w-3.5" />
                <span>{locationStr}</span>
              </div>
            )}
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Project name"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Optional project description..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !projectName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
