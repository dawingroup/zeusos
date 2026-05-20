/**
 * Image Analysis AI Component
 * 
 * Analyzes reference images to extract design elements,
 * materials, colors, and manufacturing requirements.
 * Uses the new imageAnalysis Cloud Function.
 */

import { useState, useRef } from 'react';
import { 
  Image as ImageIcon, 
  Upload, 
  Loader2, 
  AlertCircle,
  Palette,
  Layers,
  Wrench,
  Package,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

interface IdentifiedItem {
  name: string;
  type: string;
  category: 'MANUFACTURED' | 'PROCURED';
  subcategory: string;
  estimatedDimensions?: { width: number; height: number; depth: number };
  materialGuess?: string;
  finishGuess?: string;
  confidence: number;
  featureLibraryMatches?: Array<{ featureId: string; featureName: string }>;
}

interface ImageAnalysisResult {
  identifiedItems: IdentifiedItem[];
  styleAnalysis: {
    primaryStyle: string;
    secondaryInfluences: string[];
    eraReferences?: string;
  };
  materials: Array<{
    type: string;
    finish: string;
    quality: string;
    location: string;
  }>;
  colorPalette: {
    dominant: string[];
    accent: string[];
    description: string;
  };
  manufacturingAnalysis: {
    joineryTypes: string[];
    edgeTreatments: string[];
    visibleHardware: string[];
    complexityScore: number;
    specialTechniques: string[];
  };
  deliverableSuggestions: Array<{
    name: string;
    itemType: string;
    category: string;
    description: string;
    estimatedComplexity: string;
  }>;
  overallConfidence: number;
  notes: string[];
}

interface AnalysisResponse {
  success: boolean;
  analysis: ImageAnalysisResult;
  summary: {
    itemsIdentified: number;
    primaryStyle: string;
    dominantColors: string[];
    complexityScore: number;
    overallConfidence: number;
  };
  usageMetadata: {
    responseTimeMs: number;
  };
}

export interface ImageAnalysisAIProps {
  projectId?: string;
  onAnalysisComplete?: (result: ImageAnalysisResult) => void;
  onItemSelect?: (item: IdentifiedItem) => void;
  className?: string;
}

export function ImageAnalysisAI({
  projectId,
  onAnalysisComplete,
  onItemSelect,
  className,
}: ImageAnalysisAIProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    setError(null);
    setImageMimeType(file.type);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      
      // Extract base64 without data URI prefix
      const base64 = dataUrl.split(',')[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageBase64) {
      setError('Please select an image first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/ai/image-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          imageMimeType,
          projectId,
          additionalPrompt: additionalPrompt || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data: AnalysisResponse = await response.json();
      setResult(data);
      if (data.analysis) {
        onAnalysisComplete?.(data.analysis);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      console.error('Image Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getComplexityColor = (score: number) => {
    if (score <= 3) return 'text-green-600 bg-green-100';
    if (score <= 6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-pink-500 to-orange-500 rounded-lg">
          <ImageIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Image Analysis AI</h3>
          <p className="text-sm text-gray-500">Extract design elements from reference images</p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="space-y-4">
        {!imagePreview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-1">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-gray-500">
              JPEG, PNG, WebP or GIF (max 10MB)
            </p>
          </div>
        ) : (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full max-h-64 object-contain rounded-lg border"
            />
            <button
              onClick={clearImage}
              className="absolute top-2 right-2 p-1 bg-gray-900/70 text-white rounded-full hover:bg-gray-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Additional Context */}
        {imagePreview && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Context (optional)
            </label>
            <input
              type="text"
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="e.g., 'Focus on the reception desk' or 'This is for a hotel lobby'"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={isAnalyzing}
            />
          </div>
        )}

        {/* Analyze Button */}
        {imagePreview && (
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-600 to-orange-600 text-white rounded-lg font-medium hover:from-pink-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Image...
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5" />
                Analyze Image
              </>
            )}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Results */}
      {result?.analysis && (
        <div className="space-y-4">
          {/* Summary Bar */}
          {result.summary && (
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{result.summary.itemsIdentified || 0}</div>
                <div className="text-xs text-gray-500">Items</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 capitalize">{result.summary.primaryStyle || 'Unknown'}</div>
                <div className="text-xs text-gray-500">Style</div>
              </div>
              <div className={cn('text-center px-3 py-1 rounded', getComplexityColor(result.summary.complexityScore || 5))}>
                <div className="text-lg font-bold">{result.summary.complexityScore || 5}/10</div>
                <div className="text-xs">Complexity</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{Math.round((result.summary.overallConfidence || 0.8) * 100)}%</div>
                <div className="text-xs text-gray-500">Confidence</div>
              </div>
            </div>
          )}

          {/* Color Palette */}
          {result.analysis.colorPalette?.dominant?.length > 0 && (
            <div className="p-4 bg-white border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-sm">Color Palette</span>
              </div>
              <div className="flex gap-2">
                {result.analysis.colorPalette.dominant.map((color, i) => (
                  <div key={i} className="text-center">
                    <div
                      className="w-10 h-10 rounded-lg border shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <div className="text-xs text-gray-500 mt-1">{color}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materials */}
          {result.analysis.materials?.length > 0 && (
            <div className="p-4 bg-white border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-sm">Materials Detected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.analysis.materials.map((mat, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm">
                    {mat.type} ({mat.finish})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Manufacturing */}
          {result.analysis.manufacturingAnalysis && (
            <div className="p-4 bg-white border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-sm">Manufacturing Requirements</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {result.analysis.manufacturingAnalysis.joineryTypes?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Joinery</div>
                    <div className="flex flex-wrap gap-1">
                      {result.analysis.manufacturingAnalysis.joineryTypes.map((j, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{j}</span>
                      ))}
                    </div>
                  </div>
                )}
                {result.analysis.manufacturingAnalysis.edgeTreatments?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Edge Treatments</div>
                    <div className="flex flex-wrap gap-1">
                      {result.analysis.manufacturingAnalysis.edgeTreatments.map((e, i) => (
                        <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{e}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Identified Items */}
          {result.analysis.identifiedItems?.length > 0 && (
            <div className="p-4 bg-white border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-sm">Identified Items</span>
              </div>
              <div className="space-y-2">
                {result.analysis.identifiedItems.map((item, i) => (
                  <div 
                    key={i}
                    onClick={() => onItemSelect?.(item)}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                  >
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.category} • {item.materialGuess || 'Unknown material'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {Math.round(item.confidence * 100)}% confidence
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageAnalysisAI;
