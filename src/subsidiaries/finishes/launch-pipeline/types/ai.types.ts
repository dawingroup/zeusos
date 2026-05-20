/**
 * AI Types
 * AI-powered naming and content generation types
 */

import { Timestamp } from 'firebase/firestore';

export interface NamingSession {
  id: string;
  productId: string;
  context: NamingContext;
  candidates: NameCandidate[];
  selectedName?: string;
  selectedAt?: Timestamp;
  feedback: NamingFeedback[];
  createdAt: Timestamp;
}

export interface NamingContext {
  category: string;
  dimensions?: string;
  materials: string[];
  features: string[];
  targetMarket?: string;
  collectionHint?: string;
}

export interface NameCandidate {
  name: string;
  handle: string;              // URL-friendly version
  rationale: string;
  scores: {
    brandFit: number;          // 0-100
    seoScore: number;          // 0-100
    uniqueness: number;        // 0-100
  };
  generatedAt: Timestamp;
}

export interface NamingFeedback {
  type: 'regenerate' | 'refine' | 'select';
  feedback?: string;
  timestamp: Timestamp;
}

export interface AIGeneratedContent {
  shortDescription: string;    // 50-100 words
  fullDescription: string;     // 300-500 words, HTML
  metaDescription: string;     // 155 chars max
  bulletPoints: string[];
  faqs: { question: string; answer: string }[];
  altTexts: { imageId: string; altText: string }[];
  generatedAt: Timestamp;
  modelVersion: string;
  editedByUser: boolean;
}

export interface ContentGenerationRequest {
  productId: string;
  product: {
    name: string;
    category: string;
    specifications: object;
    materials: string[];
    features: string[];
  };
  contentTypes: ('short' | 'full' | 'meta' | 'bullets' | 'faqs' | 'alt')[];
  tone?: 'professional' | 'casual' | 'luxury';
  targetAudience?: string;
}
