/**
 * React hook for Adobe PDF Embed API
 *
 * Provides easy integration of the Adobe PDF Embed viewer in React components.
 *
 * @example
 * ```tsx
 * function PDFViewer({ url }) {
 *   const { containerRef, isLoading, error, viewerAPIs } = useAdobePdfEmbed({
 *     url,
 *     fileName: 'document.pdf',
 *   });
 *
 *   return (
 *     <div>
 *       {isLoading && <p>Loading PDF...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *       <div ref={containerRef} style={{ height: '600px' }} />
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdobePdfEmbedClient,
  getAdobePdfEmbedClient,
  type PDFEmbedOptions,
} from '../embed/pdf-embed-client';

interface PDFViewerAPIs {
  getCurrentPage(): Promise<number>;
  getPageZoom(): Promise<number>;
  gotoLocation(pageNumber: number, x?: number, y?: number): Promise<void>;
  print(): Promise<void>;
  download(): Promise<void>;
  search(query: string): Promise<unknown[]>;
}

export interface UseAdobePdfEmbedProps {
  /** URL of the PDF to display */
  url?: string;
  /** ArrayBuffer containing PDF data */
  buffer?: ArrayBuffer;
  /** Blob containing PDF data */
  blob?: Blob;
  /** File object containing PDF data */
  file?: File;
  /** Display name for the PDF */
  fileName?: string;
  /** Embed options */
  options?: PDFEmbedOptions;
  /** Locale for the viewer (default: 'en-US') */
  locale?: string;
  /** Whether to auto-load on mount (default: true) */
  autoLoad?: boolean;
  /** Callback when PDF is loaded */
  onLoad?: (apis: PDFViewerAPIs) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseAdobePdfEmbedResult {
  /** Ref to attach to the container div */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Whether the PDF is loading */
  isLoading: boolean;
  /** Error if loading failed */
  error: Error | null;
  /** Viewer APIs once loaded */
  viewerAPIs: PDFViewerAPIs | null;
  /** Manually trigger PDF load */
  load: () => Promise<void>;
  /** Go to a specific page */
  goToPage: (pageNumber: number) => Promise<void>;
  /** Print the PDF */
  print: () => Promise<void>;
  /** Download the PDF */
  download: () => Promise<void>;
  /** Search within the PDF */
  search: (query: string) => Promise<unknown[]>;
}

export function useAdobePdfEmbed(
  props: UseAdobePdfEmbedProps = {}
): UseAdobePdfEmbedResult {
  const {
    url,
    buffer,
    blob,
    file,
    fileName = 'document.pdf',
    options = {},
    locale = 'en-US',
    autoLoad = true,
    onLoad,
    onError,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<AdobePdfEmbedClient | null>(null);
  const divIdRef = useRef<string>(`pdf-embed-${Math.random().toString(36).substr(2, 9)}`);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [viewerAPIs, setViewerAPIs] = useState<PDFViewerAPIs | null>(null);

  const load = useCallback(async () => {
    if (!containerRef.current) {
      const err = new Error('Container element not found');
      setError(err);
      onError?.(err);
      return;
    }

    // Need at least one source
    if (!url && !buffer && !blob && !file) {
      const err = new Error('No PDF source provided. Pass url, buffer, blob, or file.');
      setError(err);
      onError?.(err);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Set the div ID on the container
      containerRef.current.id = divIdRef.current;

      // Get or create client
      if (!clientRef.current) {
        clientRef.current = getAdobePdfEmbedClient();
      }

      // Initialize the viewer
      await clientRef.current.initialize(divIdRef.current, locale);

      // Preview based on source type
      let apis: PDFViewerAPIs;

      if (url) {
        apis = await clientRef.current.previewUrl(url, fileName, options);
      } else if (buffer) {
        apis = await clientRef.current.previewBuffer(buffer, fileName, options);
      } else if (blob) {
        apis = await clientRef.current.previewBlob(blob, fileName, options);
      } else if (file) {
        apis = await clientRef.current.previewFile(file, options);
      } else {
        throw new Error('No PDF source provided');
      }

      setViewerAPIs(apis);
      onLoad?.(apis);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [url, buffer, blob, file, fileName, options, locale, onLoad, onError]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && (url || buffer || blob || file)) {
      load();
    }
  }, [autoLoad, url, buffer, blob, file, load]);

  // Helper methods
  const goToPage = useCallback(
    async (pageNumber: number) => {
      if (!viewerAPIs) {
        throw new Error('Viewer not initialized');
      }
      await viewerAPIs.gotoLocation(pageNumber);
    },
    [viewerAPIs]
  );

  const print = useCallback(async () => {
    if (!viewerAPIs) {
      throw new Error('Viewer not initialized');
    }
    await viewerAPIs.print();
  }, [viewerAPIs]);

  const download = useCallback(async () => {
    if (!viewerAPIs) {
      throw new Error('Viewer not initialized');
    }
    await viewerAPIs.download();
  }, [viewerAPIs]);

  const search = useCallback(
    async (query: string) => {
      if (!viewerAPIs) {
        throw new Error('Viewer not initialized');
      }
      return viewerAPIs.search(query);
    },
    [viewerAPIs]
  );

  return {
    containerRef,
    isLoading,
    error,
    viewerAPIs,
    load,
    goToPage,
    print,
    download,
    search,
  };
}
