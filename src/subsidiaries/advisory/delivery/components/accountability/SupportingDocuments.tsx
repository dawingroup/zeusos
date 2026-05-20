/**
 * SupportingDocuments - Display and manage supporting documents for expenses
 *
 * Shows documents in the recommended finance transaction order:
 * 1. Purchase Order / Contract
 * 2. Quotation
 * 3. Invoice
 * 4. Delivery Note
 * 5. Waybill
 * 6. Payment Receipt
 * 7. Activity Report
 * 8. Other
 */

import { useState } from 'react';
import {
  FileText,
  Download,
  Eye,
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  File,
  Image,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Plus,
} from 'lucide-react';
import {
  SupportingDocument,
  SupportingDocumentType,
  DOCUMENT_TYPE_CONFIG,
} from '../../types/accountability';

interface SupportingDocumentsProps {
  documents: SupportingDocument[];
  expenseId: string;
  onUpload?: (expenseId: string, file: File, type: SupportingDocumentType) => Promise<void>;
  onRemove?: (expenseId: string, documentId: string) => Promise<void>;
  readOnly?: boolean;
  compact?: boolean;
}

function formatDate(date: Date | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  return FileText;
}

// Sort documents by the recommended finance order
function sortDocumentsByOrder(documents: SupportingDocument[]): SupportingDocument[] {
  return [...documents].sort((a, b) => {
    const orderA = DOCUMENT_TYPE_CONFIG[a.type]?.order || 99;
    const orderB = DOCUMENT_TYPE_CONFIG[b.type]?.order || 99;
    return orderA - orderB;
  });
}

interface DocumentCardProps {
  document: SupportingDocument;
  onRemove?: () => void;
  readOnly?: boolean;
}

function DocumentCard({ document, onRemove, readOnly }: DocumentCardProps) {
  const config = DOCUMENT_TYPE_CONFIG[document.type];
  const FileIcon = getFileIcon(document.mimeType);

  return (
    <div className="flex items-start gap-3 p-3 bg-white border rounded-lg hover:bg-gray-50 group">
      <div className="p-2 bg-gray-100 rounded-lg">
        <FileIcon className="w-5 h-5 text-gray-600" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
            {config?.label || document.type}
          </span>
          {document.documentNumber && (
            <span className="text-xs text-gray-500">#{document.documentNumber}</span>
          )}
        </div>

        <div className="text-sm font-medium text-gray-900 truncate mt-1">
          {document.fileName}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
          {document.documentDate && <span>{formatDate(document.documentDate)}</span>}
          {document.fileSize && <span>{formatFileSize(document.fileSize)}</span>}
        </div>

        {document.notes && (
          <p className="text-xs text-gray-600 mt-1 italic line-clamp-1">{document.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={document.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
          title="View"
        >
          <Eye className="w-4 h-4" />
        </a>
        <a
          href={document.fileUrl}
          download={document.fileName}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </a>
        {!readOnly && onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function SupportingDocuments({
  documents,
  expenseId,
  onUpload,
  onRemove,
  readOnly = false,
  compact = false,
}: SupportingDocumentsProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [uploading, setUploading] = useState(false);

  const sortedDocuments = sortDocumentsByOrder(documents);

  // Check which required documents are missing
  const missingRequired = Object.entries(DOCUMENT_TYPE_CONFIG)
    .filter(([_, config]) => config.required)
    .filter(([type]) => !documents.some(d => d.type === type))
    .map(([type]) => type as SupportingDocumentType);

  const handleFileSelect = async (type: SupportingDocumentType, file: File) => {
    if (!onUpload) return;
    setUploading(true);
    try {
      await onUpload(expenseId, file, type);
    } finally {
      setUploading(false);
    }
  };

  if (compact && documents.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic">No documents attached</div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">Supporting Documents</span>
          <span className="text-sm text-gray-500">({documents.length})</span>
        </div>

        {missingRequired.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="w-3 h-3" />
            {missingRequired.length} required missing
          </span>
        )}
        {missingRequired.length === 0 && documents.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" />
            Complete
          </span>
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {sortedDocuments.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">No documents attached</p>
              {!readOnly && (
                <p className="text-xs text-gray-400 mt-1">
                  Upload invoice, receipt, and other supporting documents
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedDocuments.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onRemove={onRemove ? () => onRemove(expenseId, doc.id) : undefined}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}

          {/* Upload buttons */}
          {!readOnly && onUpload && (
            <div className="pt-3 border-t">
              <div className="text-xs text-gray-500 mb-2">Add document:</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(DOCUMENT_TYPE_CONFIG)
                  .sort((a, b) => a[1].order - b[1].order)
                  .map(([type, config]) => {
                    const hasDoc = documents.some(d => d.type === type);
                    return (
                      <label
                        key={type}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-lg cursor-pointer transition-colors ${
                          hasDoc
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : config.required
                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {hasDoc ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        {config.label}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileSelect(type as SupportingDocumentType, file);
                              e.target.value = '';
                            }
                          }}
                          disabled={uploading}
                        />
                      </label>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline document list for table views
 */
interface DocumentListInlineProps {
  documents: SupportingDocument[];
}

export function DocumentListInline({ documents }: DocumentListInlineProps) {
  if (documents.length === 0) {
    return <span className="text-gray-400 text-xs">-</span>;
  }

  const sortedDocs = sortDocumentsByOrder(documents);

  return (
    <div className="flex flex-wrap gap-1">
      {sortedDocs.map(doc => {
        const config = DOCUMENT_TYPE_CONFIG[doc.type];
        return (
          <a
            key={doc.id}
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-blue-100 hover:text-blue-700"
            title={`${config?.label}: ${doc.fileName}`}
          >
            <FileText className="w-3 h-3" />
            {config?.label?.substring(0, 3) || doc.type.substring(0, 3)}
          </a>
        );
      })}
    </div>
  );
}

/**
 * Continuous document viewer for finance review
 */
interface DocumentViewerContinuousProps {
  documents: SupportingDocument[];
  expenseDescription: string;
}

export function DocumentViewerContinuous({
  documents,
  expenseDescription,
}: DocumentViewerContinuousProps) {
  const sortedDocuments = sortDocumentsByOrder(documents);

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No supporting documents</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700 mb-2">
        Documents for: {expenseDescription}
      </div>

      {sortedDocuments.map((doc, index) => {
        const config = DOCUMENT_TYPE_CONFIG[doc.type];
        const isImage = doc.mimeType?.startsWith('image/');
        const isPdf = doc.mimeType === 'application/pdf';

        return (
          <div key={doc.id} className="border rounded-lg overflow-hidden">
            {/* Document header */}
            <div className="px-4 py-2 bg-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">
                  {index + 1}.
                </span>
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                  {config?.label || doc.type}
                </span>
                {doc.documentNumber && (
                  <span className="text-sm text-gray-600">#{doc.documentNumber}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {doc.documentDate && (
                  <span className="text-xs text-gray-500">{formatDate(doc.documentDate)}</span>
                )}
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-gray-500 hover:text-blue-600 rounded"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Document preview */}
            <div className="bg-white">
              {isImage ? (
                <img
                  src={doc.fileUrl}
                  alt={doc.fileName}
                  className="max-w-full h-auto mx-auto"
                  style={{ maxHeight: '600px' }}
                />
              ) : isPdf ? (
                <iframe
                  src={`${doc.fileUrl}#view=FitH`}
                  title={doc.fileName}
                  className="w-full border-0"
                  style={{ height: '600px' }}
                />
              ) : (
                <div className="p-8 text-center">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">{doc.fileName}</p>
                  <p className="text-sm text-gray-500 mb-4">{formatFileSize(doc.fileSize)}</p>
                  <a
                    href={doc.fileUrl}
                    download={doc.fileName}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              )}
            </div>

            {/* Document footer with notes */}
            {doc.notes && (
              <div className="px-4 py-2 bg-gray-50 border-t">
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Note:</span> {doc.notes}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
