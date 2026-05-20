/**
 * Strategy Canvas Page
 * Wrapper page for Strategy Canvas component
 */

import { useParams } from 'react-router-dom';
import { StrategyCanvas } from '../components/strategy/StrategyCanvas';
import { useAuth } from '@/contexts/AuthContext';

export default function StrategyCanvasPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const companyId = (user as any)?.organizationId || 'default';

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">No project selected</p>
      </div>
    );
  }

  return (
    <StrategyCanvas
      projectId={projectId}
      userId={user?.uid}
      companyId={companyId}
    />
  );
}
