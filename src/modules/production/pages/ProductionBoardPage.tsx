/**
 * /production — kanban board: one column per stage, job cards with type badge.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProductionJobs } from '../services/production-job.service';
import type { ProductionJob } from '../types/production-job.types';
import { ProductionKanban } from '../components/ProductionKanban';

export default function ProductionBoardPage() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProductionJobs()
      .then(setJobs)
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Production Board</h1>
          <p className="text-sm text-muted-foreground">
            Track TVC shoots, radio recordings, photography, print and exhibition jobs across 10 stages.
          </p>
        </div>
        <Link
          to="/production/new"
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          New Job
        </Link>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading production board…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && (
        <ProductionKanban jobs={jobs} />
      )}
    </div>
  );
}
