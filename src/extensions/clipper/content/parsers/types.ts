/**
 * Site Parser types
 */

import type { ExtractedMetadata } from '../../types/database';

export interface SiteParser {
  name: string;
  hostPatterns: RegExp[];
  canParse(url: string): boolean;
  extractMetadata(): ExtractedMetadata;
  findProductImages(): string[];
}

export interface ParserResult {
  metadata: ExtractedMetadata;
  imageUrls: string[];
  confidence: number;
}
