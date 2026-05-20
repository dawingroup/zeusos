/**
 * Pipeline Context
 * Global state management for Launch Pipeline module
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/shared/hooks';
import type { LaunchProduct } from '../types/product.types';
import type { PipelineStage, GateCheckResult } from '../types/stage.types';
import * as pipelineService from '../services/pipelineService';
import { PIPELINE_STAGES } from '../constants/stages';

// View modes for the pipeline
export type PipelineViewMode = 'board' | 'list' | 'shopify' | 'ai';

// Filter state
export interface PipelineFilters {
  stages?: PipelineStage[];
  categories?: string[];
  priority?: ('low' | 'medium' | 'high' | 'urgent')[];
  assignedTo?: string[];
  search?: string;
}

// Sort options
export type SortField = 'name' | 'createdAt' | 'updatedAt' | 'priority' | 'targetLaunchDate';
export type SortDirection = 'asc' | 'desc';

export interface PipelineSort {
  field: SortField;
  direction: SortDirection;
}

// Pipeline column for Kanban view
export interface PipelineColumn {
  stage: PipelineStage;
  config: typeof PIPELINE_STAGES[0];
  products: LaunchProduct[];
}

// Context value interface
export interface PipelineContextValue {
  // Auth
  currentUserId: string;

  // Products
  products: LaunchProduct[];
  isLoading: boolean;
  error: string | null;

  // Computed columns for Kanban
  columns: PipelineColumn[];

  // Selected product
  selectedProduct: LaunchProduct | null;
  setSelectedProduct: (product: LaunchProduct | null) => void;

  // View preferences
  viewMode: PipelineViewMode;
  setViewMode: (mode: PipelineViewMode) => void;

  // Filters & Sort
  filters: PipelineFilters;
  setFilters: (filters: PipelineFilters) => void;
  clearFilters: () => void;
  sort: PipelineSort;
  setSort: (sort: PipelineSort) => void;

  // CRUD operations
  createProduct: (data: Partial<LaunchProduct>) => Promise<LaunchProduct>;
  updateProduct: (id: string, data: Partial<LaunchProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  moveProduct: (productId: string, newStage: PipelineStage, notes?: string) => Promise<void>;
  refreshProducts: () => Promise<void>;

  // Gate checking
  checkGate: (productId: string, targetStage: PipelineStage) => GateCheckResult;

  // AI Assistant state
  showAIAssistant: boolean;
  setShowAIAssistant: (show: boolean) => void;
  aiAssistantProduct: LaunchProduct | null;
  setAIAssistantProduct: (product: LaunchProduct | null) => void;
}

const PipelineContext = createContext<PipelineContextValue | undefined>(undefined);

interface PipelineProviderProps {
  children: ReactNode;
}

export const PipelineProvider: React.FC<PipelineProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const currentUserId = user?.uid || '';

  // Products state
  const [products, setProducts] = useState<LaunchProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected product
  const [selectedProduct, setSelectedProduct] = useState<LaunchProduct | null>(null);

  // View preferences
  const [viewMode, setViewMode] = useState<PipelineViewMode>('board');

  // Filters & Sort
  const [filters, setFilters] = useState<PipelineFilters>({});
  const [sort, setSort] = useState<PipelineSort>({ field: 'updatedAt', direction: 'desc' });

  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiAssistantProduct, setAIAssistantProduct] = useState<LaunchProduct | null>(null);

  // Compute filtered and sorted products
  const filteredProducts = React.useMemo(() => {
    let result = [...products];

    // Apply filters
    if (filters.stages?.length) {
      result = result.filter(p => filters.stages!.includes(p.currentStage));
    }
    if (filters.categories?.length) {
      result = result.filter(p => filters.categories!.includes(p.category));
    }
    if (filters.priority?.length) {
      result = result.filter(p => filters.priority!.includes(p.priority));
    }
    if (filters.assignedTo?.length) {
      result = result.filter(p => p.assignedTo && filters.assignedTo!.includes(p.assignedTo));
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower) ||
        p.tags?.some(t => t.toLowerCase().includes(searchLower))
      );
    }

    // Apply sort
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sort.field) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          aVal = priorityOrder[a.priority];
          bVal = priorityOrder[b.priority];
          break;
        case 'createdAt':
        case 'updatedAt':
        case 'targetLaunchDate':
          aVal = a[sort.field]?.toMillis() || 0;
          bVal = b[sort.field]?.toMillis() || 0;
          break;
        default:
          aVal = a[sort.field];
          bVal = b[sort.field];
      }

      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, filters, sort]);

  // Compute columns for Kanban view
  const columns: PipelineColumn[] = React.useMemo(() => {
    return PIPELINE_STAGES.map(config => ({
      stage: config.id,
      config,
      products: filteredProducts.filter(p => p.currentStage === config.id),
    }));
  }, [filteredProducts]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Load products
  const refreshProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedProducts = await pipelineService.getProducts();
      setProducts(loadedProducts);
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load products on mount
  React.useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  // CRUD operations
  const createProduct = useCallback(async (data: Partial<LaunchProduct>): Promise<LaunchProduct> => {
    try {
      const newProduct = await pipelineService.createProduct(data);
      setProducts(prev => [...prev, newProduct]);
      return newProduct;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create product';
      setError(message);
      throw err;
    }
  }, []);

  const updateProduct = useCallback(async (id: string, data: Partial<LaunchProduct>): Promise<void> => {
    try {
      await pipelineService.updateProduct(id, data);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));

      // Update selected product if it's the one being updated
      if (selectedProduct?.id === id) {
        setSelectedProduct(prev => prev ? { ...prev, ...data } : null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update product';
      setError(message);
      throw err;
    }
  }, [selectedProduct]);

  const deleteProduct = useCallback(async (id: string): Promise<void> => {
    try {
      await pipelineService.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));

      // Clear selection if deleted product was selected
      if (selectedProduct?.id === id) {
        setSelectedProduct(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete product';
      setError(message);
      throw err;
    }
  }, [selectedProduct]);

  const moveProduct = useCallback(async (
    productId: string,
    newStage: PipelineStage,
    notes?: string
  ): Promise<void> => {
    try {
      await pipelineService.moveProductToStage(productId, newStage, currentUserId, notes);
      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, currentStage: newStage } : p
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move product';
      setError(message);
      throw err;
    }
  }, [currentUserId]);

  // Gate checking
  const checkGate = useCallback((productId: string, targetStage: PipelineStage): GateCheckResult => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      return { canAdvance: false, passed: [], failed: [], warnings: ['Product not found'] };
    }

    const stageConfig = PIPELINE_STAGES.find(s => s.id === targetStage);
    if (!stageConfig) {
      return { canAdvance: false, passed: [], failed: [], warnings: ['Invalid target stage'] };
    }

    const passed: typeof stageConfig.gateRequirements = [];
    const failed: typeof stageConfig.gateRequirements = [];
    const warnings: string[] = [];

    for (const requirement of stageConfig.gateRequirements) {
      // Check if requirement is met
      let isMet = false;

      switch (requirement.type) {
        case 'deliverable':
          isMet = product.deliverables?.some(d => d.type === requirement.id) || false;
          break;
        case 'data_field':
          isMet = Boolean((product as any)[requirement.id]);
          break;
        case 'approval':
          // Approvals would need to be checked against a separate system
          isMet = true; // Placeholder
          break;
        case 'quality_check':
          // Quality checks would need specific validation
          isMet = true; // Placeholder
          break;
      }

      if (isMet) {
        passed.push(requirement);
      } else if (requirement.required) {
        failed.push(requirement);
      } else {
        warnings.push(`Optional: ${requirement.label}`);
      }
    }

    return {
      canAdvance: failed.length === 0,
      passed,
      failed,
      warnings,
    };
  }, [products]);

  const value: PipelineContextValue = {
    currentUserId,
    products: filteredProducts,
    isLoading,
    error,
    columns,
    selectedProduct,
    setSelectedProduct,
    viewMode,
    setViewMode,
    filters,
    setFilters,
    clearFilters,
    sort,
    setSort,
    createProduct,
    updateProduct,
    deleteProduct,
    moveProduct,
    refreshProducts,
    checkGate,
    showAIAssistant,
    setShowAIAssistant,
    aiAssistantProduct,
    setAIAssistantProduct,
  };

  return (
    <PipelineContext.Provider value={value}>
      {children}
    </PipelineContext.Provider>
  );
};

export const usePipelineContext = (): PipelineContextValue => {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error('usePipelineContext must be used within PipelineProvider');
  }
  return context;
};

export default PipelineContext;
