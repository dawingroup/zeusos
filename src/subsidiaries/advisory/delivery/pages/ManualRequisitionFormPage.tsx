/**
 * ManualRequisitionFormPage
 *
 * Form for entering historical/backlog requisitions with their accountabilities.
 * These can later be linked to projects.
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Receipt,
  Loader2,
  AlertCircle,
  DollarSign,
  FileText,
  Link as LinkIcon,
  Info,
  Edit,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { useAuth } from '@/core/hooks/useAuth';
import { useCreateManualRequisition, useManualRequisition, useUpdateManualRequisition } from '../hooks/manual-requisition-hooks';
import {
  ManualRequisitionFormData,
  ManualAccountabilityEntry,
} from '../types/manual-requisition';
import {
  AdvanceType,
  ADVANCE_TYPE_LABELS,
  AccountabilityStatus,
  ACCOUNTABILITY_STATUS_CONFIG,
  EXPENSE_CATEGORY_LABELS,
} from '../types/requisition';
import { AccountabilityEntryForm } from '../components/accountability/AccountabilityEntryForm';

const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * Safely convert a date value (Date, Firebase Timestamp, or string) to a Date object
 */
function toDate(value: any): Date | null {
  if (!value) return null;
  // Already a Date
  if (value instanceof Date) return value;
  // Firebase Timestamp (has toDate method)
  if (value && typeof value.toDate === 'function') return value.toDate();
  // String or number
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Safely convert a date value to an ISO date string (YYYY-MM-DD) for form inputs
 */
function toDateInputString(value: any): string {
  const date = toDate(value);
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface AccountabilityEntryCardProps {
  entry: Omit<ManualAccountabilityEntry, 'id'> & { id?: string };
  index: number;
  currency: string;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function AccountabilityEntryCard({
  entry,
  index,
  currency,
  onEdit,
  onRemove,
  canRemove,
}: AccountabilityEntryCardProps) {
  const documentCount = entry.documents?.length || 0;
  const entryDate = toDate(entry.date);
  const formattedDate = entryDate
    ? entryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'No date';

  return (
    <div className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-semibold text-green-700">
              {index + 1}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{entry.description || 'No description'}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">
                  {EXPENSE_CATEGORY_LABELS[entry.category]}
                </Badge>
                <span className="text-xs text-gray-500">{formattedDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(index)}
              className="text-blue-600 hover:text-blue-700"
            >
              <Edit className="w-4 h-4" />
            </Button>
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Details Row */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {entry.vendor && (
              <span className="text-gray-600">
                <span className="text-gray-400">Vendor:</span> {entry.vendor}
              </span>
            )}
            {entry.invoiceNumber && (
              <span className="text-gray-600">
                <span className="text-gray-400">Invoice:</span> {entry.invoiceNumber}
              </span>
            )}
            {entry.receiptNumber && (
              <span className="text-gray-600">
                <span className="text-gray-400">Receipt:</span> {entry.receiptNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Document Count */}
            <div className="flex items-center gap-1">
              <Paperclip className="w-4 h-4 text-gray-400" />
              <span className={`text-xs ${documentCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {documentCount} doc{documentCount !== 1 ? 's' : ''}
              </span>
            </div>
            {/* Amount */}
            <span className="font-semibold text-gray-900">
              {formatCurrency(entry.amount, currency)}
            </span>
          </div>
        </div>

        {/* Notes */}
        {entry.notes && (
          <p className="text-xs text-gray-500 mt-2 italic">
            {entry.notes}
          </p>
        )}
      </div>
    </div>
  );
}

export function ManualRequisitionFormPage() {
  const navigate = useNavigate();
  const { requisitionId } = useParams<{ requisitionId?: string }>();
  const { user } = useAuth();
  const isEditing = Boolean(requisitionId);

  const { requisition: existingRequisition, loading: loadingExisting } = useManualRequisition(requisitionId || null);
  const { createRequisition, loading: creating, error: createError } = useCreateManualRequisition();
  const { updateRequisition, loading: updating, error: updateError } = useUpdateManualRequisition();

  // Form state
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [amount, setAmount] = useState<number>(0);
  const [requisitionDate, setRequisitionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paidDate, setPaidDate] = useState<string>('');
  const [accountabilityDueDate, setAccountabilityDueDate] = useState<string>('');
  const [advanceType, setAdvanceType] = useState<AdvanceType>('materials');
  const [accountabilityStatus, setAccountabilityStatus] = useState<AccountabilityStatus>('pending');
  const [sourceDocument, setSourceDocument] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [notes, setNotes] = useState('');

  const [accountabilities, setAccountabilities] = useState<(Omit<ManualAccountabilityEntry, 'id'> & { id?: string })[]>([]);

  // Entry form dialog state
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null);

  // Load existing data when editing
  useEffect(() => {
    if (existingRequisition) {
      setReferenceNumber(existingRequisition.referenceNumber);
      setDescription(existingRequisition.description);
      setPurpose(existingRequisition.purpose);
      setCurrency(existingRequisition.currency);
      setAmount(existingRequisition.amount);
      // Use safe date conversion for Firebase Timestamps
      setRequisitionDate(toDateInputString(existingRequisition.requisitionDate) || new Date().toISOString().split('T')[0]);
      if (existingRequisition.paidDate) {
        setPaidDate(toDateInputString(existingRequisition.paidDate));
      }
      if (existingRequisition.accountabilityDueDate) {
        setAccountabilityDueDate(toDateInputString(existingRequisition.accountabilityDueDate));
      }
      setAdvanceType(existingRequisition.advanceType);
      setAccountabilityStatus(existingRequisition.accountabilityStatus);
      setSourceDocument(existingRequisition.sourceDocument || '');
      setSourceReference(existingRequisition.sourceReference || '');
      setNotes(existingRequisition.notes || '');
      setAccountabilities(existingRequisition.accountabilities || []);
    }
  }, [existingRequisition]);

  // Calculations
  const totalAccountedAmount = useMemo(() => {
    return accountabilities.reduce((sum, acc) => sum + (acc.amount || 0), 0);
  }, [accountabilities]);

  const unaccountedAmount = useMemo(() => {
    return Math.max(0, amount - totalAccountedAmount);
  }, [amount, totalAccountedAmount]);

  const accountabilityPercentage = useMemo(() => {
    return amount > 0 ? (totalAccountedAmount / amount) * 100 : 0;
  }, [amount, totalAccountedAmount]);

  // Handlers
  const handleAddEntry = () => {
    setEditingEntryIndex(null);
    setShowEntryForm(true);
  };

  const handleEditEntry = (index: number) => {
    setEditingEntryIndex(index);
    setShowEntryForm(true);
  };

  const handleSaveEntry = (entry: Omit<ManualAccountabilityEntry, 'id'> & { id?: string }) => {
    if (editingEntryIndex !== null) {
      // Update existing entry
      setAccountabilities(prev =>
        prev.map((acc, i) => (i === editingEntryIndex ? { ...entry, id: entry.id || acc.id } : acc))
      );
    } else {
      // Add new entry
      setAccountabilities(prev => [...prev, { ...entry, id: entry.id || generateId() }]);
    }
    setShowEntryForm(false);
    setEditingEntryIndex(null);
  };

  const handleCancelEntry = () => {
    setShowEntryForm(false);
    setEditingEntryIndex(null);
  };

  const removeAccountabilityEntry = (index: number) => {
    setAccountabilities(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Build form data - only include fields that have values
    // This prevents undefined values from being sent to Firestore
    const formData: ManualRequisitionFormData = {
      referenceNumber,
      description,
      purpose,
      currency,
      amount,
      requisitionDate: new Date(requisitionDate),
      advanceType,
      accountabilityStatus,
      accountabilities: accountabilities.map(acc => {
        // Build accountability entry without undefined fields
        // Convert date from potential Firebase Timestamp to Date
        const entryDate = toDate(acc.date) || new Date();

        // Clean documents array - remove undefined fields from each document
        const cleanedDocuments = (acc.documents || []).map(doc => {
          const cleanDoc: Record<string, any> = {
            id: doc.id,
            type: doc.type,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            uploadedAt: doc.uploadedAt,
            uploadedBy: doc.uploadedBy,
          };
          // Only add optional fields if they have values
          if (doc.fileSize !== undefined) cleanDoc.fileSize = doc.fileSize;
          if (doc.mimeType) cleanDoc.mimeType = doc.mimeType;
          if (doc.documentNumber) cleanDoc.documentNumber = doc.documentNumber;
          if (doc.documentDate) cleanDoc.documentDate = doc.documentDate;
          if (doc.notes) cleanDoc.notes = doc.notes;
          return cleanDoc;
        });

        const entry: any = {
          id: acc.id || generateId(), // Include ID for persistence
          date: entryDate,
          description: acc.description,
          category: acc.category,
          amount: acc.amount,
          documents: cleanedDocuments,
        };
        // Only add optional fields if they have values
        if (acc.vendor) entry.vendor = acc.vendor;
        if (acc.receiptNumber) entry.receiptNumber = acc.receiptNumber;
        if (acc.invoiceNumber) entry.invoiceNumber = acc.invoiceNumber;
        if (acc.notes) entry.notes = acc.notes;
        if (acc.paymentMethod) entry.paymentMethod = acc.paymentMethod;
        if (acc.contractOrPONumber) entry.contractOrPONumber = acc.contractOrPONumber;
        if (acc.contractOrPODocument) {
          // Clean the contract/PO document as well
          const cleanPODoc: Record<string, any> = {
            id: acc.contractOrPODocument.id,
            type: acc.contractOrPODocument.type,
            fileName: acc.contractOrPODocument.fileName,
            fileUrl: acc.contractOrPODocument.fileUrl,
            uploadedAt: acc.contractOrPODocument.uploadedAt,
            uploadedBy: acc.contractOrPODocument.uploadedBy,
          };
          if (acc.contractOrPODocument.fileSize !== undefined) cleanPODoc.fileSize = acc.contractOrPODocument.fileSize;
          if (acc.contractOrPODocument.mimeType) cleanPODoc.mimeType = acc.contractOrPODocument.mimeType;
          if (acc.contractOrPODocument.documentNumber) cleanPODoc.documentNumber = acc.contractOrPODocument.documentNumber;
          if (acc.contractOrPODocument.documentDate) cleanPODoc.documentDate = acc.contractOrPODocument.documentDate;
          if (acc.contractOrPODocument.notes) cleanPODoc.notes = acc.contractOrPODocument.notes;
          entry.contractOrPODocument = cleanPODoc;
        }
        if (acc.activityReport) entry.activityReport = acc.activityReport;
        return entry;
      }),
    };

    // Only add optional date fields if they have values
    if (paidDate) {
      formData.paidDate = new Date(paidDate);
    }
    if (accountabilityDueDate) {
      formData.accountabilityDueDate = new Date(accountabilityDueDate);
    }
    // Only add optional text fields if they have values
    if (sourceDocument) {
      formData.sourceDocument = sourceDocument;
    }
    if (sourceReference) {
      formData.sourceReference = sourceReference;
    }
    if (notes) {
      formData.notes = notes;
    }

    try {
      if (isEditing && requisitionId) {
        await updateRequisition(requisitionId, formData);
      } else {
        await createRequisition(formData);
      }
      navigate('/advisory/delivery/backlog');
    } catch (err) {
      console.error('Failed to save manual requisition:', err);
    }
  };

  const isValid = description && purpose && amount > 0;
  const loading = creating || updating;
  const error = createError || updateError;

  if (isEditing && loadingExisting) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading requisition...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/advisory/delivery/backlog')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Manual Requisition' : 'Enter Manual Requisition'}
          </h1>
          <p className="text-gray-500">
            Enter historical requisition data from backlog. Can be linked to projects later.
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Manual Entry Mode</p>
            <p className="text-blue-600 mt-1">
              Use this form to enter requisitions from your backlog (Excel, paper records, etc.).
              You can enter accountabilities directly here, and later link this entry to a project
              once the project is set up in the system.
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{error.message}</span>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-6">
        {/* Basic Information */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Requisition Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reference Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                placeholder="Original reference (optional)"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank to auto-generate</p>
            </div>

            {/* Advance Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Advance Type <span className="text-red-500">*</span>
              </label>
              <select
                value={advanceType}
                onChange={e => setAdvanceType(e.target.value as AdvanceType)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {Object.entries(ADVANCE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of the requisition"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Purpose */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose <span className="text-red-500">*</span>
              </label>
              <textarea
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="Detailed purpose of the requisition"
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Amount & Dates */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-500" />
            Amount & Dates
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="UGX">UGX</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={amount || ''}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Requisition Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requisition Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={requisitionDate}
                onChange={e => setRequisitionDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Paid Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid Date</label>
              <input
                type="date"
                value={paidDate}
                onChange={e => setPaidDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Accountability Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accountability Due Date
              </label>
              <input
                type="date"
                value={accountabilityDueDate}
                onChange={e => setAccountabilityDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Accountability Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accountability Status
              </label>
              <select
                value={accountabilityStatus}
                onChange={e => setAccountabilityStatus(e.target.value as AccountabilityStatus)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {Object.entries(ACCOUNTABILITY_STATUS_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Accountability Progress */}
        {amount > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Accountability Progress</span>
              <span className="text-sm text-gray-600">
                {formatCurrency(totalAccountedAmount, currency)} of {formatCurrency(amount, currency)}
                ({accountabilityPercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  accountabilityPercentage >= 100
                    ? 'bg-green-500'
                    : accountabilityPercentage >= 50
                    ? 'bg-blue-500'
                    : 'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(accountabilityPercentage, 100)}%` }}
              />
            </div>
            {unaccountedAmount > 0 && (
              <p className="text-sm text-amber-600 mt-2">
                Unaccounted: {formatCurrency(unaccountedAmount, currency)}
              </p>
            )}
          </div>
        )}

        {/* Accountability Entries */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-gray-500" />
              Accountability Entries
              {accountabilities.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {accountabilities.length} {accountabilities.length === 1 ? 'entry' : 'entries'}
                </Badge>
              )}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddEntry}
              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </div>

          {accountabilities.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No accountability entries yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Click "Add Entry" to add expense records with supporting documents
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddEntry}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Entry
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accountabilities.map((entry, index) => (
                <AccountabilityEntryCard
                  key={entry.id || index}
                  entry={entry}
                  index={index}
                  currency={currency}
                  onEdit={handleEditEntry}
                  onRemove={removeAccountabilityEntry}
                  canRemove={true}
                />
              ))}
            </div>
          )}
        </div>

        {/* Accountability Entry Form Dialog */}
        <Dialog open={showEntryForm} onOpenChange={setShowEntryForm}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEntryIndex !== null ? 'Edit Accountability Entry' : 'New Accountability Entry'}
              </DialogTitle>
            </DialogHeader>
            <AccountabilityEntryForm
              requisitionId={requisitionId || 'new'}
              existingEntry={editingEntryIndex !== null ? accountabilities[editingEntryIndex] as ManualAccountabilityEntry : undefined}
              currency={currency}
              onSave={handleSaveEntry}
              onCancel={handleCancelEntry}
              userId={user?.uid || 'anonymous'}
            />
          </DialogContent>
        </Dialog>

        {/* Source Information */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-gray-500" />
            Source Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Document */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Document
              </label>
              <input
                type="text"
                value={sourceDocument}
                onChange={e => setSourceDocument(e.target.value)}
                placeholder="e.g., Excel backlog 2024, Paper records"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Source Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Reference
              </label>
              <input
                type="text"
                value={sourceReference}
                onChange={e => setSourceReference(e.target.value)}
                placeholder="e.g., Row 45, File: Reqs_Q1.xlsx"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional notes about this requisition"
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-4">
        <button
          onClick={() => navigate('/advisory/delivery/backlog')}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>

        <button
          onClick={handleSubmit}
          disabled={loading || !isValid}
          className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEditing ? 'Update Requisition' : 'Save Requisition'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default ManualRequisitionFormPage;
