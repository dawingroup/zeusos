/**
 * Roadmap Page
 * Kanban-style product pipeline board
 */

import { useState } from 'react';
import { Plus, RefreshCw, LayoutGrid, List } from 'lucide-react';
import { useRoadmap } from './useRoadmap';
import { PipelineBoard } from './PipelineBoard';
import { ProductForm } from './ProductForm';
import { ProductListView } from './ProductListView';
import type { ProductFormData, RoadmapProduct } from '../../types/roadmap';

export function RoadmapPage() {
  const {
    columns,
    products,
    isLoading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    moveProduct,
    updateProgress,
    refreshProducts,
  } = useRoadmap();

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<RoadmapProduct | null>(null);

  const handleCreate = async (data: ProductFormData) => {
    await createProduct(data);
    setShowCreateForm(false);
  };

  const handleUpdate = async (data: ProductFormData) => {
    if (editingProduct) {
      await updateProduct(editingProduct.id, data);
      setEditingProduct(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
    }
  };

  // Calculate stats
  const totalProducts = products.filter(p => p.status === 'active').length;
  const launchedCount = products.filter(p => p.stage === 'launched' && p.status === 'active').length;
  const avgProgress = products.length > 0 
    ? Math.round(products.reduce((sum, p) => sum + p.progressPercent, 0) / products.length)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Roadmap</h1>
              <p className="text-sm text-gray-500 mt-1">
                {totalProducts} products • {launchedCount} launched • {avgProgress}% avg progress
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Refresh */}
              <button
                onClick={refreshProducts}
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* View Toggle */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('board')}
                  className={`p-2 ${viewMode === 'board' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                  title="Board view"
                >
                  <LayoutGrid className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                  title="List view"
                >
                  <List className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Add Button */}
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Product</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
            {error}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : viewMode === 'board' ? (
          <PipelineBoard
            columns={columns}
            onMoveProduct={moveProduct}
            onEditProduct={setEditingProduct}
            onDeleteProduct={handleDelete}
            onUpdateProgress={updateProgress}
          />
        ) : (
          <ProductListView
            products={products}
            onEditProduct={setEditingProduct}
            onDeleteProduct={handleDelete}
          />
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <ProductForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit Form Modal */}
      {editingProduct && (
        <ProductForm
          product={editingProduct}
          onSubmit={handleUpdate}
          onCancel={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}

export default RoadmapPage;
