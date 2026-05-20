/**
 * EngagementDetailPage
 * View engagement details
 */

import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';

export default function EngagementDetailPage() {
  const { engagementId } = useParams();

  return (
    <>
      <Helmet>
        <title>Engagement Details | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-6">
          Engagement Details
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Engagement {engagementId}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Engagement details will be displayed here.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
