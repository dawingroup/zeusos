// ============================================================================
// FINANCE DOCUMENT LIBRARY
// ZeusOS v2.0 - Financial Management Module
// Searchable/filterable document table with Google Drive links
// ============================================================================

import { useState } from 'react';
import {
  Search,
  Plus,
  ExternalLink,
  Trash2,
  FileText,
  Receipt,
  Landmark,
  FileCheck,
  PieChart,
  Users,
  Shield,
  Mail,
  File,
  Filter,
  X,
  FolderOpen,
} from 'lucide-react';
import type { FinanceDocument, FinanceDocumentCategory } from '../../types/integrations.types';
import {
  FINANCE_DOCUMENT_CATEGORIES,
  FINANCE_DOCUMENT_STATUS_COLORS,
  FINANCE_DOCUMENT_STATUSES,
} from '../../constants/integrations.constants';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice: FileText,
  receipt: Receipt,
  bank_statement: Landmark,
  tax_filing: FileCheck,
  contract: FileText,
  audit_report: FileCheck,
  budget_report: PieChart,
  payroll_record: Users,
  insurance: Shield,
  correspondence: Mail,
  other: File,
};

interface FinanceDocumentLibraryProps {
  documents: FinanceDocument[];
  loading: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  onAdd: () => void;
  onDelete: (documentId: string) => void;
  onFilterCategory: (category: FinanceDocumentCategory | null) => void;
  activeCategory: FinanceDocumentCategory | null;
  categoryCounts: Record<string, number>;
  totalCount: number;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '—';
  const date = timestamp?.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function FinanceDocumentLibrary({
  documents,
  loading,
  search,
  onSearchChange,
  onAdd,
  onDelete,
  onFilterCategory,
  activeCategory,
  categoryCounts,
  totalCount,
}: FinanceDocumentLibraryProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const categoryEntries = Object.entries(FINANCE_DOCUMENT_CATEGORIES) as [
    FinanceDocumentCategory,
    string,
  ][];

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search documents by name, tags..."
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Document
        </button>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-gray-400" />
        <button
          onClick={() => onFilterCategory(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            !activeCategory
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({totalCount})
        </button>
        {categoryEntries.map(([key, label]) => {
          const count = categoryCounts[key] || 0;
          if (count === 0 && !activeCategory) return null;
          return (
            <button
              key={key}
              onClick={() => onFilterCategory(activeCategory === key ? null : key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === key
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Document List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse h-14 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {search ? 'No documents match your search' : 'No finance documents yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {documents.map((doc) => {
            const Icon = CATEGORY_ICONS[doc.category] || File;
            const statusColor = FINANCE_DOCUMENT_STATUS_COLORS[doc.status] || 'gray';

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-gray-50">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-medium text-gray-900 truncate">
                      {doc.name}
                    </h5>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium bg-${statusColor}-100 text-${statusColor}-700`}
                    >
                      {FINANCE_DOCUMENT_STATUSES[doc.status] || doc.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>{FINANCE_DOCUMENT_CATEGORIES[doc.category]}</span>
                    {doc.fiscalYear && <span>FY {doc.fiscalYear}</span>}
                    <span>{formatDate(doc.uploadedAt)}</span>
                    <span>{formatFileSize(doc.fileSize)}</span>
                  </div>
                  {doc.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {doc.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]"
                        >
                          {tag}
                        </span>
                      ))}
                      {doc.tags.length > 4 && (
                        <span className="text-[10px] text-gray-400">
                          +{doc.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {(doc.googleDriveUrl || doc.fileUrl) && (
                    <a
                      href={doc.googleDriveUrl || doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md hover:bg-blue-50 text-blue-500"
                      title="Open file"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  {confirmDeleteId === doc.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onDelete(doc.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(doc.id)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FinanceDocumentLibrary;
