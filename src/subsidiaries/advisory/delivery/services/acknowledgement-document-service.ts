/**
 * ACKNOWLEDGEMENT DOCUMENT SERVICE
 *
 * Generates acknowledgement documents (PDFs) for requisitions.
 * The acknowledgement is the first step - confirming receipt of funds
 * before accountability entries are made.
 */

import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ManualRequisition, AcknowledgementFormData } from '../types/manual-requisition';

// ─────────────────────────────────────────────────────────────────
// DOCUMENT GENERATION
// ─────────────────────────────────────────────────────────────────

export interface AcknowledgementDocumentOptions {
  requisition: ManualRequisition;
  acknowledgement: AcknowledgementFormData;
  companyName?: string;
  companyLogo?: string;
}

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
 * Convert number to words (for amounts)
 */
function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
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
      return convertHundreds(Math.floor(n / 1000)) + ' Thousand' +
        (n % 1000 ? ' ' + convertHundreds(n % 1000) : '');
    }
    if (n < 1000000000) {
      return convertHundreds(Math.floor(n / 1000000)) + ' Million' +
        (n % 1000000 ? ' ' + convertThousands(n % 1000000) : '');
    }
    return convertHundreds(Math.floor(n / 1000000000)) + ' Billion' +
      (n % 1000000000 ? ' ' + convertThousands(n % 1000000000) : '');
  };

  return convertThousands(Math.floor(num)) + ' Only';
}

/**
 * Generate acknowledgement document PDF
 */
export function generateAcknowledgementPDF(options: AcknowledgementDocumentOptions): jsPDF {
  const { requisition, acknowledgement, companyName = 'Darwin Group' } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // ─────────────────────────────────────────────────────────────────
  // HEADER
  // ─────────────────────────────────────────────────────────────────

  // Company name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  // Document title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ACKNOWLEDGEMENT OF RECEIPT OF FUNDS', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  // Reference number
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Reference: ${requisition.referenceNumber}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Horizontal line
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // ─────────────────────────────────────────────────────────────────
  // BODY
  // ─────────────────────────────────────────────────────────────────

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  // Date
  doc.text(`Date: ${formatDate(acknowledgement.dateReceived)}`, margin, yPos);
  yPos += 12;

  // Opening statement
  const openingText = `I, ${acknowledgement.receivedBy}${acknowledgement.receivedByTitle ? `, ${acknowledgement.receivedByTitle}` : ''}, hereby acknowledge receipt of funds as detailed below:`;
  const openingLines = doc.splitTextToSize(openingText, contentWidth);
  doc.text(openingLines, margin, yPos);
  yPos += openingLines.length * 6 + 8;

  // ─────────────────────────────────────────────────────────────────
  // DETAILS TABLE
  // ─────────────────────────────────────────────────────────────────

  const tableStartY = yPos;
  const col1Width = 50;
  const col2Width = contentWidth - col1Width;

  // Table header background
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, contentWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 2, yPos + 5.5);
  doc.text('Details', margin + col1Width + 2, yPos + 5.5);
  yPos += 8;

  doc.setFont('helvetica', 'normal');

  // Table rows
  const tableRows = [
    ['Purpose:', requisition.purpose],
    ['Amount Received:', formatCurrency(acknowledgement.amountReceived, requisition.currency)],
    ['Amount in Words:', numberToWords(acknowledgement.amountReceived)],
    ['Date Received:', formatDate(acknowledgement.dateReceived)],
    ['Requisition Date:', formatDate(requisition.requisitionDate)],
    ['Advance Type:', requisition.advanceType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
  ];

  if (requisition.linkedProjectName) {
    tableRows.push(['Project:', requisition.linkedProjectName]);
  }

  if (requisition.linkedProgramName) {
    tableRows.push(['Program:', requisition.linkedProgramName]);
  }

  tableRows.forEach((row, index) => {
    // Alternate row background
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, yPos, contentWidth, 7, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.text(row[0], margin + 2, yPos + 5);
    doc.setFont('helvetica', 'normal');

    // Handle long text wrapping
    const valueLines = doc.splitTextToSize(row[1], col2Width - 4);
    doc.text(valueLines, margin + col1Width + 2, yPos + 5);
    yPos += Math.max(7, valueLines.length * 5 + 2);
  });

  // Table border
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, tableStartY, contentWidth, yPos - tableStartY);
  doc.line(margin + col1Width, tableStartY, margin + col1Width, yPos);

  yPos += 12;

  // ─────────────────────────────────────────────────────────────────
  // DECLARATION
  // ─────────────────────────────────────────────────────────────────

  const declarationText = `I confirm that I have received the above-mentioned amount and undertake to provide full accountability for all expenditures within the stipulated timeframe. I understand that all expenses must be supported by valid receipts or invoices.`;
  const declarationLines = doc.splitTextToSize(declarationText, contentWidth);
  doc.text(declarationLines, margin, yPos);
  yPos += declarationLines.length * 6 + 8;

  // Notes if any
  if (acknowledgement.notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(acknowledgement.notes, contentWidth);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 6 + 8;
  }

  yPos += 10;

  // ─────────────────────────────────────────────────────────────────
  // SIGNATURE SECTION
  // ─────────────────────────────────────────────────────────────────

  doc.setFont('helvetica', 'bold');
  doc.text('Received By:', margin, yPos);
  yPos += 20;

  // Signature line
  doc.setDrawColor(0);
  doc.line(margin, yPos, margin + 70, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(acknowledgement.receivedBy, margin, yPos);
  yPos += 5;

  if (acknowledgement.receivedByTitle) {
    doc.text(acknowledgement.receivedByTitle, margin, yPos);
    yPos += 5;
  }

  doc.text(acknowledgement.receivedByEmail, margin, yPos);
  yPos += 5;

  doc.text(`Date: ${formatDate(acknowledgement.dateReceived)}`, margin, yPos);

  // ─────────────────────────────────────────────────────────────────
  // EMAIL SIGNATURE (if provided)
  // ─────────────────────────────────────────────────────────────────

  if (acknowledgement.signatureHtml) {
    yPos += 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Email Signature:', margin, yPos);
    yPos += 6;

    // Strip HTML tags and render plain text version
    const plainSignature = acknowledgement.signatureHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();

    const signatureLines = doc.splitTextToSize(plainSignature, contentWidth);
    doc.text(signatureLines, margin, yPos);
  }

  // ─────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────

  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')} | ${companyName}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc;
}

/**
 * Generate and download acknowledgement PDF
 */
export function downloadAcknowledgementPDF(options: AcknowledgementDocumentOptions): void {
  const doc = generateAcknowledgementPDF(options);
  const filename = `Acknowledgement_${options.requisition.referenceNumber}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}

/**
 * Generate acknowledgement PDF as blob for upload
 */
export function generateAcknowledgementBlob(options: AcknowledgementDocumentOptions): Blob {
  const doc = generateAcknowledgementPDF(options);
  return doc.output('blob');
}

/**
 * Generate acknowledgement PDF as data URL for preview
 */
export function generateAcknowledgementDataUrl(options: AcknowledgementDocumentOptions): string {
  const doc = generateAcknowledgementPDF(options);
  return doc.output('datauristring');
}
