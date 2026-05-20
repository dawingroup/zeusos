/**
 * GOOGLE SANS FONT LOADER FOR jsPDF
 *
 * Loads Google Sans TTF files from /public/fonts/ and registers them
 * with a jsPDF instance. Falls back to helvetica if fonts are unavailable.
 *
 * Required files in public/fonts/:
 *   - GoogleSans-Regular.ttf
 *   - GoogleSans-Bold.ttf
 *   - GoogleSans-Italic.ttf  (optional)
 */

import { jsPDF } from 'jspdf';

// Cache base64 font data to avoid re-fetching
const fontCache: Record<string, string> = {};

export const GOOGLE_SANS = 'Google Sans';
export const FALLBACK_FONT = 'helvetica';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function isLikelyTrueTypeFont(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer);
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  // TTF: 00 01 00 00, OTF: OTTO, TTC: ttcf
  return (
    (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
    sig === 'OTTO' ||
    sig === 'ttcf'
  );
}

/**
 * Fetch a font file from a list of candidate URLs and convert to base64.
 * Validates the payload is a real font binary to avoid jsPDF parser crashes.
 */
async function fetchFirstValidFontAsBase64(urls: string[]): Promise<string> {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      if (fontCache[url]) return fontCache[url];

      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        lastError = new Error(`Font not found: ${url} (${response.status})`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!isLikelyTrueTypeFont(arrayBuffer)) {
        lastError = new Error(`Invalid font payload at ${url}`);
        continue;
      }

      const base64 = arrayBufferToBase64(arrayBuffer);
      fontCache[url] = base64;
      return base64;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No valid Google Sans font source found');
}

/**
 * Register Google Sans fonts with a jsPDF document instance.
 * Returns true if successful, false if fonts are unavailable (will use helvetica).
 */
export async function registerGoogleSans(doc: jsPDF): Promise<boolean> {
  try {
    // Load required variants (Regular + Bold)
    const [regularBase64, boldBase64] = await Promise.all([
      fetchFirstValidFontAsBase64([
        '/fonts/GoogleSans-Regular.ttf',
        'https://cdn.jsdelivr.net/fontsource/fonts/google-sans@latest/latin-400-normal.ttf',
      ]),
      fetchFirstValidFontAsBase64([
        '/fonts/GoogleSans-Bold.ttf',
        'https://cdn.jsdelivr.net/fontsource/fonts/google-sans@latest/latin-700-normal.ttf',
      ]),
    ]);

    doc.addFileToVFS('GoogleSans-Regular.ttf', regularBase64);
    doc.addFont('GoogleSans-Regular.ttf', GOOGLE_SANS, 'normal');

    doc.addFileToVFS('GoogleSans-Bold.ttf', boldBase64);
    doc.addFont('GoogleSans-Bold.ttf', GOOGLE_SANS, 'bold');

    // Optional: load italic variant
    try {
      const italicBase64 = await fetchFirstValidFontAsBase64([
        '/fonts/GoogleSans-Italic.ttf',
        'https://cdn.jsdelivr.net/fontsource/fonts/google-sans@latest/latin-400-italic.ttf',
      ]);
      doc.addFileToVFS('GoogleSans-Italic.ttf', italicBase64);
      doc.addFont('GoogleSans-Italic.ttf', GOOGLE_SANS, 'italic');
    } catch {
      // Italic is optional — bold-italic and italic will fall back to normal
    }

    // Final runtime validation: some jsPDF addFont failures only surface when measuring text.
    try {
      doc.setFont(GOOGLE_SANS, 'normal');
      doc.getTextWidth('A');
      doc.setFont(GOOGLE_SANS, 'bold');
      doc.getTextWidth('A');
    } catch (validationError) {
      console.warn('Google Sans registration failed runtime validation, falling back:', validationError);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Google Sans fonts not available, using helvetica fallback:', error);
    return false;
  }
}
