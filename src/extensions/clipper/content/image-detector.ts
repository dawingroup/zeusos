/**
 * FurnitureImageDetector - Identifies clippable product images on a page
 */

import type { DetectedImage } from '../types/database';

export interface DetectorOptions {
  minWidth: number;
  minHeight: number;
  detectBackgroundImages: boolean;
  detectLazyImages: boolean;
}

const DEFAULT_OPTIONS: DetectorOptions = {
  minWidth: 200,
  minHeight: 200,
  detectBackgroundImages: true,
  detectLazyImages: true,
};

// Patterns to exclude (icons, logos, UI elements)
const EXCLUDE_PATTERNS = [
  /icon/i,
  /logo/i,
  /sprite/i,
  /avatar/i,
  /badge/i,
  /button/i,
  /arrow/i,
  /chevron/i,
  /social/i,
  /facebook|twitter|instagram|pinterest|linkedin/i,
  /placeholder/i,
  /loading/i,
  /spinner/i,
  /\.svg$/i,
  /data:image\/svg/i,
  /1x1|spacer|blank|pixel/i,
];

// Image aspect ratio ranges for furniture/product images
const VALID_ASPECT_RATIOS = {
  min: 0.3, // Tall/narrow images
  max: 3.0, // Wide/short images
};

export class FurnitureImageDetector {
  private options: DetectorOptions;

  constructor(options: Partial<DetectorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Find all clippable images on the page
   */
  detectImages(): DetectedImage[] {
    const images: DetectedImage[] = [];

    // 1. Standard <img> elements
    images.push(...this.detectImgElements());

    // 2. <picture> elements
    images.push(...this.detectPictureElements());

    // 3. Background images
    if (this.options.detectBackgroundImages) {
      images.push(...this.detectBackgroundImages());
    }

    // 4. Lazy-loaded images
    if (this.options.detectLazyImages) {
      images.push(...this.detectLazyImages());
    }

    // Deduplicate by URL
    const uniqueImages = this.deduplicateImages(images);

    // Filter and sort by relevance
    return this.filterAndRank(uniqueImages);
  }

  /**
   * Detect standard <img> elements
   */
  private detectImgElements(): DetectedImage[] {
    const images: DetectedImage[] = [];
    const imgElements = document.querySelectorAll('img');

    for (const img of imgElements) {
      if (!this.isVisible(img)) continue;

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (!this.meetsMinSize(width, height)) continue;

      const imageUrl = img.currentSrc || img.src;
      if (!imageUrl || this.shouldExclude(imageUrl, img)) continue;

      const highResUrl = this.findHighResVersion(img);

      images.push({
        element: img,
        imageUrl,
        highResUrl,
        width,
        height,
        alt: img.alt,
        sourceType: 'img',
        boundingRect: img.getBoundingClientRect(),
      });
    }

    return images;
  }

  /**
   * Detect <picture> elements with multiple sources
   */
  private detectPictureElements(): DetectedImage[] {
    const images: DetectedImage[] = [];
    const pictureElements = document.querySelectorAll('picture');

    for (const picture of pictureElements) {
      const img = picture.querySelector('img');
      if (!img || !this.isVisible(img)) continue;

      // Get highest resolution source
      const sources = picture.querySelectorAll('source');
      let highResUrl: string | undefined;
      let maxWidth = 0;

      for (const source of sources) {
        const srcset = source.srcset;
        const parsed = this.parseSrcset(srcset);
        for (const { url, width } of parsed) {
          if (width > maxWidth) {
            maxWidth = width;
            highResUrl = url;
          }
        }
      }

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (!this.meetsMinSize(width, height)) continue;

      const imageUrl = img.currentSrc || img.src;
      if (!imageUrl || this.shouldExclude(imageUrl, img)) continue;

      images.push({
        element: img,
        imageUrl,
        highResUrl: highResUrl || this.findHighResVersion(img),
        width,
        height,
        alt: img.alt,
        sourceType: 'picture',
        boundingRect: img.getBoundingClientRect(),
      });
    }

    return images;
  }

  /**
   * Detect background images on elements
   */
  private detectBackgroundImages(): DetectedImage[] {
    const images: DetectedImage[] = [];
    const allElements = document.querySelectorAll('*');

    for (const element of allElements) {
      if (!(element instanceof HTMLElement)) continue;
      if (!this.isVisible(element)) continue;

      const style = window.getComputedStyle(element);
      const bgImage = style.backgroundImage;

      if (!bgImage || bgImage === 'none') continue;

      // Extract URL from background-image
      const match = bgImage.match(/url\(["']?(.+?)["']?\)/);
      if (!match) continue;

      const imageUrl = match[1];
      if (this.shouldExclude(imageUrl, element)) continue;

      const rect = element.getBoundingClientRect();
      if (!this.meetsMinSize(rect.width, rect.height)) continue;

      images.push({
        element,
        imageUrl,
        width: rect.width,
        height: rect.height,
        sourceType: 'background',
        boundingRect: rect,
      });
    }

    return images;
  }

  /**
   * Detect lazy-loaded images (data-src, etc.)
   */
  private detectLazyImages(): DetectedImage[] {
    const images: DetectedImage[] = [];
    const lazyAttrs = [
      'data-src',
      'data-lazy-src',
      'data-original',
      'data-srcset',
      'data-lazy',
      'data-bg',
      'data-background',
    ];

    for (const attr of lazyAttrs) {
      const elements = document.querySelectorAll(`[${attr}]`);

      for (const element of elements) {
        if (!(element instanceof HTMLElement)) continue;
        if (!this.isVisible(element)) continue;

        const imageUrl = element.getAttribute(attr);
        if (!imageUrl || this.shouldExclude(imageUrl, element)) continue;

        const rect = element.getBoundingClientRect();
        if (!this.meetsMinSize(rect.width, rect.height)) continue;

        images.push({
          element,
          imageUrl,
          width: rect.width,
          height: rect.height,
          alt: element.getAttribute('alt') || undefined,
          sourceType: 'lazy',
          boundingRect: rect,
        });
      }
    }

    return images;
  }

  /**
   * Check if element is visible
   */
  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    return true;
  }

  /**
   * Check if image meets minimum size requirements
   */
  private meetsMinSize(width: number, height: number): boolean {
    return width >= this.options.minWidth && height >= this.options.minHeight;
  }

  /**
   * Check if URL or element should be excluded
   */
  private shouldExclude(url: string, element: HTMLElement): boolean {
    // Check URL patterns
    for (const pattern of EXCLUDE_PATTERNS) {
      if (pattern.test(url)) return true;
    }

    // Check element classes
    const classes = element.className.toString().toLowerCase();
    if (/icon|logo|avatar|badge/.test(classes)) return true;

    // Check parent elements for exclusion patterns
    const parent = element.closest('[class*="nav"], [class*="header"], [class*="footer"], [class*="sidebar"]');
    if (parent) return true;

    return false;
  }

  /**
   * Find higher resolution version of an image
   */
  private findHighResVersion(img: HTMLImageElement): string | undefined {
    // Check srcset
    if (img.srcset) {
      const parsed = this.parseSrcset(img.srcset);
      const highest = parsed.sort((a, b) => b.width - a.width)[0];
      if (highest) return highest.url;
    }

    // Check for common high-res URL patterns
    const src = img.src;
    const highResPatterns = [
      { from: /_\d+x\d+/, to: '' },
      { from: /-\d+x\d+/, to: '' },
      { from: /\?.*$/, to: '' },
      { from: /\/w\d+\//, to: '/w2000/' },
      { from: /\bsmall\b/i, to: 'large' },
      { from: /\bthumb\b/i, to: 'full' },
      { from: /\bmedium\b/i, to: 'large' },
    ];

    for (const { from, to } of highResPatterns) {
      if (from.test(src)) {
        return src.replace(from, to);
      }
    }

    return undefined;
  }

  /**
   * Parse srcset attribute
   */
  private parseSrcset(srcset: string): Array<{ url: string; width: number }> {
    const entries = srcset.split(',').map((s) => s.trim());
    const result: Array<{ url: string; width: number }> = [];

    for (const entry of entries) {
      const parts = entry.split(/\s+/);
      if (parts.length >= 2) {
        const url = parts[0];
        const descriptor = parts[1];
        const widthMatch = descriptor.match(/(\d+)w/);
        if (widthMatch) {
          result.push({ url, width: parseInt(widthMatch[1], 10) });
        }
      }
    }

    return result;
  }

  /**
   * Remove duplicate images by URL
   */
  private deduplicateImages(images: DetectedImage[]): DetectedImage[] {
    const seen = new Set<string>();
    return images.filter((img) => {
      const key = img.highResUrl || img.imageUrl;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Filter and rank images by relevance
   */
  private filterAndRank(images: DetectedImage[]): DetectedImage[] {
    return images
      .filter((img) => {
        // Filter by aspect ratio
        const ratio = img.width / img.height;
        return ratio >= VALID_ASPECT_RATIOS.min && ratio <= VALID_ASPECT_RATIOS.max;
      })
      .sort((a, b) => {
        // Prefer larger images
        const areaA = a.width * a.height;
        const areaB = b.width * b.height;

        // Prefer images with alt text (likely product images)
        const altScoreA = a.alt ? 1000 : 0;
        const altScoreB = b.alt ? 1000 : 0;

        // Prefer images higher on the page
        const posScoreA = 10000 - a.boundingRect.top;
        const posScoreB = 10000 - b.boundingRect.top;

        const scoreA = areaA + altScoreA + posScoreA;
        const scoreB = areaB + altScoreB + posScoreB;

        return scoreB - scoreA;
      });
  }

  /**
   * Get the best image URL (prefer high-res)
   */
  getBestUrl(image: DetectedImage): string {
    return image.highResUrl || image.imageUrl;
  }
}

// Export singleton instance for convenience
export const imageDetector = new FurnitureImageDetector();
