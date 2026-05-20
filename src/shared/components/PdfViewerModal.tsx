/**
 * PDF Viewer Modal Component
 *
 * A modal component that uses Adobe PDF Embed API to display PDFs inline
 * without requiring downloads. Supports both PDF URLs and other document types.
 *
 * @example
 * ```tsx
 * <PdfViewerModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   url={documentUrl}
 *   fileName="document.pdf"
 * />
 * ```
 */

import { useState, useEffect, useRef } from 'react';
import { X, Download, ExternalLink, Loader2, AlertCircle, FileText } from 'lucide-react';

// Adobe DC View SDK type declaration
declare global {
  interface Window {
    AdobeDC?: {
      View: new (config: { clientId: string; divId: string }) => {
        previewFile: (
          content: { content: { location: { url: string } }; metaData: { fileName: string } },
          config: Record<string, unknown>
        ) => Promise<void>;
      };
    };
  }
}

export interface PdfViewerModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** URL of the document to display */
  url: string;
  /** Display name for the document */
  fileName?: string;
  /** MIME type of the document (for non-PDF fallback) */
  mimeType?: string;
}

export function PdfViewerModal({
  isOpen,
  onClose,
  url,
  fileName = 'document.pdf',
  mimeType,
}: PdfViewerModalProps) {
  const [viewerState, setViewerState] = useState<'loading' | 'ready' | 'error' | 'fallback'>('loading');
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerId = useRef(`pdf-viewer-${Math.random().toString(36).substr(2, 9)}`);

  const clientId = import.meta.env.VITE_ADOBE_CLIENT_ID;

  // Determine if this is a PDF or needs fallback
  const isPdf = mimeType?.includes('pdf') ||
                fileName?.toLowerCase().endsWith('.pdf') ||
                url?.toLowerCase().includes('.pdf');

  // Cleanup viewer on close
  useEffect(() => {
    if (!isOpen) {
      setViewerState('loading');
      setError(null);
      // Clean up Adobe viewer content
      const viewerDiv = document.getElementById(viewerId.current);
      if (viewerDiv) {
        while (viewerDiv.firstChild) {
          viewerDiv.removeChild(viewerDiv.firstChild);
        }
      }
    }
  }, [isOpen]);

  // Initialize viewer when modal opens
  useEffect(() => {
    if (!isOpen || !url) return;

    // If not a PDF or no client ID, use fallback
    if (!isPdf || !clientId) {
      setViewerState('fallback');
      return;
    }

    const initializeViewer = async () => {
      setViewerState('loading');
      setError(null);

      try {
        // Load Adobe DC View SDK if not already loaded
        if (!window.AdobeDC) {
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.querySelector('script[src*="acrobatservices.adobe.com/view-sdk"]');
            if (existingScript) {
              const checkReady = () => {
                if (window.AdobeDC) resolve();
                else setTimeout(checkReady, 100);
              };
              checkReady();
              return;
            }

            const script = document.createElement('script');
            script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
            script.async = true;
            script.onload = () => {
              const checkReady = () => {
                if (window.AdobeDC) resolve();
                else setTimeout(checkReady, 100);
              };
              checkReady();
            };
            script.onerror = () => reject(new Error('Failed to load Adobe PDF Embed SDK'));
            document.head.appendChild(script);
          });
        }

        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Ensure the viewer div exists
        if (!document.getElementById(viewerId.current)) {
          throw new Error('Viewer container not found');
        }

        const adobeDCView = new window.AdobeDC!.View({
          clientId: clientId,
          divId: viewerId.current,
        });

        await adobeDCView.previewFile(
          {
            content: { location: { url } },
            metaData: { fileName: fileName || 'document.pdf' },
          },
          {
            embedMode: 'SIZED_CONTAINER',
            defaultViewMode: 'FIT_WIDTH',
            showDownloadPDF: true,
            showPrintPDF: true,
            showFullScreen: true,
            showAnnotationTools: false,
            showLeftHandPanel: false,
            showPageControls: true,
          }
        );

        setViewerState('ready');
      } catch (err) {
        console.error('PDF viewer error:', err);
        // Fall back to iframe/external link on error
        setViewerState('fallback');
        setError(err instanceof Error ? err.message : 'Failed to load PDF viewer');
      }
    };

    initializeViewer();
  }, [isOpen, url, clientId, isPdf, fileName]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-red-100 rounded-lg">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {fileName || 'Document'}
                </h3>
                <p className="text-sm text-gray-500">
                  {isPdf ? 'PDF Document' : mimeType || 'Document'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Download button */}
              <a
                href={url}
                download={fileName}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-4 h-4" />
                Download
              </a>

              {/* Open in new tab */}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </a>

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="relative" style={{ height: '70vh' }}>
            {/* Loading state */}
            {viewerState === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <p className="text-gray-600">Loading document...</p>
              </div>
            )}

            {/* Adobe PDF Viewer container */}
            {isPdf && clientId && viewerState !== 'fallback' && (
              <div
                id={viewerId.current}
                ref={viewerRef}
                className="w-full h-full"
                style={{ display: viewerState === 'ready' ? 'block' : 'none' }}
              />
            )}

            {/* Fallback: iframe for PDFs, or message for other types */}
            {viewerState === 'fallback' && (
              <div className="w-full h-full">
                {isPdf ? (
                  // Fallback iframe for PDFs
                  <iframe
                    src={`${url}#toolbar=1&navpanes=0`}
                    className="w-full h-full border-0"
                    title={fileName}
                  />
                ) : (
                  // Non-PDF document message
                  <div className="flex flex-col items-center justify-center h-full bg-gray-50">
                    <div className="p-4 bg-gray-100 rounded-full mb-4">
                      <FileText className="w-12 h-12 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Preview not available
                    </h4>
                    <p className="text-gray-500 mb-6 text-center max-w-md">
                      This document type cannot be previewed in the browser.
                      Please download or open it in a new tab.
                    </p>
                    <div className="flex gap-3">
                      <a
                        href={url}
                        download={fileName}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open in New Tab
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error message (shown alongside fallback) */}
            {error && viewerState === 'fallback' && isPdf && (
              <div className="absolute top-2 left-2 right-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Adobe viewer unavailable. Using browser's PDF viewer.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PdfViewerModal;
