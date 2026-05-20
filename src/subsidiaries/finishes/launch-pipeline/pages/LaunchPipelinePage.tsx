/**
 * Launch Pipeline Page
 * Main page for the product launch pipeline with Kanban board
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutGrid, List, RefreshCw, Store, Sparkles, Activity } from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { PipelineBoard } from '../components/pipeline/PipelineBoard';
import { ProductForm } from '../components/product/ProductForm';
import { ShopifySettings } from '../components/shopify/ShopifySettings';
import { ShopifyProductList } from '../components/shopify/ShopifyProductList';
import { NamingWizard, DescriptionGenerator, DiscoverabilityPanel, AuditDashboard } from '../components/ai-assistant';
import { useLaunchPipeline } from '../hooks/useLaunchPipeline';
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

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LaunchProduct | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'shopify' | 'ai'>('board');
  const [showNamingWizard, setShowNamingWizard] = useState(false);
  const [selectedProductForAI, setSelectedProductForAI] = useState<LaunchProduct | null>(null);
  const navigate = useNavigate();

  // Auth context
  const { user } = useAuth();
  const currentUserId = user?.uid || '';

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
    <div className="px-4 py-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Product Launch Pipeline</h1>
          <p className="text-gray-500">
            {products.length} products across {columns.length} stages
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-2 min-h-[44px] ${viewMode === 'board' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              title="Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 min-h-[44px] ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('shopify')}
              className={`px-3 py-2 min-h-[44px] ${viewMode === 'shopify' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              title="Shopify"
            >
              <Store className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('ai')}
              className={`px-3 py-2 min-h-[44px] ${viewMode === 'ai' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              title="AI Tools"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>

          {/* Catalog Health */}
          <button
            onClick={() => navigate('/launch-pipeline/audit')}
            className="flex items-center gap-2 px-3 py-2 min-h-[44px] text-gray-700 hover:bg-gray-100 rounded-lg border"
            title="Catalog Health"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Health</span>
          </button>

          {/* Refresh */}
          <button
            onClick={refreshProducts}
            className="p-2 min-h-[44px] min-w-[44px] text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
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

      {/* Pipeline Board */}
      {viewMode === 'board' && (
        <PipelineBoard
          columns={columns}
          onMoveProduct={moveProduct}
          onEditProduct={handleEditProduct}
          onDeleteProduct={handleDeleteProduct}
          currentUserId={currentUserId}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No products yet. Click "New Product" to create one.
                  </td>
                </tr>
              ) : (
                products.map(product => {
                  const stageConfig = columns.find(c => c.stage === product.currentStage)?.config;
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
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
                          onClick={() => handleEditProduct(product)}
                          className="text-sm text-primary hover:text-primary/80 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
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

      {/* Shopify View */}
      {viewMode === 'shopify' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ShopifySettings />
          <ShopifyProductList />
        </div>
      )}

      {/* AI Tools View */}
      {viewMode === 'ai' && (
        <div className="space-y-6">
          {/* Product Selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select a product to use AI tools
            </label>
            <select
              value={selectedProductForAI?.id || ''}
              onChange={(e) => {
                const product = products.find(p => p.id === e.target.value);
                setSelectedProductForAI(product || null);
              }}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Choose a product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name || 'Untitled'}</option>
              ))}
            </select>
          </div>

          {selectedProductForAI ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Naming Wizard Trigger */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">AI Product Naming</h3>
                    <p className="text-sm text-gray-500">Generate creative product names</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNamingWizard(true)}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Open Naming Wizard
                </button>
              </div>

              {/* Description Generator */}
              <DescriptionGenerator
                product={selectedProductForAI}
                onApply={async (content) => {
                  await updateProduct(selectedProductForAI.id, { aiContent: content as any });
                  alert('Content applied to product!');
                }}
              />

              {/* Discoverability Panel */}
              <DiscoverabilityPanel
                product={selectedProductForAI}
                onApply={async (data) => {
                  await updateProduct(selectedProductForAI.id, { aiDiscovery: data });
                  alert('Discoverability data applied!');
                }}
              />

              {/* Audit Dashboard */}
              <div className="lg:col-span-2">
                <AuditDashboard products={products} />
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
              <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Product</h3>
              <p className="text-gray-500">Choose a product above to access AI-powered tools</p>
            </div>
          )}
        </div>
      )}

      {/* Naming Wizard Modal */}
      {showNamingWizard && selectedProductForAI && (
        <NamingWizard
          productId={selectedProductForAI.id}
          initialContext={{
            category: selectedProductForAI.category,
            materials: selectedProductForAI.specifications?.materials,
            features: selectedProductForAI.specifications?.features,
          }}
          existingNames={products.map(p => p.name).filter(Boolean)}
          onComplete={async (name, handle) => {
            await updateProduct(selectedProductForAI.id, { name, handle });
            setShowNamingWizard(false);
            alert(`Product renamed to "${name}"!`);
          }}
          onClose={() => setShowNamingWizard(false)}
        />
      )}

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
