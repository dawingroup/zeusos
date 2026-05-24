/**
 * MCPPairingPage
 *
 * Browser-side half of the ZeusOS MCP token-refresh proxy pairing flow.
 *
 * Triggered by `node tools/dawinos-mcp-proxy/setup.js login`, which spins up a
 * one-shot loopback HTTP server on an ephemeral port and opens this page in the
 * default browser with `?port=<n>&nonce=<hex>` in the query string.
 *
 * On user confirmation, this page reads the signed-in user's Firebase
 * refresh token + the Firebase Web API key, and POSTs them back to
 * http://127.0.0.1:<port>/callback. The local setup script verifies the
 * nonce, validates the refresh token by minting an ID token, and writes
 * ~/.dawinos-mcp/config.json.
 *
 * Security notes:
 *   - Page is auth-gated by the existing AuthGuard (route registered with it).
 *   - The handoff is gated behind an explicit click — never auto-submit. This
 *     defends against malicious links that might try to silently steal tokens.
 *   - Nonce + port are validated for shape on the client and matched
 *     server-side by the local setup script.
 *   - The callback target is always 127.0.0.1; we do not allow arbitrary
 *     hostnames in the `port` param.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/core/components/ui/card';
import { useAuth } from '@/shared/hooks';
import { auth } from '@/shared/services/firebase/auth';

type Phase = 'validating' | 'ready' | 'sending' | 'success' | 'error';

const NONCE_RE = /^[a-f0-9]{16,64}$/i;
const PORT_MIN = 1024;
const PORT_MAX = 65535;

export default function MCPPairingPage() {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const [phase, setPhase] = useState<Phase>('validating');
  const [error, setError] = useState<string | null>(null);

  const port = useMemo(() => {
    const raw = params.get('port');
    if (!raw || !/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    if (n < PORT_MIN || n > PORT_MAX) return null;
    return n;
  }, [params]);

  const nonce = useMemo(() => {
    const raw = params.get('nonce') ?? '';
    return NONCE_RE.test(raw) ? raw : null;
  }, [params]);

  useEffect(() => {
    if (loading) return;
    if (!port || !nonce) {
      setPhase('error');
      setError(
        'Missing or malformed port/nonce. This page should only be opened by the dawinos-mcp-proxy setup script.',
      );
      return;
    }
    setPhase('ready');
  }, [loading, port, nonce]);

  const handleAuthorize = async () => {
    if (!user || !port || !nonce) return;
    setPhase('sending');
    setError(null);

    try {
      // Force a fresh ID token so any new custom claims land in the proxy's first cache.
      // The refresh token itself is long-lived and unaffected by this.
      await user.getIdToken(true);
      const refreshToken = (user as { refreshToken?: string }).refreshToken;
      const apiKey = auth.app.options.apiKey;

      if (!refreshToken) throw new Error('No refresh token on the signed-in user.');
      if (!apiKey) throw new Error('Firebase apiKey not exposed on the auth instance.');

      const res = await fetch(`http://127.0.0.1:${port}/callback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nonce,
          refreshToken,
          apiKey,
          email: user.email,
          uid: user.uid,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Local proxy returned ${res.status}: ${body.slice(0, 200)}`);
      }

      setPhase('success');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <Helmet>
        <title>Pair MCP Proxy · ZeusOS</title>
      </Helmet>
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-sunken)] p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              {phase === 'success' ? (
                <ShieldCheck className="h-7 w-7 text-[var(--rag-green)]" />
              ) : phase === 'error' ? (
                <ShieldOff className="h-7 w-7 text-[var(--rag-red)]" />
              ) : (
                <ShieldAlert className="h-7 w-7 text-[var(--rag-amber)]" />
              )}
              <CardTitle>Pair ZeusOS MCP Proxy</CardTitle>
            </div>
            <CardDescription>
              Authorize a local terminal to mint Firebase ID tokens on your behalf for the ZeusOS MCP connector.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-sm">
            {phase === 'validating' && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying request…
              </p>
            )}

            {(phase === 'ready' || phase === 'sending') && user && (
              <>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
                  <dt className="font-medium text-muted-foreground">Account</dt>
                  <dd className="font-mono text-foreground">{user.email}</dd>
                  <dt className="font-medium text-muted-foreground">Local port</dt>
                  <dd className="font-mono text-foreground">127.0.0.1:{port}</dd>
                </dl>
                <div className="rounded-md border border-[var(--rag-amber)] bg-[var(--rag-amber-soft)] p-3 text-[var(--rag-amber)]">
                  <p className="font-medium">Only proceed if you started this from your own terminal.</p>
                  <p className="mt-1 text-[var(--rag-amber)]">
                    Never authorize a pairing link that someone else sent you. Pairing grants the
                    listening process the ability to mint Firebase ID tokens for your account
                    indefinitely (until you sign out everywhere).
                  </p>
                </div>
              </>
            )}

            {phase === 'success' && (
              <p className="text-[var(--rag-green)]">
                ✅ Refresh token sent to <span className="font-mono">127.0.0.1:{port}</span>. You can close this tab.
              </p>
            )}

            {phase === 'error' && error && (
              <div className="rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] p-3 text-[var(--rag-red)]">
                <p className="font-medium">Pairing failed.</p>
                <p className="mt-1 break-words font-mono text-xs">{error}</p>
                <p className="mt-2 text-[var(--rag-red)]">
                  Re-run <span className="font-mono">node setup.js login</span> in your terminal to try again.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-2">
            {phase === 'ready' && (
              <Button onClick={handleAuthorize}>Authorize this terminal</Button>
            )}
            {phase === 'sending' && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
              </Button>
            )}
            {(phase === 'success' || phase === 'error') && (
              <Button variant="outline" onClick={() => window.close()}>Close</Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
