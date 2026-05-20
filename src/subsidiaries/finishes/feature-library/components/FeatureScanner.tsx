/**
 * Feature Scanner Component
 * Upload a photo of a jig/setup, analyze with Vision AI, and create a Feature
 */

import { useState, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { functions, db } from '@/shared/services/firebase';
import type { Asset, FeatureCategory } from '@/shared/types';

interface AnalysisResult {
  name: string;
  description: string;
  category: FeatureCategory;
  tags: string[];
  suggestedAssets: string[];
  estimatedMinutes: number;
  complexity: 'simple' | 'moderate' | 'complex';
  notes: string;
  confidence: number;
}

interface FeatureScannerProps {
  onFeatureCreated: (feature: {
    name: string;
    description: string;
    category: FeatureCategory;
    tags: string[];
    requiredAssetIds: string[];
    estimatedMinutes: number;
  }) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES: { value: FeatureCategory; label: string }[] = [
  { value: 'JOINERY', label: 'Joinery' },
  { value: 'EDGE_TREATMENT', label: 'Edge Treatment' },
  { value: 'DRILLING', label: 'Drilling' },
  { value: 'SHAPING', label: 'Shaping' },
  { value: 'ASSEMBLY', label: 'Assembly' },
  { value: 'FINISHING', label: 'Finishing' },
  { value: 'CUTTING', label: 'Cutting' },
  { value: 'SPECIALTY', label: 'Specialty' },
];

export function FeatureScanner({ onFeatureCreated, onCancel }: FeatureScannerProps) {
  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Form state (editable after analysis)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FeatureCategory>('SPECIALTY');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);
  const [notes, setNotes] = useState('');

  // Asset linking state
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load available assets
  useEffect(() => {
    async function loadAssets() {
      try {
        const q = query(collection(db, 'assets'), orderBy('brand'));
        const snapshot = await getDocs(q);
        const assets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Asset[];
        setAvailableAssets(assets);
      } catch (error) {
        console.error('Error loading assets:', error);
      } finally {
        setAssetsLoading(false);
      }
    }
    loadAssets();
  }, []);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAnalysisError('Please upload an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setAnalysisError('Image must be less than 10MB');
      return;
    }

    setAnalysisError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);
      
      // Extract base64 data (remove data:image/xxx;base64, prefix)
      const base64 = dataUrl.split(',')[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // Analyze image with Vision AI
  const handleAnalyze = async () => {
    if (!imageBase64) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const analyzeFeature = httpsCallable<
        { imageBase64: string; mimeType: string },
        AnalysisResult
      >(functions, 'analyzeFeatureFromAsset');

      const result = await analyzeFeature({
        imageBase64,
        mimeType: 'image/jpeg',
      });

      const data = result.data;
      setAnalysisResult(data);

      // Populate form with analysis results
      setName(data.name);
      setDescription(data.description);
      setCategory(data.category);
      setTags(data.tags);
      setEstimatedMinutes(data.estimatedMinutes);
      setNotes(data.notes);

      // Try to match suggested assets with available assets
      const matchedAssetIds = matchSuggestedAssets(data.suggestedAssets, availableAssets);
      setSelectedAssetIds(matchedAssetIds);

    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError(
        error instanceof Error ? error.message : 'Failed to analyze image. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Match suggested asset types to actual assets
  const matchSuggestedAssets = (suggested: string[], assets: Asset[]): string[] => {
    const matched: string[] = [];
    
    for (const suggestion of suggested) {
      const suggestionLower = suggestion.toLowerCase();
      
      // Find assets that match the suggestion
      for (const asset of assets) {
        const assetName = `${asset.brand} ${asset.model} ${asset.nickname || ''}`.toLowerCase();
        const categoryMatch = asset.category.toLowerCase().includes(suggestionLower.replace(/\s+/g, '_'));
        
        if (assetName.includes(suggestionLower) || categoryMatch) {
          if (!matched.includes(asset.id)) {
            matched.push(asset.id);
          }
        }
      }
    }
    
    return matched;
  };

  // Handle tag input
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // Handle asset selection
  const toggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId));
    } else {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      setAnalysisError('Please provide a feature name');
      return;
    }

    setIsSubmitting(true);

    try {
      await onFeatureCreated({
        name,
        description,
        category,
        tags,
        requiredAssetIds: selectedAssetIds,
        estimatedMinutes,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get display name for asset
  const getAssetDisplayName = (asset: Asset) => {
    return asset.nickname || `${asset.brand} ${asset.model}`;
  };

  return (
    <div className="space-y-6">
      {/* Image Upload Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">📷 Scan Jig or Setup</h3>
        
        <div className="flex flex-col md:flex-row gap-6">
          {/* Upload Area */}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Uploaded jig/setup"
                  className="w-full h-64 object-cover rounded-lg border border-gray-200"
                />
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setImageBase64(null);
                    setAnalysisResult(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-gray-600 font-medium">Click to upload photo</p>
                <p className="text-sm text-gray-400 mt-1">or drag and drop</p>
              </div>
            )}
          </div>

          {/* Analyze Button & Instructions */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-purple-900 mb-2">How it works</h4>
              <ol className="text-sm text-purple-700 space-y-1 list-decimal list-inside">
                <li>Upload a photo of your jig or setup</li>
                <li>AI analyzes and identifies the feature</li>
                <li>Review and edit the detected information</li>
                <li>Link to required assets from your registry</li>
              </ol>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!imageBase64 || isAnalyzing}
              className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analyze with AI
                </>
              )}
            </button>

            {analysisError && (
              <p className="mt-2 text-sm text-red-600">{analysisError}</p>
            )}

            {analysisResult && (
              <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Analysis complete ({Math.round(analysisResult.confidence * 100)}% confidence)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature Form (shown after analysis) */}
      {analysisResult && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Feature Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Feature Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeatureCategory)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Minutes
                </label>
                <input
                  type="number"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm bg-purple-100 text-purple-800"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1.5 text-purple-600 hover:text-purple-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add tag..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Add
                </button>
              </div>
            </div>

            {/* AI Notes */}
            {notes && (
              <div className="mt-4 p-3 bg-amber-50 rounded-md">
                <p className="text-sm text-amber-800">
                  <strong>AI Notes:</strong> {notes}
                </p>
              </div>
            )}
          </div>

          {/* Asset Linking - CRUCIAL */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-2">🔗 Link Required Assets</h3>
            <p className="text-sm text-gray-500 mb-4">
              Select the tools and machines needed to produce this feature. 
              The feature will be marked unavailable if any linked asset is down.
            </p>

            {assetsLoading ? (
              <div className="text-center py-4 text-gray-500">Loading assets...</div>
            ) : availableAssets.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No assets in registry. Add assets first.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableAssets.map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  const isOperational = asset.status === 'ACTIVE' || asset.status === 'CHECKED_OUT';
                  
                  return (
                    <label
                      key={asset.id}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                        ${isSelected 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'}
                        ${!isOperational ? 'opacity-60' : ''}
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAsset(asset.id)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {getAssetDisplayName(asset)}
                        </p>
                        <p className="text-xs text-gray-500">{asset.category.replace('_', ' ')}</p>
                      </div>
                      <span className={`
                        w-2 h-2 rounded-full
                        ${isOperational ? 'bg-green-500' : 'bg-red-500'}
                      `} />
                    </label>
                  );
                })}
              </div>
            )}

            {selectedAssetIds.length > 0 && (
              <p className="mt-3 text-sm text-gray-600">
                {selectedAssetIds.length} asset{selectedAssetIds.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name}
              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Feature'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
