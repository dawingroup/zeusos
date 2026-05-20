/**
 * ShareConfigDialog — URL + QR code for sharing configurations
 */
import { useEffect, useState, useCallback } from 'react';
import { generateShareableUrl, generateShareQR } from '../../services/configurator.service';
import type { ShareableConfiguration } from '../../types/configurator.types';

interface ShareConfigDialogProps {
  configuration: ShareableConfiguration;
  onClose: () => void;
}

export function ShareConfigDialog({ configuration, onClose }: ShareConfigDialogProps) {
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = window.location.origin;
    const url = generateShareableUrl(baseUrl, configuration);
    if (!url) {
      setError('Configuration is too large to share via URL.');
      return;
    }
    setShareableUrl(url);

    generateShareQR(url).then(setQrDataUrl).catch(() => {
      // QR generation failed — URL still works
    });
  }, [configuration]);

  const handleCopy = useCallback(async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement('textarea');
      textarea.value = shareableUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareableUrl]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Share Configuration</h3>
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

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <>
            {/* QR Code */}
            {qrDataUrl && (
              <div className="flex justify-center mb-4">
                <img
                  src={qrDataUrl}
                  alt="Configuration QR code"
                  className="w-48 h-48 border rounded"
                />
              </div>
            )}

            {/* URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shareable Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareableUrl ?? ''}
                  className="flex-1 text-sm border rounded-md px-3 py-2 bg-gray-50 text-gray-600 truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Anyone with this link can view and modify this configuration.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
