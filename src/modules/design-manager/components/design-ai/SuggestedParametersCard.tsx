/**
 * Suggested Parameters Card Component
 * Displays AI-suggested parameters with option to save to design item
 */

import { useState } from 'react';
import { Save, Check, ChevronDown, ChevronUp, Sparkles, AlertCircle } from 'lucide-react';
import type { SuggestedParameters } from './useDesignChat';

interface SuggestedParametersCardProps {
  parameters: SuggestedParameters;
  onSave?: (parameters: SuggestedParameters) => Promise<void>;
  isSaving?: boolean;
}

export function SuggestedParametersCard({ 
  parameters, 
  onSave,
  isSaving = false 
}: SuggestedParametersCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (onSave && !saved) {
      await onSave(parameters);
      setSaved(true);
    }
  };

  const hasContent = 
    parameters.description ||
    parameters.dimensions ||
    parameters.primaryMaterial ||
    parameters.finish ||
    parameters.hardware?.length ||
    parameters.constructionMethod ||
    parameters.joineryTypes?.length ||
    parameters.awiGrade ||
    parameters.specialRequirements?.length;

  if (!hasContent) return null;

  const confidenceColor = parameters.confidence 
    ? parameters.confidence >= 0.8 ? 'text-green-600' 
      : parameters.confidence >= 0.6 ? 'text-amber-600' 
      : 'text-red-600'
    : 'text-gray-500';

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900"
        >
          <Sparkles className="w-4 h-4" />
          Suggested Parameters
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        <div className="flex items-center gap-2">
          {parameters.confidence && (
            <span className={`text-xs ${confidenceColor}`}>
              {Math.round(parameters.confidence * 100)}% confidence
            </span>
          )}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={isSaving || saved}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                saved 
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Saved
                </>
              ) : isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save to Item
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="space-y-3 pt-2">
          {/* Description */}
          {parameters.description && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Description</div>
              <p className="text-sm text-gray-700 bg-white/50 rounded-lg px-3 py-2">
                {parameters.description}
              </p>
            </div>
          )}

          {/* Dimensions */}
          {parameters.dimensions && (parameters.dimensions.width || parameters.dimensions.height || parameters.dimensions.depth) && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Dimensions</div>
              <div className="flex flex-wrap gap-2">
                {parameters.dimensions.width && (
                  <span className="px-2 py-1 bg-white/70 rounded-md text-xs">
                    W: {parameters.dimensions.width}{parameters.dimensions.unit}
                  </span>
                )}
                {parameters.dimensions.height && (
                  <span className="px-2 py-1 bg-white/70 rounded-md text-xs">
                    H: {parameters.dimensions.height}{parameters.dimensions.unit}
                  </span>
                )}
                {parameters.dimensions.depth && (
                  <span className="px-2 py-1 bg-white/70 rounded-md text-xs">
                    D: {parameters.dimensions.depth}{parameters.dimensions.unit}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Primary Material */}
          {parameters.primaryMaterial && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Primary Material</div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-xs">
                  {parameters.primaryMaterial.name}
                </span>
                {parameters.primaryMaterial.thickness && (
                  <span className="px-2 py-1 bg-white/70 rounded-md text-xs">
                    {parameters.primaryMaterial.thickness}mm
                  </span>
                )}
                <span className="px-2 py-1 bg-white/70 rounded-md text-xs capitalize">
                  {parameters.primaryMaterial.type}
                </span>
              </div>
            </div>
          )}

          {/* Finish */}
          {parameters.finish && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Finish</div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs capitalize">
                  {parameters.finish.type}
                </span>
                {parameters.finish.color && (
                  <span className="px-2 py-1 bg-white/70 rounded-md text-xs flex items-center gap-1">
                    <div 
                      className="w-3 h-3 rounded-full border border-gray-200" 
                      style={{ backgroundColor: parameters.finish.color.startsWith('#') ? parameters.finish.color : undefined }}
                    />
                    {parameters.finish.color}
                  </span>
                )}
                {parameters.finish.sheen && (
                  <span className="px-2 py-1 bg-white/70 rounded-md text-xs capitalize">
                    {parameters.finish.sheen}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Hardware */}
          {parameters.hardware && parameters.hardware.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Hardware</div>
              <div className="flex flex-wrap gap-2">
                {parameters.hardware.map((hw, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                    {hw.quantity}x {hw.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Construction & Joinery */}
          <div className="flex flex-wrap gap-4">
            {parameters.constructionMethod && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Construction</div>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs capitalize">
                  {parameters.constructionMethod.replace('-', ' ')}
                </span>
              </div>
            )}
            {parameters.awiGrade && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">AWI Grade</div>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-xs capitalize">
                  {parameters.awiGrade}
                </span>
              </div>
            )}
          </div>

          {/* Joinery Types */}
          {parameters.joineryTypes && parameters.joineryTypes.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Joinery</div>
              <div className="flex flex-wrap gap-1.5">
                {parameters.joineryTypes.map((joinery, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white/70 rounded-full text-xs capitalize">
                    {joinery.replace('-', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Special Requirements */}
          {parameters.specialRequirements && parameters.specialRequirements.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Special Requirements
              </div>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                {parameters.specialRequirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Reasoning */}
          {parameters.reasoning && (
            <div className="pt-2 border-t border-purple-200">
              <p className="text-xs text-gray-500 italic">
                💡 {parameters.reasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
