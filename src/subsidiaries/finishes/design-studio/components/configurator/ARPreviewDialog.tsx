/**
 * ARPreviewDialog — AR preview using Google's <model-viewer> web component
 *
 * Loads a GLB model and provides AR viewing on supported devices.
 * Falls back to a 3D viewer on desktop/unsupported devices.
 *
 * Requires @google/model-viewer to be installed. The web component is
 * auto-registered when imported. If not available, shows a fallback message.
 */
import { useEffect, useState } from 'react';
import { AR_MODEL_VIEWER_VERSION } from '../../constants/configurator.constants';

// Declare model-viewer web component for JSX
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        ar?: boolean;
        'ar-modes'?: string;
        'camera-controls'?: boolean;
        'touch-action'?: string;
        'auto-rotate'?: boolean;
        'shadow-intensity'?: string;
      }, HTMLElement>;
    }
  }
}

interface ARPreviewDialogProps {
  glbUrl: string;
  productName: string;
  onClose: () => void;
}

export function ARPreviewDialog({ glbUrl, productName, onClose }: ARPreviewDialogProps) {
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Dynamically load model-viewer if not already present
    if (customElements.get('model-viewer')) {
      setModelViewerLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = `https://ajax.googleapis.com/ajax/libs/model-viewer/${AR_MODEL_VIEWER_VERSION}/model-viewer.min.js`;
    script.onload = () => setModelViewerLoaded(true);
    script.onerror = () => setLoadError(true);
    document.head.appendChild(script);

    return () => {
      // Don't remove — other components may need it
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">AR Preview — {productName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="aspect-square bg-gray-50">
          {loadError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-sm font-medium">AR Preview unavailable</p>
                <p className="text-xs mt-1">Could not load model-viewer component</p>
              </div>
            </div>
          ) : !modelViewerLoaded ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <model-viewer
              src={glbUrl}
              alt={productName}
              ar
              ar-modes="webxr scene-viewer quick-look"
              camera-controls
              touch-action="pan-y"
              auto-rotate
              shadow-intensity="1"
              style={{ width: '100%', height: '100%' }}
            >
              <button
                slot="ar-button"
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium shadow-lg"
              >
                View in your space
              </button>
            </model-viewer>
          )}
        </div>

        <div className="px-4 py-3 border-t bg-gray-50">
          <p className="text-xs text-gray-500">
            On supported mobile devices, tap "View in your space" to place this product in AR.
            On desktop, use mouse to rotate and zoom the 3D model.
          </p>
        </div>
      </div>
    </div>
  );
}
