/**
 * VerifyEmailPage
 * Email verification page
 */

import { Helmet } from 'react-helmet-async';
import { Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/core/components/ui/card';
import { useAuth } from '@/shared/hooks';

export default function VerifyEmailPage() {
  const { user, signOut } = useAuth();

  const handleResendEmail = async () => {
    // Implement resend email verification
    console.log('Resending verification email...');
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <Helmet>
        <title>Verify Email | ZeusOS</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-blue-100 p-4">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Verify your email</CardTitle>
            <CardDescription>
              We've sent a verification email to {user?.email || 'your email address'}. 
              Please check your inbox and click the verification link.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleResendEmail}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend verification email
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <Button variant="ghost" className="w-full" onClick={handleSignOut}>
              Sign in with different account
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              If you don't see the email, check your spam folder. If you're still having trouble, 
              contact <a href="mailto:support@dawin.co" className="text-primary hover:underline">support@dawin.co</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
