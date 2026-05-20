/**
 * Wayfair site parser
 */

import type { SiteParser } from './types';
import type { ExtractedMetadata } from '../../types/database';

export class WayfairParser implements SiteParser {
  name = 'Wayfair';
  hostPatterns = [/wayfair\.com/, /wayfair\.ca/, /wayfair\.co\.uk/];

  canParse(url: string): boolean {
    return this.hostPatterns.some((pattern) => pattern.test(url));
  }

  extractMetadata(): ExtractedMetadata {
    const metadata: ExtractedMetadata = {};

    // Title
    const titleEl = document.querySelector('[data-enzyme-id="ProductTitle"]') ||
      document.querySelector('h1[class*="ProductTitle"]') ||
      document.querySelector('h1');
    if (titleEl) {
      metadata.title = titleEl.textContent?.trim();
    }

    // Price
    const priceEl = document.querySelector('[data-enzyme-id="SalePrice"]') ||
      document.querySelector('[class*="SalePrice"]') ||
      document.querySelector('[data-enzyme-id="Price"]');
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

    // Brand
    const brandEl = document.querySelector('[data-enzyme-id="ProductBrand"]') ||
      document.querySelector('[class*="BrandLink"]');
    if (brandEl) {
      metadata.brand = brandEl.textContent?.trim();
    }

    // SKU
    const skuEl = document.querySelector('[data-enzyme-id="ProductSku"]');
    if (skuEl) {
      const text = skuEl.textContent || '';
      const match = text.match(/SKU[:\s]+(\S+)/i);
      if (match) {
        metadata.sku = match[1];
      }
    }

    // Dimensions - from specs section
    const specsSection = document.querySelector('[class*="ProductSpecifications"]');
    if (specsSection) {
      const text = specsSection.textContent || '';
      const dimMatch = text.match(/(\d+(?:\.\d+)?)[""''′]?\s*[Ww]?\s*[×xX]\s*(\d+(?:\.\d+)?)[""''′]?\s*[Hh]?\s*[×xX]\s*(\d+(?:\.\d+)?)/);
      if (dimMatch) {
        metadata.dimensions = {
          width: parseFloat(dimMatch[1]),
          height: parseFloat(dimMatch[2]),
          depth: parseFloat(dimMatch[3]),
          unit: 'in',
          confidence: 0.8,
        };
      }
    }

    // Materials
    const materialsEl = document.querySelector('[data-enzyme-id="Material"]');
    if (materialsEl) {
      metadata.materials = [materialsEl.textContent?.trim() || ''].filter(Boolean);
    }

    return metadata;
  }

  findProductImages(): string[] {
    const images: string[] = [];

    // Main product images
    const mainImages = document.querySelectorAll(
      '[data-enzyme-id="ProductImage"] img, [class*="ProductImage"] img, [class*="GalleryImage"] img'
    );

    for (const img of mainImages) {
      const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src;
      if (src) {
        // Get highest resolution version
        const highRes = src.replace(/(\?.*)?$/, '?w=2000&q=85');
        images.push(highRes);
      }
    }

    return [...new Set(images)];
  }
}

export const wayfairParser = new WayfairParser();
