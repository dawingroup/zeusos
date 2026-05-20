/**
 * FUNDS ACKNOWLEDGEMENT DOCUMENT SERVICE
 *
 * Generates Funds Received Acknowledgement PDFs with:
 * - Standard facility-branding header (default)
 * - Donor-header variant (optional)
 * - Transaction details table
 * - Acknowledgement statement
 * - Signature block (with digital signature support)
 */

import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import {
  FundsAcknowledgementPDFOptions,
  generateAcknowledgementFileName,
} from '../types/funds-acknowledgement';
import { registerGoogleSans, GOOGLE_SANS, FALLBACK_FONT } from './googleSansFontLoader';

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Format currency for display
 */
function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(date: Date | any): string {
  const d = date instanceof Date ? date : date?.toDate?.() || new Date(date);
  return format(d, 'MMMM d, yyyy');
}

/**
 * Format date with ordinal suffix (e.g., "3rd September 2025")
 */
function formatDateWithOrdinal(date: Date | any): string {
  const d = date instanceof Date ? date : date?.toDate?.() || new Date(date);
  const day = d.getDate();

  const ordinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return `${ordinal(day)} ${format(d, 'MMMM yyyy')}`;
}

/**
 * Convert number to words (for amounts)
 */
function numberToWords(num: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';

  const convertHundreds = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertHundreds(n % 100) : '');
  };

  const convertThousands = (n: number): string => {
    if (n < 1000) return convertHundreds(n);
    if (n < 1000000) {
      return (
        convertHundreds(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convertHundreds(n % 1000) : '')
      );
    }
    if (n < 1000000000) {
      return (
        convertHundreds(Math.floor(n / 1000000)) +
        ' Million' +
        (n % 1000000 ? ' ' + convertThousands(n % 1000000) : '')
      );
    }
    return (
      convertHundreds(Math.floor(n / 1000000000)) +
      ' Billion' +
      (n % 1000000000 ? ' ' + convertThousands(n % 1000000000) : '')
    );
  };

  return convertThousands(Math.floor(num)) + ' Shillings Only';
}

// ─────────────────────────────────────────────────────────────────
// IMAGE LOADING
// ─────────────────────────────────────────────────────────────────

/**
 * Load image from URL as base64 data URL
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load image:', url, error);
    return null;
  }
}

/**
 * Get image dimensions from base64 data URL
 */
async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 100, height: 100 }); // Default fallback
    img.src = dataUrl;
  });
}

/**
 * Trim transparent padding around a PNG-like image so layout alignment uses
 * the real visible logo bounds rather than the full transparent canvas.
 */
async function trimTransparentPadding(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

        let minX = img.width;
        let minY = img.height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const alpha = imageData[(y * img.width + x) * 4 + 3];
            if (alpha > 0) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }

        // No visible pixels or already tightly bounded
        if (maxX < 0 || minX === 0 && minY === 0 && maxX === img.width - 1 && maxY === img.height - 1) {
          resolve(dataUrl);
          return;
        }

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = width;
        outCanvas.height = height;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          resolve(dataUrl);
          return;
        }

        outCtx.drawImage(img, minX, minY, width, height, 0, 0, width, height);
        resolve(outCanvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Check whether a given font style is registered in jsPDF.
 * Prevents runtime crashes when optional variants (e.g., italic) are missing.
 */
function hasRegisteredFontStyle(doc: jsPDF, fontName: string, style: string): boolean {
  const fontList = doc.getFontList() as Record<string, string[] | Record<string, string>>;
  const entry = fontList?.[fontName];
  if (!entry) return false;
  if (Array.isArray(entry)) return entry.includes(style);
  return Object.prototype.hasOwnProperty.call(entry, style);
}

/**
 * Safely apply font/style. Falls back to helvetica if custom font metadata is invalid.
 */
function safeSetFont(doc: jsPDF, preferredFont: string, style: 'normal' | 'bold' | 'italic'): string {
  const fallbackStyle: 'normal' | 'bold' | 'italic' = style === 'italic' ? 'normal' : style;

  try {
    const styleToUse =
      style === 'italic' && !hasRegisteredFontStyle(doc, preferredFont, 'italic') ? 'normal' : style;
    doc.setFont(preferredFont, styleToUse);
    // Force jsPDF to access active font internals now (fails early if broken).
    doc.getTextWidth('A');
    return preferredFont;
  } catch {
    doc.setFont(FALLBACK_FONT, fallbackStyle);
    return FALLBACK_FONT;
  }
}

/**
 * Draw wrapped paragraph and bold a target phrase when it appears within a line.
 */
function drawWrappedParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  preferredFont: string,
  boldPhrase?: string
): number {
  const lines = doc.splitTextToSize(text, width) as string[];
  let yPos = y;

  lines.forEach((line) => {
    if (boldPhrase && line.includes(boldPhrase)) {
      const start = line.indexOf(boldPhrase);
      const before = line.slice(0, start);
      const after = line.slice(start + boldPhrase.length);

      safeSetFont(doc, preferredFont, 'normal');
      doc.text(before, x, yPos);
      let xPos = x + doc.getTextWidth(before);

      safeSetFont(doc, preferredFont, 'bold');
      doc.text(boldPhrase, xPos, yPos);
      xPos += doc.getTextWidth(boldPhrase);

      safeSetFont(doc, preferredFont, 'normal');
      doc.text(after, xPos, yPos);
    } else {
      safeSetFont(doc, preferredFont, 'normal');
      doc.text(line, x, yPos);
    }
    yPos += lineHeight;
  });

  return yPos;
}

// ─────────────────────────────────────────────────────────────────
// PDF GENERATION
// ─────────────────────────────────────────────────────────────────

/**
 * Generate Funds Acknowledgement PDF
 */
export async function generateFundsAcknowledgementPDF(
  options: FundsAcknowledgementPDFOptions
): Promise<jsPDF> {
  const { formData, branding, templateVariant = 'standard' } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Prefer Google Sans for visual consistency; safeSetFont will fall back to helvetica if unavailable.
  const hasGoogleSans = await registerGoogleSans(doc);
  const preferredFont = hasGoogleSans ? GOOGLE_SANS : FALLBACK_FONT;
  safeSetFont(doc, preferredFont, 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLR = templateVariant === 'donor_header' ? 16 : 25.4;
  const marginTB = templateVariant === 'donor_header' ? 12 : 18;
  const contentWidth = pageWidth - marginLR * 2;
  let yPos = marginTB;

  if (templateVariant === 'donor_header') {
    // ─────────────────────────────────────────────────────────────────
    // HEADER (DONOR FORM STYLE)
    // Layout: [Title + Ref left] [Donor logo right]
    // ─────────────────────────────────────────────────────────────────
    const referenceText = `Ref: ${formData.receiptNumber || 'RCPT'}`;
    const headerTopY = yPos + 2;
    const donorLogoMaxWidth = 65;
    const donorLogoMaxHeight = 30;
    let donorLogoDrawnHeight = 0;

    doc.setTextColor(0, 0, 0);
    safeSetFont(doc, preferredFont, 'bold');
    doc.setFontSize(20);

    if (branding.donorLogoUrl) {
      try {
        const donorLogoBase64 = await loadImageAsBase64(branding.donorLogoUrl);
        if (donorLogoBase64) {
          const donorLogoTrimmed = await trimTransparentPadding(donorLogoBase64);
          const dims = await getImageDimensions(donorLogoTrimmed);
          const aspectRatio = dims.width / dims.height;

          let donorLogoWidth = donorLogoMaxWidth;
          let donorLogoHeight = donorLogoWidth / aspectRatio;

          if (donorLogoHeight > donorLogoMaxHeight) {
            donorLogoHeight = donorLogoMaxHeight;
            donorLogoWidth = donorLogoHeight * aspectRatio;
          }

          const donorLogoX = pageWidth - marginLR - donorLogoWidth;
          doc.addImage(donorLogoTrimmed, 'PNG', donorLogoX, headerTopY, donorLogoWidth, donorLogoHeight);
          donorLogoDrawnHeight = donorLogoHeight;
        }
      } catch (error) {
        console.error('Failed to add donor logo:', error);
      }
    }

    const donorLogoX = pageWidth - marginLR - donorLogoMaxWidth;
    const titleWidth = Math.max(60, donorLogoX - marginLR - 8);
    const titleLines = doc.splitTextToSize('Funds Acknowledgement Form', titleWidth);
    let textY = headerTopY + 5; // baseline tuned so title top aligns with logo top
    doc.text(titleLines, marginLR, textY);
    textY += titleLines.length * 7;

    safeSetFont(doc, preferredFont, 'normal');
    doc.setFontSize(11);
    const referenceLines = doc.splitTextToSize(referenceText, titleWidth);
    doc.text(referenceLines, marginLR, textY + 1);

    const textBottomY = textY + referenceLines.length * 5 + 1;
    const headerBottomY = Math.max(textBottomY, headerTopY + donorLogoDrawnHeight);
    yPos = headerBottomY + 4;
    doc.setDrawColor(224, 224, 224);
    doc.setLineWidth(0.4);
    doc.line(marginLR, yPos, pageWidth - marginLR, yPos);
    yPos += 8;
  } else {
    // ─────────────────────────────────────────────────────────────────
    // HEADER WITH FACILITY BRANDING (DEFAULT)
    // Layout: [Logo Left] [Facility Info Center]
    // ─────────────────────────────────────────────────────────────────
    const logoFixedHeight = 30;
    const logoMaxWidth = 55;
    const logoLeftX = marginLR;
    const centerX = pageWidth / 2;
    const headerTopY = yPos + 2;

    if (branding.clientLogoUrl) {
      try {
        const clientLogoBase64 = await loadImageAsBase64(branding.clientLogoUrl);
        if (clientLogoBase64) {
          const dims = await getImageDimensions(clientLogoBase64);
          const aspectRatio = dims.width / dims.height;

          let logoHeight = logoFixedHeight;
          let logoWidth = logoHeight * aspectRatio;

          if (logoWidth > logoMaxWidth) {
            logoWidth = logoMaxWidth;
            logoHeight = logoWidth / aspectRatio;
          }

          doc.addImage(clientLogoBase64, 'PNG', logoLeftX, headerTopY, logoWidth, logoHeight);
        }
      } catch (error) {
        console.error('Failed to add client logo:', error);
      }
    }

    const textStartY = headerTopY + 3.5;
    const textCenterX = centerX + 10;

    doc.setFontSize(14);
    safeSetFont(doc, preferredFont, 'bold');
    doc.text(branding.facilityName.toUpperCase(), textCenterX, textStartY, { align: 'center' });

    let textY = textStartY + 5;
    doc.setFontSize(9);
    safeSetFont(doc, preferredFont, 'normal');
    if (branding.address) {
      doc.text(branding.address, textCenterX, textY, { align: 'center' });
      textY += 4;
    }

    if (branding.telephone || branding.email) {
      const contactParts: string[] = [];
      if (branding.telephone) contactParts.push(`Tel: ${branding.telephone}`);
      if (branding.email) contactParts.push(`Email: ${branding.email}`);
      doc.text(contactParts.join(' | '), textCenterX, textY, { align: 'center' });
      textY += 4;
    }

    if (branding.tagline) {
      safeSetFont(doc, preferredFont, 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`"${branding.tagline}"`, textCenterX, textY, { align: 'center' });
      textY += 4;
    }

    const logoEndY = headerTopY + logoFixedHeight;
    const textEndY = textY;
    yPos = Math.max(logoEndY, textEndY) + 8;

    // Document title in default template
    doc.setFontSize(16);
    safeSetFont(doc, preferredFont, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Funds Received Acknowledgement Form', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
  }

  // ─────────────────────────────────────────────────────────────────
  // TRANSACTION DETAILS TABLE
  // ─────────────────────────────────────────────────────────────────

  const tableStartY = yPos;
  const col1Width = 55;
  const col2Width = contentWidth - col1Width;
  const rowHeight = 11; // Increased row height for larger font

  doc.setFontSize(12); // Increased font size

  const tableRows = [
    ['Receipt Number:', formData.receiptNumber || 'TBD'],
    ['Date of Funds Transfer:', formatDateWithOrdinal(formData.dateOfFundsTransfer)],
    ['Project Name:', formData.projectName],
    ['Amount Received:', formatCurrency(formData.amountReceived, formData.currency)],
    ['Amount in Words:', numberToWords(formData.amountReceived)],
    ['Method of Payment:', formData.paymentMethod],
  ];

  tableRows.forEach((row, index) => {
    const rowY = tableStartY + index * rowHeight;

    // Left column (label) - dark background
    doc.setFillColor(44, 62, 80); // Dark blue-gray
    doc.rect(marginLR, rowY, col1Width, rowHeight, 'F');

    // Right column (value) - light background
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(249, 249, 249);
    }
    doc.rect(marginLR + col1Width, rowY, col2Width, rowHeight, 'F');

    // Label text (white on dark)
    safeSetFont(doc, preferredFont, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(row[0], marginLR + 4, rowY + 7);

    // Value text (black on light)
    safeSetFont(doc, preferredFont, 'normal');
    doc.setTextColor(0, 0, 0);

    // Handle long text wrapping
    const valueLines = doc.splitTextToSize(row[1], col2Width - 8);
    doc.text(valueLines[0] || '', marginLR + col1Width + 4, rowY + 7);
  });

  yPos = tableStartY + tableRows.length * rowHeight;

  // Table border
  doc.setDrawColor(200, 200, 200);
  doc.rect(marginLR, tableStartY, contentWidth, yPos - tableStartY);
  doc.line(marginLR + col1Width, tableStartY, marginLR + col1Width, yPos);

  yPos += 15;

  // ─────────────────────────────────────────────────────────────────
  // ACKNOWLEDGEMENT STATEMENT (Justified text)
  // ─────────────────────────────────────────────────────────────────

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  const projectDesc = formData.projectDescription || formData.projectName;
  const lineHeight = 6;
  const paragraph1 = `I, ${formData.requestorName}, the undersigned, hereby acknowledge that I have received the aforementioned funds.`;
  const paragraph2 = projectDesc;

  yPos = drawWrappedParagraph(
    doc,
    paragraph1,
    marginLR,
    yPos,
    contentWidth,
    lineHeight,
    preferredFont,
    formData.requestorName
  );
  yPos += 4;
  safeSetFont(doc, preferredFont, 'bold');
  doc.setFontSize(11);
  doc.text('Purpose of Funds', marginLR, yPos);
  yPos += 7;
  safeSetFont(doc, preferredFont, 'normal');
  yPos = drawWrappedParagraph(doc, paragraph2, marginLR, yPos, contentWidth, lineHeight, preferredFont);

  yPos += 14; // Space after statement before signature

  // ─────────────────────────────────────────────────────────────────
  // SIGNATURE BLOCK
  // ─────────────────────────────────────────────────────────────────

  safeSetFont(doc, preferredFont, 'bold');
  doc.setFontSize(11);
  doc.text('Recipient Signature:', marginLR, yPos);
  yPos += 8;

  // If digital signature provided, embed it (left-aligned, larger size)
  if (formData.signatureDataUrl) {
    try {
      const signatureWidth = 80;
      const signatureHeight = 35;
      doc.addImage(formData.signatureDataUrl, 'PNG', marginLR, yPos, signatureWidth, signatureHeight);
      yPos += signatureHeight + 3;
    } catch (error) {
      console.error('Failed to add signature:', error);
      // Leave space for manual signature (no line)
      yPos += 20;
    }
  } else {
    // Leave space for manual signature (no line)
    yPos += 20;
  }

  safeSetFont(doc, preferredFont, 'normal');
  doc.setFontSize(10);
  yPos += 8;

  doc.text(`Name: ${formData.requestorName}`, marginLR, yPos);
  yPos += 8;

  // Date field - text only, no line
  if (formData.signatureDate) {
    doc.text(formatDate(formData.signatureDate), marginLR, yPos);
  }
  yPos += 8;

  // Title field - text only, no line
  if (formData.requestorTitle) {
    doc.text(formData.requestorTitle, marginLR, yPos);
  }

  // ─────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────

  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const totalPages = doc.getNumberOfPages();
  const currentPage = typeof (doc as any).getCurrentPageInfo === 'function'
    ? (doc as any).getCurrentPageInfo().pageNumber
    : 1;
  doc.text(`Ref: ${formData.receiptNumber || 'RCPT'}`, marginLR, footerY, { align: 'left' });
  doc.text(`Page ${currentPage}/${totalPages}`, pageWidth - marginLR, footerY, { align: 'right' });

  return doc;
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────

/**
 * Generate and download Funds Acknowledgement PDF
 */
export async function downloadFundsAcknowledgementPDF(options: FundsAcknowledgementPDFOptions): Promise<void> {
  const doc = await generateFundsAcknowledgementPDF(options);
  const filename = generateAcknowledgementFileName(options.projectCode, options.formData.periodCovered);
  doc.save(filename);
}

/**
 * Generate Funds Acknowledgement PDF as Blob (for upload to storage)
 */
export async function generateFundsAcknowledgementBlob(options: FundsAcknowledgementPDFOptions): Promise<Blob> {
  const doc = await generateFundsAcknowledgementPDF(options);
  return doc.output('blob');
}

/**
 * Generate Funds Acknowledgement PDF as data URL (for preview)
 */
export async function generateFundsAcknowledgementDataUrl(
  options: FundsAcknowledgementPDFOptions
): Promise<string> {
  const doc = await generateFundsAcknowledgementPDF(options);
  return doc.output('datauristring');
}

/**
 * Export helper functions for use elsewhere
 */
export { formatCurrency, formatDate, numberToWords, formatDateWithOrdinal };
