/**
 * ProjectPDFPreview — In-app PDF preview using @react-pdf/renderer's PDFViewer
 *
 * Renders the project PDF before download for verification.
 */
import { useState, useEffect } from 'react';
import type { ProjectPDFRequest } from '../../types/projectPdf.types';
import { previewProjectPDF } from '../../services/projectPdf.service';

interface ProjectPDFPreviewProps {
  sceneId: string;
  request: ProjectPDFRequest;
  onClose: () => void;
}

export function ProjectPDFPreview({ sceneId, request, onClose }: ProjectPDFPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const blob = await previewProjectPDF(sceneId, request);
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [sceneId, request]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">PDF Preview</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Generating preview...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-red-600">Preview failed: {error.message}</p>
            </div>
          )}
          {blobUrl && !isLoading && (
            <iframe src={blobUrl} className="w-full h-full border-0" title="PDF Preview" />
          )}
        </div>
      </div>
    </div>
  );
}
