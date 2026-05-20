/**
 * ConfigurationActions — Action buttons (Create MO / Request Quote / Share / AR)
 */
import type { ConfiguratorMode } from '../../constants/configurator.constants';

interface ConfigurationActionsProps {
  mode: ConfiguratorMode;
  isValid: boolean;
  isGenerating?: boolean;
  onRequestQuote: () => void;
  onCreateMO: () => void;
  onShareLink?: () => void;
  onViewAR?: () => void;
}

export function ConfigurationActions({
  mode,
  isValid,
  isGenerating,
  onRequestQuote,
  onCreateMO,
  onShareLink,
  onViewAR,
}: ConfigurationActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {mode === 'workshop' && (
        <button
          type="button"
          onClick={onCreateMO}
          disabled={!isValid || isGenerating}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : 'Create Manufacturing Order'}
        </button>
      )}
      {(mode === 'client' || mode === 'workshop') && (
        <button
          type="button"
          onClick={onRequestQuote}
          disabled={!isValid || isGenerating}
          className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Request Quote
        </button>
      )}
      {onShareLink && (
        <button
          type="button"
          onClick={onShareLink}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
        >
          Share Link
        </button>
      )}
      {onViewAR && (
        <button
          type="button"
          onClick={onViewAR}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
        >
          View in AR
        </button>
      )}
    </div>
  );
}
