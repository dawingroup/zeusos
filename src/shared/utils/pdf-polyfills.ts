/**
 * Buffer polyfill for @react-pdf/renderer and other PDF libraries
 * Import this file at the top of any module that uses PDF generation.
 * Must be imported BEFORE @react-pdf/renderer.
 */
import { Buffer } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
