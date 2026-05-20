/**
 * Configurator Service — URL serialization, QR generation, GLB export
 */
import type { ShareableConfiguration } from '../types/configurator.types';
import { MAX_CONFIGURATION_URL_LENGTH, SHARE_QR_SIZE_PX } from '../constants/configurator.constants';

/**
 * Serialize a configuration to a URL-safe string.
 */
export function serializeConfiguration(config: ShareableConfiguration): string {
  const json = JSON.stringify(config);
  // Use base64url encoding for URL safety
  const encoded = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return encoded;
}

/**
 * Deserialize a configuration from a URL-safe string.
 */
export function deserializeConfiguration(encoded: string): ShareableConfiguration {
  // Restore base64 padding
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(padded);
  return JSON.parse(json) as ShareableConfiguration;
}

/**
 * Generate a full shareable URL for a configuration.
 */
export function generateShareableUrl(
  baseUrl: string,
  config: ShareableConfiguration,
): string | null {
  const serialized = serializeConfiguration(config);
  const url = `${baseUrl}/design-studio/configure?c=${serialized}`;

  if (url.length > MAX_CONFIGURATION_URL_LENGTH) {
    return null; // Too long for URL
  }

  return url;
}

/**
 * Generate a QR code data URL for a shareable configuration.
 * Returns a placeholder — real implementation would use a QR library.
 */
export async function generateShareQR(_url: string): Promise<string> {
  // Placeholder — in production, use a QR code library like 'qrcode'
  // For now, return a data URL placeholder
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_QR_SIZE_PX;
  canvas.height = SHARE_QR_SIZE_PX;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, SHARE_QR_SIZE_PX, SHARE_QR_SIZE_PX);
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code', SHARE_QR_SIZE_PX / 2, SHARE_QR_SIZE_PX / 2);
    ctx.fillText('(requires qrcode lib)', SHARE_QR_SIZE_PX / 2, SHARE_QR_SIZE_PX / 2 + 16);
  }
  return canvas.toDataURL('image/png');
}
