/**
 * Quick Capture Floating Action Button
 *
 * Appears on all delivery pages. Tapping navigates to the Quick Capture form.
 * Positioned fixed bottom-right (standard Android FAB position).
 */

import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { useUnlinkedCaptures } from '../../hooks/useQuickCapture';
import { useAuth } from '@/shared/hooks';

export function QuickCaptureFAB() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = (user as any)?.organizationId || 'default';
  const { captures } = useUnlinkedCaptures(orgId);

  const pendingCount = captures.length;

  return (
    <button
      onClick={() => navigate('/advisory/delivery/quick-captures/new')}
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
      aria-label="Quick Capture"
    >
      <Camera className="w-6 h-6" />

      {/* Badge for pending unlinked captures */}
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
          {pendingCount > 99 ? '99+' : pendingCount}
        </span>
      )}
    </button>
  );
}
