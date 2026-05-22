/**
 * LoginPage
 * User authentication page with email/password and Google sign-in.
 *
 * Email/password form is always rendered — it works against both the
 * Firebase Auth emulator (Playwright e2e suite) and in production.
 * Google OAuth remains the primary sign-in path for production users.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/core/components/ui/card';
import { useAuth } from '@/shared/hooks';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithGoogle, signInWithEmail } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // Email/password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        navigate(from, { replace: true });
      } else {
        setError('Failed to sign in with Google.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setIsEmailLoading(true);
    try {
      const user = await signInWithEmail(email, password);
      if (user) {
        navigate(from, { replace: true });
      } else {
        setError('Invalid email or password.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const isBusy = isGoogleLoading || isEmailLoading;

  return (
    <>
      <Helmet>
        <title>Sign In | ZeusOS</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {/* Zeus Group "Z" mark — gradient draws on the Zeus profile's
                  vibrant palette (yellow Zeus The Agency → magenta Odd Gorilla
                  → cyan Zeus Digital). Replace with the official polygonal SVG
                  once the asset pack arrives. */}
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[#F5D900] via-[#FFB0B8] to-[#00C5E5] flex items-center justify-center">
                <span className="text-white font-extrabold text-xl drop-shadow-sm">Z</span>
              </div>
            </div>
            <CardTitle className="text-2xl">Welcome to ZeusOS</CardTitle>
            <CardDescription>
              Sign in to your Zeus Group workspace
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div
                role="alert"
                data-testid="login-error"
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-destructive text-sm"
              >
                {error}
              </div>
            )}

            {/* Email / password form */}
            <form onSubmit={handleEmailSignIn} noValidate className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  data-testid="email-input"
                  type="email"
                  placeholder="you@zeusgroup.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  data-testid="password-input"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <Button
                type="submit"
                data-testid="login-button"
                className="w-full"
                disabled={isBusy}
              >
                {isEmailLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sign in
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google sign-in */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isBusy}
              data-testid="google-login-button"
            >
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continue with Google
            </Button>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Don&apos;t have an account?{' '}
              <span className="text-muted-foreground">
                Contact your administrator
              </span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
