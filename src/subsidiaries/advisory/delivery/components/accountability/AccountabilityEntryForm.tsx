/**
 * ACCOUNTABILITY ENTRY FORM COMPONENT
 *
 * A comprehensive form for entering accountability entries with document attachments.
 * Each entry represents a purchase transaction with supporting documents like:
 * - Invoice
 * - Receipt
 * - Delivery Note
 * - Purchase Order
 * - Other relevant documents
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  FileText,
  Upload,
  X,
  Trash2,
  Calendar,
  DollarSign,
  Building2,
  Tag,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileImage,
  Download,
  Eye,
  Search,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { format } from 'date-fns';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/shared/services/firebase';

import {
  SupportingDocument,
  SupportingDocumentType,
  DOCUMENT_TYPE_CONFIG,
  PROOF_OF_SPEND_REQUIREMENTS,
} from '../../types/accountability';
import {
  ExpenseCategory,
  EXPENSE_CATEGORY_LABELS,
} from '../../types/requisition';
import {
  ManualAccountabilityEntry,
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
} from '../../types/manual-requisition';
import { useSuppliers } from '@/subsidiaries/advisory/matflow/hooks/supplier-hooks';
import type { Supplier } from '@/subsidiaries/advisory/matflow/types/supplier';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface AccountabilityEntryFormProps {
  /** The requisition ID for file storage path */
  requisitionId: string;
  /** Existing entry to edit (if any) */
  existingEntry?: ManualAccountabilityEntry;
  /** Currency for display */
  currency: string;
  /** Callback when entry is saved */
  onSave: (entry: Omit<ManualAccountabilityEntry, 'id'> & { id?: string }) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Whether form is loading */
  isLoading?: boolean;
  /** User ID for tracking uploads */
  userId: string;
}

interface DocumentUpload {
  id: string;
  type: SupportingDocumentType;
  file?: File;
  preview?: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
  document?: SupportingDocument;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDocumentTypeOptions(): { value: SupportingDocumentType; label: string; description: string; required: boolean }[] {
  return Object.entries(DOCUMENT_TYPE_CONFIG)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([value, config]) => ({
      value: value as SupportingDocumentType,
      label: config.label,
      description: config.description,
      required: config.required,
    }));
}

function getRequiredDocumentsForCategory(category: ExpenseCategory): SupportingDocumentType[] {
  // Map from proof of spend requirements to supporting document types
  const requirements = PROOF_OF_SPEND_REQUIREMENTS[category];
  if (!requirements) return ['invoice', 'receipt'];

  // Convert DocumentType to SupportingDocumentType (they overlap)
  return requirements.requiredDocuments as unknown as SupportingDocumentType[];
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function AccountabilityEntryForm({
  requisitionId,
  existingEntry,
  currency,
  onSave,
  onCancel,
  isLoading = false,
  userId,
}: AccountabilityEntryFormProps) {
  // Helper to safely convert date to Date object
  const toDateObject = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    // Handle Firebase Timestamp
    if (typeof dateValue === 'object' && 'toDate' in dateValue && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    // Handle string or number
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Fetch shared suppliers from MatFlow database
  const { suppliers, loading: suppliersLoading } = useSuppliers({ status: 'active' });

  // Form state
  const [date, setDate] = useState<string>(() => {
    try {
      const dateObj = toDateObject(existingEntry?.date);
      return format(dateObj, 'yyyy-MM-dd');
    } catch {
      return format(new Date(), 'yyyy-MM-dd');
    }
  });
  const [description, setDescription] = useState(existingEntry?.description || '');
  const [category, setCategory] = useState<ExpenseCategory>(existingEntry?.category || 'construction_materials');
  const [vendor, setVendor] = useState(existingEntry?.vendor || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [useCustomVendor, setUseCustomVendor] = useState<boolean>(!existingEntry?.vendor || false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [amount, setAmount] = useState<number>(existingEntry?.amount || 0);

  // Filter suppliers based on search
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers.slice(0, 10);
    const search = supplierSearch.toLowerCase();
    return suppliers.filter(s =>
      s.name?.toLowerCase().includes(search) ||
      s.phone?.includes(search) ||
      s.contactPerson?.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [suppliers, supplierSearch]);

  // Handle supplier selection
  const handleSupplierSelect = useCallback((supplier: Supplier) => {
    setSelectedSupplierId(supplier.id);
    setVendor(supplier.name || supplier.phone);
    setSupplierSearch('');
    setShowSupplierDropdown(false);
    setUseCustomVendor(false);
  }, []);
  const [receiptNumber, setReceiptNumber] = useState(existingEntry?.receiptNumber || '');
  const [invoiceNumber, setInvoiceNumber] = useState(existingEntry?.invoiceNumber || '');
  const [notes, setNotes] = useState(existingEntry?.notes || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(existingEntry?.paymentMethod || '');
  const [contractOrPONumber, setContractOrPONumber] = useState(existingEntry?.contractOrPONumber || '');

  // Document uploads state
  const [documentUploads, setDocumentUploads] = useState<DocumentUpload[]>([]);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<SupportingDocumentType>('invoice');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [documentNotes, setDocumentNotes] = useState('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize existing documents
  useEffect(() => {
    if (existingEntry?.documents && existingEntry.documents.length > 0) {
      const existingUploads: DocumentUpload[] = existingEntry.documents.map(doc => ({
        id: doc.id,
        type: doc.type,
        uploading: false,
        uploaded: true,
        document: doc,
      }));
      setDocumentUploads(existingUploads);
    }
  }, [existingEntry]);

  // Get required documents for current category
  const requiredDocuments = getRequiredDocumentsForCategory(category);
  const uploadedTypes = new Set(documentUploads.filter(u => u.uploaded).map(u => u.type));
  const missingRequired = requiredDocuments.filter(type => !uploadedTypes.has(type as SupportingDocumentType));

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setCurrentFile(file);
      setShowDocumentDialog(true);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleUploadDocument = useCallback(async () => {
    if (!currentFile) return;

    setUploading(true);
    try {
      // Upload to Firebase Storage
      const timestamp = Date.now();
      const storagePath = `accountability-documents/${requisitionId}/${timestamp}-${currentFile.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, currentFile);
      const downloadUrl = await getDownloadURL(storageRef);

      // Create document record
      const newDocument: SupportingDocument = {
        id: `doc-${timestamp}`,
        type: selectedDocumentType,
        fileName: currentFile.name,
        fileUrl: downloadUrl,
        fileSize: currentFile.size,
        mimeType: currentFile.type,
        documentNumber: documentNumber || undefined,
        documentDate: documentDate ? new Date(documentDate) : undefined,
        uploadedAt: new Date(),
        uploadedBy: userId,
        notes: documentNotes || undefined,
      };

      // Add to uploads
      setDocumentUploads(prev => [
        ...prev,
        {
          id: newDocument.id,
          type: selectedDocumentType,
          uploading: false,
          uploaded: true,
          document: newDocument,
        },
      ]);

      // Reset dialog
      setShowDocumentDialog(false);
      setCurrentFile(null);
      setSelectedDocumentType('invoice');
      setDocumentNumber('');
      setDocumentDate('');
      setDocumentNotes('');
    } catch (error) {
      console.error('Failed to upload document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [currentFile, requisitionId, selectedDocumentType, documentNumber, documentDate, documentNotes, userId]);

  const handleRemoveDocument = useCallback((uploadId: string) => {
    setDocumentUploads(prev => prev.filter(u => u.id !== uploadId));
  }, []);

  const handleSubmit = useCallback(() => {
    // Validate required fields
    if (!description.trim()) {
      alert('Description is required');
      return;
    }
    if (amount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }
    if (!paymentMethod) {
      alert('Payment method is required');
      return;
    }

    // Collect uploaded documents - clean each document to remove undefined fields
    const documents: SupportingDocument[] = documentUploads
      .filter(u => u.uploaded && u.document)
      .map(u => {
        const doc = u.document!;
        // Build a clean document object without undefined fields
        const cleanDoc: Record<string, any> = {
          id: doc.id,
          type: doc.type,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          uploadedAt: doc.uploadedAt,
          uploadedBy: doc.uploadedBy,
        };
        if (doc.fileSize !== undefined) cleanDoc.fileSize = doc.fileSize;
        if (doc.mimeType) cleanDoc.mimeType = doc.mimeType;
        if (doc.documentNumber) cleanDoc.documentNumber = doc.documentNumber;
        if (doc.documentDate) cleanDoc.documentDate = doc.documentDate;
        if (doc.notes) cleanDoc.notes = doc.notes;
        return cleanDoc as SupportingDocument;
      });

    // Build entry object without undefined fields - Firestore does NOT accept undefined
    const entry: Record<string, any> = {
      date: new Date(date),
      description: description.trim(),
      category,
      amount,
      documents,
      paymentMethod: paymentMethod as PaymentMethod,
    };

    // Only add optional fields if they have values (NOT undefined)
    if (existingEntry?.id) entry.id = existingEntry.id;
    if (vendor.trim()) entry.vendor = vendor.trim();
    if (receiptNumber.trim()) entry.receiptNumber = receiptNumber.trim();
    if (invoiceNumber.trim()) entry.invoiceNumber = invoiceNumber.trim();
    if (notes.trim()) entry.notes = notes.trim();
    if (contractOrPONumber.trim()) entry.contractOrPONumber = contractOrPONumber.trim();

    onSave(entry as Omit<ManualAccountabilityEntry, 'id'> & { id?: string });
  }, [
    date,
    description,
    category,
    vendor,
    amount,
    receiptNumber,
    invoiceNumber,
    notes,
    documentUploads,
    existingEntry,
    onSave,
    paymentMethod,
    contractOrPONumber,
  ]);

  const documentTypeOptions = getDocumentTypeOptions();

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {existingEntry ? 'Edit Accountability Entry' : 'New Accountability Entry'}
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Entry Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Calendar className="w-4 h-4 inline mr-1" />
            Date <span className="text-red-500">*</span>
          </label>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Tag className="w-4 h-4 inline mr-1" />
            Expense Category <span className="text-red-500">*</span>
          </label>
          <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <FileText className="w-4 h-4 inline mr-1" />
            Description <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the expense/purchase..."
            rows={2}
          />
        </div>

        {/* Vendor/Supplier Selector */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Building2 className="w-4 h-4 inline mr-1" />
            Vendor/Supplier
          </label>

          {/* Toggle between database and custom vendor */}
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                setUseCustomVendor(false);
                setShowSupplierDropdown(true);
              }}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                !useCustomVendor
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Search className="w-3 h-3" />
              From Database
            </button>
            <button
              type="button"
              onClick={() => {
                setUseCustomVendor(true);
                setShowSupplierDropdown(false);
                setSelectedSupplierId('');
              }}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                useCustomVendor
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <UserPlus className="w-3 h-3" />
              Custom Entry
            </button>
          </div>

          {useCustomVendor ? (
            /* Custom vendor input */
            <Input
              type="text"
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              placeholder="Enter vendor/supplier name"
            />
          ) : (
            /* Supplier database selector */
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  value={supplierSearch || vendor}
                  onChange={e => {
                    setSupplierSearch(e.target.value);
                    setShowSupplierDropdown(true);
                  }}
                  onFocus={() => setShowSupplierDropdown(true)}
                  placeholder="Search suppliers by name or phone..."
                  className="pl-10"
                />
              </div>

              {/* Supplier dropdown */}
              {showSupplierDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {suppliersLoading ? (
                    <div className="p-3 text-center text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Loading suppliers...
                    </div>
                  ) : filteredSuppliers.length === 0 ? (
                    <div className="p-3 text-center text-gray-500">
                      <p className="text-sm">No suppliers found</p>
                      <button
                        type="button"
                        onClick={() => setUseCustomVendor(true)}
                        className="text-xs text-amber-600 hover:underline mt-1"
                      >
                        Enter custom vendor instead
                      </button>
                    </div>
                  ) : (
                    <>
                      {filteredSuppliers.map(supplier => (
                        <button
                          key={supplier.id}
                          type="button"
                          onClick={() => handleSupplierSelect(supplier)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="font-medium text-sm">
                            {supplier.name || 'Unnamed Supplier'}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{supplier.phone}</span>
                            {supplier.contactPerson && (
                              <span>• {supplier.contactPerson}</span>
                            )}
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setShowSupplierDropdown(false);
                          setUseCustomVendor(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-amber-600 hover:bg-amber-50 border-t"
                      >
                        <UserPlus className="w-3 h-3 inline mr-1" />
                        Add custom vendor
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Selected supplier indicator */}
          {selectedSupplierId && !useCustomVendor && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Linked to supplier database
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Amount ({currency}) <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            value={amount || ''}
            onChange={e => setAmount(parseFloat(e.target.value) || 0)}
            placeholder="0"
            min={0}
            step={0.01}
          />
        </div>

        {/* Receipt Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Receipt Number
          </label>
          <Input
            type="text"
            value={receiptNumber}
            onChange={e => setReceiptNumber(e.target.value)}
            placeholder="e.g., RCP-001"
          />
        </div>

        {/* Invoice Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invoice Number
          </label>
          <Input
            type="text"
            value={invoiceNumber}
            onChange={e => setInvoiceNumber(e.target.value)}
            placeholder="e.g., INV-12345"
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Payment Method <span className="text-red-500">*</span>
          </label>
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
            <SelectTrigger>
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contract/PO Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <FileText className="w-4 h-4 inline mr-1" />
            Contract/PO Number
          </label>
          <Input
            type="text"
            value={contractOrPONumber}
            onChange={e => setContractOrPONumber(e.target.value)}
            placeholder="e.g., PO-2024-001 or CTR-123"
          />
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes about this expense..."
            rows={2}
          />
        </div>
      </div>

      {/* Required Documents Notice */}
      {missingRequired.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Recommended Documents for {EXPENSE_CATEGORY_LABELS[category]}
              </p>
              <p className="text-sm text-amber-600 mt-1">
                Please attach: {missingRequired.map(type => DOCUMENT_TYPE_CONFIG[type as SupportingDocumentType]?.label || type).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Documents Section */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Supporting Documents
            <Badge variant="outline" className="ml-2">
              {documentUploads.filter(u => u.uploaded).length} uploaded
            </Badge>
          </h4>
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Add Document
            </Button>
          </div>
        </div>

        {/* Uploaded Documents List */}
        {documentUploads.length > 0 ? (
          <div className="space-y-2">
            {documentUploads.map(upload => (
              <div
                key={upload.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded border">
                    {upload.document?.mimeType?.startsWith('image/') ? (
                      <FileImage className="w-5 h-5 text-blue-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {upload.document?.fileName || 'Unknown file'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {DOCUMENT_TYPE_CONFIG[upload.type]?.label || upload.type}
                      </Badge>
                      {DOCUMENT_TYPE_CONFIG[upload.type]?.required && (
                        <Badge className="text-xs bg-green-100 text-green-700">Required</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {upload.document?.fileSize
                        ? formatFileSize(upload.document.fileSize)
                        : ''}
                      {upload.document?.documentNumber && (
                        <span className="ml-2">• Doc #: {upload.document.documentNumber}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {upload.uploaded && upload.document && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(upload.document!.fileUrl, '_blank')}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = upload.document!.fileUrl;
                          a.download = upload.document!.fileName;
                          a.click();
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveDocument(upload.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No documents uploaded</p>
            <p className="text-gray-400 text-xs mt-1">
              Click "Add Document" to attach invoices, receipts, etc.
            </p>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              {existingEntry ? 'Update Entry' : 'Add Entry'}
            </>
          )}
        </Button>
      </div>

      {/* Document Upload Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add details about the document you're uploading
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* File Preview */}
            {currentFile && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="w-8 h-8 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(currentFile.size)}</p>
                </div>
              </div>
            )}

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedDocumentType}
                onValueChange={(v) => setSelectedDocumentType(v as SupportingDocumentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span>{option.label}</span>
                        {option.required && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {DOCUMENT_TYPE_CONFIG[selectedDocumentType]?.description}
              </p>
            </div>

            {/* Document Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Number
              </label>
              <Input
                type="text"
                value={documentNumber}
                onChange={e => setDocumentNumber(e.target.value)}
                placeholder="e.g., INV-12345, RCP-001"
              />
            </div>

            {/* Document Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Date
              </label>
              <Input
                type="date"
                value={documentDate}
                onChange={e => setDocumentDate(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <Textarea
                value={documentNotes}
                onChange={e => setDocumentNotes(e.target.value)}
                placeholder="Additional notes about this document..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDocumentDialog(false);
                setCurrentFile(null);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUploadDocument} disabled={uploading || !currentFile}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AccountabilityEntryForm;
