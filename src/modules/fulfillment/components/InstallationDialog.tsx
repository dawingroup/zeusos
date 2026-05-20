/**
 * InstallationDialog
 * Dialog for marking items as installed or completing directly
 */

import { useState } from 'react';
import { Wrench, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Textarea } from '@/core/components/ui/textarea';
import { markAsInstalled, markAsComplete } from '@/modules/manufacturing/services/fulfillmentService';
import { checkAndAutoCompleteProject } from '../services/fulfillmentQueryService';
import type { FulfillmentItem } from '../services/fulfillmentQueryService';
import { deriveFulfillmentStatus } from '@/modules/design-manager/services/designItemStatusDerivation';

interface InstallationDialogProps {
  open: boolean;
  onClose: () => void;
  item: FulfillmentItem;
  userId: string;
  onSuccess: () => void;
}

export function InstallationDialog({ open, onClose, item, userId, onSuccess }: InstallationDialogProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'install' | 'complete'>('install');

  if (!open) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (mode === 'complete') {
        // Skip installation, mark directly as complete
        await markAsComplete(item.id, userId, item.projectId);
      } else {
        await markAsInstalled(item.id, notes || undefined, userId, item.projectId);
      }
      await checkAndAutoCompleteProject(item.projectId);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Installation/completion failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // P7/F10: derive from tracking timestamps — the flat field can lag.
  const derived = deriveFulfillmentStatus(item);
  const isDelivered = derived === 'delivered';
  const isInstalled = derived === 'installed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">
            {isInstalled ? 'Complete Item' : 'Installation & Completion'}
          </h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <span className="font-medium">{item.name}</span> — {item.projectName}
        </p>

        {/* Mode selection — only for delivered items */}
        {isDelivered && (
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium text-gray-700">Action</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('install')}
                className={`px-3 py-2 rounded border text-sm flex items-center gap-2 ${
                  mode === 'install'
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" /> Mark Installed
              </button>
              <button
                onClick={() => setMode('complete')}
                className={`px-3 py-2 rounded border text-sm flex items-center gap-2 ${
                  mode === 'complete'
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {mode === 'complete'
                ? 'No installation needed — mark directly as complete'
                : 'Item requires installation before final completion'}
            </p>
          </div>
        )}

        {mode === 'install' && !isInstalled && (
          <div>
            <label className="text-sm font-medium text-gray-700">Installation Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Installation details, team, location..."
              className="mt-1"
              rows={3}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isInstalled ? 'Mark Complete' : mode === 'complete' ? 'Complete' : 'Mark Installed'}
          </Button>
        </div>
      </div>
    </div>
  );
}
