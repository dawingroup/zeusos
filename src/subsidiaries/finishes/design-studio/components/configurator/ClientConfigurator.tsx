/**
 * ClientConfigurator — Top-level configurator shell
 *
 * Loads PDD, renders parameter controls + finish selector + pricing panel.
 * Layout switches by mode (workshop / client / embed).
 */
import { useState, useCallback } from 'react';
import { useConfiguratorState } from '../../hooks/useConfiguratorState';
import { ParameterControls } from './ParameterControls';
import { PricingPanel } from './PricingPanel';
import { ConfigurationActions } from './ConfigurationActions';
import { ShareConfigDialog } from './ShareConfigDialog';
import { ARPreviewDialog } from './ARPreviewDialog';
import type { ConfiguratorMode } from '../../constants/configurator.constants';
import type { ShareableConfiguration } from '../../types/configurator.types';

interface ClientConfiguratorProps {
  pddId: string;
  mode?: ConfiguratorMode;
  initialConfig?: Record<string, unknown>;
}

export function ClientConfigurator({
  pddId,
  mode = 'workshop',
}: ClientConfiguratorProps) {
  const {
    pdd,
    visibleParameters,
    setParameter,
    isValidating,
    violations,
    warnings,
    estimatedPrice,
    state,
  } = useConfiguratorState(pddId, mode);

  if (!pdd) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showARPreview, setShowARPreview] = useState(false);

  const isValid = violations.length === 0;

  const handleShare = useCallback(() => {
    setShowShareDialog(true);
  }, []);

  const shareConfig: ShareableConfiguration = {
    pddId,
    params: state.parameters as Record<string, unknown>,
    finishes: state.finishSelections,
    version: 1,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Parameters */}
      <div className="lg:col-span-1 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">{pdd.name}</h2>
          {pdd.description && (
            <p className="text-sm text-gray-500">{pdd.description}</p>
          )}
        </div>

        <ParameterControls
          parameters={visibleParameters}
          values={state.parameters}
          onChange={setParameter}
          violations={[...violations, ...warnings]}
          labels={pdd.clientFacingConfig?.parameterLabels}
          helpText={pdd.clientFacingConfig?.parameterHelpText}
        />
      </div>

      {/* Center: 3D Viewport placeholder */}
      <div className="lg:col-span-1">
        <div className="rounded-lg border bg-gray-50 h-80 flex items-center justify-center">
          <span className="text-gray-400 text-sm">3D Viewport</span>
        </div>
      </div>

      {/* Right: Pricing + Actions */}
      <div className="lg:col-span-1 space-y-4">
        {pdd.clientFacingConfig?.showPriceEstimate !== false && (
          <PricingPanel
            breakdown={estimatedPrice}
            isLoading={isValidating}
          />
        )}

        <ConfigurationActions
          mode={mode}
          isValid={isValid}
          isGenerating={isValidating}
          onRequestQuote={() => {/* TODO: integrate quote dialog */}}
          onCreateMO={() => {/* TODO: integrate MO creation */}}
          onShareLink={pdd.clientFacingConfig?.shareableUrl ? handleShare : undefined}
          onViewAR={pdd.clientFacingConfig?.allowARPreview ? () => setShowARPreview(true) : undefined}
        />
      </div>

      {showShareDialog && (
        <ShareConfigDialog
          configuration={shareConfig}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {showARPreview && (pdd as unknown as { glbUrl?: string }).glbUrl && (
        <ARPreviewDialog
          glbUrl={(pdd as unknown as { glbUrl?: string }).glbUrl!}
          productName={pdd.name}
          onClose={() => setShowARPreview(false)}
        />
      )}
    </div>
  );
}
