/**
 * AccountabilityFormPage - Enhanced form for submitting expense accountability
 *
 * Features:
 * - Real-time progress indicator
 * - Better expense entry UX
 * - Category-based organization
 * - Validation feedback
 * - Document upload support (Invoice, Delivery Note, PO, Activity Report, Contract, etc.)
 */

import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Receipt,
  Loader2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Paperclip,
  Info,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  Image,
  File,
} from 'lucide-react';
import { useRequisition, useCreateAccountability } from '../hooks/payment-hooks';
import {
  AccountabilityFormData,
  SupportingDocumentType,
  DOCUMENT_TYPE_CONFIG,
  SupportingDocument,
} from '../types/accountability';
import { ExpenseCategory, EXPENSE_CATEGORY_LABELS } from '../types/requisition';
import { db, storage } from '@/core/services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/shared/hooks';

// Document attachment for form (before upload)
interface DocumentAttachment {
  id: string;
  type: SupportingDocumentType;
  file: File;
  documentNumber?: string;
  documentDate?: string;
  notes?: string;
}

interface ExpenseItemForm {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  receiptNumber?: string;
  invoiceNumber?: string;
  vendor?: string;
  documents: DocumentAttachment[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  return File;
}

// Sort document types by recommended finance order
const SORTED_DOCUMENT_TYPES = Object.entries(DOCUMENT_TYPE_CONFIG)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([type]) => type as SupportingDocumentType);

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ProgressIndicatorProps {
  requisitionAmount: number;
  enteredAmount: number;
  currency: string;
}

function ProgressIndicator({ requisitionAmount, enteredAmount, currency }: ProgressIndicatorProps) {
  const percentage = requisitionAmount > 0 ? (enteredAmount / requisitionAmount) * 100 : 0;
  const remaining = requisitionAmount - enteredAmount;
  const isComplete = Math.abs(remaining) < 1;
  const isOver = remaining < 0;

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Accountability Progress</span>
        <span className="text-sm text-gray-500">{percentage.toFixed(0)}% entered</span>
      </div>

      <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete
              ? 'bg-green-500'
              : isOver
              ? 'bg-red-500'
              : percentage >= 80
              ? 'bg-blue-500'
              : 'bg-amber-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-gray-500">Requisition</div>
          <div className="font-semibold">{formatCurrency(requisitionAmount, currency)}</div>
        </div>
        <div>
          <div className="text-gray-500">Entered</div>
          <div className="font-semibold text-blue-600">{formatCurrency(enteredAmount, currency)}</div>
        </div>
        <div>
          <div className="text-gray-500">Remaining</div>
          <div
            className={`font-semibold ${
              isComplete ? 'text-green-600' : isOver ? 'text-red-600' : 'text-amber-600'
            }`}
          >
            {isOver ? '+' : ''}
            {formatCurrency(Math.abs(remaining), currency)}
          </div>
        </div>
      </div>

      {isComplete && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          <span>Amount matches requisition</span>
        </div>
      )}

      {isOver && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg">
          <AlertTriangle className="w-4 h-4" />
          <span>Expenses exceed requisition amount</span>
        </div>
      )}
    </div>
  );
}

interface ExpenseCardProps {
  expense: ExpenseItemForm;
  index: number;
  onUpdate: (index: number, field: keyof ExpenseItemForm, value: string | number) => void;
  onRemove: (index: number) => void;
  onAddDocument: (index: number, doc: DocumentAttachment) => void;
  onRemoveDocument: (expenseIndex: number, docId: string) => void;
  canRemove: boolean;
  currency: string;
}

function ExpenseCard({
  expense,
  index,
  onUpdate,
  onRemove,
  onAddDocument,
  onRemoveDocument,
  canRemove,
  currency,
}: ExpenseCardProps) {
  const [showDocuments, setShowDocuments] = useState(false);

  const documentsByType = expense.documents.reduce((acc, doc) => {
    if (!acc[doc.type]) acc[doc.type] = [];
    acc[doc.type].push(doc);
    return acc;
  }, {} as Record<SupportingDocumentType, DocumentAttachment[]>);

  const hasRequiredDocs = expense.documents.some(d => d.type === 'invoice') &&
    expense.documents.some(d => d.type === 'receipt');

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <Receipt className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">Expense #{index + 1}</div>
            {expense.amount > 0 && (
              <div className="text-sm text-gray-500">{formatCurrency(expense.amount, currency)}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expense.documents.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
              <FileText className="w-3 h-3" />
              {expense.documents.length} doc{expense.documents.length !== 1 ? 's' : ''}
            </span>
          )}
          {canRemove && (
            <button
              onClick={() => onRemove(index)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              title="Remove expense"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={expense.description}
            onChange={e => onUpdate(index, 'description', e.target.value)}
            placeholder="What was this expense for?"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount ({currency}) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={expense.amount || ''}
            onChange={e => onUpdate(index, 'amount', parseFloat(e.target.value) || 0)}
            placeholder="0"
            min="0"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={expense.category}
            onChange={e => onUpdate(index, 'category', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={expense.date}
            onChange={e => onUpdate(index, 'date', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Vendor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vendor / Supplier</label>
          <input
            type="text"
            value={expense.vendor || ''}
            onChange={e => onUpdate(index, 'vendor', e.target.value)}
            placeholder="Supplier name"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Invoice Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
          <input
            type="text"
            value={expense.invoiceNumber || ''}
            onChange={e => onUpdate(index, 'invoiceNumber', e.target.value)}
            placeholder="INV-XXXX"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Receipt Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
          <input
            type="text"
            value={expense.receiptNumber || ''}
            onChange={e => onUpdate(index, 'receiptNumber', e.target.value)}
            placeholder="REC-XXXX"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Supporting Documents Section */}
        <div className="md:col-span-2">
          <button
            type="button"
            onClick={() => setShowDocuments(!showDocuments)}
            className={`w-full flex items-center justify-between px-4 py-3 border rounded-lg transition-colors ${
              showDocuments ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-700">Supporting Documents</span>
              {expense.documents.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {expense.documents.length}
                </span>
              )}
              {!hasRequiredDocs && expense.amount > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Missing required
                </span>
              )}
            </div>
            {showDocuments ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showDocuments && (
            <div className="mt-3 p-4 bg-gray-50 rounded-lg border">
              {/* Document type upload buttons */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">
                  Attach documents (ordered by finance workflow):
                </div>
                <div className="flex flex-wrap gap-2">
                  {SORTED_DOCUMENT_TYPES.map(type => {
                    const config = DOCUMENT_TYPE_CONFIG[type];
                    const hasDoc = documentsByType[type]?.length > 0;
                    return (
                      <label
                        key={type}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg cursor-pointer transition-colors ${
                          hasDoc
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : config.required
                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {hasDoc ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        {config.label}
                        {config.required && !hasDoc && <span className="text-red-500">*</span>}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const newDoc: DocumentAttachment = {
                                id: generateId(),
                                type,
                                file,
                              };
                              onAddDocument(index, newDoc);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Attached documents list */}
              {expense.documents.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 mb-2">Attached documents:</div>
                  {expense.documents
                    .sort((a, b) => DOCUMENT_TYPE_CONFIG[a.type].order - DOCUMENT_TYPE_CONFIG[b.type].order)
                    .map(doc => {
                      const config = DOCUMENT_TYPE_CONFIG[doc.type];
                      const FileIcon = getFileIcon(doc.file.type);
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-2 bg-white rounded-lg border"
                        >
                          <div className="p-1.5 bg-gray-100 rounded">
                            <FileIcon className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {config.label}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {doc.file.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatFileSize(doc.file.size)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveDocument(index, doc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  No documents attached yet
                </div>
              )}

              {/* Required documents hint */}
              <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                <strong>Required:</strong> Invoice and Payment Receipt.{' '}
                <span className="text-blue-600">
                  Other documents (PO, Delivery Note, etc.) help with verification.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccountabilityFormPage() {
  const navigate = useNavigate();
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const { user } = useAuth();

  const { requisition, loading: reqLoading, error: reqError } = useRequisition(
    db,
    requisitionId || null
  );
  const { createAccountability, loading, error } = useCreateAccountability(db, user?.uid || '');

  const [expenses, setExpenses] = useState<ExpenseItemForm[]>([
    {
      id: generateId(),
      description: '',
      category: 'construction_materials',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      receiptNumber: '',
      invoiceNumber: '',
      vendor: '',
      documents: [],
    },
  ]);

  const [unspentReturned, setUnspentReturned] = useState(0);
  const [uploading, setUploading] = useState(false);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  const totalEntered = totalExpenses + unspentReturned;

  const requisitionAmount = useMemo(() => {
    return requisition?.unaccountedAmount || requisition?.grossAmount || 0;
  }, [requisition]);

  const balanceDue = useMemo(() => {
    return requisitionAmount - totalEntered;
  }, [requisitionAmount, totalEntered]);

  const addExpense = () => {
    setExpenses(prev => [
      ...prev,
      {
        id: generateId(),
        description: '',
        category: 'construction_materials',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        receiptNumber: '',
        invoiceNumber: '',
        vendor: '',
        documents: [],
      },
    ]);
  };

  const removeExpense = (index: number) => {
    if (expenses.length > 1) {
      setExpenses(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateExpense = (index: number, field: keyof ExpenseItemForm, value: string | number) => {
    setExpenses(prev => prev.map((exp, i) => (i === index ? { ...exp, [field]: value } : exp)));
  };

  const addDocumentToExpense = (expenseIndex: number, doc: DocumentAttachment) => {
    setExpenses(prev =>
      prev.map((exp, i) =>
        i === expenseIndex ? { ...exp, documents: [...exp.documents, doc] } : exp
      )
    );
  };

  const removeDocumentFromExpense = (expenseIndex: number, docId: string) => {
    setExpenses(prev =>
      prev.map((exp, i) =>
        i === expenseIndex
          ? { ...exp, documents: exp.documents.filter(d => d.id !== docId) }
          : exp
      )
    );
  };

  // Upload a single document to Firebase Storage
  const uploadDocument = async (
    requisitionId: string,
    expenseId: string,
    doc: DocumentAttachment
  ): Promise<SupportingDocument> => {
    const timestamp = Date.now();
    const sanitizedFileName = doc.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `accountabilities/${requisitionId}/${expenseId}/${doc.type}_${timestamp}_${sanitizedFileName}`;

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, doc.file);
    const fileUrl = await getDownloadURL(storageRef);

    return {
      id: doc.id,
      type: doc.type,
      fileName: doc.file.name,
      fileUrl,
      fileSize: doc.file.size,
      mimeType: doc.file.type,
      documentNumber: doc.documentNumber,
      documentDate: doc.documentDate ? new Date(doc.documentDate) : undefined,
      uploadedAt: new Date(),
      uploadedBy: user?.uid || '',
      notes: doc.notes,
    };
  };

  const handleSubmit = async () => {
    if (!requisitionId || !requisition) return;

    setUploading(true);

    try {
      // Filter valid expenses
      const validExpensesList = expenses.filter(exp => exp.description && exp.amount > 0);

      // Upload all documents and build expense data with uploaded document references
      const expensesWithDocuments = await Promise.all(
        validExpensesList.map(async (exp, index) => {
          // Upload all documents for this expense
          const uploadedDocs = await Promise.all(
            exp.documents.map(doc => uploadDocument(requisitionId, exp.id, doc))
          );

          return {
            lineNumber: index + 1,
            date: new Date(exp.date),
            description: exp.description,
            category: exp.category,
            amount: exp.amount,
            receiptNumber: exp.receiptNumber,
            invoiceNumber: exp.invoiceNumber,
            vendor: exp.vendor,
            documents: uploadedDocs,
          };
        })
      );

      const formData: AccountabilityFormData = {
        requisitionId,
        expenses: expensesWithDocuments as any,
        unspentReturned,
      };

      await createAccountability(formData);
      navigate(`/advisory/delivery/requisitions/${requisitionId}`);
    } catch (err) {
      console.error('Failed to create accountability:', err);
    } finally {
      setUploading(false);
    }
  };

  if (reqLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading requisition...</span>
      </div>
    );
  }

  if (reqError || !requisition) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{reqError?.message || 'Requisition not found'}</span>
        </div>
      </div>
    );
  }

  const validExpenses = expenses.filter(exp => exp.description && exp.amount > 0);
  const isValid = validExpenses.length > 0;
  const isBalanced = Math.abs(balanceDue) < 1;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit Accountability</h1>
          <p className="text-gray-500">
            For requisition {requisition.requisitionNumber} •{' '}
            {formatCurrency(requisitionAmount, requisition.currency)} to account for
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error.message}
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mb-6">
        <ProgressIndicator
          requisitionAmount={requisitionAmount}
          enteredAmount={totalEntered}
          currency={requisition.currency}
        />
      </div>

      {/* Expenses */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Expenses</h2>
          <button
            onClick={addExpense}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>

        <div className="space-y-4">
          {expenses.map((expense, index) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              index={index}
              onUpdate={updateExpense}
              onRemove={removeExpense}
              onAddDocument={addDocumentToExpense}
              onRemoveDocument={removeDocumentFromExpense}
              canRemove={expenses.length > 1}
              currency={requisition.currency}
            />
          ))}
        </div>
      </div>

      {/* Unspent Amount */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 mb-1">Unspent Amount Returned</h3>
            <p className="text-sm text-gray-500 mb-3">
              If you have any unspent funds to return to the project budget, enter the amount here.
            </p>
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{requisition.currency}</span>
                <input
                  type="number"
                  value={unspentReturned || ''}
                  onChange={e => setUnspentReturned(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg border p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Expenses ({validExpenses.length} items)</span>
            <span className="font-medium">{formatCurrency(totalExpenses, requisition.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Unspent Returned</span>
            <span className="font-medium">
              {formatCurrency(unspentReturned, requisition.currency)}
            </span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="font-medium text-gray-900">Total Accounted</span>
            <span className="font-bold">{formatCurrency(totalEntered, requisition.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Balance</span>
            <span
              className={`font-medium ${
                isBalanced ? 'text-green-600' : balanceDue < 0 ? 'text-red-600' : 'text-amber-600'
              }`}
            >
              {balanceDue < 0 ? '+' : ''}
              {formatCurrency(Math.abs(balanceDue), requisition.currency)}
              {isBalanced && ' ✓'}
            </span>
          </div>
        </div>

        {!isBalanced && balanceDue > 0 && (
          <div className="mt-3 p-2 bg-amber-50 rounded-lg text-sm text-amber-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>
              You still have {formatCurrency(balanceDue, requisition.currency)} to account for
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {!isBalanced && (
            <span className="text-sm text-gray-500">
              Amounts don&apos;t match - you can still submit
            </span>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || uploading || !isValid}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {(loading || uploading) ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploading ? 'Uploading Documents...' : 'Submitting...'}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Submit Accountability
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountabilityFormPage;
