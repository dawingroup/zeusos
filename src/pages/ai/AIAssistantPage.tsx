/**
 * AIAssistantPage — full-page cross-module AI assistant (Phase 3.1).
 *
 * Mounts the working AIAssistantPanel (which routes natural-language queries
 * through the `crossModuleIntelligence` + `assistantChat` callables) in its
 * full-page variant, scoped to the viewer's org: parent-org principals get the
 * group brain (`zeus-group`); a subsidiary member is scoped to their brand.
 *
 * Replaces the dead static stub that never called the backend.
 */

import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { AIAssistantPanel } from '@/modules/intelligence-layer/components/assistant/AIAssistantPanel';
import { useCurrentDawinUser } from '@/core/settings';
import { isParentOrgUser, resolveHomeSubsidiaryId } from '@/modules/delivery/components/deliveryAccess';

export default function AIAssistantPage() {
  const { dawinUser } = useCurrentDawinUser();

  // Group brain by default; brand members scope to their own org.
  const companyId = useMemo(() => {
    if (!dawinUser) return 'zeus-group';
    if (isParentOrgUser(dawinUser)) return 'zeus-group';
    return resolveHomeSubsidiaryId(dawinUser) || 'zeus-group';
  }, [dawinUser]);

  return (
    <>
      <Helmet>
        <title>AI Assistant | ZeusOS</title>
      </Helmet>

      <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-[1200px] mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
          <p className="text-muted-foreground text-sm">
            Ask anything across campaigns, finance, talent, IWOs and more — answered from live ZeusOS data.
          </p>
        </div>

        <AIAssistantPanel
          open
          variant="full"
          initialMode="cross_module"
          companyId={companyId}
          onClose={() => {}}
        />
      </div>
    </>
  );
}
