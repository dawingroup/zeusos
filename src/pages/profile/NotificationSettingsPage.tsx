/**
 * NotificationSettingsPage
 * User notification preferences
 */

import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';

export default function NotificationSettingsPage() {
  return (
    <>
      <Helmet>
        <title>Notification Settings | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
          <p className="text-muted-foreground">Manage your notification preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Notification settings will be displayed here</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
