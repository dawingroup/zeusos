/**
 * Title Block Renderer — DF-Style 1 A3 Landscape
 * 6 sections separated by internal separator lines.
 * Section 1 (logo + contact) is taller (1.5× height) for proper spacing.
 * Uses Outfit font (loaded from CDN).
 *
 * Section 1: Logo + contact info (1.5× height)
 * Section 2: General notes
 * Section 3: Project name, client, project address
 * Section 4: Date modified, project no., drawn, checked
 * Section 5: Drawing title, project stage, paper size
 * Section 6: Drawing number + revision
 */

import type { jsPDF } from 'jspdf';
import type { PrintPackageProjectInfo } from '../types/workshop-viewer.types';
import {
  A3_DIMENSIONS,
  A4_DIMENSIONS,
  DF_BRAND_COLORS,
  DF_CONTACT_INFO,
} from '../constants/workshop-viewer.constants';

// 6 sections: section 1 (logo+contact) gets 1.5x weight, others 1x
// Total weight = 1.5 + 5 = 6.5 units
const NUM_VISUAL_SECTIONS = 6;
const SECTION1_WEIGHT = 1.5;

// Line weights
const SEPARATOR_WEIGHT = 0.5; // Internal section separators

// Typography — generous sizing for A3 landscape print
const SECTION_HEADER_SIZE = 9;   // Section headers (GENERAL NOTES, etc.)
const FIELD_LABEL_SIZE = 8;      // Field labels (PROJECT NAME, CLIENT, etc.)
const FIELD_VALUE_SIZE = 10;     // Field values
const CONTACT_LABEL_SIZE = 6.5;  // Contact info labels (WEBSITE:, PHONE:, etc.)
const CONTACT_SIZE = 8;          // Contact info text
const NOTES_TEXT_SIZE = 7.5;     // General notes body text
const DRAWING_NUMBER_SIZE = 32;  // Drawing number — prominent
const REVISION_VALUE_SIZE = 11;
const LABEL_COLOR = '#888888';
const VALUE_COLOR = DF_BRAND_COLORS.navy;
const INNER_PAD = 3.5; // Left padding inside title block

/**
 * Convert a string to Title Case (first letter of each word capitalised).
 */
function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Draw a field label + value pair.
 * Returns the Y position after the value.
 */
function drawFieldPair(
  doc: jsPDF,
  font: string,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
): number {
  // Label
  doc.setFont(font, 'normal');
  doc.setFontSize(FIELD_LABEL_SIZE);
  doc.setTextColor(LABEL_COLOR);
  doc.text(label, x, y);

  // Value
  doc.setFont(font, 'bold');
  doc.setFontSize(FIELD_VALUE_SIZE);
  doc.setTextColor(VALUE_COLOR);
  doc.text(toTitleCase(value) || '', x, y + 6, { maxWidth });

  return y + 12.5;
}

/**
 * Draw the complete DF-Style 1 title block on a jsPDF page.
 * 7 equal-height sections with internal separator lines between them.
 */
export function drawTitleBlock(
  doc: jsPDF,
  projectInfo: PrintPackageProjectInfo,
  drawingTitle: string,
  drawingNumber: string,
  hasOutfitFont: boolean,
  logoImageBase64?: string,
  logoFormat?: 'PNG' | 'JPEG',
  paperSize?: 'A3' | 'A4',
) {
  const font = hasOutfitFont ? 'Outfit' : 'helvetica';
  const scale = paperSize === 'A4' ? 0.8 : 1;
  const dims = paperSize === 'A4' ? A4_DIMENSIONS : A3_DIMENSIONS;
  const tbLeft = dims.width - dims.margin - dims.titleBlockWidth;
  const tbRight = dims.width - dims.margin;
  const availHeight = dims.height - 2 * dims.margin;
  const innerPad = INNER_PAD * scale;
  const left = tbLeft + innerPad;
  const fieldWidth = dims.titleBlockWidth - innerPad * 2;

  // Weighted section heights: section 1 is 1.5x, others 1x
  const totalWeight = SECTION1_WEIGHT + (NUM_VISUAL_SECTIONS - 1);
  const unitH = availHeight / totalWeight;
  const sec1H = unitH * SECTION1_WEIGHT;
  const sectionH = unitH; // standard section height

  // Compute section top positions with weighted layout
  const sectionTops: number[] = [];
  sectionTops[0] = dims.margin;                    // Section 1
  sectionTops[1] = dims.margin + sec1H;            // Section 2
  for (let i = 2; i < NUM_VISUAL_SECTIONS; i++) {
    sectionTops[i] = sectionTops[1] + (i - 1) * sectionH;
  }
  const secTop = (index: number) => sectionTops[index] ?? dims.margin;
  const secH = (index: number) => index === 0 ? sec1H : sectionH;

  // Page border (thin, around entire page)
  doc.setDrawColor(DF_BRAND_COLORS.separator);
  doc.setLineWidth(dims.borderWeight);
  doc.rect(dims.margin, dims.margin, dims.width - 2 * dims.margin, dims.height - 2 * dims.margin);

  // Internal section separators (lines between sections)
  for (let i = 1; i < NUM_VISUAL_SECTIONS; i++) {
    doc.setDrawColor(DF_BRAND_COLORS.navy);
    doc.setLineWidth(SEPARATOR_WEIGHT);
    doc.line(tbLeft, secTop(i), tbRight, secTop(i));
  }

  // ═══════════════════════════════════════════════════
  // SECTION 1: Logo + Contact Info (1.5× height)
  // ═══════════════════════════════════════════════════
  const s1Top = secTop(0);
  const s1H = secH(0);
  if (logoImageBase64 && logoFormat) {
    const logoH = 22 * scale;
    const logoW = logoH * 2.5; // locked 2.5:1 aspect ratio
    const logoX = left;
    const logoY = s1Top + 8 * scale; // generous top padding
    try {
      doc.addImage(logoImageBase64, logoFormat, logoX, logoY, logoW, logoH);
    } catch {
      drawTextLogoFallback(doc, left, s1Top, fieldWidth, font);
    }
  } else {
    drawTextLogoFallback(doc, left, s1Top, fieldWidth, font);
  }

  // Contact info (bottom half of section 1) — labelled fields
  const contactY = s1Top + s1H - 24 * scale;
  const lineH = 4.5 * scale;
  const labelIndent = left;
  const contactEntries: Array<{ label: string; value: string }> = [
    { label: 'WEBSITE', value: DF_CONTACT_INFO.website },
    { label: 'PHONE', value: DF_CONTACT_INFO.phone },
    { label: 'EMAIL', value: DF_CONTACT_INFO.email },
    { label: 'ADDRESS', value: DF_CONTACT_INFO.address },
  ];
  for (let i = 0; i < contactEntries.length; i++) {
    const y = contactY + i * lineH;
    doc.setFont(font, 'bold');
    doc.setFontSize(CONTACT_LABEL_SIZE * scale);
    doc.setTextColor(LABEL_COLOR);
    doc.text(`${contactEntries[i].label}:`, labelIndent, y);
    doc.setFont(font, 'normal');
    doc.setFontSize(CONTACT_SIZE * scale);
    doc.setTextColor('#333333');
    // Address wraps to fit within field width
    const valX = labelIndent + 16 * scale;
    doc.text(contactEntries[i].value, valX, y, { maxWidth: fieldWidth - 16 * scale });
  }

  // ═══════════════════════════════════════════════════
  // SECTION 2: General Notes
  // ═══════════════════════════════════════════════════
  const s2Top = secTop(1);
  doc.setFont(font, 'bold');
  doc.setFontSize(SECTION_HEADER_SIZE * scale);
  doc.setTextColor(VALUE_COLOR);
  doc.text('GENERAL NOTES', left, s2Top + 6 * scale);

  doc.setFont(font, 'normal');
  doc.setFontSize(NOTES_TEXT_SIZE * scale);
  doc.setTextColor('#666666');
  doc.text('All dimensions in millimetres unless noted.', left, s2Top + 13 * scale, { maxWidth: fieldWidth });
  doc.text('Do not scale from drawings.', left, s2Top + 18 * scale, { maxWidth: fieldWidth });
  doc.text('Verify all dimensions on site.', left, s2Top + 23 * scale, { maxWidth: fieldWidth });

  // ═══════════════════════════════════════════════════
  // SECTION 3: Project Name, Client, Project Address
  // ═══════════════════════════════════════════════════
  const s3Top = secTop(2);
  let y3 = s3Top + 5;
  y3 = drawFieldPair(doc, font, 'PROJECT NAME', projectInfo.projectName, left, y3, fieldWidth);
  y3 = drawFieldPair(doc, font, 'CLIENT', projectInfo.client, left, y3, fieldWidth);
  drawFieldPair(doc, font, 'PROJECT ADDRESS', projectInfo.address, left, y3, fieldWidth);

  // ═══════════════════════════════════════════════════
  // SECTION 4: Date, Project No., Drawn, Checked
  // ═══════════════════════════════════════════════════
  const s4Top = secTop(3);
  const halfW = fieldWidth / 2 - 1;
  let y4 = s4Top + 5;
  drawFieldPair(doc, font, 'DATE MODIFIED', projectInfo.date, left, y4, halfW);
  drawFieldPair(doc, font, 'PROJECT NO.', projectInfo.projectNo, left + halfW + 2, y4, halfW);
  y4 += 13;
  drawFieldPair(doc, font, 'DRAWN', projectInfo.drawnBy, left, y4, halfW);
  drawFieldPair(doc, font, 'CHECKED', projectInfo.checkedBy, left + halfW + 2, y4, halfW);

  // ═══════════════════════════════════════════════════
  // SECTION 5: Drawing Title, Project Stage, Paper Size
  // ═══════════════════════════════════════════════════
  const s5Top = secTop(4);
  let y5 = s5Top + 5;
  y5 = drawFieldPair(doc, font, 'DRAWING TITLE', drawingTitle, left, y5, fieldWidth);
  y5 = drawFieldPair(doc, font, 'PROJECT STAGE', projectInfo.stage, left, y5, fieldWidth);
  drawFieldPair(doc, font, 'PAPER SIZE', paperSize || 'A3', left, y5, fieldWidth);

  // ═══════════════════════════════════════════════════
  // SECTION 6: Drawing Number + Revision
  // ═══════════════════════════════════════════════════
  const s7Top = secTop(5);

  // Drawing Number label
  doc.setFont(font, 'normal');
  doc.setFontSize(FIELD_LABEL_SIZE * scale);
  doc.setTextColor(LABEL_COLOR);
  doc.text('DRAWING NUMBER', left, s7Top + 6 * scale);

  // Drawing Number value (large)
  doc.setFont(font, 'bold');
  doc.setFontSize(DRAWING_NUMBER_SIZE * scale);
  doc.setTextColor(VALUE_COLOR);
  doc.text(drawingNumber, left, s7Top + 21 * scale);

  // Revision label
  doc.setFont(font, 'normal');
  doc.setFontSize(FIELD_LABEL_SIZE * scale);
  doc.setTextColor(LABEL_COLOR);
  doc.text('REVISION', left, s7Top + 28 * scale);

  // Revision value
  doc.setFont(font, 'bold');
  doc.setFontSize(REVISION_VALUE_SIZE * scale);
  doc.setTextColor(VALUE_COLOR);
  doc.text(projectInfo.revision || '-', left, s7Top + 35 * scale);
}

/**
 * Text-only logo fallback — "DAWIN FINISHES" in navy, Outfit Bold 14pt, centered.
 */
function drawTextLogoFallback(
  doc: jsPDF,
  sectionLeft: number,
  sectionTopY: number,
  _sectionWidth: number,
  font: string,
) {
  doc.setFont(font, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(DF_BRAND_COLORS.navy);
  doc.text('DAWIN FINISHES', sectionLeft, sectionTopY + 14); // Left-aligned
}

/**
 * Fetch a logo image from a URL and convert to base64 for jsPDF.
 * Uses an Image element to bypass CORS issues with Firebase Storage URLs.
 * Draws to a canvas to extract base64 data.
 * Returns null if load fails.
 */
export async function fetchLogoAsBase64(
  url: string,
): Promise<{ base64: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }

          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          // Strip the data:image/png;base64, prefix
          const base64 = dataUrl.split(',')[1];
          resolve({ base64, format: 'PNG' });
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => {
        console.warn('Failed to load logo image via Image element');
        resolve(null);
      };

      // Set src last to trigger load
      img.src = url;
    });
  } catch (err) {
    console.warn('Failed to fetch logo image:', err);
    return null;
  }
}

/**
 * Load Outfit font from CDN and register with jsPDF.
 * Returns true if font was loaded successfully.
 */
export async function loadOutfitFont(doc: jsPDF): Promise<boolean> {
  try {
    const weights = [
      { name: 'normal', url: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-400-normal.ttf' },
      { name: 'medium', url: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-500-normal.ttf' },
      { name: 'semibold', url: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-600-normal.ttf' },
      { name: 'bold', url: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-700-normal.ttf' },
    ];

    for (const weight of weights) {
      const response = await fetch(weight.url);
      if (!response.ok) throw new Error(`Failed to fetch font: ${weight.url}`);

      const buffer = await response.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);

      doc.addFileToVFS(`Outfit-${weight.name}.ttf`, base64);
      doc.addFont(`Outfit-${weight.name}.ttf`, 'Outfit', weight.name);
    }

    return true;
  } catch (err) {
    console.warn('Failed to load Outfit font, falling back to Helvetica:', err);
    return false;
  }
}

/**
 * Load osifont (ISO 3098 technical lettering) and register as 'ISOCPEUR' with jsPDF.
 * Used for dimension labels to match engineering drawing standards.
 */
export async function loadISOFont(doc: jsPDF): Promise<boolean> {
  try {
    // osifont is bundled in public/fonts/ — served from the app's origin
    const response = await fetch('/fonts/osifont.ttf');
    if (!response.ok) throw new Error(`Failed to fetch ISO font: ${response.status}`);

    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    doc.addFileToVFS('osifont.ttf', base64);
    doc.addFont('osifont.ttf', 'ISOCPEUR', 'normal');
    doc.addFont('osifont.ttf', 'ISOCPEUR', 'bold'); // osifont has single weight — alias bold to same

    return true;
  } catch (err) {
    console.warn('Failed to load ISO font (osifont), falling back to helvetica:', err);
    return false;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
