/**
 * Pipeline Board Component
 * Kanban-style board for product stages
 */

import { ProductCard } from './ProductCard';
import type { PipelineColumn, PipelineStage, RoadmapProduct } from '../../types/roadmap';
import { STAGE_CONFIG } from '../../types/roadmap';

interface PipelineBoardProps {
  columns: PipelineColumn[];
  onMoveProduct: (productId: string, newStage: PipelineStage, newOrder: number) => Promise<void>;
  onEditProduct: (product: RoadmapProduct) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateProgress: (id: string, progress: number) => Promise<void>;
}

export function PipelineBoard({ 
  columns, 
  onMoveProduct, 
  onEditProduct, 
  onDeleteProduct,
  onUpdateProgress,
}: PipelineBoardProps) {
  const handleDragStart = (e: React.DragEvent, product: RoadmapProduct) => {
    e.dataTransfer.setData('productId', product.id);
    e.dataTransfer.setData('sourceStage', product.stage);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    const productId = e.dataTransfer.getData('productId');
    const sourceStage = e.dataTransfer.getData('sourceStage') as PipelineStage;
    
    if (sourceStage !== targetStage) {
      const targetColumn = columns.find(c => c.stage === targetStage);
      const newOrder = targetColumn ? targetColumn.products.length : 0;
      await onMoveProduct(productId, targetStage, newOrder);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const config = STAGE_CONFIG[column.stage];
        return (
          <div
            key={column.stage}
            className="flex-shrink-0 w-72"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.stage)}
          >
            {/* Column Header */}
            <div className={`px-3 py-2 rounded-t-lg ${config.bgColor}`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-semibold ${config.color}`}>{config.label}</h3>
                <span className={`text-sm ${config.color}`}>{column.products.length}</span>
              </div>
            </div>

            {/* Column Content */}
            <div className="bg-gray-100 rounded-b-lg min-h-[400px] p-2 space-y-2">
              {column.products.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                  Drop products here
                </div>
              ) : (
                column.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={() => onEditProduct(product)}
                    onDelete={() => onDeleteProduct(product.id)}
                    onUpdateProgress={(progress) => onUpdateProgress(product.id, progress)}
                    onDragStart={(e) => handleDragStart(e, product)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
