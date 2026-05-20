/**
 * Project Documents Tab
 * Displays uploaded client documents with AI analysis results
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileImage,
  FileText,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  Sparkles,
  AlertCircle,
  Loader2,
  Eye,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { DocumentUploadSection } from './DocumentUploadSection';
import type { ClientDocument } from '../../types/document.types';
import {
  getCategoryDisplayName,
  formatFileSize,
  getAIStatusDisplay,
} from '../../types/document.types';
import {
  getProjectDocuments,
  deleteDocument,
  retryAIAnalysis,
  markAIAsApplied,
} from '../../services/documentUpload';

export interface ProjectDocumentsProps {
  projectId: string;
  projectCode: string;
  userId: string;
  userName: string;
  onApplyAIToProject?: (document: ClientDocument) => void;
}

export function ProjectDocuments({
  projectId,
  projectCode,
  userId,
  userName,
  onApplyAIToProject,
}: ProjectDocumentsProps) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<ClientDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<ClientDocument | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const docs = await getProjectDocuments(projectId);
      setDocuments(docs);
      // Start polling if any docs have in-progress AI
      if (docs.some((d) => d.aiAnalysisStatus === 'pending' || d.aiAnalysisStatus === 'running')) {
        setIsPolling(true);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Poll for AI analysis completion
  useEffect(() => {
    if (!isPolling) return;

    pollingRef.current = setInterval(async () => {
      try {
        const docs = await getProjectDocuments(projectId);
        setDocuments(docs);

        const stillInProgress = docs.some(
          (d) => d.aiAnalysisStatus === 'pending' || d.aiAnalysisStatus === 'running'
        );
        if (!stillInProgress) {
          setIsPolling(false);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isPolling, projectId]);

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      setDeletingId(documentId);
      await deleteDocument(projectId, documentId);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetryAI = async (documentId: string) => {
    try {
      await retryAIAnalysis(projectId, documentId);
      // Reload documents to get updated status
      await loadDocuments();
    } catch (error) {
      console.error('Failed to retry AI analysis:', error);
      alert('Failed to retry AI analysis');
    }
  };

  const handleApplyToProject = async (document: ClientDocument) => {
    if (!document.aiAnalysisResult?.extractedItems?.length) {
      alert('No design items found in AI analysis');
      return;
    }

    try {
      await markAIAsApplied(projectId, document.id);
      onApplyAIToProject?.(document);
      // Reload to update applied status
      await loadDocuments();
    } catch (error) {
      console.error('Failed to apply AI to project:', error);
      alert('Failed to apply AI suggestions');
    }
  };

  const getFileIcon = (doc: ClientDocument) => {
    if (doc.mimeType.startsWith('image/')) {
      return <FileImage className="w-6 h-6 text-blue-500" />;
    }
    return <FileText className="w-6 h-6 text-purple-500" />;
  };

  const groupedDocuments = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, ClientDocument[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <DocumentUploadSection
        projectId={projectId}
        projectCode={projectCode}
        userId={userId}
        userName={userName}
        onUploadComplete={() => {
          loadDocuments();
          setIsPolling(true);
        }}
        onUploadError={(error) => console.error('Upload error:', error)}
      />

      {/* Document Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            Project Documents
          </h3>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
            {documents.length} {documents.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
            <div className="max-w-sm mx-auto">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white shadow-md flex items-center justify-center">
                <FileText className="w-10 h-10 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h4>
              <p className="text-sm text-gray-600 mb-1">
                Upload client documents to get started
              </p>
              <p className="text-xs text-gray-500">
                Images and PDFs will be automatically analyzed by AI
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedDocuments).map(([category, docs]) => (
              <div key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <h4 className="text-base font-semibold text-gray-900">
                    {getCategoryDisplayName(category as any)}
                  </h4>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                    {docs.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {docs.map((doc) => {
                    const aiStatus = getAIStatusDisplay(doc.aiAnalysisStatus);
                    const hasAIResults = doc.aiAnalysisStatus === 'completed' && doc.aiAnalysisResult;

                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          'bg-gradient-to-br from-white to-gray-50 border-2 rounded-xl p-5 transition-all hover:shadow-lg',
                          selectedDocument?.id === doc.id
                            ? 'border-blue-500 shadow-xl ring-2 ring-blue-100'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {/* Document Header */}
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-lg bg-white shadow-sm border border-gray-200 flex items-center justify-center">
                              {getFileIcon(doc)}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h5 className="text-base font-semibold text-gray-900 truncate mb-1">
                              {doc.name}
                            </h5>
                            <p className="text-sm text-gray-600 mb-3">
                              {formatFileSize(doc.fileSize)} • Uploaded by {doc.uploadedByName || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(doc.uploadedAt as any).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>

                            {/* AI Status Badge */}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm',
                                  aiStatus.color === 'green' && 'bg-green-100 text-green-800 border border-green-200',
                                  aiStatus.color === 'yellow' && 'bg-yellow-100 text-yellow-800 border border-yellow-200',
                                  aiStatus.color === 'blue' && 'bg-blue-100 text-blue-800 border border-blue-200',
                                  aiStatus.color === 'red' && 'bg-red-100 text-red-800 border border-red-200',
                                  aiStatus.color === 'gray' && 'bg-gray-100 text-gray-700 border border-gray-200'
                                )}
                              >
                                <span>{aiStatus.icon}</span>
                                <span>{aiStatus.label}</span>
                              </span>

                              {doc.aiAnalysisResult?.appliedToProject && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-purple-100 text-purple-800 border border-purple-200 shadow-sm">
                                  <CheckCircle className="w-4 h-4" />
                                  Applied to Project
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2">
                            {hasAIResults && !selectedDocument && (
                              <button
                                onClick={() => setSelectedDocument(doc)}
                                className="p-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                                title="View AI Analysis"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            )}
                            {selectedDocument?.id === doc.id && (
                              <button
                                onClick={() => setSelectedDocument(null)}
                                className="p-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                                title="Hide AI Analysis"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            )}
                            {(doc.mimeType.startsWith('image/') || doc.mimeType === 'application/pdf') && (
                              <button
                                onClick={() => setPreviewDocument(doc)}
                                className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                                title="Preview"
                              >
                                <ZoomIn className="w-5 h-5" />
                              </button>
                            )}
                            <a
                              href={doc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                              title="Download"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                            {doc.aiAnalysisStatus === 'failed' && (
                              <button
                                onClick={() => handleRetryAI(doc.id)}
                                className="p-2.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                                title="Retry AI Analysis"
                              >
                                <RefreshCw className="w-5 h-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(doc.id)}
                              disabled={deletingId === doc.id}
                              className="p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* AI Analysis Results (Expanded) */}
                        {selectedDocument?.id === doc.id && hasAIResults && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <AIAnalysisCard
                              document={doc}
                              onApplyToProject={() => handleApplyToProject(doc)}
                              onClose={() => setSelectedDocument(null)}
                            />
                          </div>
                        )}

                        {/* Error Message */}
                        {doc.aiAnalysisStatus === 'failed' && doc.aiAnalysisError && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-red-900">AI Analysis Failed</p>
                                <p className="text-xs text-red-700 mt-1">{doc.aiAnalysisError}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AI Analysis Card Component
 * Displays detailed AI analysis results
 */
function AIAnalysisCard({
  document,
  onApplyToProject,
  onClose,
}: {
  document: ClientDocument;
  onApplyToProject: () => void;
  onClose: () => void;
}) {
  const result = document.aiAnalysisResult;
  if (!result) return null;

  const isImageAnalysis = result.styleAnalysis !== undefined;
  const isProjectScoping = result.multiplierDetected !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Analysis Results
          {result.confidence && (
            <span className="text-xs font-normal text-gray-500">
              • {Math.round(result.confidence * 100)}% confidence
            </span>
          )}
        </h4>
      </div>

      {/* Extracted Items */}
      {result.extractedItems && result.extractedItems.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-gray-700 mb-2">
            Items Identified ({result.extractedItems.length})
          </h5>
          <div className="space-y-2">
            {result.extractedItems.map((item, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-600">Category: {item.category}</p>
                    {item.dimensions && (
                      <p className="text-xs text-gray-500 mt-1">
                        {item.dimensions.width && `W: ${item.dimensions.width}mm`}
                        {item.dimensions.height && ` × H: ${item.dimensions.height}mm`}
                        {item.dimensions.depth && ` × D: ${item.dimensions.depth}mm`}
                      </p>
                    )}
                  </div>
                  {item.confidence !== undefined && (
                    <span className="text-xs text-gray-500">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Style Analysis (Image Analysis Only) */}
      {isImageAnalysis && result.styleAnalysis && (
        <div>
          <h5 className="text-xs font-medium text-gray-700 mb-2">Style Analysis</h5>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-900">
              {result.styleAnalysis.primaryStyle}
            </p>
            {result.styleAnalysis.secondaryStyles && result.styleAnalysis.secondaryStyles.length > 0 && (
              <p className="text-xs text-blue-700 mt-1">
                {result.styleAnalysis.secondaryStyles.join(', ')}
              </p>
            )}
            {result.styleAnalysis.aestheticNotes && result.styleAnalysis.aestheticNotes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.styleAnalysis.aestheticNotes.map((note, index) => (
                  <li key={index} className="text-xs text-blue-600">• {note}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Material Recommendations (Image Analysis Only) */}
      {isImageAnalysis && result.materialRecommendations && result.materialRecommendations.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-gray-700 mb-2">Material Recommendations</h5>
          <div className="space-y-2">
            {result.materialRecommendations.map((material, index) => (
              <div key={index} className="p-2 bg-green-50 rounded border border-green-200">
                <p className="text-xs font-medium text-green-900">{material.material}</p>
                <p className="text-xs text-green-700">Category: {material.category}</p>
                {material.notes && (
                  <p className="text-xs text-green-600 mt-1">{material.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manufacturing Notes (Image Analysis Only) */}
      {isImageAnalysis && result.manufacturingNotes && (
        <div>
          <h5 className="text-xs font-medium text-gray-700 mb-2">Manufacturing Notes</h5>
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-xs text-purple-900">
              <span className="font-medium">CNC Suitable:</span>{' '}
              {result.manufacturingNotes.suitableForCNC ? 'Yes' : 'No'}
            </p>
            <p className="text-xs text-purple-900 mt-1">
              <span className="font-medium">Complexity Level:</span>{' '}
              {result.manufacturingNotes.complexityLevel}/5
            </p>
            {result.manufacturingNotes.estimatedMaterialsCost && (
              <p className="text-xs text-purple-900 mt-1">
                <span className="font-medium">Est. Materials Cost:</span>{' '}
                {result.manufacturingNotes.estimatedMaterialsCost.currency}{' '}
                {result.manufacturingNotes.estimatedMaterialsCost.min}-
                {result.manufacturingNotes.estimatedMaterialsCost.max}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Project Scoping Info */}
      {isProjectScoping && (
        <div className="space-y-3">
          {result.multiplierDetected && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs font-medium text-yellow-900">
                Multiplier Detected
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                The AI detected quantity multipliers in your brief (e.g., "32 rooms, each with...")
              </p>
            </div>
          )}

          {result.deliverables && result.deliverables.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-700 mb-2">
                Deliverables ({result.deliverables.length})
              </h5>
              <div className="space-y-1">
                {result.deliverables.map((deliverable, index) => (
                  <div key={index} className="text-xs text-gray-600">
                    • {deliverable.name} ({deliverable.quantity}x) - {deliverable.category}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.ambiguities && result.ambiguities.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-orange-700 mb-2">Ambiguities Found</h5>
              <ul className="space-y-1">
                {result.ambiguities.map((ambiguity, index) => (
                  <li key={index} className="text-xs text-orange-600">• {ambiguity}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
        <button
          onClick={onApplyToProject}
          disabled={result.appliedToProject}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            result.appliedToProject
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#0A7C8E] text-white hover:bg-[#086a7a]'
          )}
        >
          {result.appliedToProject ? 'Already Applied' : 'Apply to Project'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/**
 * Document Preview Modal
 * In-app viewer for images and PDFs
 */
function DocumentPreviewModal({
  document,
  onClose,
}: {
  document: ClientDocument;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(100);
  const isImage = document.mimeType.startsWith('image/');
  const isPDF = document.mimeType === 'application/pdf';

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl h-[85vh] mx-4 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            {isImage ? (
              <FileImage className="w-5 h-5 text-blue-500 flex-shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-purple-500 flex-shrink-0" />
            )}
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {document.name}
            </h3>
            <span className="text-xs text-gray-500 flex-shrink-0">
              {formatFileSize(document.fileSize)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isImage && (
              <>
                <button
                  onClick={() => setZoom((z) => Math.max(25, z - 25))}
                  className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-600 w-12 text-center font-medium">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(300, z + 25))}
                  className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </>
            )}
            <a
              href={document.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center">
          {isImage && (
            <img
              src={document.downloadUrl}
              alt={document.name}
              className="max-w-none transition-transform duration-200"
              style={{ width: `${zoom}%` }}
            />
          )}
          {isPDF && (
            <iframe
              src={`${document.downloadUrl}#toolbar=1`}
              className="w-full h-full border-0"
              title={document.name}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectDocuments;
