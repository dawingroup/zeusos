/**
 * MigrationDashboardPage
 * Data migration management
 */

import { Helmet } from 'react-helmet-async';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';

export default function MigrationDashboardPage() {
  return (
    <>
      <Helmet>
        <title>Data Migration | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Data Migration</h1>
          <p className="text-muted-foreground">Manage data migrations and imports</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Migration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No migrations in progress</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
