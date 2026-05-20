// ============================================================================
// FINANCE ADMIN PAGE
// DawinOS v2.0 - Financial Management Module
// Admin dashboard: Reconciliation Tracker, Tax Portals, Document Library
// ============================================================================

import { useState, useCallback } from 'react';
import {
  Calendar,
  Globe,
  FolderOpen,
  X,
} from 'lucide-react';
import { ReconciliationScheduleList } from '../components/admin/ReconciliationScheduleList';
import { TaxPortalLinks } from '../components/admin/TaxPortalLinks';
import { FinanceDocumentLibrary } from '../components/admin/FinanceDocumentLibrary';
import { useReconciliationSchedule } from '../hooks/useReconciliationSchedule';
import { useFinanceDocuments } from '../hooks/useFinanceDocuments';
import { useTaxPortals } from '../hooks/useTaxPortals';
import { useAuth, useCurrentUserId } from '@/contexts/AuthContext';
import type {
  ReconciliationScheduleInput,
  ReconciliationType,
  ReconciliationFrequency,
  FinanceDocumentInput,
  FinanceDocumentCategory,
} from '../types/integrations.types';
import {
  RECONCILIATION_TYPES,
  RECONCILIATION_FREQUENCIES,
  FINANCE_DOCUMENT_CATEGORIES,
} from '../constants/integrations.constants';

type AdminTab = 'reconciliation' | 'tax_portals' | 'documents';

const TABS: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'reconciliation', label: 'Reconciliation', icon: Calendar },
  { id: 'tax_portals', label: 'Tax Portals', icon: Globe },
  { id: 'documents', label: 'Document Library', icon: FolderOpen },
];

const COMPANY_ID = 'dawinos';

export function FinanceAdminPage() {
  const userId = useCurrentUserId();
  const { user } = useAuth();
  const userName = user?.displayName || user?.email || 'Unknown User';
  const [activeTab, setActiveTab] = useState<AdminTab>('reconciliation');
  const [showReconciliationForm, setShowReconciliationForm] = useState(false);
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [showPortalForm, setShowPortalForm] = useState(false);

  // Hooks
  const reconciliation = useReconciliationSchedule({ companyId: COMPANY_ID });
  const documents = useFinanceDocuments({ companyId: COMPANY_ID });
  const taxPortals = useTaxPortals({ companyId: COMPANY_ID });

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<FinanceDocumentCategory | null>(null);

  const handleFilterCategory = useCallback((category: FinanceDocumentCategory | null) => {
    setActiveCategoryFilter(category);
    if (category) {
      documents.setFilter({ ...documents.filter, category: [category] });
    } else {
      const { category: _, ...rest } = documents.filter;
      documents.setFilter(rest);
    }
  }, [documents]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Finance Admin Tools</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage reconciliation schedules, access tax portals, and organize finance documents
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'reconciliation' && (
        <div>
          <ReconciliationScheduleList
            schedules={reconciliation.schedules}
            loading={reconciliation.loading}
            onComplete={(id) => reconciliation.complete(id, userId)}
            onToggle={reconciliation.toggle}
            onDelete={reconciliation.remove}
            onAdd={() => setShowReconciliationForm(true)}
            overdueCount={reconciliation.overdueCount}
            dueThisWeekCount={reconciliation.dueThisWeekCount}
          />

          {/* Reconciliation Form Modal */}
          {showReconciliationForm && (
            <ReconciliationFormModal
              onClose={() => setShowReconciliationForm(false)}
              defaultAssigneeId={userId}
              onSubmit={async (input) => {
                await reconciliation.create(input, userId);
                setShowReconciliationForm(false);
              }}
            />
          )}
        </div>
      )}

      {activeTab === 'tax_portals' && (
        <div>
          <TaxPortalLinks
            groupedByCategory={taxPortals.groupedByCategory}
            loading={taxPortals.loading}
            onAddLink={() => setShowPortalForm(true)}
            onDeleteLink={taxPortals.removeLink}
          />

          {showPortalForm && (
            <PortalLinkFormModal
              onClose={() => setShowPortalForm(false)}
              onSubmit={async (link) => {
                await taxPortals.addLink(link);
                setShowPortalForm(false);
              }}
            />
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          <FinanceDocumentLibrary
            documents={documents.documents}
            loading={documents.loading}
            search={documents.search}
            onSearchChange={documents.setSearch}
            onAdd={() => setShowDocumentForm(true)}
            onDelete={documents.remove}
            onFilterCategory={handleFilterCategory}
            activeCategory={activeCategoryFilter}
            categoryCounts={documents.categoryCounts}
            totalCount={documents.totalCount}
          />

          {showDocumentForm && (
            <DocumentFormModal
              onClose={() => setShowDocumentForm(false)}
              onSubmit={async (input) => {
                await documents.create(input, userId, userName);
                setShowDocumentForm(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODAL FORMS (inline for simplicity)
// ============================================================================

function ReconciliationFormModal({
  onClose,
  onSubmit,
  defaultAssigneeId,
}: {
  onClose: () => void;
  onSubmit: (input: ReconciliationScheduleInput) => Promise<void>;
  defaultAssigneeId: string;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ReconciliationType>('bank_reconciliation');
  const [frequency, setFrequency] = useState<ReconciliationFrequency>('monthly');
  const [assigneeName, setAssigneeName] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !assigneeName || !nextDueDate) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        type,
        frequency,
        assigneeId: defaultAssigneeId,
        assigneeName,
        nextDueDate: new Date(nextDueDate),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">New Reconciliation Schedule</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Bank Reconciliation - Stanbic"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ReconciliationType)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.entries(RECONCILIATION_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ReconciliationFrequency)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.entries(RECONCILIATION_FREQUENCIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assignee</label>
            <input
              type="text"
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="Who is responsible?"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Next Due Date</label>
            <input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: FinanceDocumentInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FinanceDocumentCategory>('invoice');
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [tags, setTags] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        category,
        googleDriveUrl: googleDriveUrl || undefined,
        fileUrl: googleDriveUrl || '',
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        fiscalYear: fiscalYear || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Add Finance Document</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Document Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 2024 VAT Return"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FinanceDocumentCategory)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.entries(FINANCE_DOCUMENT_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fiscal Year</label>
              <input
                type="text"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                placeholder="e.g. 2024/25"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Google Drive URL
            </label>
            <input
              type="url"
              value={googleDriveUrl}
              onChange={(e) => setGoogleDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. vat, q4, 2024"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PortalLinkFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (link: any) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        url,
        description,
        category: 'custom' as const,
        icon: 'Link',
        country: 'UG',
        order: 99,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Add Custom Portal Link</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stanbic Online Banking"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FinanceAdminPage;
