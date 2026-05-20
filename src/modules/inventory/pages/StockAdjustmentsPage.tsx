/**
 * StockAdjustmentsPage
 * Route: /inventory/adjustments
 */

import { useAuth } from '@/contexts/AuthContext';
import { useGlobalState } from '@/integration/store/GlobalContext';
import { useStockAdjustmentsRealtime } from '../hooks/useStockAdjustments';
import { StockAdjustmentList } from '../components/stockAdjustment/StockAdjustmentList';

export default function StockAdjustmentsPage() {
  const { user } = useAuth();
  const { state } = useGlobalState();
  const organizationId = state.auth?.user?.organizationId || 'dawinos';

  const { adjustments, loading, error } = useStockAdjustmentsRealtime(organizationId);

  if (!user) return null;

  return (
    <StockAdjustmentList
      adjustments={adjustments}
      loading={loading}
      error={error}
    />
  );
}
