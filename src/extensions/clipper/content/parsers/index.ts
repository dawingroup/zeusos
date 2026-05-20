/**
 * Parser Registry - manages site-specific parsers
 */

import type { SiteParser, ParserResult } from './types';
import { genericParser } from './generic';
import { wayfairParser } from './wayfair';
import { westElmParser } from './westelm';
import { pinterestParser } from './pinterest';
import { houzzParser } from './houzz';
import { workspaceParser } from './workspace';

class ParserRegistry {
  private parsers: SiteParser[] = [];

  constructor() {
    // Register parsers in priority order (specific first, generic last)
    this.register(workspaceParser);
    this.register(wayfairParser);
    this.register(westElmParser);
    this.register(pinterestParser);
    this.register(houzzParser);
    this.register(genericParser); // Fallback
  }

  /**
   * Register a new parser
   */
  register(parser: SiteParser): void {
    this.parsers.push(parser);
  }

  /**
   * Find the best parser for the current URL
   */
  getParser(url: string = window.location.href): SiteParser {
    for (const parser of this.parsers) {
      if (parser.canParse(url)) {
        return parser;
      }
    }
    return genericParser;
  }

  /**
   * Parse current page with the best matching parser
   */
  parse(url: string = window.location.href): ParserResult {
    const parser = this.getParser(url);
    
    try {
      const metadata = parser.extractMetadata();
      const imageUrls = parser.findProductImages();

      // Calculate confidence based on how much data we extracted
      let confidence = 0.5; // Base
      if (metadata.title) confidence += 0.1;
      if (metadata.price) confidence += 0.15;
      if (metadata.brand) confidence += 0.1;
      if (metadata.dimensions) confidence += 0.1;
      if (imageUrls.length > 0) confidence += 0.05;
      
      // Bonus for site-specific parser
      if (parser.name !== 'Generic') {
        confidence += 0.1;
      }

      return {
        metadata,
        imageUrls,
        confidence: Math.min(confidence, 1),
      };
    } catch (error) {
      console.error(`Parser ${parser.name} failed:`, error);
      
      // Fall back to generic
      return {
        metadata: genericParser.extractMetadata(),
        imageUrls: genericParser.findProductImages(),
        confidence: 0.3,
      };
    }
  }

  /**
   * Get list of all registered parsers
   */
  getRegisteredParsers(): string[] {
    return this.parsers.map((p) => p.name);
  }
}

export const parserRegistry = new ParserRegistry();
export { genericParser, wayfairParser, westElmParser, pinterestParser, houzzParser, workspaceParser };
export type { SiteParser, ParserResult };
