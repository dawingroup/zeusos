/**
 * MetadataExtractor - Extract product information from web pages
 */

import type { ExtractedMetadata } from '../types/database';
import { parserRegistry } from './parsers';

export class MetadataExtractor {
  /**
   * Extract all available metadata from the current page
   */
  extract(): ExtractedMetadata {
    // First try site-specific parser
    const url = window.location.href;
    try {
      const parser = parserRegistry.getParser(url);
      const parserResult = parserRegistry.parse(url);
      if (parserResult.metadata && (parserResult.metadata.title || parserResult.metadata.price)) {
        console.log('Using site-specific parser:', parser.name);
        // Merge with generic extraction for any missing fields
        const genericMetadata = this.extractGeneric();
        return {
          ...genericMetadata,
          ...parserResult.metadata,
        };
      }
    } catch (e) {
      console.warn('Site parser failed, falling back to generic:', e);
    }

    // Fall back to generic extraction
    return this.extractGeneric();
  }

  /**
   * Generic extraction logic
   */
  private extractGeneric(): ExtractedMetadata {
    const metadata: ExtractedMetadata = {};

    // Try structured data first (most reliable)
    const structuredData = this.extractStructuredData();
    Object.assign(metadata, structuredData);

    // Fill in gaps with DOM parsing
    if (!metadata.title) {
      metadata.title = this.extractTitle();
    }

    if (!metadata.description) {
      metadata.description = this.extractDescription();
    }

    if (!metadata.price) {
      metadata.price = this.extractPrice();
    }

    if (!metadata.brand) {
      metadata.brand = this.extractBrand();
    }

    if (!metadata.dimensions) {
      metadata.dimensions = this.extractDimensions();
    }

    if (!metadata.materials || metadata.materials.length === 0) {
      metadata.materials = this.extractMaterials();
    }

    if (!metadata.colors || metadata.colors.length === 0) {
      metadata.colors = this.extractColors();
    }

    return metadata;
  }

  /**
   * Extract JSON-LD structured data
   */
  private extractStructuredData(): Partial<ExtractedMetadata> {
    const metadata: Partial<ExtractedMetadata> = {};
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        const product = this.findProductData(data);

        if (product) {
          if (typeof product.name === 'string') metadata.title = product.name;
          if (typeof product.description === 'string') metadata.description = product.description;
          
          const brand = product.brand as Record<string, unknown> | undefined;
          if (brand && typeof brand.name === 'string') metadata.brand = brand.name;
          
          if (typeof product.sku === 'string') metadata.sku = product.sku;
          if (typeof product.category === 'string') metadata.category = product.category;

          // Price
          const offers = product.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
          if (offers) {
            const offer = (Array.isArray(offers) ? offers[0] : offers) as Record<string, unknown>;
            const price = offer?.price;
            if (price !== undefined) {
              const priceNum = parseFloat(String(price));
              const currency = typeof offer.priceCurrency === 'string' ? offer.priceCurrency : 'USD';
              metadata.price = {
                amount: priceNum,
                currency,
                formatted: this.formatPrice(priceNum, currency),
                confidence: 0.9,
              };
            }
          }

          break;
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    return metadata;
  }

  /**
   * Find product data in nested JSON-LD
   */
  private findProductData(data: unknown): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;

    const obj = data as Record<string, unknown>;

    if (obj['@type'] === 'Product') {
      return obj;
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        const found = this.findProductData(item);
        if (found) return found;
      }
    }

    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
      for (const item of obj['@graph']) {
        const found = this.findProductData(item);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Extract title from page
   */
  private extractTitle(): string | undefined {
    // Try product-specific selectors first
    const selectors = [
      '[itemprop="name"]',
      'h1[class*="product"]',
      'h1[class*="title"]',
      '.product-title',
      '.product-name',
      '[data-testid="product-title"]',
      'h1',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return document.title?.split(/[|\-–—]/)[0]?.trim();
  }

  /**
   * Extract description
   */
  private extractDescription(): string | undefined {
    const selectors = [
      '[itemprop="description"]',
      '.product-description',
      '[data-testid="product-description"]',
      'meta[name="description"]',
      'meta[property="og:description"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = element.getAttribute('content') || element.textContent;
        if (content?.trim()) {
          return content.trim().slice(0, 500);
        }
      }
    }

    return undefined;
  }

  /**
   * Extract price from page
   */
  private extractPrice(): ExtractedMetadata['price'] {
    const selectors = [
      '[itemprop="price"]',
      '.price',
      '[class*="price"]',
      '[data-testid*="price"]',
      '.product-price',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || element.getAttribute('content') || '';
        const priceMatch = text.match(/[\$£€]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);

        if (priceMatch) {
          const amount = parseFloat(priceMatch[1].replace(/,/g, ''));
          const currency = this.detectCurrency(text);

          return {
            amount,
            currency,
            formatted: this.formatPrice(amount, currency),
            confidence: 0.7,
          };
        }
      }
    }

    return undefined;
  }

  /**
   * Extract brand
   */
  private extractBrand(): string | undefined {
    const selectors = [
      '[itemprop="brand"]',
      '.brand',
      '[class*="brand"]',
      '[data-testid*="brand"]',
      '.manufacturer',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const content = element?.textContent?.trim();
      if (content && content.length < 50) {
        return content;
      }
    }

    return undefined;
  }

  /**
   * Extract dimensions
   */
  private extractDimensions(): ExtractedMetadata['dimensions'] {
    const text = document.body.textContent || '';

    // Common dimension patterns
    const patterns = [
      // W x H x D format
      /(\d+(?:\.\d+)?)\s*[""''′]?\s*[Ww]?\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[""''′]?\s*[Hh]?\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[""''′]?\s*[Dd]?/,
      // Individual dimensions
      /[Ww]idth[:\s]+(\d+(?:\.\d+)?)\s*(?:in|inch|cm|mm)?/,
      /[Hh]eight[:\s]+(\d+(?:\.\d+)?)\s*(?:in|inch|cm|mm)?/,
      /[Dd]epth[:\s]+(\d+(?:\.\d+)?)\s*(?:in|inch|cm|mm)?/,
    ];

    const match = text.match(patterns[0]);
    if (match) {
      const unit = this.detectUnit(text);
      return {
        width: parseFloat(match[1]),
        height: parseFloat(match[2]),
        depth: parseFloat(match[3]),
        unit,
        confidence: 0.6,
      };
    }

    return undefined;
  }

  /**
   * Extract materials
   */
  private extractMaterials(): string[] {
    const materials: string[] = [];
    const materialKeywords = [
      'wood', 'oak', 'walnut', 'maple', 'cherry', 'pine', 'mahogany', 'teak', 'birch',
      'metal', 'steel', 'iron', 'aluminum', 'brass', 'copper', 'chrome',
      'leather', 'fabric', 'velvet', 'linen', 'cotton', 'polyester',
      'glass', 'marble', 'stone', 'granite', 'concrete',
      'plastic', 'acrylic', 'resin',
      'rattan', 'wicker', 'bamboo', 'cane',
      'mdf', 'plywood', 'veneer', 'laminate',
    ];

    const text = document.body.textContent?.toLowerCase() || '';

    for (const keyword of materialKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(text)) {
        materials.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    }

    // Limit to top 5 most relevant
    return [...new Set(materials)].slice(0, 5);
  }

  /**
   * Extract colors
   */
  private extractColors(): string[] {
    const colors: string[] = [];
    const colorKeywords = [
      'black', 'white', 'gray', 'grey', 'brown', 'beige', 'tan', 'cream',
      'navy', 'blue', 'green', 'red', 'orange', 'yellow', 'pink', 'purple',
      'gold', 'silver', 'bronze', 'copper', 'brass',
      'natural', 'walnut', 'oak', 'espresso', 'charcoal',
    ];

    // Look in color-specific areas
    const selectors = [
      '[class*="color"]',
      '[class*="swatch"]',
      '[data-testid*="color"]',
      '.variant',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.toLowerCase() || '';
        for (const color of colorKeywords) {
          if (text.includes(color)) {
            colors.push(color.charAt(0).toUpperCase() + color.slice(1));
          }
        }
      }
    }

    return [...new Set(colors)].slice(0, 5);
  }

  /**
   * Detect currency from text
   */
  private detectCurrency(text: string): string {
    if (text.includes('$')) return 'USD';
    if (text.includes('£')) return 'GBP';
    if (text.includes('€')) return 'EUR';
    return 'USD';
  }

  /**
   * Detect dimension unit
   */
  private detectUnit(text: string): 'in' | 'cm' | 'mm' {
    if (/\bcm\b/i.test(text)) return 'cm';
    if (/\bmm\b/i.test(text)) return 'mm';
    return 'in';
  }

  /**
   * Format price
   */
  private formatPrice(amount: number, currency: string): string {
    const symbols: Record<string, string> = {
      USD: '$',
      GBP: '£',
      EUR: '€',
    };
    const symbol = symbols[currency] || '$';
    return `${symbol}${amount.toFixed(2)}`;
  }

  /**
   * Extract metadata for a specific image
   */
  extractForImage(imageElement: HTMLElement): ExtractedMetadata {
    const metadata = this.extract();

    // Try to get alt text from image
    if (imageElement instanceof HTMLImageElement) {
      metadata.imageAlt = imageElement.alt;
    }

    return metadata;
  }
}

export const metadataExtractor = new MetadataExtractor();
