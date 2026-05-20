/**
 * West Elm / Williams Sonoma site parser
 */

import type { SiteParser } from './types';
import type { ExtractedMetadata } from '../../types/database';

export class WestElmParser implements SiteParser {
  name = 'West Elm';
  hostPatterns = [
    /westelm\.com/,
    /williams-sonoma\.com/,
    /potterybarn\.com/,
    /potterybarnkids\.com/,
    /rejuvenation\.com/,
  ];

  canParse(url: string): boolean {
    return this.hostPatterns.some((pattern) => pattern.test(url));
  }

  extractMetadata(): ExtractedMetadata {
    const metadata: ExtractedMetadata = {};

    // Title
    const titleEl = document.querySelector('[data-testid="product-title"]') ||
      document.querySelector('.product-name h1') ||
      document.querySelector('h1.pip-title');
    if (titleEl) {
      metadata.title = titleEl.textContent?.trim();
    }

    // Price
    const priceEl = document.querySelector('[data-testid="product-price"]') ||
      document.querySelector('.price-amount') ||
      document.querySelector('.product-price');
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

    // Brand - infer from hostname
    const hostname = window.location.hostname;
    if (hostname.includes('westelm')) {
      metadata.brand = 'West Elm';
    } else if (hostname.includes('potterybarn')) {
      metadata.brand = 'Pottery Barn';
    } else if (hostname.includes('williams-sonoma')) {
      metadata.brand = 'Williams Sonoma';
    } else if (hostname.includes('rejuvenation')) {
      metadata.brand = 'Rejuvenation';
    }

    // SKU from URL or page
    const urlMatch = window.location.pathname.match(/\/([a-z0-9-]+)\/?$/i);
    if (urlMatch) {
      metadata.sku = urlMatch[1];
    }

    // Dimensions from product details
    const detailsSection = document.querySelector('.product-details, .pip-details');
    if (detailsSection) {
      const text = detailsSection.textContent || '';
      const dimMatch = text.match(/(\d+(?:\.\d+)?)[""''′]?\s*[Ww]?\s*[×xX]\s*(\d+(?:\.\d+)?)[""''′]?\s*[Hh]?/);
      if (dimMatch) {
        metadata.dimensions = {
          width: parseFloat(dimMatch[1]),
          height: parseFloat(dimMatch[2]),
          unit: 'in',
          confidence: 0.7,
        };
      }
    }

    // Materials from details
    const materialsSection = document.querySelector('[data-testid="materials"]');
    if (materialsSection) {
      const text = materialsSection.textContent || '';
      metadata.materials = this.extractMaterialsFromText(text);
    }

    return metadata;
  }

  findProductImages(): string[] {
    const images: string[] = [];

    // Main carousel images
    const carouselImages = document.querySelectorAll(
      '.product-image-carousel img, [data-testid="product-image"] img, .pip-hero-image img'
    );

    for (const img of carouselImages) {
      const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src;
      if (src) {
        // Get highest resolution version
        const highRes = src.replace(/\$.*$/, '$pdp-1800$');
        images.push(highRes);
      }
    }

    // Also check thumbnail strip
    const thumbnails = document.querySelectorAll('.product-thumbnails img, .pip-thumbnails img');
    for (const thumb of thumbnails) {
      const dataSrc = thumb.getAttribute('data-src') || thumb.getAttribute('data-large-src');
      if (dataSrc) {
        images.push(dataSrc);
      }
    }

    return [...new Set(images)];
  }

  private extractMaterialsFromText(text: string): string[] {
    const materials: string[] = [];
    const keywords = ['wood', 'metal', 'fabric', 'leather', 'glass', 'marble', 'oak', 'walnut'];

    const lowerText = text.toLowerCase();
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        materials.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    }

    return materials;
  }
}

export const westElmParser = new WestElmParser();
