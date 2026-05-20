/**
 * Product Recommendations Section
 * Search and recommend existing products from the catalog
 * Integrates with the Strategy Canvas for customer recommendations
 */

import { useState, useEffect } from 'react';
import { 
  Search, 
  Package, 
  Plus, 
  X, 
  Check, 
  Filter,
  Loader2,
  Star,
  Sparkles,
  ImageIcon,
} from 'lucide-react';
import { 
  searchProducts, 
  getProductRecommendations,
  type ProductSearchResult,
  type ProductRecommendation,
} from '../../services/productSearchService';
import type { ProductCategory } from '@/modules/launch-pipeline/types/product.types';

export interface SelectedProduct {
  productId: string;
  productName: string;
  category: ProductCategory;
  reason: string;
  quantity?: number;
  notes?: string;
}

interface ProductRecommendationsSectionProps {
  projectContext: {
    projectType?: string;
    spaceType?: string;
    budgetTier?: string;
    styleKeywords?: string[];
    roomTypes?: string[];
    materials?: string[];
  };
  selectedProducts: SelectedProduct[];
  onProductsChange: (products: SelectedProduct[]) => void;
}

const CATEGORY_COLORS: Record<ProductCategory, { bg: string; text: string }> = {
  casework: { bg: 'bg-blue-100', text: 'text-blue-700' },
  furniture: { bg: 'bg-green-100', text: 'text-green-700' },
  millwork: { bg: 'bg-purple-100', text: 'text-purple-700' },
  doors: { bg: 'bg-amber-100', text: 'text-amber-700' },
  fixtures: { bg: 'bg-pink-100', text: 'text-pink-700' },
  specialty: { bg: 'bg-teal-100', text: 'text-teal-700' },
};

export function ProductRecommendationsSection({
  projectContext,
  selectedProducts,
  onProductsChange,
}: ProductRecommendationsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<ProductRecommendation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | ''>('');
  const [activeTab, setActiveTab] = useState<'search' | 'ai'>('ai');

  // Load AI recommendations when context changes
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!projectContext.projectType && !projectContext.styleKeywords?.length) {
        return;
      }

      setIsLoadingRecommendations(true);
      try {
        const recommendations = await getProductRecommendations(projectContext);
        setAiRecommendations(recommendations);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
      } finally {
        setIsLoadingRecommendations(false);
      }
    };

    loadRecommendations();
  }, [projectContext]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchProducts(searchQuery, {
          category: categoryFilter || undefined,
        });
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter]);

  const isProductSelected = (productId: string) => {
    return selectedProducts.some(p => p.productId === productId);
  };

  const addProduct = (product: { 
    productId: string; 
    productName: string; 
    category: ProductCategory;
    reason?: string;
  }) => {
    if (isProductSelected(product.productId)) return;
    
    onProductsChange([
      ...selectedProducts,
      {
        productId: product.productId,
        productName: product.productName,
        category: product.category,
        reason: product.reason || 'Manual selection',
        quantity: 1,
      },
    ]);
  };

  const removeProduct = (productId: string) => {
    onProductsChange(selectedProducts.filter(p => p.productId !== productId));
  };

  const updateProductQuantity = (productId: string, quantity: number) => {
    onProductsChange(
      selectedProducts.map(p => 
        p.productId === productId ? { ...p, quantity } : p
      )
    );
  };


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-gray-900">Product Recommendations</h3>
          {selectedProducts.length > 0 && (
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
              {selectedProducts.length} selected
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ai'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            AI Recommendations
          </div>
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'search'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Search className="w-4 h-4" />
            Search Catalog
          </div>
        </button>
      </div>

      {/* AI Recommendations Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-3">
          {isLoadingRecommendations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-gray-500">Analyzing project context...</span>
            </div>
          ) : aiRecommendations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Fill in project context to get AI recommendations</p>
              <p className="text-xs text-gray-400 mt-1">
                Add project type, style, and other details above
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {aiRecommendations.map((rec) => (
                <div
                  key={rec.productId}
                  className={`p-3 border rounded-lg transition-colors ${
                    isProductSelected(rec.productId)
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Product Image Placeholder */}
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {rec.imageUrl ? (
                        <img 
                          src={rec.imageUrl} 
                          alt={rec.productName}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 truncate">{rec.productName}</h4>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          CATEGORY_COLORS[rec.category]?.bg || 'bg-gray-100'
                        } ${CATEGORY_COLORS[rec.category]?.text || 'text-gray-700'}`}>
                          {rec.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-1 mt-0.5">
                        {rec.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-xs text-indigo-600">
                          <Star className="w-3 h-3" />
                          <span>{rec.relevanceScore}% match</span>
                        </div>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{rec.recommendationReason}</span>
                      </div>
                      {rec.materials.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {rec.materials.slice(0, 3).map((m, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add Button */}
                    <button
                      onClick={() => addProduct({
                        productId: rec.productId,
                        productName: rec.productName,
                        category: rec.category,
                        reason: rec.recommendationReason,
                      })}
                      disabled={isProductSelected(rec.productId)}
                      className={`p-2 rounded-lg transition-colors ${
                        isProductSelected(rec.productId)
                          ? 'bg-indigo-100 text-indigo-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-600'
                      }`}
                    >
                      {isProductSelected(rec.productId) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-3">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, material, style..."
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 border rounded-lg transition-colors ${
                showFilters ? 'bg-gray-100 border-gray-300' : 'hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ProductCategory | '')}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">All categories</option>
                <option value="casework">Casework</option>
                <option value="furniture">Furniture</option>
                <option value="millwork">Millwork</option>
                <option value="doors">Doors</option>
                <option value="fixtures">Fixtures</option>
                <option value="specialty">Specialty</option>
              </select>
            </div>
          )}

          {/* Search Results */}
          {searchQuery && (
            <div className="space-y-2">
              {searchResults.length === 0 && !isSearching ? (
                <p className="text-center py-4 text-sm text-gray-500">
                  No products found for "{searchQuery}"
                </p>
              ) : (
                searchResults.map((result) => (
                  <div
                    key={result.product.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      isProductSelected(result.product.id)
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{result.product.name}</h4>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            CATEGORY_COLORS[result.product.category]?.bg || 'bg-gray-100'
                          } ${CATEGORY_COLORS[result.product.category]?.text || 'text-gray-700'}`}>
                            {result.product.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-1 mt-0.5">
                          {result.product.description}
                        </p>
                        <div className="flex gap-1 mt-1">
                          {result.matchReasons.slice(0, 2).map((reason, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-green-50 text-green-700 text-xs rounded">
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => addProduct({
                          productId: result.product.id,
                          productName: result.product.name,
                          category: result.product.category,
                          reason: result.matchReasons[0] || 'Search result',
                        })}
                        disabled={isProductSelected(result.product.id)}
                        className={`p-2 rounded-lg transition-colors ml-2 ${
                          isProductSelected(result.product.id)
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-600'
                        }`}
                      >
                        {isProductSelected(result.product.id) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Products */}
      {selectedProducts.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Selected for Recommendation ({selectedProducts.length})
          </h4>
          <div className="space-y-2">
            {selectedProducts.map((product) => (
              <div
                key={product.productId}
                className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{product.productName}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      CATEGORY_COLORS[product.category]?.bg || 'bg-gray-100'
                    } ${CATEGORY_COLORS[product.category]?.text || 'text-gray-700'}`}>
                      {product.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{product.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={product.quantity || 1}
                    onChange={(e) => updateProductQuantity(product.productId, parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border rounded text-sm text-center"
                    title="Quantity"
                  />
                  <button
                    onClick={() => removeProduct(product.productId)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
