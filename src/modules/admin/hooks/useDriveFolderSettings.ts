/**
 * React hook — live subscription to the Drive folder settings doc.
 * Returns `{ settings, loading }`; the settings page wraps this and
 * drives its form state from the subscription.
 */

import { useEffect, useState } from 'react';
import {
  subscribeToDriveFolderSettings,
  type VerifyResult,
} from '../services/driveFolderSettingsService';
import type { DriveFolderSettings } from '../types/driveFolderSettings';

export function useDriveFolderSettings() {
  const [settings, setSettings] = useState<DriveFolderSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToDriveFolderSettings((next) => {
      setSettings(next);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { settings, loading };
}

// Re-export VerifyResult for convenience
export type { VerifyResult };
