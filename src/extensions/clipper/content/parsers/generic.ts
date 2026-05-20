/**
 * Generic site parser - fallback for unrecognized sites
 */

import type { SiteParser } from './types';
import type { ExtractedMetadata } from '../../types/database';
import { metadataExtractor } from '../metadata-extractor';

export class GenericParser implements SiteParser {
  name = 'Generic';
  hostPatterns = [/.*/];

  canParse(): boolean {
    return true; // Fallback parser, always can parse
  }

  extractMetadata(): ExtractedMetadata {
    return metadataExtractor.extract();
  }

  findProductImages(): string[] {
    const images: string[] = [];
    const imgElements = document.querySelectorAll('img');

    for (const img of imgElements) {
      const src = img.currentSrc || img.src;
      if (src && this.isProductImage(img)) {
        images.push(src);
      }
    }

    return images;
  }

  private isProductImage(img: HTMLImageElement): boolean {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    // Must be reasonably sized
    if (width < 200 || height < 200) return false;

    // Exclude common non-product patterns
    const src = img.src.toLowerCase();
    if (/logo|icon|sprite|avatar|badge/.test(src)) return false;

    return true;
  }
}

export const genericParser = new GenericParser();
