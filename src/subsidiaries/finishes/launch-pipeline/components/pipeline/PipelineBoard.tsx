/**
 * Pipeline Board Component
 * Kanban-style board for product launch stages with gate indicators
 */

import { ProductCard } from '@/modules/launch-pipeline/components/product/ProductCard';
import type { PipelineStage } from '../../types/stage.types';
import type { LaunchProduct } from '../../types/product.types';
import { PIPELINE_STAGES } from '../../constants/stages';
import { getIconByName } from '@/shared/utils/iconMap';

interface PipelineColumn {
  stage: PipelineStage;
  config: typeof PIPELINE_STAGES[0];
  products: LaunchProduct[];
}

interface PipelineBoardProps {
  columns: PipelineColumn[];
  onMoveProduct: (productId: string, newStage: PipelineStage, userId: string) => Promise<void>;
  onEditProduct: (product: LaunchProduct) => void;
  onDeleteProduct: (id: string) => void;
  currentUserId: string;
}

export function PipelineBoard({ 
  columns, 
  onMoveProduct, 
  onEditProduct, 
  onDeleteProduct,
  currentUserId,
}: PipelineBoardProps) {
  const handleDragStart = (e: React.DragEvent, product: LaunchProduct) => {
    e.dataTransfer.setData('productId', product.id);
    e.dataTransfer.setData('sourceStage', product.currentStage);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    const productId = e.dataTransfer.getData('productId');
    const sourceStage = e.dataTransfer.getData('sourceStage') as PipelineStage;
    
    if (sourceStage !== targetStage) {
      await onMoveProduct(productId, targetStage, currentUserId);
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = getIconByName(iconName);
    return Icon ? <Icon className="w-4 h-4" /> : null;
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
      blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
      cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
      red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
      green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
      emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {columns.map((column) => {
        const colors = getColorClasses(column.config.color);
        return (
          <div
            key={column.stage}
            className="flex-shrink-0 w-72 sm:w-80 snap-start"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.stage)}
          >
            {/* Column Header */}
            <div className={`px-3 py-2 rounded-t-lg ${colors.bg} border ${colors.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={colors.text}>{getIcon(column.config.icon)}</span>
                  <h3 className={`font-semibold ${colors.text}`}>{column.config.label}</h3>
                </div>
                <span className={`text-sm font-medium ${colors.text} bg-white/50 px-2 py-0.5 rounded-full`}>
                  {column.products.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{column.config.description}</p>
            </div>

            {/* Column Content */}
            <div className="bg-gray-50 rounded-b-lg min-h-[320px] sm:min-h-[400px] p-2 space-y-2 border border-t-0 border-gray-200">
              {column.products.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                  Drop products here
                </div>
              ) : (
                column.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    stageConfig={column.config}
                    onEdit={() => onEditProduct(product)}
                    onDelete={() => onDeleteProduct(product.id)}
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
