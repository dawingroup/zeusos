/**
 * AcceptInvitePage
 *
 * Landing page an invitee hits when they open a shareable invite link
 * (`/accept-invite?inviteId=...`). The page itself is public — it just
 * explains the next step (sign in with Google) and hands off to the
 * normal login flow. Actual acceptance happens in `GlobalContext`'s
 * auth listener, which invokes the `processNewUserInvite` callable and
 * matches the invite by the authenticated user's email.
 *
 * The inviteId in the URL is advisory; the server-side match is by email,
 * so a stale link still works as long as the invite is pending + unexpired.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
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

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get('inviteId');
  const { user, loading, signInWithGoogle } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Once the user is authenticated, let GlobalContext's auth listener run
  // `processNewUserInvite`. We bounce to the dashboard — if the invite was
  // valid the user will have a DawinUser doc by then; if not, the dashboard
  // will show the unauthorised empty state, which is the correct behaviour.
  useEffect(() => {
    if (!loading && user) {
      // Short delay to give the auth listener a tick to run the CFn.
      const t = window.setTimeout(() => navigate('/dashboard', { replace: true }), 600);
      return () => window.clearTimeout(t);
    }
  }, [loading, user, navigate]);

  async function handleGoogleSignIn() {
    setError(null);
    setIsSigningIn(true);
    try {
      const result = await signInWithGoogle();
      if (!result) {
        setError('Failed to sign in with Google.');
      }
      // On success the useEffect above redirects.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google.');
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Accept Invitation | ZeusOS</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-sunken,#f8fafc)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {user ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <Mail className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle>
              {user ? 'Welcome to ZeusOS' : "You've been invited to ZeusOS"}
            </CardTitle>
            <CardDescription>
              {user
                ? 'Finalising your account…'
                : 'Sign in with your Google account to accept the invitation. Your access and role were set by the person who invited you.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>{error}</div>
              </div>
            )}

            {!user && !loading && (
              <Button
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening Google…
                  </>
                ) : (
                  'Sign in with Google'
                )}
              </Button>
            )}

            {(loading || user) && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            {inviteId && (
              <p>
                Invite reference: <span className="font-mono">{inviteId.slice(0, 8)}…</span>
              </p>
            )}
            <p>
              Already have an account?{' '}
              <Link to="/auth/login" className="underline hover:text-foreground">
                Sign in here
              </Link>
              .
            </p>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
