/**
 * ObligationsPage
 * List of compliance obligations with status, frequency, next due, and actions.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import {
  Plus,
  Search,
  Loader2,
  ClipboardCheck,
  RefreshCw,
  Calendar,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useComplianceObligations } from '../hooks/useComplianceObligations';
import { ObligationForm } from '../components/ObligationForm';
import { ObligationDetailDrawer } from '../components/ObligationDetailDrawer';
import type {
  ComplianceObligation,
  ComplianceObligationInput,
  ObligationStatus,
  ComplianceDocumentCategory,
} from '../types';
import {
  OBLIGATION_STATUS_LABELS,
  OBLIGATION_PRIORITY_LABELS,
  OBLIGATION_PRIORITY_COLORS,
  CATEGORY_LABELS,
  REGULATORY_BODY_LABELS,
  FREQUENCY_LABELS,
} from '../types/constants';
import { useComplianceCompanyId } from '../hooks/useComplianceScope';

export function ObligationsPage() {
  const companyId = useComplianceCompanyId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ObligationStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<ComplianceDocumentCategory | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [selectedObligation, setSelectedObligation] = useState<ComplianceObligation | null>(null);

  const filters = useMemo(
    () => ({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(categoryFilter ? { category: categoryFilter } : {}),
    }),
    [statusFilter, categoryFilter]
  );

  const { obligations, loading, error, refresh, create, remove, complete } =
    useComplianceObligations(companyId, filters);

  const filteredObligations = useMemo(() => {
    if (!search) return obligations;
    const q = search.toLowerCase();
    return obligations.filter(
      o =>
        o.title.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q)
    );
  }, [obligations, search]);

  const handleSave = async (input: Partial<ComplianceObligationInput>) => {
    await create(input);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search obligations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ObligationStatus | '')}
          className="text-sm border rounded-md px-3 py-2 bg-background"
        >
          <option value="">All Statuses</option>
          {Object.entries(OBLIGATION_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as ComplianceDocumentCategory | '')}
          className="text-sm border rounded-md px-3 py-2 bg-background"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Obligation
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && obligations.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--rag-green)]" />
        </div>
      )}

      {/* Empty */}
      {!loading && filteredObligations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-2">No obligations found</p>
            <Button variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Obligation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Obligations List */}
      {filteredObligations.length > 0 && (
        <div className="space-y-2">
          {filteredObligations.map(o => {
            const nextDue = o.nextDueDate?.toDate();
            const isOverdue = nextDue && nextDue < new Date();
            const lastCompleted = o.lastCompletedDate?.toDate();

            return (
              <Card
                key={o.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedObligation(o)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardCheck className="h-4 w-4 text-[var(--rag-green)] shrink-0" />
                        <p className="text-sm font-medium">{o.title}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{REGULATORY_BODY_LABELS[o.regulatoryBody]}</span>
                        <span>{CATEGORY_LABELS[o.category]}</span>
                        <span>{FREQUENCY_LABELS[o.frequency]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', OBLIGATION_PRIORITY_COLORS[o.priority])}>
                        {OBLIGATION_PRIORITY_LABELS[o.priority]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {nextDue && (
                      <span className={cn('flex items-center gap-1', isOverdue ? 'text-[var(--rag-red)] font-medium' : '')}>
                        {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                        {isOverdue ? 'Overdue' : 'Next due'}: {nextDue.toLocaleDateString()}
                      </span>
                    )}
                    {lastCompleted && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-[var(--rag-green)]" />
                        Last: {lastCompleted.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <ObligationForm
        open={showForm}
        onOpenChange={setShowForm}
        onSave={handleSave}
      />

      {/* Detail Drawer */}
      <ObligationDetailDrawer
        obligation={selectedObligation}
        open={!!selectedObligation}
        onClose={() => setSelectedObligation(null)}
        onComplete={async id => {
          await complete(id);
          setSelectedObligation(null);
        }}
        onDelete={async id => {
          await remove(id);
          setSelectedObligation(null);
        }}
      />
    </div>
  );
}
