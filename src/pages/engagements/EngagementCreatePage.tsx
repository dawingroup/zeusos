/**
 * EngagementCreatePage
 * Create new engagement
 */

import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';

export default function EngagementCreatePage() {
  return (
    <>
      <Helmet>
        <title>Create Engagement | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-6">
          Create Engagement
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>New Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Engagement creation form will be displayed here.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
