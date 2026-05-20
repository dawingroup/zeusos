/**
 * Asset Capabilities Modal
 * Analyzes an asset with AI and shows suggested features it can produce
 */

import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { X, Sparkles, Check, Plus, Loader2 } from 'lucide-react';
import type { Asset, FeatureCategory } from '@/shared/types';

interface SuggestedFeature {
  name: string;
  description: string;
  category: FeatureCategory;
  tags: string[];
  estimatedMinutes: number;
  complexity: 'simple' | 'moderate' | 'complex';
  sourceAssetId: string;
  sourceAssetName: string;
}

interface AnalysisResult {
  asset: {
    id: string;
    name: string;
    brand: string;
    model: string;
  };
  suggestedFeatures: SuggestedFeature[];
  analyzedAt: string;
}

interface AssetCapabilitiesModalProps {
  asset: Asset;
  onClose: () => void;
  onFeaturesCreated?: (count: number) => void;
}

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  JOINERY: 'Joinery',
  EDGE_TREATMENT: 'Edge Treatment',
  DRILLING: 'Drilling',
  SHAPING: 'Shaping',
  ASSEMBLY: 'Assembly',
  FINISHING: 'Finishing',
  CUTTING: 'Cutting',
  SPECIALTY: 'Specialty',
};

const COMPLEXITY_COLORS = {
  simple: 'bg-green-100 text-green-800',
  moderate: 'bg-amber-100 text-amber-800',
  complex: 'bg-red-100 text-red-800',
};

export function AssetCapabilitiesModal({ asset, onClose, onFeaturesCreated }: AssetCapabilitiesModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<number>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  // Analyze asset capabilities
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/analyze-asset-capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze asset');
      }

      const result = await response.json();
      setAnalysisResult(result.data);
      
      // Select all features by default
      setSelectedFeatures(new Set(result.data.suggestedFeatures.map((_: SuggestedFeature, i: number) => i)));
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze asset. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle feature selection
  const toggleFeature = (index: number) => {
    const newSelected = new Set(selectedFeatures);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFeatures(newSelected);
  };

  // Map AI category to featureLibrary category
  const mapCategory = (aiCategory: string): string => {
    const mapping: Record<string, string> = {
      'JOINERY': 'joinery',
      'EDGE_TREATMENT': 'finishing',
      'DRILLING': 'hardware',
      'SHAPING': 'carving',
      'ASSEMBLY': 'hardware',
      'FINISHING': 'finishing',
      'CUTTING': 'joinery',
      'SPECIALTY': 'joinery',
    };
    return mapping[aiCategory] || 'joinery';
  };

  // Create selected features
  const handleCreateFeatures = async () => {
    if (!analysisResult || selectedFeatures.size === 0) return;

    setIsCreating(true);
    setError(null);

    try {
      const featuresToCreate = analysisResult.suggestedFeatures.filter((_, i) => selectedFeatures.has(i));
      let created = 0;

      for (const feature of featuresToCreate) {
        const category = mapCategory(feature.category);
        const hours = (feature.estimatedMinutes || 15) / 60;
        
        // Generate a simple code
        const code = `AI-${Date.now().toString(36).toUpperCase().slice(-4)}`;
        
        // Save to featureLibrary collection with correct schema
        await addDoc(collection(db, 'featureLibrary'), {
          code,
          name: feature.name,
          description: feature.description || '',
          category,
          tags: feature.tags || [],
          processSteps: [],
          estimatedTime: {
            minimum: hours * 0.5,
            typical: hours,
            maximum: hours * 1.5,
            unit: 'hours',
          },
          costFactors: {
            laborIntensity: feature.complexity === 'complex' ? 'high' : feature.complexity === 'moderate' ? 'medium' : 'low',
            wastePercent: 10,
            toolingRequired: true,
            skillLevel: feature.complexity === 'complex' ? 'master' : feature.complexity === 'moderate' ? 'journeyman' : 'apprentice',
            setupTime: 15,
          },
          requiredEquipment: [asset.nickname || `${asset.brand} ${asset.model}`],
          qualityGrade: 'custom',
          status: 'active',
          usageCount: 0,
          images: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: 'ai-analysis',
          _sourceAsset: {
            assetId: asset.id,
            assetName: asset.nickname || `${asset.brand} ${asset.model}`,
            analyzedAt: analysisResult.analyzedAt,
          },
        });
        created++;
      }

      setCreatedCount(created);
      onFeaturesCreated?.(created);
      
      // Clear selection after creating
      setSelectedFeatures(new Set());
    } catch (err) {
      console.error('Error creating features:', err);
      setError(err instanceof Error ? err.message : 'Failed to create features');
    } finally {
      setIsCreating(false);
    }
  };

  const assetDisplayName = asset.nickname || `${asset.brand} ${asset.model}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3 text-white">
            <Sparkles className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-semibold">Analyze Capabilities</h2>
              <p className="text-sm text-purple-100">{assetDisplayName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Initial State - Not Analyzed Yet */}
          {!analysisResult && !isAnalyzing && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Discover What This Asset Can Do
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                AI will analyze <strong>{assetDisplayName}</strong> and suggest manufacturing 
                features it can produce. These features will be linked to this asset in the Feature Library.
              </p>
              <button
                onClick={handleAnalyze}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Analyze with AI
              </button>
            </div>
          )}

          {/* Analyzing State */}
          {isAnalyzing && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Analyzing {assetDisplayName}...</p>
              <p className="text-sm text-gray-400 mt-1">This may take a few seconds</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {createdCount > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <p className="text-green-700">
                Created {createdCount} feature{createdCount > 1 ? 's' : ''} linked to this asset!
              </p>
            </div>
          )}

          {/* Results */}
          {analysisResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Suggested Features ({analysisResult.suggestedFeatures.length})
                </h3>
                <div className="text-sm text-gray-500">
                  {selectedFeatures.size} selected
                </div>
              </div>

              <div className="space-y-3">
                {analysisResult.suggestedFeatures.map((feature, index) => {
                  const isSelected = selectedFeatures.has(index);
                  return (
                    <div
                      key={index}
                      onClick={() => toggleFeature(index)}
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${isSelected 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                          ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}
                        `}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-gray-900">{feature.name}</h4>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              {CATEGORY_LABELS[feature.category] || feature.category}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded ${COMPLEXITY_COLORS[feature.complexity]}`}>
                              {feature.complexity}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                          
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>~{feature.estimatedMinutes} min</span>
                            <div className="flex gap-1">
                              {feature.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 bg-gray-100 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {createdCount > 0 ? 'Done' : 'Cancel'}
          </button>
          
          {analysisResult && selectedFeatures.size > 0 && (
            <button
              onClick={handleCreateFeatures}
              disabled={isCreating}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create {selectedFeatures.size} Feature{selectedFeatures.size > 1 ? 's' : ''}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
