/**
 * Image Analysis Card Component
 * Displays structured analysis results from image processing
 */

import { Palette, Layers, Wrench, Sparkles } from 'lucide-react';
import type { ImageAnalysis } from './useDesignChat';

interface ImageAnalysisCardProps {
  analysis: ImageAnalysis;
}

export function ImageAnalysisCard({ analysis }: ImageAnalysisCardProps) {
  const hasContent = 
    analysis.styleElements.length > 0 ||
    analysis.detectedMaterials.length > 0 ||
    analysis.colorPalette.length > 0 ||
    analysis.suggestedFeatures.length > 0;

  if (!hasContent) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Image Analysis
      </h4>

      {/* Style Elements */}
      {analysis.styleElements.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
            <Layers className="w-3.5 h-3.5" />
            Style Elements
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.styleElements.map((style, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                {style}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Detected Materials */}
      {analysis.detectedMaterials.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
            <Wrench className="w-3.5 h-3.5" />
            Materials Detected
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.detectedMaterials.map((material, i) => (
              <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs">
                {material}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Color Palette */}
      {analysis.colorPalette.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
            <Palette className="w-3.5 h-3.5" />
            Color Palette
          </div>
          <div className="flex gap-2">
            {analysis.colorPalette.map((color, i) => (
              <div key={i} className="flex items-center gap-1">
                <div 
                  className="w-5 h-5 rounded-full border border-gray-200 shadow-sm"
                  style={{ backgroundColor: color }}
                  title={color}
                />
                <span className="text-xs text-gray-500 font-mono">{color}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Features */}
      {analysis.suggestedFeatures.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Suggested Features
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.suggestedFeatures.map((feature, i) => (
              <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
