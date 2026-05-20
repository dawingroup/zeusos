/**
 * IMAGE-TO-PDF SERVICE
 *
 * Converts captured receipt/invoice photos into professional scanned PDF documents.
 * Uses jsPDF with the DocumentScannerService for intelligent corner detection,
 * perspective correction (flattening), and contrast enhancement.
 */

import jsPDF from 'jspdf';
import { DocumentScannerService } from './document-scanner-service';

export interface PdfConversionResult {
  pdfBlob: Blob;
  fileName: string;
  pageCount: number;
}

export interface PdfConversionOptions {
  enhanceContrast?: boolean;
  brightness?: number;
  autoCrop?: boolean;
}

// A4 dimensions in mm
const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN = 10;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;
const CONTENT_HEIGHT = A4_HEIGHT - 2 * MARGIN;

export class ImageToPdfService {
  private static instance: ImageToPdfService;

  private constructor() {}

  static getInstance(): ImageToPdfService {
    if (!ImageToPdfService.instance) {
      ImageToPdfService.instance = new ImageToPdfService();
    }
    return ImageToPdfService.instance;
  }

  /**
   * Convert one or more captured images into a single PDF.
   * Each image gets its own page, sized to fit A4 with margins.
   * Applies document scanning (corner detection + perspective flatten + enhance).
   */
  async convertImagesToPdf(
    files: File[],
    options: PdfConversionOptions = {}
  ): Promise<PdfConversionResult> {
    const { autoCrop = true } = options;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const scanner = DocumentScannerService.getInstance();

    for (let i = 0; i < files.length; i++) {
      if (i > 0) doc.addPage();

      const file = files[i];
      let imageDataUrl = await this.fileToDataUrl(file);

      // Run the full scan pipeline: corner detect → perspective flatten → enhance
      if (autoCrop && file.size < 10 * 1024 * 1024) {
        try {
          const result = await scanner.scan(imageDataUrl);
          imageDataUrl = result.dataUrl;
        } catch {
          // Fallback: use original image
        }
      }

      // Get image dimensions to calculate aspect ratio
      const dims = await this.getImageDimensions(imageDataUrl);
      const { width, height } = this.fitToPage(dims.width, dims.height);

      // Center the image on the page
      const x = MARGIN + (CONTENT_WIDTH - width) / 2;
      const y = MARGIN + (CONTENT_HEIGHT - height) / 2;

      const format = file.type === 'image/png' ? 'PNG' : 'JPEG';
      doc.addImage(imageDataUrl, format, x, y, width, height);

      // Add footer with scan metadata
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Scanned document — Page ${i + 1} of ${files.length} — ${new Date().toLocaleDateString()}`,
        A4_WIDTH / 2,
        A4_HEIGHT - 5,
        { align: 'center' }
      );
    }

    const pdfBlob = doc.output('blob');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const fileName = `receipt-scan-${timestamp}.pdf`;

    return {
      pdfBlob,
      fileName,
      pageCount: files.length,
    };
  }

  /**
   * Generate a preview PDF blob URL for in-browser viewing.
   * Returns a blob URL that can be opened in a new tab.
   */
  async generatePreviewUrl(
    files: File[],
    options: PdfConversionOptions = {}
  ): Promise<string> {
    const { pdfBlob } = await this.convertImagesToPdf(files, options);
    return URL.createObjectURL(pdfBlob);
  }

  /**
   * Get the natural dimensions of an image from a data URL.
   */
  private getImageDimensions(
    dataUrl: string
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Calculate dimensions to fit an image within the A4 content area
   * while preserving aspect ratio.
   */
  private fitToPage(
    imgWidth: number,
    imgHeight: number
  ): { width: number; height: number } {
    const widthRatio = CONTENT_WIDTH / imgWidth;
    const heightRatio = CONTENT_HEIGHT / imgHeight;
    const scale = Math.min(widthRatio, heightRatio);

    return {
      width: imgWidth * scale,
      height: imgHeight * scale,
    };
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
