/**
 * NotFoundPage
 * 404 error page
 */

import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/core/components/ui/button';

export default function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Page Not Found | Dawin Advisory Platform</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="text-8xl font-bold text-muted-foreground mb-4">404</div>
          <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
          <p className="text-muted-foreground mb-8">
            Sorry, we couldn't find the page you're looking for. It might have been
            moved or deleted.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
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
        </div>
      </div>
    </>
  );
}
