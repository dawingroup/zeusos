/**
 * ServerErrorPage
 * 500 server error page
 */

import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/core/components/ui/button';

export default function ServerErrorPage() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <>
      <Helmet>
        <title>Server Error | Dawin Advisory Platform</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-8">
            We're experiencing technical difficulties. Please try again later or
            contact support if the problem persists.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Page
            </Button>
            <Button asChild>
              <Link to="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
