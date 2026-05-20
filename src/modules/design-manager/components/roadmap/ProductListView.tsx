/**
 * Product List View Component
 * Table/list view of products
 */

import { Edit2, Trash2, Calendar, Clock } from 'lucide-react';
import type { RoadmapProduct } from '../../types/roadmap';
import { STAGE_CONFIG, PRIORITY_CONFIG } from '../../types/roadmap';

interface ProductListViewProps {
  products: RoadmapProduct[];
  onEditProduct: (product: RoadmapProduct) => void;
  onDeleteProduct: (id: string) => void;
}

export function ProductListView({ products, onEditProduct, onDeleteProduct }: ProductListViewProps) {
  const activeProducts = products.filter(p => p.status === 'active');

  if (activeProducts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No products in the pipeline yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timeline</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {activeProducts.map((product) => {
            const stageConfig = STAGE_CONFIG[product.stage];
            const priorityConfig = PRIORITY_CONFIG[product.priority];

            return (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    {product.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">{product.description}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${stageConfig.bgColor} ${stageConfig.color}`}>
                    {stageConfig.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${priorityConfig.color}`}>
                    {priorityConfig.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-[100px]">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${product.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{product.progressPercent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    {product.estimatedHours && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {product.estimatedHours}h
                      </span>
                    )}
                    {product.targetLaunchDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(product.targetLaunchDate.toDate()).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEditProduct(product)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteProduct(product.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
