/**
 * PortalDashboardRouter — single entry for `/portal/p/:code/dashboard`
 * that branches between FinishesDashboardPage and AdvisoryDashboardPage
 * based on the resolved project's `subsidiaryId`.
 *
 * Keeps the router config flat — staff don't need to maintain two
 * parallel route trees and the project picker can navigate by code
 * without knowing the subsidiary in advance.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPortalProjectByCode } from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import FinishesDashboardPage from './finishes/FinishesDashboardPage';
import AdvisoryDashboardPage from './advisory/AdvisoryDashboardPage';

export default function PortalDashboardRouter() {
  const { code } = useParams<{ code: string }>();
  const [subsidiary, setSubsidiary] = useState<'advisory' | 'finishes' | 'loading' | 'unknown'>('loading');

  useEffect(() => {
    if (!code) {
      setSubsidiary('unknown');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await getPortalProjectByCode(code);
        if (cancelled) return;
        if (!p) setSubsidiary('unknown');
        else if (p.subsidiaryId === 'advisory') setSubsidiary('advisory');
        else setSubsidiary('finishes');
      } catch {
        if (!cancelled) setSubsidiary('unknown');
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  // While we resolve, render the Finishes page — it'll either resolve
  // successfully (most common case) or land on its own error state if
  // the project isn't accessible.
  if (subsidiary === 'loading' || subsidiary === 'finishes' || subsidiary === 'unknown') {
    return <FinishesDashboardPage />;
  }
  return <AdvisoryDashboardPage />;
}
