/**
 * Service Credentials Page
 * Manage AI / integration service API keys backed by Firebase Secret Manager.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { useCurrentDawinUser } from '@/core/settings';
import { useAuth } from '@/core/hooks/useAuth';
import {
  listServiceCredentials,
  type ServiceCredentialGroup,
  type ServiceCredentialStatus,
} from '../services/secretsService';
import { ServiceCredentialCard } from '../components/ServiceCredentialCard';

const GROUP_ORDER: ServiceCredentialGroup[] = [
  'ai',
  'documents',
  'storefront',
  'messaging',
  'accounting',
];

const GROUP_LABELS: Record<ServiceCredentialGroup, string> = {
  ai: 'AI Services',
  documents: 'Documents',
  storefront: 'Storefront',
  messaging: 'Messaging',
  accounting: 'Accounting',
};

const SUPER_USER_EMAILS = ['onzimai@zeusgroup.co.ug'];

export default function ServiceCredentialsPage() {
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const [credentials, setCredentials] = useState<ServiceCredentialStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only owners (or hard-coded super user) may write secrets.
  const canEdit =
    dawinUser?.globalRole === 'owner' ||
    (user?.email ? SUPER_USER_EMAILS.includes(user.email) : false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listServiceCredentials();
      setCredentials(data);
    } catch (err) {
      console.error('Failed to load service credentials:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reach the secrets service. Is the function deployed?',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped: Record<ServiceCredentialGroup, ServiceCredentialStatus[]> = {
    ai: [],
    documents: [],
    storefront: [],
    messaging: [],
    accounting: [],
  };
  for (const c of credentials) {
    if (grouped[c.group]) grouped[c.group].push(c);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/admin/settings"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Back to Settings"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Service Credentials &amp; API Keys</h1>
          <p className="text-gray-500">
            Manage integration and AI service keys stored in Firebase Secret Manager. Values are
            never displayed; only the last 4 characters are shown for verification.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {/* Permission banner */}
      {!canEdit && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            You can view and test credentials, but only an <strong>owner</strong> account can
            rotate them.
          </div>
        </div>
      )}

      {/* Propagation note */}
      <div className="mb-6 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
        Saved values reach Cloud Functions on their next cold start (usually under a minute).
        Rotating OAuth-style secrets (Adobe, QuickBooks, Shopify) may require re-authorization
        through their respective consoles.
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800">
            <div className="font-medium">Couldn't load credentials</div>
            <div className="text-xs mt-1">{error}</div>
            <div className="text-xs mt-1">
              If this is the first time you're using the API Keys page, deploy the admin secrets
              functions:
              <code className="block mt-1 px-2 py-1 bg-white border border-red-200 rounded font-mono text-[11px]">
                firebase deploy --only
                functions:adminListServiceCredentials,functions:adminSetServiceCredential,functions:adminTestServiceCredential
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && !credentials.length && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {/* Grouped credentials */}
      {!isLoading && credentials.length > 0 && (
        <div className="space-y-6">
          {GROUP_ORDER.map((group) => {
            const items = grouped[group];
            if (!items.length) return null;
            return (
              <section key={group}>
                <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                  {GROUP_LABELS[group]}
                </h2>
                <div className="space-y-2">
                  {items.map((c) => (
                    <ServiceCredentialCard
                      key={c.id}
                      credential={c}
                      canEdit={canEdit}
                      onSaved={load}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!isLoading && !credentials.length && !error && (
        <div className="text-center py-12 text-sm text-gray-500">
          No managed credentials are defined yet. Edit{' '}
          <code className="font-mono">functions/src/admin/secrets.js</code> to register one.
        </div>
      )}
    </div>
  );
}
