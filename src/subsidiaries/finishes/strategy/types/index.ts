/**
 * Strategy Module Types
 * Type definitions for strategy reports and AI-generated content
 */

export interface Trend {
  name: string;
  description: string;
  relevanceScore: number;
  source: string;
}

export interface MatchedFeature {
  featureId: string;
  featureName: string;
  rationale: string;
  requiredAssets?: {
    id: string;
    name: string;
    status: string;
  }[];
}

export interface Recommendation {
  title: string;
  description: string;
  trendName: string;
  matchedFeatures: MatchedFeature[];
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDays: number;
  priority: 'high' | 'medium' | 'low';
}

export interface MaterialPalette {
  material: string;
  application: string;
  finish: string;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  description: string;
}

export interface ProductionFeasibility {
  overallScore: number;
  notes: string;
  requiredFeatures: string[];
  estimatedTotalDays: number;
}

export interface ProductionDetail {
  featureId: string;
  featureName: string;
  category: string;
  estimatedMinutes: number;
  requiredAssets: {
    id: string;
    name: string;
    status: string;
  }[];
}

export interface StrategyMetadata {
  generatedAt: string;
  projectName: string;
  projectType: string;
  location: string;
  year: number;
  totalAvailableFeatures: number;
  featuresProposed: number;
}

export interface StrategyReport {
  reportTitle: string;
  generatedAt: string;
  executiveSummary: string;
  trends: Trend[];
  recommendations: Recommendation[];
  materialPalette: MaterialPalette[];
  colorScheme: ColorScheme;
  productionFeasibility: ProductionFeasibility;
  productionDetails: ProductionDetail[];
  nextSteps: string[];
  metadata: StrategyMetadata;
}

export interface ResearchFindingInput {
  title: string;
  content: string;
  category: string;
}

export interface GenerateStrategyInput {
  projectName: string;
  projectType?: string;
  clientBrief: string;
  location?: string;
  year?: number;
  // Enhanced inputs for better AI research
  constraints?: string[];
  painPoints?: string[];
  goals?: string[];
  budgetTier?: string;
  spaceDetails?: string;
  researchFindings?: ResearchFindingInput[];
  researchExcerpts?: string[];
  // Project Scoping AI output
  scopingContext?: {
    deliverables?: Array<{
      name: string;
      category: string;
      quantity: number;
      roomType?: string;
    }>;
    summary?: {
      totalDeliverables: number;
      totalUnits: number;
      byCategory: Record<string, number>;
      estimatedTotalHours: number;
    };
    entities?: {
      projectType?: string;
      location?: string;
      roomGroups?: Array<{ type: string; quantity: number }>;
    };
    trendInsights?: string[];
  };
}
