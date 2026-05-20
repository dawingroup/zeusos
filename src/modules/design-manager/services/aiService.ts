/**
 * AI Service Wrapper
 * Integrates with AI tools for document analysis:
 * - Project Scoping AI (design brief parsing)
 * - Image Analysis AI (reference image analysis)
 * - Design Item Enhancement AI (spec enrichment)
 */

import type {
  AIAnalysisType,
  ImageAnalysisResult,
  ProjectScopingResult,
} from '../types/document.types';
import { auth } from '@/shared/services/firebase/auth';

// API endpoint for AI functions
const AI_API_ENDPOINT = 'https://api-okekivpl2a-uc.a.run.app/api/ai';

/**
 * Get authentication headers for API requests
 * Returns headers with Bearer token if user is authenticated
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('Failed to get auth token:', error);
    }
  }

  return headers;
}

/**
 * AI analysis response wrapper
 */
export interface AIAnalysisResponse<T> {
  success: boolean;
  data: T;
  confidence: number;
  error?: string;
}

/**
 * Analyze a document using the appropriate AI tool
 */
export async function analyzeDocument(
  analysisType: AIAnalysisType,
  fileUrl: string,
  _mimeType: string
): Promise<AIAnalysisResponse<ImageAnalysisResult | ProjectScopingResult>> {
  switch (analysisType) {
    case 'image-analysis':
      return analyzeImage(fileUrl);
    case 'project-scoping':
      return analyzeProjectBrief(fileUrl);
    default:
      throw new Error(`Unknown analysis type: ${analysisType}`);
  }
}

/**
 * Image Analysis AI
 * Analyzes reference images to extract design items, style, materials, and manufacturing notes
 */
export async function analyzeImage(imageUrl: string): Promise<AIAnalysisResponse<ImageAnalysisResult>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${AI_API_ENDPOINT}/analyze-image`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        imageUrl,
        extractItems: true,
        analyzeStyle: true,
        analyzeMaterials: true,
        analyzeManufacturing: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Image analysis failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Parse response into ImageAnalysisResult format
    const parsedResult: ImageAnalysisResult = {
      extractedItems: result.items || [],
      styleAnalysis: result.styleAnalysis || {
        primaryStyle: 'Unknown',
        secondaryStyles: [],
        aestheticNotes: [],
        colorPalette: [],
        designApproach: [],
      },
      materialRecommendations: result.materials || [],
      manufacturingNotes: result.manufacturing || {
        suitableForCNC: false,
        complexityLevel: 3,
      },
      featureLibraryMatches: result.featureMatches || [],
      confidence: result.confidence || 0.5,
    };

    return {
      success: true,
      data: parsedResult,
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    console.error('Image analysis error:', error);
    return {
      success: false,
      data: {} as ImageAnalysisResult,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Project Scoping AI
 * Analyzes design briefs to extract design items with multiplier detection
 */
export async function analyzeProjectBrief(
  pdfUrl: string
): Promise<AIAnalysisResponse<ProjectScopingResult>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${AI_API_ENDPOINT}/analyze-brief`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        briefUrl: pdfUrl,
        detectMultipliers: true,
        extractDeliverables: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Brief analysis failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Parse response into ProjectScopingResult format
    const parsedResult: ProjectScopingResult = {
      extractedItems: result.items || [],
      multiplierDetected: result.multiplierDetected || false,
      deliverables: result.deliverables || [],
      projectNotes: result.notes,
      ambiguities: result.ambiguities || [],
      confidence: result.confidence || 0.5,
    };

    return {
      success: true,
      data: parsedResult,
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    console.error('Brief analysis error:', error);
    return {
      success: false,
      data: {} as ProjectScopingResult,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Design Item Enhancement AI
 * Enriches a design item with specifications, DfM validation, and supplier recommendations
 */
export async function enhanceDesignItem(item: {
  name: string;
  category: string;
  dimensions?: {
    width: number | null;
    height: number | null;
    depth: number | null;
  };
}): Promise<AIAnalysisResponse<any>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${AI_API_ENDPOINT}/enhance-design-item`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        item,
        includeDfM: true,
        includeSuppliers: true,
        includeMaterialAlternatives: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Design item enhancement failed: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      success: true,
      data: result,
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error('Design item enhancement error:', error);
    return {
      success: false,
      data: {},
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Poll for AI analysis completion
 * Used when AI analysis is running asynchronously
 */
export async function pollForAICompletion(
  checkStatus: () => Promise<'pending' | 'running' | 'completed' | 'failed' | 'none'>,
  maxAttempts = 30,
  baseDelay = 1000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkStatus();

    if (status === 'completed' || status === 'failed') {
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error('AI analysis timed out');
}

/**
 * Generate strategy report content using AI
 * Called from strategyReportService for report regeneration
 */
export async function generateStrategyReportContent(inputParams: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${AI_API_ENDPOINT}/generate-strategy-report`, {
      method: 'POST',
      headers,
      body: JSON.stringify(inputParams),
    });

    if (!response.ok) {
      throw new Error(`Strategy report generation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Strategy report generation error:', error);
    throw error;
  }
}

/**
 * Extract text from PDF (for Project Scoping AI)
 */
export async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${AI_API_ENDPOINT}/extract-pdf-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pdfUrl }),
    });

    if (!response.ok) {
      throw new Error(`PDF text extraction failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.text || '';
  } catch (error) {
    console.error('PDF text extraction error:', error);
    throw error;
  }
}
