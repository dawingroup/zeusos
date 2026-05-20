/**
 * Payments Page - Project payment management for IPCs, Requisitions, and Accountabilities.
 * Uses UnifiedPaymentList with rich payment cards.
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Loader2,
  AlertCircle,
  ChevronLeft,
  Download,
} from 'lucide-react';
import { useProjectPayments, useProjectIPCs, useProjectRequisitions } from '../hooks/payment-hooks';
import { useProject } from '../hooks/project-hooks';
import { useProgram } from '../hooks/program-hooks';
import type { Accountability } from '../types/accountability';
import { UnifiedPaymentList } from '../components/payments';
import { db } from '@/core/services/firebase';

export function PaymentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { project, loading: projectLoading } = useProject(db, projectId || null);
  const { program } = useProgram(db, project?.programId || null);
  const { payments, summary, byType, loading, error } = useProjectPayments(db, projectId || null, { realtime: true });
  const { ipcs } = useProjectIPCs(db, projectId || null, true);
  const { requisitions } = useProjectRequisitions(db, projectId || null);

  const isContractorProject = program?.implementationType === 'contractor';

  // Cast accountability Payment[] to Accountability[] (they are stored as full entities)
  const accountabilities = byType.accountabilities as unknown as Accountability[];

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading payments...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/advisory/delivery/projects/${projectId}`}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
            <p className="text-gray-600">{project?.name || 'Project'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          {isContractorProject ? (
            <button
              onClick={() => navigate(`/advisory/delivery/projects/${projectId}/ipcs/new`)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New IPC
            </button>
          ) : (
            <button
              onClick={() => navigate(`/advisory/delivery/projects/${projectId}/requisitions/new`)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Requisition
            </button>
          )}
        </div>
      </div>

      {/* Unified Payment List with cards */}
      <UnifiedPaymentList
        payments={payments}
        ipcs={ipcs}
        requisitions={requisitions}
        accountabilities={accountabilities}
        summary={summary}
        isContractorProject={isContractorProject}
        currency={project?.budget?.currency || 'UGX'}
        onPaymentClick={(paymentId) => navigate(`/advisory/delivery/projects/${projectId}/payments/${paymentId}`)}
      />
    </div>
  );
}
