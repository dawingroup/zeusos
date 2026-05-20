/**
 * UnauthorizedPage
 * 403 access denied page
 */

import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ShieldOff, Home, ArrowLeft, LogIn } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { useAuth } from '@/shared/hooks';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <>
      <Helmet>
        <title>Unauthorized | Dawin Advisory Platform</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-destructive/10 p-4">
              <ShieldOff className="h-12 w-12 text-destructive" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-8">
            You don't have permission to access this page. Please contact your
            administrator if you believe this is an error.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button asChild>
              <Link to="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
          </div>

          {user && (
            <div className="mt-8 pt-8 border-t">
              <p className="text-sm text-muted-foreground mb-4">
                Signed in as {user.email}
              </p>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign in with different account
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
