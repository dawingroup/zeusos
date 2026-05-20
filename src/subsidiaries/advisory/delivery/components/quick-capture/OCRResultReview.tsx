/**
 * OCR RESULT REVIEW COMPONENT
 *
 * Side-by-side (or stacked on mobile) view of scanned image and extracted fields.
 * Users can review, edit, and confirm each field before populating the form.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Edit2,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Smartphone,
  FileText,
  Sparkles,
} from 'lucide-react';
import type {
  ReceiptExtractionResult,
  MobileMoneyTransaction,
  EFRISReceiptData,
  OCRReviewState,
  OCRReviewField,
} from '../../types/ocr.types';
import { createReviewStateFromExtraction } from '../../types/ocr.types';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface OCRResultReviewProps {
  imageUrl: string;
  extractionResult: ReceiptExtractionResult;
  onConfirm: (reviewedData: OCRReviewState) => void;
  onRescan: () => void;
  onCancel: () => void;
  /** If true, also trigger server-side OCR */
  onRetryServer?: () => void;
}

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: { value: string; label: string }[];
}

// ─────────────────────────────────────────────────────────────────
// FIELD CONFIGURATION
// ─────────────────────────────────────────────────────────────────

const FIELD_CONFIGS: FieldConfig[] = [
  { key: 'vendorName', label: 'Vendor Name', type: 'text' },
  { key: 'totalAmount', label: 'Total Amount', type: 'number' },
  {
    key: 'currency',
    label: 'Currency',
    type: 'select',
    options: [
      { value: 'UGX', label: 'UGX' },
      { value: 'USD', label: 'USD' },
    ],
  },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'description', label: 'Description', type: 'text' },
  {
    key: 'paymentMethod',
    label: 'Payment Method',
    type: 'select',
    options: [
      { value: 'Cash', label: 'Cash' },
      { value: 'MobileMoney', label: 'Mobile Money' },
      { value: 'BankTransfer', label: 'Bank Transfer' },
      { value: 'Cheque', label: 'Cheque' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function OCRResultReview({
  imageUrl,
  extractionResult,
  onConfirm,
  onRescan,
  onCancel,
  onRetryServer,
}: OCRResultReviewProps) {
  const [reviewState, setReviewState] = useState<OCRReviewState>(() =>
    createReviewStateFromExtraction(extractionResult)
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showMobileMoney, setShowMobileMoney] = useState(
    !!extractionResult.mobileMoneyData
  );
  const [showEFRIS, setShowEFRIS] = useState(!!extractionResult.efrisData);

  // ─────────────────────────────────────────────────────────────
  // FIELD HANDLERS
  // ─────────────────────────────────────────────────────────────

  const updateField = useCallback(
    (key: string, value: string) => {
      setReviewState((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          [key]: {
            ...prev.fields[key],
            value,
          },
        },
      }));
    },
    []
  );

  const confirmField = useCallback((key: string) => {
    setReviewState((prev) => {
      const updated = {
        ...prev,
        fields: {
          ...prev.fields,
          [key]: {
            ...prev.fields[key],
            confirmed: true,
          },
        },
      };
      updated.allConfirmed = Object.values(updated.fields).every(
        (f) => f.confirmed
      );
      return updated;
    });
    setEditingField(null);
  }, []);

  const rejectField = useCallback((key: string) => {
    setReviewState((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [key]: {
          ...prev.fields[key],
          value: '',
          confirmed: false,
        },
      },
      allConfirmed: false,
    }));
    setEditingField(key);
  }, []);

  const confirmAll = useCallback(() => {
    setReviewState((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(updated.fields)) {
        updated.fields[key] = { ...updated.fields[key], confirmed: true };
      }
      updated.allConfirmed = true;
      updated.reviewedAt = new Date();
      return updated;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const finalState: OCRReviewState = {
      ...reviewState,
      reviewedAt: new Date(),
    };
    onConfirm(finalState);
  }, [reviewState, onConfirm]);

  // ─────────────────────────────────────────────────────────────
  // CONFIDENCE HELPERS
  // ─────────────────────────────────────────────────────────────

  const overallConfidence = extractionResult.confidence;

  const confidenceColor = useMemo(() => {
    if (overallConfidence >= 0.8) return 'text-green-600 bg-green-100';
    if (overallConfidence >= 0.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  }, [overallConfidence]);

  const confirmedCount = useMemo(() => {
    return Object.values(reviewState.fields).filter((f) => f.confirmed).length;
  }, [reviewState]);

  const totalFields = Object.keys(reviewState.fields).length;

  // ─────────────────────────────────────────────────────────────
  // RENDER FIELD
  // ─────────────────────────────────────────────────────────────

  const renderField = (config: FieldConfig) => {
    const field: OCRReviewField | undefined = reviewState.fields[config.key];
    if (!field) return null;

    const isEditing = editingField === config.key;
    const hasValue = field.value !== '' && field.value !== 'null';

    return (
      <div
        key={config.key}
        className={`p-3 rounded-lg border transition-colors ${
          field.confirmed
            ? 'border-green-200 bg-green-50'
            : hasValue
            ? 'border-gray-200 bg-white'
            : 'border-yellow-200 bg-yellow-50'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {config.label}
          </label>
          <div className="flex items-center gap-1">
            {field.aiSuggested && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-0.5">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
            {field.confirmed && (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            {config.type === 'select' ? (
              <select
                value={field.value}
                onChange={(e) => updateField(config.key, e.target.value)}
                className="flex-1 px-2 py-1.5 border rounded text-sm"
              >
                <option value="">Select...</option>
                {config.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={config.type === 'number' ? 'number' : 'text'}
                value={field.value}
                onChange={(e) => updateField(config.key, e.target.value)}
                className="flex-1 px-2 py-1.5 border rounded text-sm"
                autoFocus
              />
            )}
            <button
              onClick={() => confirmField(config.key)}
              className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span
              className={`text-sm ${
                hasValue ? 'text-gray-900 font-medium' : 'text-gray-400 italic'
              }`}
            >
              {hasValue
                ? config.key === 'totalAmount'
                  ? Number(field.value).toLocaleString()
                  : field.value
                : 'Not detected'}
            </span>
            <div className="flex items-center gap-1">
              {!field.confirmed && hasValue && (
                <>
                  <button
                    onClick={() => confirmField(config.key)}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="Confirm"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => rejectField(config.key)}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                    title="Edit"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => setEditingField(config.key)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER MOBILE MONEY SECTION
  // ─────────────────────────────────────────────────────────────

  const renderMobileMoneySection = (data: MobileMoneyTransaction) => (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setShowMobileMoney(!showMobileMoney)}
        className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100"
      >
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-900">
            Mobile Money ({data.provider})
          </span>
        </div>
        {showMobileMoney ? (
          <ChevronDown className="w-4 h-4 text-purple-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-purple-600" />
        )}
      </button>
      {showMobileMoney && (
        <div className="p-3 space-y-2 text-sm">
          {data.transactionId && (
            <div className="flex justify-between">
              <span className="text-gray-500">Transaction ID</span>
              <span className="font-mono font-medium">{data.transactionId}</span>
            </div>
          )}
          {data.senderName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Sender</span>
              <span>{data.senderName} {data.senderPhone && `(${data.senderPhone})`}</span>
            </div>
          )}
          {data.receiverName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Receiver</span>
              <span>{data.receiverName} {data.receiverPhone && `(${data.receiverPhone})`}</span>
            </div>
          )}
          {data.amount != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-medium">
                {data.currency} {data.amount.toLocaleString()}
              </span>
            </div>
          )}
          {data.fee != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">Fee</span>
              <span>{data.currency} {data.fee.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                data.status === 'Successful'
                  ? 'bg-green-100 text-green-700'
                  : data.status === 'Failed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {data.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER EFRIS SECTION
  // ─────────────────────────────────────────────────────────────

  const renderEFRISSection = (data: EFRISReceiptData) => (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setShowEFRIS(!showEFRIS)}
        className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            EFRIS Tax Data
          </span>
          {data.isValid && (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          )}
        </div>
        {showEFRIS ? (
          <ChevronDown className="w-4 h-4 text-blue-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-blue-600" />
        )}
      </button>
      {showEFRIS && (
        <div className="p-3 space-y-2 text-sm">
          {data.fdn && (
            <div className="flex justify-between">
              <span className="text-gray-500">FDN</span>
              <span className="font-mono font-medium">{data.fdn}</span>
            </div>
          )}
          {data.sellerTIN && (
            <div className="flex justify-between">
              <span className="text-gray-500">Seller TIN</span>
              <span className="font-mono">{data.sellerTIN}</span>
            </div>
          )}
          {data.sellerName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Seller</span>
              <span>{data.sellerName}</span>
            </div>
          )}
          {data.vatAmount != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">VAT Amount</span>
              <span className="font-medium">
                {data.currency} {data.vatAmount.toLocaleString()}
              </span>
            </div>
          )}
          {data.totalExclVAT != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">Total (excl. VAT)</span>
              <span>{data.currency} {data.totalExclVAT.toLocaleString()}</span>
            </div>
          )}
          {data.totalInclVAT != null && (
            <div className="flex justify-between font-medium">
              <span className="text-gray-500">Total (incl. VAT)</span>
              <span>{data.currency} {data.totalInclVAT.toLocaleString()}</span>
            </div>
          )}
          {data.items.length > 0 && (
            <div className="mt-2 pt-2 border-t">
              <h5 className="text-xs font-medium text-gray-500 mb-1">
                Line Items ({data.items.length})
              </h5>
              {data.items.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs py-0.5">
                  <span className="truncate flex-1">{item.description}</span>
                  <span className="ml-2 text-gray-600">
                    {item.totalPrice?.toLocaleString() ?? '—'}
                  </span>
                </div>
              ))}
              {data.items.length > 5 && (
                <p className="text-xs text-gray-400 mt-1">
                  +{data.items.length - 5} more items
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Review Extracted Data
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${confidenceColor}`}>
              {Math.round(overallConfidence * 100)}% confidence
            </span>
            <span className="text-xs text-gray-500">
              {confirmedCount}/{totalFields} fields confirmed
            </span>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Content — side by side on desktop, stacked on mobile */}
      <div className="md:flex">
        {/* Image panel */}
        <div className="md:w-1/2 border-b md:border-b-0 md:border-r bg-gray-100">
          <div className="p-2 max-h-[50vh] md:max-h-[60vh] overflow-auto">
            <img
              src={imageUrl}
              alt="Receipt"
              className="w-full h-auto rounded"
            />
          </div>
        </div>

        {/* Fields panel */}
        <div className="md:w-1/2 p-4 space-y-3 max-h-[50vh] md:max-h-[60vh] overflow-y-auto">
          {/* Standard fields */}
          {FIELD_CONFIGS.map(renderField)}

          {/* Mobile Money section */}
          {extractionResult.mobileMoneyData &&
            renderMobileMoneySection(extractionResult.mobileMoneyData)}

          {/* EFRIS section */}
          {extractionResult.efrisData &&
            renderEFRISSection(extractionResult.efrisData)}

          {/* Raw text fallback */}
          {extractionResult.rawText && overallConfidence === 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="text-xs font-medium text-gray-500 mb-1">
                Raw Extracted Text
              </h4>
              <p className="text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {extractionResult.rawText}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={onRescan}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            <RotateCcw className="w-4 h-4" />
            Re-scan
          </button>
          {onRetryServer && overallConfidence < 0.3 && (
            <button
              onClick={onRetryServer}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-lg"
            >
              <RotateCcw className="w-4 h-4" />
              Retry on Server
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={confirmAll}
            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Accept All
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
          >
            <Check className="w-4 h-4" />
            Confirm & Fill Form
          </button>
        </div>
      </div>
    </div>
  );
}

export default OCRResultReview;
