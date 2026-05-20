/**
 * Adobe PDF Embed API Client
 *
 * Provides in-browser PDF viewing capabilities using Adobe's PDF Embed API.
 * This is a client-side only API that renders PDFs directly in the browser.
 *
 * @see https://developer.adobe.com/document-services/docs/overview/pdf-embed-api/
 */

import { logAdobeDebug } from '../config';

// Adobe DC View SDK types
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Window {
    // @ts-expect-error Duplicate AdobeDC declaration with extended type
    AdobeDC?: {
      View: new (config: AdobeDCViewConfig) => AdobeDCView;
    };
  }
}

interface AdobeDCViewConfig {
  clientId: string;
  divId: string;
  locale?: string;
}

interface AdobeDCView {
  previewFile(
    content: PDFContent,
    config?: PreviewConfig
  ): Promise<AdobeDCPreviewRef>;
  registerCallback(
    type: CallbackType,
    callback: (event: PDFEvent) => void,
    options?: CallbackOptions
  ): void;
}

interface AdobeDCPreviewRef {
  getAPIs(): Promise<PDFViewerAPIs>;
}

interface PDFViewerAPIs {
  getAnnotationManager(): Promise<AnnotationManager>;
  getCurrentPage(): Promise<number>;
  getPageZoom(): Promise<number>;
  getSelectedContent(): Promise<SelectedContent>;
  gotoLocation(pageNumber: number, x?: number, y?: number): Promise<void>;
  print(): Promise<void>;
  download(): Promise<void>;
  search(query: string): Promise<SearchResult[]>;
}

interface AnnotationManager {
  getAnnotations(): Promise<Annotation[]>;
  addAnnotations(annotations: Annotation[]): Promise<void>;
  deleteAnnotations(annotationIds: string[]): Promise<void>;
  updateAnnotation(annotation: Annotation): Promise<void>;
  selectAnnotation(annotationId: string): Promise<void>;
  unselectAnnotation(): Promise<void>;
}

interface Annotation {
  id?: string;
  type: 'highlight' | 'note' | 'strikeout' | 'underline' | 'freetext' | 'shape' | 'stamp';
  bodyValue?: string;
  target?: AnnotationTarget;
  motivation?: string;
  created?: string;
  modified?: string;
  creator?: AnnotationCreator;
}

interface AnnotationTarget {
  selector: {
    type: string;
    node?: { index: number };
    subtype?: string;
    boundingBox?: number[];
    quadPoints?: number[];
    strokeColor?: string;
    opacity?: number;
  };
  source: string;
}

interface AnnotationCreator {
  type: string;
  name: string;
}

interface SelectedContent {
  type: 'text' | 'image';
  data: string;
}

interface SearchResult {
  pageNumber: number;
  text: string;
  bounds: number[];
}

interface PDFContent {
  content?: {
    location?: { url: string };
    promise?: Promise<ArrayBuffer>;
  };
  metaData: {
    fileName: string;
    id?: string;
  };
}

interface PreviewConfig {
  embedMode?: 'FULL_WINDOW' | 'SIZED_CONTAINER' | 'IN_LINE' | 'LIGHT_BOX';
  defaultViewMode?: 'FIT_PAGE' | 'FIT_WIDTH' | 'TWO_COLUMN' | 'TWO_COLUMN_FIT_PAGE';
  showDownloadPDF?: boolean;
  showPrintPDF?: boolean;
  showLeftHandPanel?: boolean;
  showAnnotationTools?: boolean;
  showBookmarks?: boolean;
  showThumbnails?: boolean;
  showFullScreen?: boolean;
  showPageControls?: boolean;
  showZoomControl?: boolean;
  enableFormFilling?: boolean;
  enableAnnotationAPIs?: boolean;
  includePDFAnnotations?: boolean;
  dockPageControls?: boolean;
  focusOnRendering?: boolean;
}

type CallbackType =
  | 'SAVE_API'
  | 'STATUS_API'
  | 'EVENT_LISTENER'
  | 'APP_RENDERING_START'
  | 'APP_RENDERING_DONE'
  | 'APP_RENDERING_FAILED';

interface CallbackOptions {
  enablePDFAnalytics?: boolean;
  enableAnnotationEvents?: boolean;
  enableFilePreviewEvents?: boolean;
  enableSearchEvents?: boolean;
  enableBookmarkEvents?: boolean;
  enableAttachmentEvents?: boolean;
  enableHyperlinkEvents?: boolean;
  enableLinearizationEvents?: boolean;
}

interface PDFEvent {
  type: string;
  data: unknown;
}

export interface PDFEmbedConfig {
  clientId: string;
  divId: string;
  locale?: string;
}

export interface PDFEmbedOptions {
  embedMode?: 'FULL_WINDOW' | 'SIZED_CONTAINER' | 'IN_LINE' | 'LIGHT_BOX';
  defaultViewMode?: 'FIT_PAGE' | 'FIT_WIDTH' | 'TWO_COLUMN' | 'TWO_COLUMN_FIT_PAGE';
  showDownloadPDF?: boolean;
  showPrintPDF?: boolean;
  showLeftHandPanel?: boolean;
  showAnnotationTools?: boolean;
  enableAnnotationAPIs?: boolean;
  enableFormFilling?: boolean;
  showFullScreen?: boolean;
}

const PDF_EMBED_SDK_URL = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
let sdkLoadPromise: Promise<void> | null = null;

/**
 * Load the Adobe PDF Embed SDK
 */
async function loadPdfEmbedSdk(): Promise<void> {
  if (window.AdobeDC) {
    return;
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDF_EMBED_SDK_URL;
    script.async = true;

    script.onload = () => {
      logAdobeDebug('PDF Embed SDK loaded');
      // SDK might need a moment to initialize
      const checkReady = () => {
        if (window.AdobeDC) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    };

    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error('Failed to load Adobe PDF Embed SDK'));
    };

    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

/**
 * Adobe PDF Embed API Client
 */
export class AdobePdfEmbedClient {
  private clientId: string;
  private adobeDCView: AdobeDCView | null = null;
  private previewRef: AdobeDCPreviewRef | null = null;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  /**
   * Initialize the PDF Embed viewer in a container element
   */
  async initialize(divId: string, locale = 'en-US'): Promise<void> {
    await loadPdfEmbedSdk();

    if (!window.AdobeDC) {
      throw new Error('Adobe DC SDK not available');
    }

    this.adobeDCView = new (window.AdobeDC as any).View({
      clientId: this.clientId,
      divId,
      locale,
    }) as AdobeDCView;

    logAdobeDebug('PDF Embed viewer initialized', { divId, locale });
  }

  /**
   * Preview a PDF from a URL
   */
  async previewUrl(
    url: string,
    fileName: string,
    options: PDFEmbedOptions = {}
  ): Promise<PDFViewerAPIs> {
    if (!this.adobeDCView) {
      throw new Error('PDF Embed viewer not initialized. Call initialize() first.');
    }

    const config: PreviewConfig = {
      embedMode: options.embedMode || 'SIZED_CONTAINER',
      defaultViewMode: options.defaultViewMode || 'FIT_WIDTH',
      showDownloadPDF: options.showDownloadPDF ?? true,
      showPrintPDF: options.showPrintPDF ?? true,
      showLeftHandPanel: options.showLeftHandPanel ?? false,
      showAnnotationTools: options.showAnnotationTools ?? false,
      enableAnnotationAPIs: options.enableAnnotationAPIs ?? false,
      enableFormFilling: options.enableFormFilling ?? false,
      showFullScreen: options.showFullScreen ?? true,
      dockPageControls: true,
    };

    this.previewRef = await this.adobeDCView.previewFile(
      {
        content: { location: { url } },
        metaData: { fileName },
      },
      config
    );

    logAdobeDebug('PDF preview started', { url, fileName, config });

    return this.previewRef.getAPIs();
  }

  /**
   * Preview a PDF from an ArrayBuffer
   */
  async previewBuffer(
    buffer: ArrayBuffer,
    fileName: string,
    options: PDFEmbedOptions = {}
  ): Promise<PDFViewerAPIs> {
    if (!this.adobeDCView) {
      throw new Error('PDF Embed viewer not initialized. Call initialize() first.');
    }

    const config: PreviewConfig = {
      embedMode: options.embedMode || 'SIZED_CONTAINER',
      defaultViewMode: options.defaultViewMode || 'FIT_WIDTH',
      showDownloadPDF: options.showDownloadPDF ?? true,
      showPrintPDF: options.showPrintPDF ?? true,
      showLeftHandPanel: options.showLeftHandPanel ?? false,
      showAnnotationTools: options.showAnnotationTools ?? false,
      enableAnnotationAPIs: options.enableAnnotationAPIs ?? false,
      enableFormFilling: options.enableFormFilling ?? false,
      showFullScreen: options.showFullScreen ?? true,
      dockPageControls: true,
    };

    this.previewRef = await this.adobeDCView.previewFile(
      {
        content: { promise: Promise.resolve(buffer) },
        metaData: { fileName },
      },
      config
    );

    logAdobeDebug('PDF preview started from buffer', { fileName, config });

    return this.previewRef.getAPIs();
  }

  /**
   * Preview a PDF from a Blob
   */
  async previewBlob(
    blob: Blob,
    fileName: string,
    options: PDFEmbedOptions = {}
  ): Promise<PDFViewerAPIs> {
    const buffer = await blob.arrayBuffer();
    return this.previewBuffer(buffer, fileName, options);
  }

  /**
   * Preview a PDF from a File
   */
  async previewFile(
    file: File,
    options: PDFEmbedOptions = {}
  ): Promise<PDFViewerAPIs> {
    const buffer = await file.arrayBuffer();
    return this.previewBuffer(buffer, file.name, options);
  }

  /**
   * Register an event callback
   */
  onEvent(
    callback: (event: PDFEvent) => void,
    options: CallbackOptions = {}
  ): void {
    if (!this.adobeDCView) {
      throw new Error('PDF Embed viewer not initialized. Call initialize() first.');
    }

    this.adobeDCView.registerCallback('EVENT_LISTENER', callback, {
      enablePDFAnalytics: options.enablePDFAnalytics ?? true,
      enableAnnotationEvents: options.enableAnnotationEvents ?? false,
      enableFilePreviewEvents: options.enableFilePreviewEvents ?? true,
      ...options,
    });
  }

  /**
   * Get the current preview APIs
   */
  async getViewerAPIs(): Promise<PDFViewerAPIs | null> {
    if (!this.previewRef) {
      return null;
    }
    return this.previewRef.getAPIs();
  }
}

// Singleton instance using the client ID from environment
let embedClientInstance: AdobePdfEmbedClient | null = null;

export function getAdobePdfEmbedClient(): AdobePdfEmbedClient {
  if (!embedClientInstance) {
    const clientId = import.meta.env.VITE_ADOBE_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        'VITE_ADOBE_CLIENT_ID environment variable is required for PDF Embed API'
      );
    }
    embedClientInstance = new AdobePdfEmbedClient(clientId);
  }
  return embedClientInstance;
}

export const adobePdfEmbed = {
  getClient: getAdobePdfEmbedClient,
  loadSdk: loadPdfEmbedSdk,
};
