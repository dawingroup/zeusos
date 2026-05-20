/**
 * AuditLogPage
 * System audit logs
 */

import { Helmet } from 'react-helmet-async';
import { FileText } from 'lucide-react';
import { EmptyState } from '@/shared/components/feedback/EmptyState';

export default function AuditLogPage() {
  return (
    <>
      <Helmet>
        <title>Audit Log | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">View system activity and changes</p>
        </div>

        <EmptyState
          icon={FileText}
          title="No audit entries"
          description="Audit logs will appear here as activity occurs"
        />
      </div>
    </>
  );
}
