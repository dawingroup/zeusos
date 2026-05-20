/**
 * QUICK CAPTURE FORM
 *
 * Mobile-first single-page form for recording field expenditures.
 * Designed for 375px screens with large touch targets (48px min).
 *
 * Features:
 * - AI-powered receipt extraction (Gemini Flash)
 * - Project picker with real Firestore projects
 * - Image-to-PDF conversion on submit
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  ImagePlus,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  FileText,
  Eye,
  FolderDown,
  AlertCircle,
} from 'lucide-react';
import { getFirestore } from 'firebase/firestore';
import { useAuth } from '@/shared/hooks';
import { useCreateQuickCapture, useMatchingRequisitions } from '../../hooks/useQuickCapture';
import { useCreateAllocationGroup } from '../../hooks/useAllocation';
import { useDriveImport } from '../../hooks/useDriveImport';
import type { DriveFile } from '../../services/drive-import-service';
import { refreshGoogleAccessToken } from '@/shared/services/firebase/auth';
import { useReceiptExtraction } from '../../hooks/useReceiptExtraction';
import { useAllProjects } from '../../hooks/project-hooks';
import { DocumentCaptureService } from '../../services/document-capture-service';
import { ImageToPdfService } from '../../services/image-to-pdf-service';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '../../types/requisition';
import type {
  QuickCaptureInput,
  QuickCaptureDocument,
  QuickCaptureDocumentType,
  PaymentMethod,
} from '../../types/quick-capture';
import {
  QUICK_CAPTURE_DOCUMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../types/quick-capture';
import { formatBudgetAmount } from '../../types/project-budget';
import type { CaptureLineItem } from '../../types/allocation';
import type { OCRReviewState } from '../../types/ocr.types';
import { useMatrixState } from '../../hooks/useMatrixAllocation';
import { ProjectPicker } from './ProjectPicker';
import { AiFieldIndicator } from './AiFieldIndicator';
import { ReceiptScanner } from './ReceiptScanner';
import { OCRResultReview } from './OCRResultReview';
import { MatrixSplitter } from '../allocation/MatrixSplitter';

const BUDGET_CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];
const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'MobileMoney', 'BankTransfer', 'Cheque'];
const DOC_TYPES: QuickCaptureDocumentType[] = ['Receipt', 'Invoice', 'DeliveryNote', 'Photo', 'Other'];

interface CapturedDoc {
  file: File;
  previewUrl: string;
  type: QuickCaptureDocumentType;
  uploading: boolean;
  uploaded?: QuickCaptureDocument;
}

export function QuickCaptureForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = (user as any)?.organizationId || 'default';
  const userId = user?.uid || '';

  // Form state
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [vendorName, setVendorName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'UGX' | 'USD'>('UGX');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [programId, setProgramId] = useState('');
  const [budgetCategory, setBudgetCategory] = useState<string>('construction_materials');
  const [requisitionId, setRequisitionId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<CapturedDoc[]>([]);
  const [showRequisitionLink, setShowRequisitionLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Split mode state: 'single' or 'matrix'
  type SplitMode = 'single' | 'matrix';
  const [splitMode, setSplitMode] = useState<SplitMode>('single');

  // AI extraction state
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const { extract: extractReceipt, result: aiResult, extracting } = useReceiptExtraction();

  const [previewingPdf, setPreviewingPdf] = useState(false);

  // Scanner & OCR review state
  const [showScanner, setShowScanner] = useState(false);
  const [showOCRReview, setShowOCRReview] = useState(false);
  const [ocrReviewImageUrl, setOcrReviewImageUrl] = useState<string | null>(null);

  // Drive import state
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const { driveFiles, listing: driveListLoading, importing: driveImporting, error: driveError, listFiles: listDriveFiles, importFile: importDriveFile } = useDriveImport();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileRef = useRef<HTMLInputElement>(null);

  const { createCapture } = useCreateQuickCapture();
  const { createAllocation } = useCreateAllocationGroup();
  const parsedAmount = parseFloat(amount) || 0;
  const { requisitions: matchingReqs, loading: loadingReqs } = useMatchingRequisitions(
    projectId || undefined,
    parsedAmount
  );

  // Active projects for picker + allocation splitter
  const db = getFirestore();
  const { projects: activeProjects, loading: projectsLoading, error: projectsError } = useAllProjects(db, {
    status: ['planning', 'active', 'mobilization', 'procurement'] as any[],
  });

  // Matrix allocation state
  const matrix = useMatrixState(parsedAmount, currency);

  // ─── AI Auto-fill Effect ────────────────────────────────────

  useEffect(() => {
    if (!aiResult || aiResult.confidence === 0) return;

    const filled = new Set<string>();

    if (aiResult.vendorName && !vendorName) {
      setVendorName(aiResult.vendorName);
      filled.add('vendorName');
    }
    if (aiResult.totalAmount && !amount) {
      setAmount(String(aiResult.totalAmount));
      filled.add('amount');
    }
    if (aiResult.currency && currency === 'UGX') {
      setCurrency(aiResult.currency);
      if (aiResult.currency !== 'UGX') filled.add('currency');
    }
    if (aiResult.date && date === new Date().toISOString().split('T')[0]) {
      setDate(aiResult.date);
      filled.add('date');
    }
    if (aiResult.description && !description) {
      setDescription(aiResult.description);
      filled.add('description');
    }
    if (aiResult.paymentMethodHint && paymentMethod === 'Cash') {
      setPaymentMethod(aiResult.paymentMethodHint);
      filled.add('paymentMethod');
    }

    // Auto-populate matrix line items from AI extraction
    if (aiResult.lineItems && aiResult.lineItems.length >= 1 && matrix.lineItems.length === 0) {
      const items: CaptureLineItem[] = aiResult.lineItems
        .filter((li) => li.description && li.quantity && li.unitPrice)
        .map((li) => ({
          id: crypto.randomUUID(),
          description: li.description,
          quantity: li.quantity ?? 1,
          unit: 'pcs',
          unitPrice: li.unitPrice ?? 0,
          totalPrice: (li.quantity ?? 1) * (li.unitPrice ?? 0),
          budgetCategory: 'materials',
        }));
      if (items.length >= 1) {
        matrix.setAllLineItems(items);
        filled.add('lineItems');
      }
    }

    if (filled.size > 0) {
      setAiFilledFields(filled);
    }
  // Only run when AI result changes, not on every form field change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResult]);

  const dismissAiField = useCallback((field: string) => {
    setAiFilledFields(prev => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);

  // ─── Scanner & OCR Review ────────────────────────────────────

  const handleScannerCapture = useCallback((rawFile: File, scannedFile?: File) => {
    const fileToUse = scannedFile || rawFile;
    const previewUrl = URL.createObjectURL(fileToUse);
    const newDoc: CapturedDoc = {
      file: fileToUse,
      previewUrl,
      type: 'Receipt',
      uploading: false,
    };
    setDocuments(prev => [...prev, newDoc]);
    setShowScanner(false);

    // Trigger AI extraction
    if (fileToUse.type.startsWith('image/')) {
      setOcrReviewImageUrl(previewUrl);
      extractReceipt(fileToUse).then((result) => {
        if (result && result.confidence > 0) {
          setShowOCRReview(true);
        }
      }).catch(() => {});
    }
  }, [extractReceipt]);

  const handleOCRReviewConfirm = useCallback((reviewState: OCRReviewState) => {
    setShowOCRReview(false);
    // Apply confirmed fields to form
    const fields = reviewState.fields;
    const filled = new Set<string>();

    if (fields.vendorName?.confirmed && fields.vendorName.value) {
      setVendorName(fields.vendorName.value);
      filled.add('vendorName');
    }
    if (fields.totalAmount?.confirmed && fields.totalAmount.value) {
      setAmount(fields.totalAmount.value);
      filled.add('amount');
    }
    if (fields.currency?.confirmed && fields.currency.value) {
      setCurrency(fields.currency.value as 'UGX' | 'USD');
      filled.add('currency');
    }
    if (fields.date?.confirmed && fields.date.value) {
      setDate(fields.date.value);
      filled.add('date');
    }
    if (fields.description?.confirmed && fields.description.value) {
      setDescription(fields.description.value);
      filled.add('description');
    }
    if (fields.paymentMethod?.confirmed && fields.paymentMethod.value) {
      setPaymentMethod(fields.paymentMethod.value as PaymentMethod);
      filled.add('paymentMethod');
    }

    // Also populate matrix line items from the AI result after OCR review
    if (aiResult?.lineItems && aiResult.lineItems.length >= 1 && matrix.lineItems.length === 0) {
      const items: CaptureLineItem[] = aiResult.lineItems
        .filter((li) => li.description && li.quantity && li.unitPrice)
        .map((li) => ({
          id: crypto.randomUUID(),
          description: li.description,
          quantity: li.quantity ?? 1,
          unit: 'pcs',
          unitPrice: li.unitPrice ?? 0,
          totalPrice: (li.quantity ?? 1) * (li.unitPrice ?? 0),
          budgetCategory: 'materials',
        }));
      if (items.length >= 1) {
        matrix.setAllLineItems(items);
        filled.add('lineItems');
      }
    }

    if (filled.size > 0) {
      setAiFilledFields(filled);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResult]);

  // ─── Document Capture ────────────────────────────────────────

  const handleFileCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const file = files[0];
    const previewUrl = URL.createObjectURL(file);
    const newDoc: CapturedDoc = {
      file,
      previewUrl,
      type: 'Receipt',
      uploading: false,
    };
    setDocuments(prev => [...prev, newDoc]);

    // Trigger AI extraction for receipt/invoice images (non-blocking)
    if (file.type.startsWith('image/')) {
      extractReceipt(file).catch(() => {
        // Non-blocking: errors handled by the hook
      });
    }

    // Reset file input for reuse
    e.target.value = '';
  }, [extractReceipt]);

  const removeDocument = useCallback((index: number) => {
    setDocuments(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const updateDocType = useCallback((index: number, type: QuickCaptureDocumentType) => {
    setDocuments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], type };
      return updated;
    });
  }, []);

  // ─── Populate matrix from OCR when switching to split mode ──

  const populateMatrixFromOCR = useCallback(() => {
    if (matrix.lineItems.length > 0) return; // already populated
    if (aiResult?.lineItems && aiResult.lineItems.length >= 1) {
      const items: CaptureLineItem[] = aiResult.lineItems
        .filter((li) => li.description && li.quantity && li.unitPrice)
        .map((li) => ({
          id: crypto.randomUUID(),
          description: li.description,
          quantity: li.quantity ?? 1,
          unit: 'pcs',
          unitPrice: li.unitPrice ?? 0,
          totalPrice: (li.quantity ?? 1) * (li.unitPrice ?? 0),
          budgetCategory: 'materials',
        }));
      if (items.length >= 1) {
        matrix.setAllLineItems(items);
        return;
      }
    }
    // Fallback: create a single line item from the form amount/description
    if (parsedAmount > 0 && description.trim()) {
      matrix.setAllLineItems([{
        id: crypto.randomUUID(),
        description: description.trim(),
        quantity: 1,
        unit: 'lots',
        unitPrice: parsedAmount,
        totalPrice: parsedAmount,
        budgetCategory: budgetCategory || 'materials',
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResult, matrix.lineItems.length, parsedAmount, description, budgetCategory]);

  // ─── Project Selection ───────────────────────────────────────

  const handleProjectSelect = useCallback((id: string, name: string, progId: string, cur: 'UGX' | 'USD') => {
    setProjectId(id);
    setProjectName(name);
    setProgramId(progId);
    setCurrency(cur);
  }, []);

  // ─── PDF Preview ────────────────────────────────────────────

  const handlePreviewPdf = useCallback(async () => {
    const imageFiles = documents
      .filter(d => d.file.type.startsWith('image/'))
      .map(d => d.file);
    if (imageFiles.length === 0) return;

    setPreviewingPdf(true);
    try {
      const pdfService = ImageToPdfService.getInstance();
      const url = await pdfService.generatePreviewUrl(imageFiles);
      window.open(url, '_blank');
    } catch (err) {
      console.error('PDF preview failed:', err);
    } finally {
      setPreviewingPdf(false);
    }
  }, [documents]);

  // ─── Drive Import ───────────────────────────────────────────

  const handleOpenDrivePicker = useCallback(async () => {
    setShowDrivePicker(true);
    try {
      await listDriveFiles();
    } catch {
      // error state handled by the hook
    }
  }, [listDriveFiles]);

  const handleDriveFileSelect = useCallback(async (file: DriveFile) => {
    if (!projectId) return;

    // Find project code from active projects
    const project = activeProjects.find(p => p.id === projectId);
    const projectCode = project?.projectCode || projectId;

    // Find selected requisition number
    const selectedReq = matchingReqs.find(r => r.id === requisitionId);

    try {
      const imported = await importDriveFile({
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        projectCode,
        requisitionNumber: selectedReq?.requisitionNumber || null,
        vendorName: vendorName.trim() || 'scan',
        docType: 'Receipt',
        orgId,
        projectId,
      });

      // Add to documents list as an already-uploaded doc
      const previewUrl = file.thumbnailLink || '';
      setDocuments(prev => [...prev, {
        file: new File([], imported.fileName, { type: file.mimeType }),
        previewUrl,
        type: 'Receipt',
        uploading: false,
        uploaded: imported,
      }]);

      setShowDrivePicker(false);

      // Trigger AI extraction on the imported file if it's an image
      if (file.mimeType.startsWith('image/')) {
        const res = await fetch(imported.storageUrl);
        const blob = await res.blob();
        const imageFile = new File([blob], imported.fileName, { type: file.mimeType });
        extractReceipt(imageFile).catch(() => {});
      }
    } catch {
      // error state handled by the hook
    }
  }, [projectId, activeProjects, matchingReqs, requisitionId, vendorName, orgId, importDriveFile, extractReceipt]);

  // ─── Form Submission ─────────────────────────────────────────

  // ─── Document Upload Helper ────────────────────────────────
  const uploadDocuments = async (targetProjectId: string): Promise<{ uploadedDocs: QuickCaptureDocument[]; documentUrls: string[] }> => {
    const docService = DocumentCaptureService.getInstance();
    const uploadedDocs: QuickCaptureDocument[] = [];
    const documentUrls: string[] = [];

    // Upload raw images
    for (const capturedDoc of documents) {
      if (capturedDoc.uploaded) {
        uploadedDocs.push(capturedDoc.uploaded);
        documentUrls.push(capturedDoc.uploaded.storageUrl);
        continue;
      }
      const result = await docService.uploadDocument(capturedDoc.file, orgId, targetProjectId);
      uploadedDocs.push({
        type: capturedDoc.type,
        storageUrl: result.storageUrl,
        fileName: capturedDoc.file.name,
      });
      documentUrls.push(result.storageUrl);
    }

    // Convert images to scanned PDF
    const imageFiles = documents
      .filter(d => d.file.type.startsWith('image/'))
      .map(d => d.file);

    if (imageFiles.length > 0) {
      try {
        const pdfService = ImageToPdfService.getInstance();
        const { pdfBlob, fileName } = await pdfService.convertImagesToPdf(imageFiles);
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        const pdfResult = await docService.uploadDocument(pdfFile, orgId, targetProjectId);

        uploadedDocs.push({
          type: 'Receipt',
          storageUrl: pdfResult.storageUrl,
          fileName,
          pdfStorageUrl: pdfResult.storageUrl,
        });
        documentUrls.push(pdfResult.storageUrl);
      } catch (pdfErr) {
        console.warn('PDF conversion failed, using raw images:', pdfErr);
      }
    }

    return { uploadedDocs, documentUrls };
  };

  const handleSubmit = async (_isDraft: boolean) => {
    // Validate common fields
    if (!vendorName.trim() || !description.trim() || parsedAmount <= 0) return;

    // Validate mode-specific fields
    if (splitMode === 'matrix') {
      if (!matrix.validation.isComplete) return;
    } else {
      if (!projectId) return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (splitMode === 'matrix') {
        // ── MATRIX ALLOCATION MODE ───────────────────────────
        const firstProjectId = matrix.selectedProjects[0]?.projectId || 'shared';
        const { documentUrls } = await uploadDocuments(firstProjectId);

        const matrixInput = matrix.toAllocationInput();
        await createAllocation(
          {
            date: new Date(date),
            vendorName: vendorName.trim(),
            description: description.trim(),
            totalAmount: parsedAmount,
            currency,
            allocationMethod: matrixInput.allocationMethod,
            rationale: matrix.rationale.trim(),
            sourceDocumentUrls: documentUrls,
            allocations: matrixInput.allocations,
            lineItems: matrixInput.lineItems,
            matrixAllocations: matrixInput.matrixAllocations,
          },
          userId,
          orgId
        );
      } else {
        // ── SINGLE PROJECT MODE ──────────────────────────────
        const { uploadedDocs } = await uploadDocuments(projectId);

        const input: QuickCaptureInput = {
          date: new Date(date),
          vendorName: vendorName.trim(),
          description: description.trim(),
          totalAmount: parsedAmount,
          currency,
          paymentMethod,
          paymentReference: paymentMethod !== 'Cash' ? paymentReference || null : null,
          projectId,
          programId: programId || undefined,
          budgetCategory,
          requisitionId,
          documents: uploadedDocs,
          notes: notes.trim(),
        };

        await createCapture(input, userId, orgId);
      }

      setSubmitted(true);
      setTimeout(() => {
        navigate('/advisory/delivery/quick-captures');
      }, 1500);
    } catch (err) {
      console.error('Quick capture submission failed:', err);
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save capture. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success State ───────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-semibold text-gray-800">Capture Saved</h2>
        <p className="text-gray-500 text-center max-w-xs">
          {splitMode === 'matrix'
            ? 'Allocation group created — accountability entries added to each project.'
            : requisitionId
            ? 'Linked to requisition successfully.'
            : 'Added to your inbox — link to a requisition within 48 hours.'}
        </p>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 min-h-[48px] min-w-[48px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Quick Capture</h1>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* 1. Document Capture Section */}
        <section className="py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Documents
          </h2>

          {/* Hidden file inputs — camera (capture) and gallery (no capture) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileCapture}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileCapture}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileCapture}
            className="hidden"
          />
          <input
            ref={additionalFileRef}
            type="file"
            accept="image/*"
            onChange={handleFileCapture}
            className="hidden"
          />

          {documents.length === 0 ? (
            <div className="space-y-3">
              {/* Primary: Take Photo (mobile camera) */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors min-h-[120px]"
              >
                <Camera className="w-10 h-10" />
                <span className="font-medium">Take Photo of Receipt</span>
                <span className="text-xs text-blue-400">Opens your camera — AI will read the receipt</span>
              </button>

              {/* Secondary row: Gallery + Smart Scan + Drive */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors min-h-[48px]"
                >
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-sm font-medium">Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border border-purple-300 rounded-lg text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors min-h-[48px]"
                >
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-medium">Smart Scan</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleOpenDrivePicker}
                className="w-full flex items-center justify-center gap-2 py-3 border border-green-300 rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-colors min-h-[48px]"
              >
                <FolderDown className="w-5 h-5" />
                <span className="text-sm font-medium">Fetch from Google Drive</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc, i) => (
                <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                  <img
                    src={doc.previewUrl}
                    alt={`Document ${i + 1}`}
                    className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <select
                      value={doc.type}
                      onChange={(e) => updateDocType(i, e.target.value as QuickCaptureDocumentType)}
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white min-h-[36px]"
                    >
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {QUICK_CAPTURE_DOCUMENT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1 truncate">{doc.file.name}</p>
                  </div>
                  <button
                    onClick={() => removeDocument(i)}
                    className="p-1.5 text-gray-400 hover:text-red-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add more: camera, gallery, or Drive */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 min-h-[48px]"
                >
                  <Camera className="w-4 h-4" />
                  <span className="text-sm">Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 min-h-[48px]"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-sm">Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenDrivePicker}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border border-dashed border-green-300 rounded-lg text-green-600 hover:bg-green-50 min-h-[48px]"
                >
                  <FolderDown className="w-4 h-4" />
                  <span className="text-sm">Drive</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Extraction Status Banner */}
          {extracting && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span className="text-sm text-purple-700">Analyzing receipt...</span>
            </div>
          )}
          {aiResult && aiResult.confidence > 0 && !extracting && aiFilledFields.size > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
              <Sparkles className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">
                Receipt analyzed — {aiFilledFields.size} field{aiFilledFields.size !== 1 ? 's' : ''} auto-filled
              </span>
            </div>
          )}
          {aiResult && aiResult.confidence === 0 && aiResult.rawText && !extracting && (
            <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700">Could not read receipt clearly. Please fill in details manually.</p>
            </div>
          )}

          {/* PDF preview button */}
          {documents.length > 0 && (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={handlePreviewPdf}
                disabled={previewingPdf}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-700 font-medium rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors min-h-[48px] disabled:opacity-50"
              >
                {previewingPdf ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating PDF preview...
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    Preview Scanned PDF
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                <FileText className="w-3 h-3" />
                Auto border detection &amp; contrast enhancement applied
              </p>
            </div>
          )}
        </section>

        {/* 2. Transaction Details */}
        <section className="py-4 border-b border-gray-100 space-y-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Transaction Details
          </h2>

          {/* Date */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              Date
              {aiFilledFields.has('date') && (
                <AiFieldIndicator confidence={aiResult?.confidence} onDismiss={() => dismissAiField('date')} />
              )}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); dismissAiField('date'); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base min-h-[48px]"
            />
          </div>

          {/* Vendor Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              Vendor Name
              {aiFilledFields.has('vendorName') && (
                <AiFieldIndicator confidence={aiResult?.confidence} onDismiss={() => dismissAiField('vendorName')} />
              )}
            </label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => { setVendorName(e.target.value); dismissAiField('vendorName'); }}
              placeholder="e.g., Crane Hardware Entebbe"
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base min-h-[48px]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              Description
              {aiFilledFields.has('description') && (
                <AiFieldIndicator confidence={aiResult?.confidence} onDismiss={() => dismissAiField('description')} />
              )}
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); dismissAiField('description'); }}
              placeholder="What was purchased?"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base resize-none"
            />
          </div>

          {/* Amount with currency toggle */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              Amount
              {aiFilledFields.has('amount') && (
                <AiFieldIndicator confidence={aiResult?.confidence} onDismiss={() => dismissAiField('amount')} />
              )}
            </label>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrency('UGX')}
                  className={`px-3 py-3 text-sm font-medium min-h-[48px] transition-colors ${
                    currency === 'UGX'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  UGX
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-3 text-sm font-medium min-h-[48px] transition-colors ${
                    currency === 'USD'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  USD
                </button>
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); dismissAiField('amount'); }}
                placeholder={currency === 'UGX' ? '1,800,000' : '500.00'}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base text-right font-semibold min-h-[48px]"
              />
            </div>
            {parsedAmount > 0 && (
              <p className="text-sm text-gray-500 mt-1 text-right">
                {formatBudgetAmount(parsedAmount, currency)}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              Payment Method
              {aiFilledFields.has('paymentMethod') && (
                <AiFieldIndicator confidence={aiResult?.confidence} onDismiss={() => dismissAiField('paymentMethod')} />
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => { setPaymentMethod(method); dismissAiField('paymentMethod'); }}
                  className={`px-3 py-2 rounded-full text-sm font-medium min-h-[40px] transition-colors ${
                    paymentMethod === method
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Reference (conditional) */}
          {paymentMethod !== 'Cash' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Reference
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={
                  paymentMethod === 'MobileMoney'
                    ? 'e.g., MM-12345678'
                    : paymentMethod === 'BankTransfer'
                    ? 'e.g., TRF-2026-001'
                    : 'e.g., CHQ-0001'
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base min-h-[48px]"
              />
            </div>
          )}
        </section>

        {/* 3. Project Attribution */}
        <section className="py-4 border-b border-gray-100 space-y-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Project Attribution
          </h2>

          {/* Single / Split toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setSplitMode('single')}
              className={`flex-1 px-3 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
                splitMode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Single Project
            </button>
            <button
              type="button"
              onClick={() => { setSplitMode('matrix'); populateMatrixFromOCR(); }}
              disabled={parsedAmount <= 0}
              className={`flex-1 px-3 py-2.5 text-sm font-medium min-h-[44px] transition-colors disabled:opacity-40 ${
                splitMode === 'matrix'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Split Across Projects
            </button>
          </div>

          {splitMode === 'single' ? (
            <>
              {/* Project Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <ProjectPicker
                  value={projectId || null}
                  selectedName={projectName}
                  onChange={handleProjectSelect}
                  projects={activeProjects}
                  loading={projectsLoading}
                  error={projectsError}
                />
              </div>

              {/* Budget Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Line</label>
                <select
                  value={budgetCategory}
                  onChange={(e) => setBudgetCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base min-h-[48px] bg-white"
                >
                  {BUDGET_CATEGORIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <MatrixSplitter
              currency={currency}
              lineItems={matrix.lineItems}
              onAddLineItem={matrix.addLineItem}
              onRemoveLineItem={matrix.removeLineItem}
              selectedProjects={matrix.selectedProjects}
              onAddProject={matrix.addProject}
              onRemoveProject={matrix.removeProject}
              cells={matrix.cells}
              onUpdateCell={matrix.updateCell}
              activeProjects={activeProjects}
              projectsLoading={projectsLoading}
              projectsError={projectsError}
              validation={matrix.validation}
              projectTotals={matrix.projectTotals}
              rationale={matrix.rationale}
              onRationaleChange={matrix.setRationale}
            />
          )}
        </section>

        {/* 4. Requisition Link (optional) */}
        <section className="py-4 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setShowRequisitionLink(!showRequisitionLink)}
            className="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-700 min-h-[48px]"
          >
            <span>Link to Requisition</span>
            {showRequisitionLink ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showRequisitionLink && (
            <div className="mt-2 space-y-2">
              {loadingReqs ? (
                <div className="flex items-center justify-center py-4 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Finding matching requisitions...</span>
                </div>
              ) : matchingReqs.length === 0 ? (
                <p className="text-sm text-gray-500 py-3 text-center">
                  {projectId && parsedAmount > 0
                    ? 'No matching requisitions found.'
                    : 'Select a project and enter an amount to see suggestions.'}
                </p>
              ) : (
                matchingReqs.map((req) => {
                  const remaining =
                    req.childRequisitionsSummary?.remainingFundsBalance ??
                    req.unaccountedAmount ??
                    req.grossAmount;
                  const isSelected = requisitionId === req.id;

                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => setRequisitionId(isSelected ? null : req.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors min-h-[48px] ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm text-gray-900">
                            {req.requisitionNumber}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{req.purpose}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatBudgetAmount(remaining, currency)}
                          </p>
                          <p className="text-xs text-gray-400">remaining</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}

              {requisitionId && (
                <button
                  type="button"
                  onClick={() => setRequisitionId(null)}
                  className="w-full text-sm text-gray-500 py-2 hover:text-gray-700 min-h-[48px]"
                >
                  Skip — I'll link later
                </button>
              )}
            </div>
          )}
        </section>

        {/* Notes */}
        <section className="py-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional context..."
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base resize-none"
          />
        </section>
      </div>

      {/* Submit Error Banner */}
      {submitError && (
        <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5 cursor-pointer" onClick={() => setSubmitError(null)} />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 space-y-2 z-20">
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={submitting || !vendorName.trim() || !description.trim() || parsedAmount <= 0 || (splitMode === 'matrix' ? !matrix.validation.isComplete : !projectId)}
          className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors min-h-[48px] flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving & generating PDF...
            </>
          ) : (
            'Submit'
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={submitting}
          className="w-full py-3 text-gray-600 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors min-h-[48px]"
        >
          Save Draft
        </button>
      </div>

      {/* Receipt Scanner Overlay */}
      {showScanner && (
        <ReceiptScanner
          onCapture={handleScannerCapture}
          onCancel={() => setShowScanner(false)}
          fullScreen
        />
      )}

      {/* OCR Result Review Modal */}
      {showOCRReview && aiResult && ocrReviewImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <OCRResultReview
              imageUrl={ocrReviewImageUrl}
              extractionResult={aiResult}
              onConfirm={handleOCRReviewConfirm}
              onRescan={() => {
                setShowOCRReview(false);
                setShowScanner(true);
              }}
              onCancel={() => setShowOCRReview(false)}
            />
          </div>
        </div>
      )}

      {/* Google Drive File Picker */}
      {showDrivePicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Google Drive Scans</h3>
              <button
                onClick={() => setShowDrivePicker(false)}
                className="p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {driveListLoading && (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Searching Drive...
                </div>
              )}

              {driveError && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                  <p className="text-sm text-red-600">{driveError.message}</p>
                  {driveError.name === 'DriveTokenExpiredError' ? (
                    <button
                      onClick={async () => {
                        try {
                          await refreshGoogleAccessToken();
                          await listDriveFiles();
                        } catch {
                          // Error state handled by hook
                        }
                      }}
                      className="mt-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 min-h-[44px] flex items-center gap-2"
                    >
                      <FolderDown className="w-4 h-4" />
                      Reconnect Google Drive
                    </button>
                  ) : (
                    <button
                      onClick={() => listDriveFiles()}
                      className="mt-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 min-h-[44px]"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {!driveListLoading && !driveError && driveFiles.length === 0 && (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <FolderDown className="w-10 h-10 mb-2" />
                  <p className="text-sm font-medium text-gray-600">No scanned files found</p>
                  <p className="text-xs mt-1">Scan a receipt with Google Drive and it will appear here.</p>
                </div>
              )}

              {!driveListLoading && driveFiles.length > 0 && (
                <div className="space-y-2">
                  {driveFiles.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => handleDriveFileSelect(file)}
                      disabled={driveImporting || !projectId}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed min-h-[60px]"
                    >
                      {file.thumbnailLink ? (
                        <img
                          src={file.thumbnailLink}
                          alt=""
                          className="w-12 h-12 object-cover rounded-md flex-shrink-0 bg-gray-100"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(file.modifiedTime).toLocaleDateString('en-UG', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {file.size && ` · ${(parseInt(file.size) / 1024).toFixed(0)} KB`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {driveImporting && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                  <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                  <span className="text-sm text-green-700">Importing & renaming per policy...</span>
                </div>
              )}

              {!projectId && !driveListLoading && (
                <div className="mt-3 px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-700">Select a project first to enable file naming.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
