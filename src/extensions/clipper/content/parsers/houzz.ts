/**
 * Houzz site parser
 */

import type { SiteParser } from './types';
import type { ExtractedMetadata } from '../../types/database';

export class HouzzParser implements SiteParser {
  name = 'Houzz';
  hostPatterns = [/houzz\.com/, /houzz\.co\.uk/, /houzz\.com\.au/];

  canParse(url: string): boolean {
    return this.hostPatterns.some((pattern) => pattern.test(url));
  }

  extractMetadata(): ExtractedMetadata {
    const metadata: ExtractedMetadata = {};

    // Product title
    const titleEl = document.querySelector('[data-testid="product-title"]') ||
      document.querySelector('.product-info__title') ||
      document.querySelector('h1');
    if (titleEl) {
      metadata.title = titleEl.textContent?.trim();
    }

    // Price
    const priceEl = document.querySelector('[data-testid="product-price"]') ||
      document.querySelector('.product-info__price') ||
      document.querySelector('.price');
    if (priceEl) {
      const priceText = priceEl.textContent || '';
      const match = priceText.match(/\$?([\d,]+\.?\d*)/);
      if (match) {
        metadata.price = {
          amount: parseFloat(match[1].replace(/,/g, '')),
          currency: 'USD',
          formatted: `$${match[1]}`,
          confidence: 0.9,
        };
      }
    }

    // Brand/Seller
    const brandEl = document.querySelector('[data-testid="product-brand"]') ||
      document.querySelector('.product-info__brand') ||
      document.querySelector('.seller-name');
    if (brandEl) {
      metadata.brand = brandEl.textContent?.trim();
    }

    // Description
    const descEl = document.querySelector('[data-testid="product-description"]') ||
      document.querySelector('.product-description');
    if (descEl) {
      metadata.description = descEl.textContent?.trim().slice(0, 500);
    }

    // Dimensions from specs
    const specsSection = document.querySelector('.product-specs, [data-testid="product-specs"]');
    if (specsSection) {
      const text = specsSection.textContent || '';
      const dimMatch = text.match(/(\d+(?:\.\d+)?)\s*[""''′]?\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[""''′]?\s*[×xX]?\s*(\d+(?:\.\d+)?)?/);
      if (dimMatch) {
        metadata.dimensions = {
          width: parseFloat(dimMatch[1]),
          height: parseFloat(dimMatch[2]),
          depth: dimMatch[3] ? parseFloat(dimMatch[3]) : undefined,
          unit: 'in',
          confidence: 0.8,
        };
      }
    }

    // Category - from breadcrumbs
    const categoryEl = document.querySelector('.breadcrumb a:last-child, [data-testid="breadcrumb"] a:last-child');
    if (categoryEl) {
      metadata.category = categoryEl.textContent?.trim();
    }

    return metadata;
  }

  findProductImages(): string[] {
    const images: string[] = [];

    // Main product gallery
    const galleryImages = document.querySelectorAll(
      '.product-gallery img, [data-testid="product-gallery"] img, .lightbox-image img'
    );

    for (const img of galleryImages) {
      const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src;
      if (src) {
        // Get highest resolution version
        const highRes = src.replace(/\/s\d+\//, '/s2000/').replace(/\?.*$/, '');
        images.push(highRes);
      }
    }

    // Idea photos (for inspiration content)
    const ideaImages = document.querySelectorAll('.idea-photo img, [data-testid="photo"] img');
    for (const img of ideaImages) {
      const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src;
      if (src) {
        images.push(src);
      }
    }

    return [...new Set(images)];
  }
}

export const houzzParser = new HouzzParser();
