/**
 * Pipeline Board Component
 * Kanban-style board for product launch stages with gate indicators.
 * Migrated to the shared <KanbanColumn> primitive.
 */

import { ProductCard } from '@/modules/launch-pipeline/components/product/ProductCard';
import type { PipelineStage } from '../../types/stage.types';
import type { LaunchProduct } from '../../types/product.types';
import { PIPELINE_STAGES } from '../../constants/stages';
import { getIconByName } from '@/shared/utils/iconMap';
import { KanbanColumn } from '@/shared/components/data-display';

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

const STRIPE_BY_COLOR: Record<string, string> = {
  purple: 'var(--boysenberry)',
  blue: 'var(--rag-blue)',
  cyan: 'var(--seafoam)',
  orange: 'var(--golden-bell)',
  red: 'var(--rag-red)',
  green: 'var(--rag-green)',
  emerald: 'var(--rag-green)',
};

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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = 'var(--bg-sunken)';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.backgroundColor = 'transparent';
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetStage: PipelineStage,
  ) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = 'transparent';
    const productId = e.dataTransfer.getData('productId');
    const sourceStage = e.dataTransfer.getData('sourceStage') as PipelineStage;
    if (sourceStage !== targetStage) {
      await onMoveProduct(productId, targetStage, currentUserId);
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = getIconByName(iconName);
    return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {columns.map((column) => {
        const stripe = STRIPE_BY_COLOR[column.config.color] ?? 'var(--rag-blue)';
        const terminal = column.config.color === 'green' || column.config.color === 'emerald';
        return (
          <KanbanColumn
            key={column.stage}
            label={
              <span className="inline-flex items-center gap-1.5">
                <span style={{ color: stripe }}>{getIcon(column.config.icon)}</span>
                {column.config.label}
              </span>
            }
            count={column.products.length}
            total={
              column.config.description ? (
                <span className="hidden xl:inline">{column.config.description}</span>
              ) : undefined
            }
            stripeColor={stripe}
            terminal={terminal}
            emptyLabel="Drop products here"
            width={300}
            className="rounded-md px-1 py-1 snap-start"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.stage)}
          >
            {column.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                stageConfig={column.config}
                onEdit={() => onEditProduct(product)}
                onDelete={() => onDeleteProduct(product.id)}
                onDragStart={(e) => handleDragStart(e, product)}
              />
            ))}
          </KanbanColumn>
        );
      })}
    </div>
  );
}
