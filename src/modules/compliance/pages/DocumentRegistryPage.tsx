/**
 * DocumentRegistryPage
 * Grid of all compliance documents with filters, status badges,
 * progress indicators, and detail drawer.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Search, Loader2, FileText, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useComplianceDocuments } from '../hooks/useComplianceDocuments';
import { DocumentDetailDrawer } from '../components/DocumentDetailDrawer';
import type {
  ComplianceDocument,
  ComplianceDocumentStatus,
  ComplianceDocumentCategory,
} from '../types';
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_COLORS,
  CATEGORY_LABELS,
  REGULATORY_BODY_LABELS,
  FREQUENCY_LABELS,
} from '../types/constants';
import { useComplianceCompanyId } from '../hooks/useComplianceScope';

export function DocumentRegistryPage() {
  const companyId = useComplianceCompanyId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplianceDocumentStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<ComplianceDocumentCategory | ''>('');
  const [selectedDoc, setSelectedDoc] = useState<ComplianceDocument | null>(null);

  const filters = useMemo(
    () => ({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(categoryFilter ? { category: categoryFilter } : {}),
    }),
    [statusFilter, categoryFilter]
  );

  const { documents, loading, error, refresh, update, remove, uploadFile, toggleChecklist, changeStatus } =
    useComplianceDocuments(companyId, filters);

  const filteredDocs = useMemo(() => {
    if (!search) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      d =>
        d.name.toLowerCase().includes(q) ||
        d.documentType.toLowerCase().includes(q) ||
        d.referenceNumber?.toLowerCase().includes(q)
    );
  }, [documents, search]);

  // Keep selectedDoc in sync with documents state (for checklist updates)
  const currentDoc = selectedDoc
    ? documents.find(d => d.id === selectedDoc.id) || selectedDoc
    : null;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ComplianceDocumentStatus | '')}
          className="text-sm border rounded-md px-3 py-2 bg-background"
        >
          <option value="">All Statuses</option>
          {Object.entries(DOCUMENT_STATUS_LABELS).map(([k, v]) => (
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
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && documents.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--rag-green)]" />
        </div>
      )}

      {/* Empty */}
      {!loading && filteredDocs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No documents found</p>
          </CardContent>
        </Card>
      )}

      {/* Documents Grid */}
      {filteredDocs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map(doc => {
            const expiry = doc.expiryDate?.toDate();
            const checklist = doc.checklist || [];
            const completedCount = checklist.filter(c => c.completed).length;
            const progress = doc.complianceProgress ?? (checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0);

            return (
              <Card
                key={doc.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedDoc(doc)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium line-clamp-1 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[var(--rag-green)] shrink-0" />
                      {doc.name}
                    </CardTitle>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap', DOCUMENT_STATUS_COLORS[doc.status])}>
                      {DOCUMENT_STATUS_LABELS[doc.status]}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-1.5 text-xs text-muted-foreground">
                  <p>{CATEGORY_LABELS[doc.category]}</p>
                  {doc.regulatoryBody && (
                    <p>{REGULATORY_BODY_LABELS[doc.regulatoryBody]}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span>{FREQUENCY_LABELS[doc.renewalFrequency]}</span>
                    {expiry && <span>Expires: {expiry.toLocaleDateString()}</span>}
                  </div>

                  {/* Progress Bar */}
                  {checklist.length > 0 && (
                    <div className="pt-1.5">
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span>{completedCount}/{checklist.length} steps</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            progress === 100 ? 'bg-[var(--rag-green)]' : progress >= 50 ? 'bg-[var(--rag-green)]' : 'bg-[var(--rag-amber)]'
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {doc.fileUrl && (
                    <div className="flex items-center gap-1 text-[var(--rag-blue)] pt-1">
                      <FileText className="h-3 w-3" />
                      <span>File attached</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Drawer */}
      <DocumentDetailDrawer
        document={currentDoc}
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onUpdate={async (id, updates) => {
          await update(id, updates);
          setSelectedDoc(null);
        }}
        onDelete={async id => {
          await remove(id);
          setSelectedDoc(null);
        }}
        onUploadFile={async (docId, file) => {
          await uploadFile(docId, file);
          setSelectedDoc(null);
        }}
        onToggleChecklist={async (docId, itemId) => {
          const updated = await toggleChecklist(docId, itemId);
          return updated;
        }}
        onChangeStatus={async (docId, newStatus) => {
          await changeStatus(docId, newStatus);
          setSelectedDoc(null);
        }}
      />
    </div>
  );
}
