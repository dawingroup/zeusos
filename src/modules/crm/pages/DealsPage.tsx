/**
 * Deals Page
 * Full deal management with table view and create/edit functionality
 */

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useDeals } from '../hooks/useDeals';
import { DealList } from '../components/deals/DealList';
import { DealForm, type DealFormValues } from '../components/deals/DealForm';
import { Timestamp } from 'firebase/firestore';
import type { CRMDealFormData } from '../types';
import { useAuth } from '@/shared/hooks';
import { CRM_DEFAULT_CURRENCY } from '../constants/crm.constants';
import { FullPageLoader } from '@/shared/components/feedback/FullPageLoader';

export default function DealsPage() {
  const { user } = useAuth();
  const { deals, loading, error, syncing, actions } = useDeals();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const handleCreateDeal = async (values: DealFormValues) => {
    if (!user) return;
    const formData: CRMDealFormData = {
      title: values.title,
      description: values.description,
      customerId: values.customerId,
      customerName: values.customerName,
      stage: values.stage,
      probability: 0,
      priority: values.priority,
      source: values.source,
      estimatedValue: values.estimatedValue,
      currency: values.currency || CRM_DEFAULT_CURRENCY,
      linkedQuoteIds: [],
      linkedMOIds: [],
      ownerId: user.uid,
      ownerName: user.displayName || user.email || 'Unknown',
      teamMemberIds: [],
      expectedCloseDate: values.expectedCloseDate ? Timestamp.fromDate(new Date(values.expectedCloseDate)) : undefined,
      siteLocation: values.siteLocation,
      tags: values.tags,
      notes: values.notes,
      subsidiaryId: 'dawin-finishes',
    };
    await actions.create(formData);
  };

  const handleSyncFromProjects = async () => {
    try {
      setSyncMessage('');
      const result = await actions.syncFromProjects();
      if (result.created > 0) {
        setSyncMessage(`Synced ${result.created} deal${result.created !== 1 ? 's' : ''} from ${result.total} projects.`);
      } else if (result.total === 0) {
        setSyncMessage('No design projects found to sync.');
      } else if (result.errors.length > 0) {
        setSyncMessage(`Sync errors: ${result.errors.join('; ')}`);
      } else {
        setSyncMessage(`All ${result.total} projects already have deals (${result.skipped} skipped).`);
      }
      setTimeout(() => setSyncMessage(''), 8000);
    } catch (err) {
      setSyncMessage(`Sync failed: ${(err as Error).message}`);
    }
  };

  if (loading) return <FullPageLoader />;

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Deals</h2>
          <p className="text-sm text-gray-500">
            Manage all your deals and opportunities in one place.
          </p>
        </div>
        <button
          onClick={handleSyncFromProjects}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          title="Sync deals from Design Manager projects"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync from Projects'}
        </button>
      </div>

      {/* Sync feedback */}
      {syncMessage && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          syncMessage.includes('error') || syncMessage.includes('failed')
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {syncMessage}
        </div>
      )}

      <DealList
        deals={deals}
        onCreateDeal={() => setShowCreateForm(true)}
      />

      {showCreateForm && (
        <DealForm
          onSubmit={handleCreateDeal}
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}
