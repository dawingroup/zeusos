/**
 * Pinterest site parser
 */

import type { SiteParser } from './types';
import type { ExtractedMetadata } from '../../types/database';

export class PinterestParser implements SiteParser {
  name = 'Pinterest';
  hostPatterns = [/pinterest\.com/, /pinterest\.co\.uk/, /pin\.it/];

  canParse(url: string): boolean {
    return this.hostPatterns.some((pattern) => pattern.test(url));
  }

  extractMetadata(): ExtractedMetadata {
    const metadata: ExtractedMetadata = {};

    // Pin title/description
    const titleEl = document.querySelector('[data-test-id="pin-title"]') ||
      document.querySelector('[data-test-id="pinTitle"]') ||
      document.querySelector('h1');
    if (titleEl) {
      metadata.title = titleEl.textContent?.trim();
    }

    // Description
    const descEl = document.querySelector('[data-test-id="pin-description"]') ||
      document.querySelector('[data-test-id="pinDescription"]');
    if (descEl) {
      metadata.description = descEl.textContent?.trim();
    }

    // Source link - may contain product info
    const sourceLink = document.querySelector('[data-test-id="source-link"]');
    if (sourceLink) {
      const href = sourceLink.getAttribute('href');
      if (href) {
        // Store source URL for potential further extraction
        metadata.category = 'Pinterest Pin';
      }
    }

    return metadata;
  }

  findProductImages(): string[] {
    const images: string[] = [];

    // Main pin image
    const mainImage = document.querySelector(
      '[data-test-id="pin-closeup-image"] img, [data-test-id="visual-content-container"] img'
    );
    if (mainImage) {
      const src = (mainImage as HTMLImageElement).currentSrc || (mainImage as HTMLImageElement).src;
      if (src) {
        // Get original/highest resolution
        const highRes = src.replace(/\/\d+x\//, '/originals/');
        images.push(highRes);
      }
    }

    // Fallback to any large images in the pin viewer
    const pinViewerImages = document.querySelectorAll('[class*="PinImage"] img, [class*="closeup"] img');
    for (const img of pinViewerImages) {
      const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src;
      if (src && !images.includes(src)) {
        const highRes = src.replace(/\/\d+x\//, '/originals/');
        images.push(highRes);
      }
    }

    return [...new Set(images)];
  }
}

export const pinterestParser = new PinterestParser();
