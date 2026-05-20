/**
 * Adobe PDF Services Test Component
 *
 * Simple UI to test Adobe PDF integration.
 * Add this to any page temporarily to verify the integration works.
 *
 * @example
 * import { AdobePdfTest } from '@/shared/services/adobe/components/AdobePdfTest';
 * // In your component: <AdobePdfTest />
 */

import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface TestResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  data?: unknown;
}

export function AdobePdfTest() {
  const [result, setResult] = useState<TestResult>({
    status: 'idle',
    message: 'Click a button to test Adobe PDF Services',
  });

  const functions = getFunctions();

  const testConnectivity = async () => {
    setResult({ status: 'loading', message: 'Testing Adobe API connectivity...' });

    try {
      const createPdf = httpsCallable(functions, 'adobeCreatePdf');
      await createPdf({});
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (err.message?.includes('Input file reference required')) {
        setResult({
          status: 'success',
          message: 'Adobe API connectivity verified! Functions are working.',
        });
        return;
      }
      if (err.message?.includes('Adobe OAuth token request failed')) {
        setResult({
          status: 'error',
          message: 'Adobe authentication failed. Check your credentials.',
        });
        return;
      }
      if (err.message?.includes('User must be authenticated')) {
        setResult({
          status: 'error',
          message: 'You must be logged in to test Adobe services.',
        });
        return;
      }
      setResult({
        status: 'error',
        message: `Unexpected error: ${err.message}`,
      });
    }
  };

  const testExtractPdf = async () => {
    setResult({ status: 'loading', message: 'Extracting text from sample PDF...' });

    try {
      const extractPdf = httpsCallable(functions, 'adobeExtractPdf');
      const response = await extractPdf({
        input: {
          type: 'url',
          value: 'https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf',
        },
        elementsToExtract: ['text'],
      });

      setResult({
        status: 'success',
        message: 'PDF extraction successful!',
        data: response.data,
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      setResult({
        status: 'error',
        message: `Extraction failed: ${err.message}`,
      });
    }
  };

  const testCompressPdf = async () => {
    setResult({ status: 'loading', message: 'Compressing sample PDF...' });

    try {
      const compressPdf = httpsCallable(functions, 'adobeCompressPdf');
      const response = await compressPdf({
        input: {
          type: 'url',
          value: 'https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf',
        },
        compressionLevel: 'medium',
      });

      const data = response.data as {
        originalSize?: number;
        compressedSize?: number;
        compressionRatio?: number;
      };

      setResult({
        status: 'success',
        message: `Compression successful! ${data.originalSize} → ${data.compressedSize} bytes (${Math.round((data.compressionRatio || 0) * 100)}% reduction)`,
        data: response.data,
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      setResult({
        status: 'error',
        message: `Compression failed: ${err.message}`,
      });
    }
  };

  const getStatusColor = () => {
    switch (result.status) {
      case 'loading':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-xl">
      <h2 className="text-xl font-bold mb-4">Adobe PDF Services Test</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={testConnectivity}
          disabled={result.status === 'loading'}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
        >
          Test Connectivity
        </button>
        <button
          onClick={testExtractPdf}
          disabled={result.status === 'loading'}
          className="px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded disabled:opacity-50"
        >
          Test Extract PDF
        </button>
        <button
          onClick={testCompressPdf}
          disabled={result.status === 'loading'}
          className="px-4 py-2 bg-green-100 hover:bg-green-200 rounded disabled:opacity-50"
        >
          Test Compress PDF
        </button>
      </div>

      <div className={`p-4 rounded ${result.status === 'loading' ? 'bg-blue-50' : result.status === 'success' ? 'bg-green-50' : result.status === 'error' ? 'bg-red-50' : 'bg-gray-50'}`}>
        <p className={`font-medium ${getStatusColor()}`}>
          {result.status === 'loading' && '⏳ '}
          {result.status === 'success' && '✅ '}
          {result.status === 'error' && '❌ '}
          {result.message}
        </p>

        {(result.data as any) && (
          <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-48">
            {JSON.stringify(result.data, null, 2).slice(0, 1000)}
            {JSON.stringify(result.data, null, 2).length > 1000 && '...'}
          </pre>
        )}
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Note: You must be logged in to test these functions.
      </p>
    </div>
  );
}
