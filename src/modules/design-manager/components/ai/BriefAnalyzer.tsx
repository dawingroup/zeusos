/**
 * Brief Analyzer Component
 * AI-powered design brief parsing
 */

import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import type { BriefAnalysisResult, ExtractedDesignItem, DesignCategory } from '../../types';

export interface BriefAnalyzerProps {
  projectId: string;
  onAnalysisComplete: (results: BriefAnalysisResult) => void;
  onApplyItem?: (item: ExtractedDesignItem) => void;
  className?: string;
}

const CATEGORY_LABELS: Record<DesignCategory, string> = {
  casework: 'Casework',
  furniture: 'Furniture',
  millwork: 'Millwork',
  doors: 'Doors',
  fixtures: 'Fixtures',
  specialty: 'Specialty',
  architectural: 'Architectural',
};

export function BriefAnalyzer({
  projectId,
  onAnalysisComplete,
  onApplyItem,
  className,
}: BriefAnalyzerProps) {
  const [briefText, setBriefText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<BriefAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!briefText.trim()) {
      setError('Please enter a design brief to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('https://api-okekivpl2a-uc.a.run.app/api/ai/analyze-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefText, projectId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze brief');
      }

      if (data.result) {
        setResults(data.result);
        onAnalysisComplete(data.result);
      } else {
        throw new Error('No results returned from analysis');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplexityBadge = (complexity: 'low' | 'medium' | 'high'): string => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };
    return colors[complexity];
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Input Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">AI Brief Analyzer</h3>
          <span className="text-xs text-gray-500">Powered by Claude</span>
        </div>
        
        <p className="text-sm text-gray-600">
          Paste your design brief below and let AI extract design items, dimensions, 
          materials, and requirements automatically.
        </p>

        <textarea
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          placeholder="Paste the design brief here...

Example:
The client requires a reception desk for their hotel lobby. The desk should be approximately 3m wide x 1.2m deep x 1.1m high. They prefer a walnut veneer finish with a white Corian countertop. Include cable management and a lockable storage cabinet."
          rows={8}
          className="w-full border rounded-lg px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-[#1d1d1f] focus:border-[#1d1d1f]"
          disabled={isAnalyzing}
        />

        <div className="flex items-center gap-4">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !briefText.trim()}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              isAnalyzing || !briefText.trim()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#1d1d1f] text-white hover:bg-[#424245]'
            )}
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              '🔍 Analyze Brief'
            )}
          </button>

          {briefText && (
            <button
              onClick={() => {
                setBriefText('');
                setResults(null);
                setError(null);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-6 border-t pt-6">
          <h4 className="font-medium text-gray-900">Analysis Results</h4>

          {/* Extracted Items */}
          {results.extractedItems.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">
                Extracted Design Items ({results.extractedItems.length})
              </h5>
              
              {results.extractedItems.map((item: ExtractedDesignItem, index: number) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h6 className="font-medium text-gray-900">{item.name}</h6>
                        <span className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          getComplexityBadge(item.estimatedComplexity)
                        )}>
                          {item.estimatedComplexity}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                      
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 bg-gray-100 rounded">
                          {CATEGORY_LABELS[item.category]}
                        </span>
                        
                        {item.dimensions.width && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                            {item.dimensions.width} × {item.dimensions.height || '?'} × {item.dimensions.depth || '?'} {item.dimensions.unit}
                          </span>
                        )}
                        
                        {item.suggestedMaterials.map((mat: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-amber-50 text-amber-700 rounded">
                            {mat}
                          </span>
                        ))}
                      </div>
                      
                      {item.specialRequirements.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          <strong>Special:</strong> {item.specialRequirements.join(', ')}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <span className={cn('text-sm font-medium', getConfidenceColor(item.confidence))}>
                        {Math.round(item.confidence * 100)}%
                      </span>
                      <p className="text-xs text-gray-500">confidence</p>
                      
                      {onApplyItem && (
                        <button
                          onClick={() => onApplyItem(item)}
                          className="mt-2 px-3 py-1 text-xs font-medium text-[#1d1d1f] border border-[#1d1d1f] rounded hover:bg-[#1d1d1f]/10"
                        >
                          Create Item
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ambiguities */}
          {results.ambiguities.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h5 className="text-sm font-medium text-yellow-800 mb-2">
                ⚠️ Clarification Needed
              </h5>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                {results.ambiguities.map((amb: string, i: number) => (
                  <li key={i}>{amb}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Client Preferences */}
          {results.clientPreferences.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-sm font-medium text-blue-800 mb-2">
                📋 Client Preferences
              </h5>
              <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                {results.clientPreferences.map((pref: string, i: number) => (
                  <li key={i}>{pref}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Project Notes */}
          {results.projectNotes && (
            <div className="p-4 bg-gray-50 border rounded-lg">
              <h5 className="text-sm font-medium text-gray-700 mb-2">
                📝 Project Notes
              </h5>
              <p className="text-sm text-gray-600">{results.projectNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BriefAnalyzer;
