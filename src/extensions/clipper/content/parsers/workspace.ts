/**
 * Workspace.ae site parser
 * UAE office furniture supplier
 */

import type { SiteParser } from './types';
import type { ExtractedMetadata } from '../../types/database';

export class WorkspaceParser implements SiteParser {
  name = 'Workspace.ae';
  hostPatterns = [/workspace\.ae/];

  canParse(url: string): boolean {
    return this.hostPatterns.some((pattern) => pattern.test(url));
  }

  extractMetadata(): ExtractedMetadata {
    const metadata: ExtractedMetadata = {};
    console.log('[Workspace Parser] Starting extraction...');

    // Title - try multiple selectors
    const titleEl = document.querySelector('h1.product-title') ||
      document.querySelector('h1[itemprop="name"]') ||
      document.querySelector('.product-name h1') ||
      document.querySelector('h1');
    if (titleEl) {
      metadata.title = titleEl.textContent?.trim();
      console.log('[Workspace Parser] Found title:', metadata.title);
    }

    // Price - workspace.ae specific selectors
    // Based on inspection, the price appears as "AED 185" in a prominent element
    const priceSelectors = [
      '.product-prices .price', // PrestaShop common
      '.product-price .price',
      '.current-price-value',
      '.current-price span',
      '.current-price',
      '[itemprop="price"]',
      '.product-price',
      '#product-price',
      'span.price',
      '.price',
    ];

    console.log('[Workspace Parser] Searching for price...');
    
    for (const selector of priceSelectors) {
      const priceEl = document.querySelector(selector);
      if (priceEl) {
        const priceText = priceEl.textContent || priceEl.getAttribute('content') || '';
        console.log('[Workspace Parser] Checking selector:', selector, 'text:', priceText);
        
        // Match various price formats: AED 100, 100 AED, د.إ 100, $100, etc.
        const match = priceText.match(/(?:AED|د\.إ|Dhs?\.?|\$|€|£)?\s*([\d,]+(?:\.\d{2})?)\s*(?:AED|د\.إ|Dhs?\.?)?/i);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (amount > 0) {
            metadata.price = {
              amount,
              currency: this.detectCurrency(priceText),
              formatted: `AED ${amount.toFixed(2)}`,
              confidence: 0.85,
            };
            console.log('[Workspace Parser] Found price:', metadata.price);
            break;
          }
        }
      }
    }
    
    // If still no price, try finding any element containing "AED" followed by numbers
    if (!metadata.price) {
      console.log('[Workspace Parser] Trying text search for AED...');
      const allElements = document.querySelectorAll('span, div, p');
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        // Match "AED 185" or similar patterns
        if (text.match(/^AED\s*[\d,]+(\.\d{2})?$/i)) {
          const match = text.match(/AED\s*([\d,]+(?:\.\d{2})?)/i);
          if (match) {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            if (amount > 0) {
              metadata.price = {
                amount,
                currency: 'AED',
                formatted: `AED ${amount.toFixed(2)}`,
                confidence: 0.8,
              };
              console.log('[Workspace Parser] Found price via text search:', metadata.price);
              break;
            }
          }
        }
      }
    }

    // Also try to get price from JSON-LD
    if (!metadata.price) {
      const ldJson = this.extractLdJsonPrice();
      if (ldJson) {
        metadata.price = ldJson;
      }
    }

    // Brand
    const brandEl = document.querySelector('[itemprop="brand"]') ||
      document.querySelector('.product-brand') ||
      document.querySelector('.manufacturer');
    if (brandEl) {
      metadata.brand = brandEl.textContent?.trim();
    }

    // SKU
    const skuEl = document.querySelector('[itemprop="sku"]') ||
      document.querySelector('.product-reference') ||
      document.querySelector('.product-sku');
    if (skuEl) {
      const text = skuEl.textContent || skuEl.getAttribute('content') || '';
      const match = text.match(/(?:SKU|REF|Reference)[:\s]*(\S+)/i) || [null, text.trim()];
      if (match[1]) {
        metadata.sku = match[1];
      }
    }

    // Description
    const descEl = document.querySelector('[itemprop="description"]') ||
      document.querySelector('.product-description') ||
      document.querySelector('#product-description');
    if (descEl) {
      metadata.description = descEl.textContent?.trim().slice(0, 500);
    }

    // Category from breadcrumbs
    const breadcrumbs = document.querySelectorAll('.breadcrumb a, [itemprop="itemListElement"] a');
    if (breadcrumbs.length > 1) {
      // Get second-to-last breadcrumb as category
      const categoryEl = breadcrumbs[breadcrumbs.length - 2];
      if (categoryEl) {
        metadata.category = categoryEl.textContent?.trim();
      }
    }

    return metadata;
  }

  private extractLdJsonPrice(): ExtractedMetadata['price'] {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        const product = this.findProduct(data);
        
        if (product?.offers) {
          const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          const price = offers?.price;
          
          if (price !== undefined) {
            return {
              amount: parseFloat(String(price)),
              currency: offers?.priceCurrency || 'AED',
              formatted: `${offers?.priceCurrency || 'AED'} ${price}`,
              confidence: 0.9,
            };
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    }
    
    return undefined;
  }

  private findProduct(data: unknown): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;
    
    const obj = data as Record<string, unknown>;
    
    if (obj['@type'] === 'Product') return obj;
    
    if (Array.isArray(data)) {
      for (const item of data) {
        const found = this.findProduct(item);
        if (found) return found;
      }
    }
    
    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
      for (const item of obj['@graph']) {
        const found = this.findProduct(item);
        if (found) return found;
      }
    }
    
    return null;
  }

  private detectCurrency(text: string): string {
    if (/AED|د\.إ|Dhs?\.?/i.test(text)) return 'AED';
    if (text.includes('$')) return 'USD';
    if (text.includes('€')) return 'EUR';
    if (text.includes('£')) return 'GBP';
    return 'AED'; // Default for UAE site
  }

  findProductImages(): string[] {
    const images: string[] = [];

    // Main product images
    const imageSelectors = [
      '.product-images img',
      '.product-gallery img',
      '[itemprop="image"]',
      '.product-cover img',
      '.product-image img',
      '#product-images img',
      '.swiper-slide img',
      '.product-thumbs img',
    ];

    for (const selector of imageSelectors) {
      const imgs = document.querySelectorAll(selector);
      for (const img of imgs) {
        const src = (img as HTMLImageElement).currentSrc || 
                   (img as HTMLImageElement).src ||
                   img.getAttribute('data-src') ||
                   img.getAttribute('data-lazy-src');
        if (src && !src.includes('placeholder') && !src.includes('loading')) {
          images.push(src);
        }
      }
    }

    return [...new Set(images)];
  }
}

export const workspaceParser = new WorkspaceParser();
