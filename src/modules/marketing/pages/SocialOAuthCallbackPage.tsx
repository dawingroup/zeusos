/**
 * SocialOAuthCallbackPage
 *
 * Mounted at /marketing/accounts/oauth/meta/callback. The actual OAuth code
 * exchange happens server-side in the metaOAuthCallback Cloud Function, which
 * returns an HTML page that does window.opener.postMessage and self-closes.
 *
 * This SPA route exists only so that direct navigation (e.g. user opens the
 * callback URL in a new tab without going through Meta) doesn't 404. It
 * renders a friendly fallback explaining what happened.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function SocialOAuthCallbackPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');

    if (errorParam) {
      setState('error');
      setMessage(errorDescription || errorParam);
      return;
    }

    // Normal flow: the server-side metaOAuthCallback handler completed and
    // posted a message to window.opener. If we got here in a NEW tab (not the
    // popup), there's no opener — just show a generic success / instruct user.
    if (window.opener) {
      // Server-side function already posted the message; just self-close.
      try {
        window.close();
      } catch {
        /* noop */
      }
    }

    setState('success');
    setMessage('Connection finalized — you can close this tab and return to ZeusOS.');
  }, [params]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-md w-full text-center">
        {state === 'loading' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
            <h1 className="text-base font-semibold text-gray-900">Connecting…</h1>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <h1 className="text-base font-semibold text-gray-900">Account connected</h1>
            <p className="text-sm text-gray-500 mt-2">{message}</p>
            <Link
              to="/marketing/accounts"
              className="inline-block mt-4 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90"
            >
              Back to Social Accounts
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h1 className="text-base font-semibold text-gray-900">Connection failed</h1>
            <p className="text-sm text-gray-500 mt-2">{message}</p>
            <Link
              to="/marketing/accounts"
              className="inline-block mt-4 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90"
            >
              Try again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
