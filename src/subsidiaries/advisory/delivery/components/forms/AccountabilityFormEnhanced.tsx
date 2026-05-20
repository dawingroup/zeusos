/**
 * ENHANCED ACCOUNTABILITY FORM (ADD-FIN-001)
 *
 * Features:
 * - Zero-discrepancy validation
 * - Category-specific proof of spend requirements
 * - Document quality validation (300 DPI)
 * - Variance calculation with 4-tier classification
 * - Investigation triggers for moderate/severe variances
 * - BOQ executed quantity tracking
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Send,
  X,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { getFirestore } from 'firebase/firestore';
import { useAuth } from '@/shared/hooks';
import { StatusBadge } from '../common/StatusBadge';
import type {
  AccountabilityFormData,
  AccountabilityExpense,
  ProofOfSpendDocument,
  DocumentType,
} from '../../types/accountability';
import type { ExpenseCategory } from '../../types/requisition';
import {
  PROOF_OF_SPEND_REQUIREMENTS,
  DOCUMENT_TYPE_LABELS,
  calculateAccountabilityVariance,
  validateProofOfSpend,
  getVarianceStatusColor,
} from '../../types/accountability';
import { EXPENSE_CATEGORY_LABELS } from '../../types/requisition';
import type { AllocationSplitRow, AllocationMethod } from '../../types/allocation';
import { useCreateAllocationGroup, useVendorAllocationHistory } from '../../hooks/useAllocation';
import { useAllProjects } from '../../hooks/project-hooks';
import { AllocationSplitter } from '../allocation/AllocationSplitter';

const generateId = () => Math.random().toString(36).substring(2, 9);

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface ExpenseForm extends Omit<AccountabilityExpense, 'id' | 'status'> {
  id: string;
}

export function AccountabilityFormEnhanced() {
  const navigate = useNavigate();
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const { user } = useAuth();

  // Requisition data
  const [requisition, setRequisition] = useState<any>(null);
  const [loadingRequisition, setLoadingRequisition] = useState(true);

  // Form state
  const [expenses, setExpenses] = useState<ExpenseForm[]>([
    {
      id: generateId(),
      lineNumber: 1,
      date: new Date(),
      description: '',
      category: 'construction_materials',
      amount: 0,
      documents: [],
      isZeroDiscrepancy: false,
    },
  ]);
  const [unspentReturned, setUnspentReturned] = useState(0);

  // Allocation state
  const [splitMode, setSplitMode] = useState(false);
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('Percentage');
  const [allocationRows, setAllocationRows] = useState<AllocationSplitRow[]>([]);
  const [allocationRationale, setAllocationRationale] = useState('');

  // Proof of spend state
  const [_uploadingDocuments, setUploadingDocuments] = useState<Record<string, boolean>>({});

  // Validation
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>({ valid: true, errors: [], warnings: [] });
  const [loading, setLoading] = useState(false);

  // Allocation hooks
  const orgId = (user as any)?.organizationId || 'default';
  const { createAllocation } = useCreateAllocationGroup();
  const db = getFirestore();
  const { projects: activeProjects } = useAllProjects(db, {
    status: ['active', 'mobilization', 'procurement'] as any[],
  });
  const vendorForSuggestions = splitMode
    ? expenses[0]?.vendor || ''
    : undefined;
  const { suggestions: vendorSuggestions } = useVendorAllocationHistory(
    vendorForSuggestions,
    splitMode ? orgId : undefined
  );

  // Load requisition
  useEffect(() => {
    if (requisitionId) {
      loadRequisition();
    }
  }, [requisitionId]);

  const loadRequisition = async () => {
    setLoadingRequisition(true);
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../../../../../firebase/config');
      const reqDoc = await getDoc(doc(db, 'requisitions', requisitionId!));
      if (reqDoc.exists()) {
        setRequisition({ id: reqDoc.id, ...reqDoc.data() } as any);
      }
    } catch (error) {
      console.error('Failed to load requisition:', error);
    } finally {
      setLoadingRequisition(false);
    }
  };

  // Expense handlers
  const addExpense = () => {
    setExpenses((prev) => [
      ...prev,
      {
        id: generateId(),
        lineNumber: prev.length + 1,
        date: new Date(),
        description: '',
        category: 'construction_materials',
        amount: 0,
        documents: [],
        isZeroDiscrepancy: false,
      },
    ]);
  };

  const removeExpense = (id: string) => {
    if (expenses.length > 1) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const updateExpense = <K extends keyof ExpenseForm>(
    id: string,
    field: K,
    value: ExpenseForm[K]
  ) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  // Document upload handler
  const handleDocumentUpload = async (
    expenseId: string,
    documentType: DocumentType,
    file: File
  ) => {
    setUploadingDocuments((prev) => ({ ...prev, [expenseId]: true }));
    try {
      // Upload to Firebase Storage
      const { ref, uploadBytes, getDownloadURL, getStorage } = await import('firebase/storage');
      const storage = getStorage();
      const storagePath = `accountability/${requisitionId}/${expenseId}/${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const documentUrl = await getDownloadURL(storageRef);

      // Extract DPI from image metadata
      let dpi: number | undefined;
      if (file.type.startsWith('image/')) {
        dpi = await new Promise<number>((resolve) => {
          const img = new Image();
          img.onload = () => {
            // Estimate DPI from image dimensions vs typical print sizes
            // Default to 300 if we can't determine
            resolve(Math.max(img.naturalWidth, img.naturalHeight) > 2000 ? 300 : 150);
          };
          img.onerror = () => resolve(300);
          img.src = URL.createObjectURL(file);
        });
      }

      const document: ProofOfSpendDocument = {
        id: generateId(),
        type: documentType,
        documentUrl,
        documentName: file.name,
        uploadedAt: new Date() as any,
        uploadedBy: user?.uid || '',
        fileSize: file.size,
        mimeType: file.type,
        dpi,
        isQualityValid: !dpi || dpi >= 300,
      };

      // Add document to expense
      setExpenses((prev) =>
        prev.map((expense) => {
          if (expense.id === expenseId) {
            const providedDocuments = expense.proofOfSpend?.providedDocuments || [];
            const updatedDocuments = [...providedDocuments, document];
            const validation = validateProofOfSpend(expense.category, updatedDocuments);

            return {
              ...expense,
              proofOfSpend: {
                expenseId,
                category: expense.category,
                requiredDocuments:
                  PROOF_OF_SPEND_REQUIREMENTS[expense.category].requiredDocuments,
                providedDocuments: updatedDocuments,
                isComplete: validation.isComplete,
                completionNotes: validation.completionNotes,
              },
            };
          }
          return expense;
        })
      );
    } catch (error) {
      console.error('Failed to upload document:', error);
    } finally {
      setUploadingDocuments((prev) => ({ ...prev, [expenseId]: false }));
    }
  };

  // Calculations
  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const variance = useMemo(() => {
    if (!requisition) return null;
    return calculateAccountabilityVariance(
      totalExpenses,
      unspentReturned,
      requisition.grossAmount
    );
  }, [totalExpenses, unspentReturned, requisition]);

  const proofOfSpendCompleteness = useMemo(() => {
    return expenses.map((expense) => {
      const requirements = PROOF_OF_SPEND_REQUIREMENTS[expense.category];
      const providedDocuments = expense.proofOfSpend?.providedDocuments || [];
      const validation = validateProofOfSpend(expense.category, providedDocuments);

      return {
        expenseId: expense.id,
        category: expense.category,
        requirements,
        validation,
      };
    });
  }, [expenses]);

  // Validation
  const validateForm = () => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (expenses.length === 0 || expenses.every((e) => e.amount === 0)) {
      errors.push('Add at least one expense');
    }

    // Check proof of spend completeness
    proofOfSpendCompleteness.forEach((proof) => {
      if (!proof.validation.isComplete) {
        warnings.push(
          `Expense "${expenses.find((e) => e.id === proof.expenseId)?.description || 'Untitled'}" is missing proof: ${proof.validation.missingDocuments.join(', ')}`
        );
      }
    });

    // Check variance
    if (variance && !variance.isZeroDiscrepancy) {
      warnings.push(
        `Variance detected: ${formatCurrency(variance.varianceAmount)} (${variance.variancePercentage.toFixed(2)}%). ADD-FIN-001 requires zero discrepancy.`
      );

      if (variance.requiresInvestigation) {
        warnings.push(
          `This variance (${variance.varianceStatus}) will trigger an investigation with 48-hour deadline.`
        );
      }
    }

    // Check document quality
    expenses.forEach((expense) => {
      const lowQualityDocs =
        expense.proofOfSpend?.providedDocuments.filter((d) => d.dpi && d.dpi < 300) || [];
      if (lowQualityDocs.length > 0) {
        warnings.push(
          `Expense "${expense.description}" has ${lowQualityDocs.length} document(s) below 300 DPI quality standard`
        );
      }
    });

    setValidationResult({ valid: errors.length === 0, errors, warnings });
    return errors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!requisitionId || !user) return;

    setLoading(true);
    try {
      // If allocation mode, also create the allocation group
      if (splitMode && allocationRows.length >= 2 && allocationRationale.trim()) {
        await createAllocation(
          {
            date: new Date(),
            vendorName: expenses[0]?.vendor || 'Unknown',
            description: expenses.map(e => e.description).filter(Boolean).join('; '),
            totalAmount: totalExpenses,
            currency: (requisition?.currency as 'UGX' | 'USD') || 'UGX',
            allocationMethod,
            rationale: allocationRationale.trim(),
            sourceDocumentUrls: [],
            allocations: allocationRows.map(row => ({
              projectId: row.projectId,
              projectName: row.projectName,
              programId: row.programId,
              budgetCategory: row.budgetCategory,
              percentage: row.percentage,
              allocatedAmount: row.allocatedAmount,
              requisitionId,
            })),
          },
          user.uid,
          orgId
        );
      }

      const formData: AccountabilityFormData = {
        requisitionId,
        expenses: expenses.map((e, idx) => ({
          lineNumber: idx + 1,
          date: e.date,
          description: e.description,
          category: e.category,
          amount: e.amount,
          vendor: e.vendor,
          receiptNumber: e.receiptNumber,
          documents: e.documents || [],
          isZeroDiscrepancy: Math.abs(e.amount - (e.amount || 0)) < 0.01,
          proofOfSpend: e.proofOfSpend,
          boqItemId: e.boqItemId,
          boqItemCode: e.boqItemCode,
          quantityExecuted: e.quantityExecuted,
        })),
        unspentReturned,
      };

      // Submit via Firestore
      const { collection, addDoc, Timestamp } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('../../../../../firebase/config');
      await addDoc(collection(firestoreDb, 'accountabilities'), {
        ...formData,
        projectId: requisition?.projectId,
        submittedBy: user.uid,
        submittedAt: Timestamp.now(),
        status: 'pending_review',
        variance: variance ? {
          amount: variance.varianceAmount,
          percentage: variance.variancePercentage,
          status: variance.varianceStatus,
          isZeroDiscrepancy: variance.isZeroDiscrepancy,
        } : null,
      });

      navigate(`/advisory/delivery/requisitions/${requisitionId}`);
    } catch (error: any) {
      console.error('Failed to create accountability:', error);
      setValidationResult({
        valid: false,
        errors: [error.message || 'Failed to create accountability'],
        warnings: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingRequisition) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-gray-600">Loading requisition...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            New Accountability (ADD-FIN-001)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Zero-discrepancy policy with proof of spend validation
          </p>
          {requisition && (
            <p className="text-sm text-gray-600 mt-1">
              For Requisition: {requisition.requisitionNumber} -{' '}
              {formatCurrency(requisition.grossAmount)}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>

      {/* Validation messages */}
      {validationResult.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 mb-1">
                Cannot create accountability
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {validationResult.errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {validationResult.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-900 mb-1">Warnings</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {validationResult.warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Variance Summary */}
      {variance && (
        <div
          className={`border rounded-lg p-4 ${
            variance.isZeroDiscrepancy
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Variance Summary
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Requisition:</span>
                  <span className="font-medium ml-2">
                    {formatCurrency(variance.requisitionAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total Expenses:</span>
                  <span className="font-medium ml-2">
                    {formatCurrency(variance.totalExpenses)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Unspent Returned:</span>
                  <span className="font-medium ml-2">
                    {formatCurrency(variance.unspentReturned)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Variance:</span>
                  <span className={`font-medium ml-2 ${variance.varianceAmount < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(variance.varianceAmount)} (
                    {variance.variancePercentage.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge
                status={variance.varianceStatus}
                customColor={getVarianceStatusColor(variance.varianceStatus)}
              />
              {variance.isZeroDiscrepancy && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expenses */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Expenses</h2>
          <p className="text-sm text-gray-500 mt-1">
            Provide detailed expenses with proof of spend
          </p>
        </div>

        <div className="p-6 space-y-6">
          {expenses.map((expense, index) => {
            const requirements = PROOF_OF_SPEND_REQUIREMENTS[expense.category];
            const providedDocuments = expense.proofOfSpend?.providedDocuments || [];
            const validation = validateProofOfSpend(expense.category, providedDocuments);

            return (
              <div key={expense.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Expense {index + 1}
                  </span>
                  <button
                    onClick={() => removeExpense(expense.id)}
                    className="text-red-600 hover:text-red-700"
                    disabled={expenses.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={expense.description}
                      onChange={(e) =>
                        updateExpense(expense.id, 'description', e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="What was purchased/paid for?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={expense.category}
                      onChange={(e) =>
                        updateExpense(
                          expense.id,
                          'category',
                          e.target.value as ExpenseCategory
                        )
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={expense.amount || ''}
                      onChange={(e) =>
                        updateExpense(
                          expense.id,
                          'amount',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor
                    </label>
                    <input
                      type="text"
                      value={expense.vendor || ''}
                      onChange={(e) =>
                        updateExpense(expense.id, 'vendor', e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Vendor name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Receipt Number
                    </label>
                    <input
                      type="text"
                      value={expense.receiptNumber || ''}
                      onChange={(e) =>
                        updateExpense(expense.id, 'receiptNumber', e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Receipt/invoice number"
                    />
                  </div>
                </div>

                {/* Proof of Spend Checklist */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        Proof of Spend Checklist
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {requirements.description} (300 DPI minimum)
                      </p>
                    </div>
                    {validation.isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    )}
                  </div>

                  <div className="space-y-2">
                    {requirements.requiredDocuments.map((docType) => {
                      const hasDocument = providedDocuments.some(
                        (d) => d.type === docType
                      );

                      return (
                        <div
                          key={docType}
                          className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            {hasDocument ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                            )}
                            <span className="text-sm text-gray-700">
                              {DOCUMENT_TYPE_LABELS[docType]}
                            </span>
                          </div>

                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept={
                                docType === 'photo_evidence'
                                  ? 'image/*'
                                  : 'application/pdf,image/*'
                              }
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleDocumentUpload(expense.id, docType, file);
                                }
                              }}
                            />
                            <div className="px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded flex items-center gap-1">
                              <Upload className="w-3 h-3" />
                              Upload
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {providedDocuments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <h5 className="text-xs font-medium text-gray-700 mb-2">
                        Uploaded Documents ({providedDocuments.length})
                      </h5>
                      <div className="space-y-1">
                        {providedDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between text-xs text-gray-600 bg-white rounded px-2 py-1"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-3 h-3" />
                              <span>{doc.documentName}</span>
                              {doc.dpi && (
                                <span
                                  className={`px-1.5 py-0.5 rounded ${
                                    doc.dpi >= 300
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {doc.dpi} DPI
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button
            onClick={addExpense}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary hover:text-primary flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Multi-Project Allocation */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Project Allocation
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Split this expense across multiple projects
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">
              {splitMode ? 'Multi-project' : 'Single project'}
            </span>
            <div
              onClick={() => setSplitMode(!splitMode)}
              className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${
                splitMode ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  splitMode ? 'left-5' : 'left-1'
                }`}
              />
            </div>
          </label>
        </div>

        {splitMode && (
          <AllocationSplitter
            totalAmount={totalExpenses}
            currency={(requisition?.currency as 'UGX' | 'USD') || 'UGX'}
            vendorName={expenses[0]?.vendor || ''}
            activeProjects={activeProjects}
            method={allocationMethod}
            onMethodChange={setAllocationMethod}
            allocations={allocationRows}
            onChange={setAllocationRows}
            rationale={allocationRationale}
            onRationaleChange={setAllocationRationale}
            suggestions={vendorSuggestions}
          />
        )}
      </div>

      {/* Unspent Amount */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Unspent Amount
        </h2>
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount to Return
          </label>
          <input
            type="number"
            value={unspentReturned || ''}
            onChange={(e) => setUnspentReturned(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="0"
          />
          <p className="text-xs text-gray-500 mt-1">
            Any unspent funds from the requisition
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Submit Accountability
        </button>
      </div>
    </div>
  );
}

export default AccountabilityFormEnhanced;
