/**
 * StockAdjustmentDetailPage
 * Route: /inventory/adjustments/:adjustmentId
 * Handles both "new" (form) and existing (detail view).
 */

import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalState } from '@/integration/store/GlobalContext';
import { useStockAdjustment } from '../hooks/useStockAdjustments';
import { StockAdjustmentForm } from '../components/stockAdjustment/StockAdjustmentForm';
import { StockAdjustmentDetail } from '../components/stockAdjustment/StockAdjustmentDetail';
// Using inline Tailwind instead of MUI

export default function StockAdjustmentDetailPage() {
  const { adjustmentId } = useParams<{ adjustmentId: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { state } = useGlobalState();
  const organizationId = state.auth?.user?.organizationId || 'dawinos';
  const userId = user?.uid || '';

  // If route is /inventory/adjustments/new, show form
  const isNew = adjustmentId === 'new';

  // Get default values from navigation state (for reverse adjustments)
  const defaultValues = (location.state as any)?.defaultValues;

  const { data: adjustment, isLoading, error } = useStockAdjustment(
    isNew ? '' : (adjustmentId || '')
  );

  if (!user) return null;

  if (isNew) {
    return (
      <StockAdjustmentForm
        userId={userId}
        organizationId={organizationId}
        defaultValues={defaultValues}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load adjustment: {(error as Error).message}
      </div>
    );
  }

  if (!adjustment) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
        Adjustment not found.
      </div>
    );
  }

  // If adjustment is draft, show editable form (update existing, don't re-create)
  if (adjustment.status === 'draft') {
    return (
      <StockAdjustmentForm
        userId={userId}
        organizationId={organizationId}
        existingId={adjustment.id}
        defaultValues={{
          adjustmentType: adjustment.adjustmentType,
          lineItems: adjustment.lineItems,
          reason: adjustment.reason,
          referenceType: adjustment.referenceType,
          referenceId: adjustment.referenceId,
          referenceNumber: adjustment.referenceNumber,
          attachments: adjustment.attachments,
        }}
      />
    );
  }

  return (
    <StockAdjustmentDetail
      adjustment={adjustment}
      userId={userId}
    />
  );
}
