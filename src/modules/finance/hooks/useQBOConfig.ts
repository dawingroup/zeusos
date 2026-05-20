/**
 * useQBOConfig Hook
 * Checks whether QuickBooks Online integration is configured and ready.
 */

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

interface QBOConfigResult {
  isReady: boolean;
  loading: boolean;
}

export function useQBOConfig(): QBOConfigResult {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkConfig() {
      try {
        // Check QBO connection status
        const connectionRef = doc(db, 'integrations', 'quickbooks');
        const connectionSnap = await getDoc(connectionRef);
        const connectionData = connectionSnap.data();
        // Consider connected if doc exists and has realmId or access_token (backend writes these on OAuth)
        const isConnected = connectionSnap.exists() && !!(
          connectionData?.isConnected ||
          connectionData?.realmId ||
          connectionData?.access_token
        );

        // Check QBO account mapping is configured
        const configRef = doc(db, 'integrations', 'quickbooks_config');
        const configSnap = await getDoc(configRef);
        const configData = configSnap.data();
        // Consider configured if doc exists and has account mappings or isConfigured flag
        const isConfigured = configSnap.exists() && !!(
          configData?.isConfigured ||
          configData?.accountMapping ||
          configData?.accounts
        );

        console.log('[useQBOConfig] connection:', { exists: connectionSnap.exists(), isConnected, fields: connectionData ? Object.keys(connectionData) : [] });
        console.log('[useQBOConfig] config:', { exists: configSnap.exists(), isConfigured, fields: configData ? Object.keys(configData) : [] });

        setIsReady(isConnected && isConfigured);
      } catch (err) {
        console.error('[useQBOConfig] Error checking QBO config:', err);
        setIsReady(false);
      } finally {
        setLoading(false);
      }
    }
    checkConfig();
  }, []);

  return { isReady, loading };
}
