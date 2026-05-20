/**
 * ClientDetailPage
 * View client details
 */

import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';

export default function ClientDetailPage() {
  const { clientId } = useParams();

  return (
    <>
      <Helmet>
        <title>Client Details | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Client Details</h1>
        <Card>
          <CardHeader>
            <CardTitle>Client {clientId}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Client details will be displayed here.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
