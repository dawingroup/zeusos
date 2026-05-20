/**
 * ProfilePage
 * User profile page
 */

import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { useAuth } from '@/shared/hooks';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <>
      <Helmet>
        <title>Profile | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <p className="text-muted-foreground">{user?.displayName || 'Not set'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <p className="text-muted-foreground">{user?.email || 'Not set'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
