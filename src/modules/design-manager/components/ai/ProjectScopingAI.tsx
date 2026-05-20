/**
 * Project Scoping AI Component
 * 
 * Unified AI that combines brief analysis with strategy research.
 * Extracts deliverables from natural language briefs with multiplier detection.
 * Uses the new projectScoping Cloud Function.
 */

import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { deepStripUndefined } from '@/subsidiaries/advisory/core/firebase/converters';
import { 
  Sparkles, 
  FileText, 
  Package, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Lightbulb,
  Plus,
  Check,
  Square,
  CheckSquare,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { BudgetTier, ProjectStrategy } from '../../types/strategy';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

interface Deliverable {
  id: string;
  name: string;
  itemType: string;
  category: 'MANUFACTURED' | 'PROCURED' | 'DOCUMENT';
  subcategory: string;
  roomType: string;
  roomTypeName: string;
  quantity: number;
  unitQuantityPerRoom: number;
  roomCount: number;
  specifications: {
    dimensions?: { width: number; height: number; depth: number };
    material?: string;
    finish?: string;
    complexity?: string;
  } | null;
  manufacturing?: {
    featureLibraryMatches: Array<{ featureId: string; featureName: string }>;
    capabilityVerified: boolean;
    estimatedHoursPerUnit?: number;
  };
  aiMetadata: {
    confidenceScore: number;
    requiresClarification: boolean;
    reasoning?: string;
    ambiguities?: string[];
    extractionMethod?: 'regex' | 'llm' | 'hybrid';
  };
}

interface ScopingResult {
  projectId: string;
  projectName: string;
  generatedAt: string;
  processingTimeMs: number;
  entities: {
    roomGroups: Array<{ type: string; quantity: number; source: string }>;
    explicitItems: string[];
    projectType: string | null;
    location: string | null;
  };
  deliverables: Deliverable[];
  summary: {
    totalDeliverables: number;
    totalUnits: number;
    byCategory: Record<string, number>;
    byRoomType: Record<string, number>;
    estimatedTotalHours: number;
    itemsRequiringClarification: number;
  };
  aiEnhancement: {
    validation: { extractedCorrectly: boolean; missingItems: string[]; corrections: string[] } | null;
    ambiguities: string[];
    trendInsights: string[] | null;
    recommendations: string[];
  };
}

export interface ProjectScopingAIProps {
  projectId?: string;
  projectName?: string;
  initialBriefText?: string;
  projectStrategy?: ProjectStrategy | null;
  onScopingComplete?: (result: ScopingResult) => void;
  onDeliverableSelect?: (deliverable: Deliverable) => void;
  onItemsAdded?: (count: number) => void;
  className?: string;
}

export function ProjectScopingAI({
  projectId,
  projectName = 'New Project',
  initialBriefText,
  projectStrategy,
  onScopingComplete,
  onDeliverableSelect,
  onItemsAdded,
  className,
}: ProjectScopingAIProps) {
  const [briefText, setBriefText] = useState(initialBriefText || '');
  const userHasTyped = useRef(false);

  // Update brief text when initialBriefText changes (e.g. sent from Design Brief section)
  useEffect(() => {
    if (initialBriefText && !userHasTyped.current) {
      setBriefText(initialBriefText);
    }
  }, [initialBriefText]);
  const [projectType, setProjectType] = useState<string>('');
  const [location, setLocation] = useState('East Africa');
  const [includeResearch, setIncludeResearch] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ScopingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDeliverables, setSelectedDeliverables] = useState<Set<string>>(new Set());
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  
  const [expandedSections, setExpandedSections] = useState({
    deliverables: true,
    summary: true,
    insights: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleDeliverableSelection = (id: string) => {
    setSelectedDeliverables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllDeliverables = () => {
    if (!result) return;
    const allIds = result.deliverables.map(d => d.id);
    setSelectedDeliverables(new Set(allIds));
  };

  const selectDeliverablesByCategory = (category: Deliverable['category']) => {
    if (!result) return;
    const ids = result.deliverables
      .filter(d => d.category === category)
      .map(d => d.id);
    setSelectedDeliverables(new Set(ids));
  };

  const deselectAllDeliverables = () => {
    setSelectedDeliverables(new Set());
  };

  const handleAddAsDesignItems = async () => {
    if (!projectId || selectedDeliverables.size === 0 || !result) return;

    setIsAddingItems(true);
    setError(null);

    try {
      const itemsToAdd = result.deliverables.filter(d => selectedDeliverables.has(d.id));
      const designItemsRef = collection(db, 'designProjects', projectId, 'designItems');

      let addedCount = 0;
      for (const del of itemsToAdd) {
        if (addedItems.has(del.id)) continue; // Skip already added

        // Generate item code
        const itemCode = `${projectId?.substring(0, 8) || 'ITEM'}-${Date.now().toString(36).toUpperCase()}`;
        
        // Create default RAG status
        const defaultRagValue = {
          status: 'red',
          notes: '',
          updatedAt: new Date().toISOString(),
          updatedBy: 'ai_scoping',
        };
        
        const defaultRagStatus = {
          designCompleteness: {
            overallDimensions: defaultRagValue,
            model3D: defaultRagValue,
            productionDrawings: defaultRagValue,
            materialSpecs: defaultRagValue,
            hardwareSpecs: defaultRagValue,
            finishSpecs: defaultRagValue,
            joineryDetails: defaultRagValue,
            tolerances: defaultRagValue,
            assemblyInstructions: defaultRagValue,
          },
          manufacturingReadiness: {
            materialAvailability: defaultRagValue,
            hardwareAvailability: defaultRagValue,
            toolingReadiness: defaultRagValue,
            processDocumentation: defaultRagValue,
            qualityCriteria: defaultRagValue,
            costValidation: defaultRagValue,
          },
          qualityGates: {
            internalDesignReview: defaultRagValue,
            manufacturingReview: defaultRagValue,
            clientApproval: defaultRagValue,
            prototypeValidation: defaultRagValue,
          },
        };

        // Build strategy context if available
        const strategyContext = projectStrategy ? {
          strategyId: projectStrategy.id,
          budgetTier: projectStrategy.budgetFramework?.tier as BudgetTier | undefined,
          spaceMultiplier: del.roomCount > 1 ? del.roomCount : 1,
          scopingConfidence: del.aiMetadata?.confidenceScore || 0.85,
          deliverableType: del.itemType,
        } : undefined;

        // Initialize budget tracking with allocated budget hint if available
        const budgetTracking = projectStrategy ? {
          allocatedBudget: 0, // To be set later from pricing hints or user input
          actualCost: 0,
          variance: 0,
          lastUpdated: serverTimestamp(),
        } : undefined;

        await addDoc(designItemsRef, deepStripUndefined({
          // Identification
          itemCode,
          name: del.name,
          description: `${del.roomTypeName} - ${del.subcategory}`,
          category: del.category === 'MANUFACTURED' ? 'casework' :
                   del.category === 'PROCURED' ? 'fixtures' : 'specialty',
          sourcingType: del.category === 'MANUFACTURED' || del.category === 'PROCURED' ? del.category : undefined,

          // Project relationship
          projectId: projectId,
          projectCode: projectId?.substring(0, 8) || 'PROJ',

          // Status
          currentStage: del.category === 'PROCURED' ? 'procure-identify' : 'concept',
          ragStatus: defaultRagStatus,
          overallReadiness: 0,

          // History
          stageHistory: [],
          approvals: [],

          // Files
          files: [],

          // Additional fields from scoping
          itemType: del.itemType,
          subcategory: del.subcategory,
          quantity: del.quantity,
          requiredQuantity: del.quantity, // Set initial required quantity
          roomType: del.roomTypeName,
          priority: 'normal',
          source: 'ai_scoping',

          // AI metadata
          aiMetadata: {
            scopedAt: new Date().toISOString(),
            confidenceScore: del.aiMetadata?.confidenceScore || 0.85,
            requiresClarification: del.aiMetadata?.requiresClarification || false,
          },

          // Strategy context (linking to project strategy)
          ...(strategyContext && { strategyContext }),

          // Budget tracking
          ...(budgetTracking && { budgetTracking }),

          // Timestamps
          createdAt: serverTimestamp(),
          createdBy: 'ai_scoping',
          updatedAt: serverTimestamp(),
          updatedBy: 'ai_scoping',
        }));

        addedCount++;
        setAddedItems(prev => new Set([...prev, del.id]));
      }

      onItemsAdded?.(addedCount);
      setSelectedDeliverables(new Set()); // Clear selection after adding
    } catch (err) {
      console.error('Error adding design items:', err);
      setError(err instanceof Error ? err.message : 'Failed to add items');
    } finally {
      setIsAddingItems(false);
    }
  };

  const handleScope = async () => {
    if (!briefText.trim() || briefText.length < 20) {
      setError('Please enter a design brief (at least 20 characters)');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/ai/project-scoping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefText,
          projectId,
          projectName,
          projectType: projectType || undefined,
          location: location || 'East Africa',
          includeResearch,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Scoping failed');
      }

      const data = await response.json();
      setResult(data);
      onScopingComplete?.(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Scoping failed';
      setError(errorMessage);
      console.error('Project Scoping error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'MANUFACTURED':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'PROCURED':
        return <ShoppingCart className="w-4 h-4 text-green-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getConfidenceLevel = (score: number): { label: string; color: string; bgColor: string } => {
    if (score >= 0.8) {
      return { label: 'High', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' };
    }
    if (score >= 0.6) {
      return { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' };
    }
    return { label: 'Low', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' };
  };

  const getExtractionMethodBadge = (method?: 'regex' | 'llm' | 'hybrid') => {
    if (!method) return null;

    const styles = {
      regex: { label: 'Regex', color: 'text-gray-600', bg: 'bg-gray-100' },
      llm: { label: 'AI', color: 'text-purple-600', bg: 'bg-purple-100' },
      hybrid: { label: 'Hybrid', color: 'text-blue-600', bg: 'bg-blue-100' },
    };

    const style = styles[method];
    return (
      <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', style.color, style.bg)}>
        {style.label}
      </span>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Project Scoping AI</h3>
          <p className="text-sm text-gray-500">Extract deliverables from your design brief</p>
        </div>
      </div>

      {/* Input Form */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
        {/* Brief Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Design Brief
          </label>
          <textarea
            value={briefText}
            onChange={(e) => { userHasTyped.current = true; setBriefText(e.target.value); }}
            placeholder="Describe your project... e.g., '32 guest rooms, each with wardrobe, desk area, and bathroom vanity. Premium finish required.'"
            className="w-full h-32 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isProcessing}
          />
          <p className="mt-1 text-xs text-gray-500">
            Tip: Include quantities with multipliers like "32 rooms, each with..." for automatic expansion
          </p>
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Type
            </label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={isProcessing}
            >
              <option value="">Auto-detect</option>
              <option value="hospitality">Hospitality</option>
              <option value="residential">Residential</option>
              <option value="restaurant">Restaurant</option>
              <option value="office">Office</option>
              <option value="retail">Retail</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="East Africa"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={isProcessing}
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeResearch}
                onChange={(e) => setIncludeResearch(e.target.checked)}
                className="rounded border-gray-300"
                disabled={isProcessing}
              />
              <span className="text-sm text-gray-700">Include trend research</span>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleScope}
          disabled={isProcessing || briefText.length < 20}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing Brief...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Project Scope
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div 
            className="bg-white border rounded-lg cursor-pointer"
            onClick={() => toggleSection('summary')}
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium">Scope Generated</span>
                <span className="text-sm text-gray-500">
                  {result.summary.totalUnits} units in {result.processingTimeMs}ms
                </span>
              </div>
              {expandedSections.summary ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            
            {expandedSections.summary && (
              <div className="px-4 pb-4 border-t">
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{result.summary.byCategory.MANUFACTURED || 0}</div>
                    <div className="text-xs text-blue-600">Manufactured</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{result.summary.byCategory.PROCURED || 0}</div>
                    <div className="text-xs text-green-600">Procured</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">{Math.round(result.summary.estimatedTotalHours)}</div>
                    <div className="text-xs text-purple-600">Est. Hours</div>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-700">{result.summary.itemsRequiringClarification}</div>
                    <div className="text-xs text-amber-600">Need Review</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Deliverables List */}
          <div className="bg-white border rounded-lg">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => toggleSection('deliverables')}
            >
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Deliverables</span>
                <span className="text-sm text-gray-500">({result.deliverables.length} types)</span>
              </div>
              {expandedSections.deliverables ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>

            {expandedSections.deliverables && (
              <>
                {/* Selection Controls */}
                {projectId && (
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-b">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllDeliverables}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => selectDeliverablesByCategory('MANUFACTURED')}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Select Manufactured
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => selectDeliverablesByCategory('PROCURED')}
                        className="text-xs text-green-700 hover:underline"
                      >
                        Select Procured
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={deselectAllDeliverables}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Deselect All
                      </button>
                      {selectedDeliverables.size > 0 && (
                        <span className="text-xs text-gray-500">
                          ({selectedDeliverables.size} selected)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleAddAsDesignItems}
                      disabled={selectedDeliverables.size === 0 || isAddingItems}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAddingItems ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          Add as Design Items
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="max-h-96 overflow-y-auto">
                  {result.deliverables.map((del) => (
                    <div 
                      key={del.id}
                      className={cn(
                        "flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50",
                        selectedDeliverables.has(del.id) && "bg-blue-50",
                        addedItems.has(del.id) && "bg-green-50"
                      )}
                    >
                      {/* Checkbox for selection */}
                      {projectId && (
                        <button
                          onClick={() => toggleDeliverableSelection(del.id)}
                          disabled={addedItems.has(del.id)}
                          className="mr-2 flex-shrink-0"
                        >
                          {addedItems.has(del.id) ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : selectedDeliverables.has(del.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      )}
                      
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => onDeliverableSelect?.(del)}
                      >
                        {getCategoryIcon(del.category)}
                        <div>
                          <div className="font-medium text-sm">
                            {del.name}
                            {addedItems.has(del.id) && (
                              <span className="ml-2 text-xs text-green-600">✓ Added</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {del.roomTypeName} • {del.subcategory}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-semibold">{del.quantity}</div>
                          <div className="text-xs text-gray-500">units</div>
                        </div>

                        {/* Confidence Score Badge with Tooltip */}
                        <div className="relative group">
                          {(() => {
                            const confidence = getConfidenceLevel(del.aiMetadata?.confidenceScore || 0.85);
                            return (
                              <div className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded border cursor-help',
                                confidence.bgColor,
                                confidence.color
                              )}>
                                <span className="text-xs font-semibold">
                                  {confidence.label}
                                </span>
                                <span className="text-xs opacity-70">
                                  {Math.round((del.aiMetadata?.confidenceScore || 0.85) * 100)}%
                                </span>
                              </div>
                            );
                          })()}

                          {/* Tooltip */}
                          {(del.aiMetadata?.reasoning || del.aiMetadata?.ambiguities?.length || del.aiMetadata?.extractionMethod) && (
                            <div className="invisible group-hover:visible absolute z-10 w-64 p-3 mt-1 right-0 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
                              <div className="space-y-2">
                                {del.aiMetadata.extractionMethod && (
                                  <div>
                                    <span className="font-semibold">Method:</span>{' '}
                                    {del.aiMetadata.extractionMethod.toUpperCase()}
                                  </div>
                                )}
                                {del.aiMetadata.reasoning && (
                                  <div>
                                    <span className="font-semibold">Reasoning:</span>{' '}
                                    {del.aiMetadata.reasoning}
                                  </div>
                                )}
                                {del.aiMetadata.ambiguities && del.aiMetadata.ambiguities.length > 0 && (
                                  <div>
                                    <span className="font-semibold">Ambiguities:</span>
                                    <ul className="mt-1 ml-3 list-disc list-inside">
                                      {del.aiMetadata.ambiguities.map((amb, i) => (
                                        <li key={i}>{amb}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -top-1 right-4" />
                            </div>
                          )}
                        </div>

                        {/* Extraction Method Badge */}
                        {del.aiMetadata?.extractionMethod && getExtractionMethodBadge(del.aiMetadata.extractionMethod)}

                        {/* Requires Clarification Warning */}
                        {del.aiMetadata?.requiresClarification && (
                          <div className="relative group">
                            <AlertCircle className="w-5 h-5 text-amber-500 cursor-help" />
                            <div className="invisible group-hover:visible absolute z-10 w-48 p-2 mt-1 right-0 bg-amber-900 text-white text-xs rounded-lg shadow-xl">
                              This item requires clarification or review
                              <div className="absolute w-2 h-2 bg-amber-900 transform rotate-45 -top-1 right-2" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* AI Insights */}
          {(result.aiEnhancement.trendInsights?.length || result.aiEnhancement.recommendations?.length) && (
            <div className="bg-white border rounded-lg">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => toggleSection('insights')}
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium">AI Insights</span>
                </div>
                {expandedSections.insights ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              {expandedSections.insights && (
                <div className="px-4 pb-4 border-t space-y-3">
                  {result.aiEnhancement.trendInsights?.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{insight}</span>
                    </div>
                  ))}
                  {result.aiEnhancement.recommendations?.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ambiguities */}
          {result.aiEnhancement.ambiguities?.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                <AlertCircle className="w-5 h-5" />
                Items Needing Clarification
              </div>
              <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                {result.aiEnhancement.ambiguities.map((amb, i) => (
                  <li key={i}>{amb}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectScopingAI;
