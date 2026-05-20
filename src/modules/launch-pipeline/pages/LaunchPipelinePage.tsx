/**
 * Launch Pipeline Page
 * Main page with tab-based layout: Products, Catalog Health, Shopify Store, Clips
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { Plus, LayoutGrid, List, RefreshCw, Store, Activity, Scissors, Package, Download, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { PipelineBoard } from '../components/pipeline/PipelineBoard';
import { ProductIdeaClips } from '../components/pipeline/ProductIdeaClips';
import { ProductForm } from '../components/product/ProductForm';
import { ShopifySettings } from '../components/shopify/ShopifySettings';
import { ShopifyProductList } from '../components/shopify/ShopifyProductList';
import { CatalogHealthPanel } from '../components/health/CatalogHealthPanel';
import { useLaunchPipeline } from '../hooks/useLaunchPipeline';
import { getUnlinkedShopifyProducts, importShopifyProducts } from '../services/shopifyService';
import type { ImportResult } from '../services/shopifyService';
import type { LaunchProduct } from '../types/product.types';

export default function LaunchPipelinePage() {
  const {
    columns,
    products,
    isLoading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    moveProduct,
    refreshProducts,
  } = useLaunchPipeline();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'products';

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LaunchProduct | null>(null);
  const [productView, setProductView] = useState<'board' | 'list'>('board');
  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const navigate = useNavigate();

  // Load unlinked Shopify product count
  useEffect(() => {
    getUnlinkedShopifyProducts()
      .then(data => setUnlinkedCount(data.unlinked.length))
      .catch(() => {}); // Shopify may not be connected
  }, []);

  const handleImportAll = async () => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const result = await importShopifyProducts();
      setImportResult(result);
      setUnlinkedCount(0);
      refreshProducts();
    } catch (err: any) {
      console.error('Import failed:', err);
      setImportResult({
        imported: 0,
        alreadyLinked: 0,
        errors: 1,
        importedProducts: [],
        errorDetails: [{
          shopifyId: '',
          title: 'Connection Error',
          error: err?.message || 'Failed to connect to Shopify. Check your network and try again.',
        }],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const { user } = useAuth();
  const currentUserId = user?.uid || 'unknown';

  const handleCreateProduct = async (data: Partial<LaunchProduct>) => {
    await createProduct(data);
  };

  const handleUpdateProduct = async (data: Partial<LaunchProduct>) => {
    if (editingProduct) {
      await updateProduct(editingProduct.id, data);
    }
  };

  const handleEditProduct = (product: LaunchProduct) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleTabChange = (value: string) => {
    setSearchParams(value === 'products' ? {} : { tab: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading products: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Product Launch Pipeline</h1>
          <p className="text-gray-500">
            {products.length} products across {columns.length} stages
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
          {/* Refresh */}
          <button
            onClick={refreshProducts}
            className="p-2 min-h-[44px] min-w-[44px] text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Import from Shopify */}
          <button
            onClick={handleImportAll}
            disabled={isImporting}
            className="flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {isImporting ? 'Importing...' : `Import from Shopify${unlinkedCount > 0 ? ` (${unlinkedCount})` : ''}`}
            </span>
            <span className="sm:hidden">
              {isImporting ? '...' : `Import${unlinkedCount > 0 ? ` (${unlinkedCount})` : ''}`}
            </span>
          </button>

          {/* New Product */}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Product</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Tab-Based Layout */}
      <Tabs value={initialTab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="products" className="flex items-center gap-2 min-h-[44px]">
            <Package className="w-4 h-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2 min-h-[44px]">
            <Activity className="w-4 h-4" />
            Catalog Health
          </TabsTrigger>
          <TabsTrigger value="shopify" className="flex items-center gap-2 min-h-[44px]">
            <Store className="w-4 h-4" />
            Shopify Store
          </TabsTrigger>
          <TabsTrigger value="clips" className="flex items-center gap-2 min-h-[44px]">
            <Scissors className="w-4 h-4" />
            Clips
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4 mt-4">
          {/* Import Result Banner */}
          {importResult && (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${
              importResult.errors > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-green-50 border-green-200'
            }`}>
              {importResult.errors > 0 ? (
                <XCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  Imported {importResult.imported} product{importResult.imported !== 1 ? 's' : ''} from Shopify
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {importResult.alreadyLinked > 0 && `${importResult.alreadyLinked} already linked. `}
                  {importResult.errors > 0 && `${importResult.errors} failed.`}
                </p>
                {importResult.errorDetails.length > 0 && (
                  <ul className="mt-2 text-sm text-red-700 space-y-0.5">
                    {importResult.errorDetails.map((e, i) => (
                      <li key={i}>{e.title}: {e.error}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={() => setImportResult(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>
          )}

          {/* Stage Summary Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {columns.map((col, idx) => {
              const count = col.products?.length ?? 0;
              return (
                <div key={col.stage} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm whitespace-nowrap">
                    <span className="font-medium text-gray-700">{col.config.label}</span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-semibold">{count}</span>
                  </div>
                  {idx < columns.length - 1 && (
                    <span className="text-gray-300 text-xs">{'\u2192'}</span>
                  )}
                </div>
              );
            })}
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-sm">
              <span className="font-semibold text-primary">{products.length}</span>
              <span className="text-gray-500">total</span>
            </div>
          </div>

          {/* Board/List Sub-Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setProductView('board')}
                className={`px-3 py-2 min-h-[36px] ${productView === 'board' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                title="Board View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setProductView('list')}
                className={`px-3 py-2 min-h-[36px] ${productView === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Board View */}
          {productView === 'board' && (
            <PipelineBoard
              columns={columns}
              onMoveProduct={moveProduct}
              onEditProduct={handleEditProduct}
              onDeleteProduct={handleDeleteProduct}
              currentUserId={currentUserId}
            />
          )}

          {/* List View */}
          {productView === 'list' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No products yet. Click "New Product" to create one.
                        </td>
                      </tr>
                    ) : (
                      products.map(product => {
                        const stageConfig = columns.find(c => c.stage === product.currentStage)?.config;
                        return (
                          <tr
                            key={product.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/launch-pipeline/product/${product.id}`)}
                          >
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{product.name || 'Untitled'}</p>
                                {product.description && (
                                  <p className="text-sm text-gray-500 truncate max-w-xs">{product.description}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 capitalize">{product.category}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stageConfig?.color || 'bg-gray-100 text-gray-700'}`}>
                                {stageConfig?.label || product.currentStage}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                product.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                product.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                product.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {product.priority}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {product.pricing?.basePrice
                                ? `${product.pricing.currency} ${product.pricing.basePrice.toFixed(2)}`
                                : '-'}
                            </td>
                            <td className="px-4 py-3">
                              {product.shopifySync?.status === 'synced' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  Published
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  Draft
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}
                                className="text-sm text-primary hover:text-primary/80 mr-3"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                                className="text-sm text-red-600 hover:text-red-700"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Catalog Health Tab */}
        <TabsContent value="health" className="mt-4">
          <CatalogHealthPanel />
        </TabsContent>

        {/* Shopify Store Tab */}
        <TabsContent value="shopify" className="space-y-6 mt-4">
          {/* Sync Overview */}
          <KPIGrid cols={4}>
            <KPICard
              label="Published Products"
              value={products.filter(p => p.shopifySync?.status === 'synced').length}
              trend="up"
            />
            <KPICard
              label="Draft Products"
              value={products.filter(p => !p.shopifySync || p.shopifySync.status !== 'synced').length}
            />
            <KPICard
              label="Sync Errors"
              value={products.filter(p => p.shopifySync?.status === 'error').length}
              trend={
                products.filter(p => p.shopifySync?.status === 'error').length > 0
                  ? 'down'
                  : undefined
              }
            />
            <KPICard label="Unlinked in Shopify" value={unlinkedCount} />
          </KPIGrid>

          {/* Settings + Product List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <ShopifySettings />
            </div>
            <div className="lg:col-span-2">
              <ShopifyProductList />
            </div>
          </div>
        </TabsContent>

        {/* Clips Tab */}
        <TabsContent value="clips" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <ProductIdeaClips
              onProductCreated={() => {
                refreshProducts();
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          product={editingProduct || undefined}
          onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}
