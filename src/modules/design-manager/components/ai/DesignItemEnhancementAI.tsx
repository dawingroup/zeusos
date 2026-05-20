/**
 * Design Item Enhancement AI Component
 * 
 * Refines individual deliverables with:
 * - Specification inference (dimensions, materials, finishes)
 * - DfM validation
 * - Supplier discovery for procurement items
 * - Alternative generation
 * 
 * Uses the designItemEnhancement Cloud Function.
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wrench,
  ShoppingCart,
  Ruler,
  Palette,
  History,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  getOrCreateConversation,
  addConversationMessage,
} from '@/shared/services/ai/aiMemory.service';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

interface EnhancementResult {
  id: string;
  name: string;
  itemType: string;
  category: string;
  quantity: number;
  specifications: {
    dimensions?: { width: number; height: number; depth: number };
    material?: { type: string; thickness: number };
    finish?: { type: string; sheen: string };
    hardware?: Array<{ type: string; quantity: number }>;
    estimatedHours?: number;
  };
  dfmValidation: {
    passed: boolean;
    issues: Array<{
      severity: string;
      rule: string;
      description: string;
      suggestedFix: string;
    }>;
  };
  manufacturing?: {
    featureLibraryMatches: Array<{ featureId: string; featureName: string }>;
    capabilityVerified: boolean;
    estimatedHoursPerUnit: number;
    estimatedTotalHours: number;
  };
  procurement?: {
    supplierOptions: Array<{
      supplier: string;
      platform: string;
      unitPriceUsd: number;
      totalLeadTime: number;
    }>;
    recommendedSupplier?: {
      supplier: string;
      unitPriceUsd: number;
    };
  };
  aiEnhancement?: {
    refinements: string[];
    materialAlternatives: Array<{ original: string; alternative: string; costDiff: string }>;
    qualityGrade: string;
    estimatedCostRange: { min: number; max: number; currency: string };
  };
  aiMetadata: {
    confidenceScore: number;
    enhancedAt: string;
  };
}

export interface DesignItemEnhancementAIProps {
  designItem: {
    id: string;
    name: string;
    itemType?: string;
    sourcingType?: 'MANUFACTURED' | 'PROCURED';
    quantity?: number;
  };
  projectId?: string;
  projectContext?: {
    projectType?: string;
    budgetTier?: string;
    location?: string;
  };
  userId?: string;
  companyId?: string;
  onEnhancementComplete?: (result: EnhancementResult) => void;
  className?: string;
}

export function DesignItemEnhancementAI({
  designItem,
  projectId,
  projectContext,
  userId,
  companyId,
  onEnhancementComplete,
  className,
}: DesignItemEnhancementAIProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [result, setResult] = useState<EnhancementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [previousEnhancements, setPreviousEnhancements] = useState<Array<{ timestamp: Date; summary: string }>>([]);
  const [expandedSections, setExpandedSections] = useState({
    specs: true,
    dfm: false,
    suppliers: false,
    alternatives: false,
  });
  const chatInitialized = useRef(false);

  // Initialize chat history
  useEffect(() => {
    if (!designItem.id || !userId || chatInitialized.current) return;
    
    const initChat = async () => {
      try {
        const conv = await getOrCreateConversation({
          module: 'design_enhancement',
          title: `Enhancement - ${designItem.name}`,
          designItemId: designItem.id,
          projectId,
        }, companyId || 'default', userId);
        
        setChatId(conv.id);
        chatInitialized.current = true;
        
        // Load previous enhancement summaries
        if (conv.messages.length > 0) {
          const enhancements = conv.messages
            .filter(m => m.role === 'assistant')
            .map(m => ({
              timestamp: m.timestamp,
              summary: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
            }));
          setPreviousEnhancements(enhancements);
        }
      } catch (err) {
        // Chat history is optional - don't break the UI if it fails
        console.warn('Chat history unavailable:', err);
        chatInitialized.current = true; // Prevent retries
      }
    };
    
    initChat();
  }, [designItem.id, designItem.name, projectId, userId, companyId]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleEnhance = async () => {
    setIsEnhancing(true);
    setError(null);
    setResult(null);

    // Persist user request to chat history
    if (chatId) {
      try {
        await addConversationMessage(chatId, {
          role: 'user',
          content: `Enhance design item: ${designItem.name} (${designItem.sourcingType || 'MANUFACTURED'})`,
        });
      } catch (err) {
        console.warn('Failed to persist user message:', err);
      }
    }

    try {
      const response = await fetch(`${API_BASE}/ai/design-item-enhancement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliverable: {
            id: designItem.id,
            name: designItem.name,
            itemType: designItem.itemType || designItem.name.toLowerCase().replace(/\s+/g, '_'),
            category: designItem.sourcingType || 'MANUFACTURED',
            quantity: designItem.quantity || 1,
          },
          projectContext,
          companyId,
          includeSuppliers: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Enhancement failed');
      }

      const data: EnhancementResult = await response.json();
      setResult(data);
      onEnhancementComplete?.(data);

      // Persist AI response to chat history
      if (chatId) {
        try {
          const summary = `Enhanced ${data.name}: ${data.specifications?.dimensions ? `${data.specifications.dimensions.width}x${data.specifications.dimensions.height}x${data.specifications.dimensions.depth}mm` : 'N/A'}, Material: ${data.specifications?.material?.type || 'N/A'}, DfM: ${data.dfmValidation?.passed ? 'Passed' : 'Issues found'}`;
          await addConversationMessage(chatId, {
            role: 'assistant',
            content: summary,
            metadata: data as any,
          });
        } catch (err) {
          console.warn('Failed to persist assistant message:', err);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Enhancement failed';
      setError(errorMessage);
      console.error('Enhancement error:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h4 className="font-medium text-gray-900">AI Enhancement</h4>
        </div>
        <button
          onClick={handleEnhance}
          disabled={isEnhancing}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEnhancing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enhancing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Enhance Item
            </>
          )}
        </button>
      </div>

      {/* Previous Enhancements */}
      {previousEnhancements.length > 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Previous Enhancements</span>
          </div>
          <div className="space-y-1">
            {previousEnhancements.slice(-3).map((enh, idx) => (
              <div key={idx} className="text-xs text-gray-600">
                <span className="text-gray-400">{enh.timestamp.toLocaleDateString()}</span>
                {' - '}
                {enh.summary}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Confidence Score */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium">Enhancement Complete</span>
            {result.aiMetadata && (
              <span className={cn(
                'ml-auto px-2 py-1 rounded text-xs font-medium',
                (result.aiMetadata.confidenceScore || 0.8) >= 0.8 ? 'bg-green-100 text-green-700' :
                (result.aiMetadata.confidenceScore || 0.8) >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              )}>
                {Math.round((result.aiMetadata.confidenceScore || 0.85) * 100)}% confidence
              </span>
            )}
          </div>

          {/* Specifications */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('specs')}
            >
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-sm">Specifications</span>
              </div>
              {expandedSections.specs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            {expandedSections.specs && result.specifications && (
              <div className="px-3 pb-3 border-t">
                <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                  {result.specifications.dimensions && (
                    <div>
                      <span className="text-gray-500">Dimensions</span>
                      <p className="font-medium">
                        {result.specifications.dimensions.width} × {result.specifications.dimensions.height} × {result.specifications.dimensions.depth} mm
                      </p>
                    </div>
                  )}
                  {result.specifications.material && (
                    <div>
                      <span className="text-gray-500">Material</span>
                      <p className="font-medium">{result.specifications.material.type}, {result.specifications.material.thickness}mm</p>
                    </div>
                  )}
                  {result.specifications.finish && (
                    <div>
                      <span className="text-gray-500">Finish</span>
                      <p className="font-medium">{result.specifications.finish.type} ({result.specifications.finish.sheen})</p>
                    </div>
                  )}
                  {result.specifications.estimatedHours && (
                    <div>
                      <span className="text-gray-500">Est. Hours/Unit</span>
                      <p className="font-medium">{result.specifications.estimatedHours} hrs</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* DfM Validation */}
          {result.dfmValidation && (
            <div className="border rounded-lg">
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSection('dfm')}
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-sm">DfM Validation</span>
                  {result.dfmValidation.passed ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Passed</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                      {result.dfmValidation.issues?.length || 0} issues
                    </span>
                  )}
                </div>
                {expandedSections.dfm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
              {expandedSections.dfm && (
                <div className="px-3 pb-3 border-t">
                  {!result.dfmValidation.issues?.length ? (
                    <p className="text-sm text-green-600 mt-3">All DfM checks passed!</p>
                  ) : (
                    <div className="space-y-2 mt-3">
                      {result.dfmValidation.issues.map((issue, i) => (
                        <div key={i} className={cn('p-2 rounded border text-sm', getSeverityColor(issue.severity))}>
                          <p className="font-medium">{issue.description}</p>
                          <p className="text-xs mt-1 opacity-80">Fix: {issue.suggestedFix}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Suppliers (for PROCURED items) */}
          {(result.procurement?.supplierOptions?.length ?? 0) > 0 && (
            <div className="border rounded-lg">
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSection('suppliers')}
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-sm">Supplier Options</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                    {result.procurement?.supplierOptions?.length ?? 0} found
                  </span>
                </div>
                {expandedSections.suppliers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
              {expandedSections.suppliers && result.procurement?.supplierOptions && (
                <div className="px-3 pb-3 border-t">
                  <div className="space-y-2 mt-3">
                    {result.procurement.supplierOptions.map((supplier, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div>
                          <p className="font-medium">{supplier.supplier}</p>
                          <p className="text-xs text-gray-500">{supplier.platform} • {supplier.totalLeadTime} days</p>
                        </div>
                        <span className="font-medium text-green-600">${supplier.unitPriceUsd}/unit</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Material Alternatives */}
          {result.aiEnhancement?.materialAlternatives && result.aiEnhancement.materialAlternatives.length > 0 && (
            <div className="border rounded-lg">
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSection('alternatives')}
              >
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-sm">Material Alternatives</span>
                </div>
                {expandedSections.alternatives ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
              {expandedSections.alternatives && (
                <div className="px-3 pb-3 border-t">
                  <div className="space-y-2 mt-3">
                    {result.aiEnhancement.materialAlternatives.map((alt, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div>
                          <span className="text-gray-500">{alt.original}</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium">{alt.alternative}</span>
                        </div>
                        <span className={cn(
                          'font-medium',
                          alt.costDiff?.startsWith('-') ? 'text-green-600' : 'text-amber-600'
                        )}>
                          {alt.costDiff}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cost Estimate */}
          {result.aiEnhancement?.estimatedCostRange && 
           result.aiEnhancement.estimatedCostRange.min != null && 
           result.aiEnhancement.estimatedCostRange.max != null && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">Estimated Cost Range</span>
                <span className="font-bold text-green-700">
                  ${Number(result.aiEnhancement.estimatedCostRange.min).toLocaleString()} - ${Number(result.aiEnhancement.estimatedCostRange.max).toLocaleString()}
                </span>
              </div>
              {result.aiEnhancement.qualityGrade && (
                <p className="text-xs text-green-600 mt-1">
                  AWI Grade: {result.aiEnhancement.qualityGrade.toUpperCase()}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DesignItemEnhancementAI;
