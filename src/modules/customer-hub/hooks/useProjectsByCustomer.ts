/**
 * useProjectsByCustomer
 * Subscribe to design projects for a specific customer
 */

import { useEffect, useState } from 'react';
import { subscribeToProjectsByCustomer } from '@/modules/design-manager/services/firestore';
import type { DesignProject } from '@/modules/design-manager/types';

export function useProjectsByCustomer(customerId: string | undefined) {
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToProjectsByCustomer(customerId, (data) => {
      setProjects(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [customerId]);

  return { projects, loading };
}
