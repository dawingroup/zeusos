/**
 * BOQ List Component
 * Displays all BOQs for a project with filtering and search
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Copy,
  Bot,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';

type BOQStatus = 'draft' | 'active' | 'approved' | 'archived' | 'superseded';
type SortField = 'name' | 'status' | 'totalValue' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

interface BOQSummary {
  totalValue?: number;
  itemCount?: number;
  sectionCount?: number;
}

interface BOQ {
  id: string;
  name: string;
  description?: string;
  status: BOQStatus;
  version?: string;
  summary?: BOQSummary;
  updatedAt: Date | string;
  createdAt: Date | string;
}

const STATUS_COLORS: Record<BOQStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  archived: 'bg-yellow-100 text-yellow-700',
  superseded: 'bg-red-100 text-red-700',
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const BOQList: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  // Placeholder data - will connect to hooks later
  const boqs: BOQ[] = [
    {
      id: '1',
      name: 'Main Building BOQ',
      description: 'Bill of quantities for main building construction',
      status: 'approved',
      version: '1.2',
      summary: { totalValue: 450000000, itemCount: 156, sectionCount: 12 },
      updatedAt: new Date(),
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Site Works BOQ',
      description: 'External works and landscaping',
      status: 'active',
      version: '1.0',
      summary: { totalValue: 85000000, itemCount: 42, sectionCount: 5 },
      updatedAt: new Date(Date.now() - 86400000),
      createdAt: new Date(Date.now() - 86400000 * 7),
    },
    {
      id: '3',
      name: 'MEP Works BOQ',
      description: 'Mechanical, Electrical, and Plumbing',
      status: 'draft',
      version: '0.1',
      summary: { totalValue: 120000000, itemCount: 89, sectionCount: 8 },
      updatedAt: new Date(Date.now() - 86400000 * 2),
      createdAt: new Date(Date.now() - 86400000 * 5),
    },
  ];
  const loading = false;
  const [error] = useState<Error | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Filter and sort BOQs
  const filteredBOQs = useMemo(() => {
    let result = [...(boqs || [])];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (boq) =>
          boq.name.toLowerCase().includes(query) ||
          boq.description?.toLowerCase().includes(query) ||
          boq.version?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'totalValue':
          comparison = (a.summary?.totalValue || 0) - (b.summary?.totalValue || 0);
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [boqs, searchQuery, sortField, sortDirection]);

  // Pagination
  const paginatedBOQs = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredBOQs.slice(start, start + rowsPerPage);
  }, [filteredBOQs, page, rowsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAction = (action: string, boq: BOQ) => {
    setMenuOpen(null);
    switch (action) {
      case 'view':
        navigate(`/advisory/matflow/${projectId}/boq/${boq.id}`);
        break;
      case 'edit':
        navigate(`/advisory/matflow/${projectId}/boq/${boq.id}/edit`);
        break;
      case 'duplicate':
        (async () => {
          try {
            const { collection, addDoc, doc, getDoc, Timestamp } = await import('firebase/firestore');
            const { db } = await import('../../../../../firebase/config');
            const boqDoc = await getDoc(doc(db, `matflow_projects/${projectId}/boqs`, boq.id));
            if (boqDoc.exists()) {
              const data = boqDoc.data();
              await addDoc(collection(db, `matflow_projects/${projectId}/boqs`), {
                ...data,
                name: `${data.name} (Copy)`,
                status: 'draft',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
              });
              window.location.reload();
            }
          } catch (error) {
            console.error('Failed to duplicate BOQ:', error);
            alert('Failed to duplicate BOQ');
          }
        })();
        break;
      case 'parse':
        navigate(`/advisory/matflow/${projectId}/ai-tools/parse?boqId=${boq.id}`);
        break;
      case 'delete':
        if (window.confirm(`Are you sure you want to delete "${boq.name}"? This action cannot be undone.`)) {
          (async () => {
            try {
              const { doc, deleteDoc } = await import('firebase/firestore');
              const { db } = await import('../../../../../firebase/config');
              await deleteDoc(doc(db, `matflow_projects/${projectId}/boqs`, boq.id));
              window.location.reload();
            } catch (error) {
              console.error('Failed to delete BOQ:', error);
              alert('Failed to delete BOQ');
            }
          })();
        }
        break;
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 ml-1" />
    );
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load BOQs: {error.message}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bill of Quantities</h1>
          <p className="text-gray-500">Manage project BOQs and material specifications</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/advisory/matflow/${projectId}/boq/upload`)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload BOQ
          </button>
          <button
            onClick={() => navigate(`/advisory/matflow/${projectId}/boq/new`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create BOQ
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search BOQs by name, description, or version..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center font-medium text-gray-700 hover:text-gray-900"
                  >
                    Name
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort('status')}
                    className="inline-flex items-center font-medium text-gray-700 hover:text-gray-900"
                  >
                    Status
                    <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Version
                </th>
                <th className="text-right px-4 py-3">
                  <button
                    onClick={() => handleSort('totalValue')}
                    className="inline-flex items-center font-medium text-gray-700 hover:text-gray-900"
                  >
                    Total Value
                    <SortIcon field="totalValue" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Items
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort('updatedAt')}
                    className="inline-flex items-center font-medium text-gray-700 hover:text-gray-900"
                  >
                    Last Updated
                    <SortIcon field="updatedAt" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                // Loading skeletons
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-48" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-12" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-8" /></td>
                  </tr>
                ))
              ) : paginatedBOQs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    {searchQuery
                      ? 'No BOQs match your search'
                      : 'No BOQs yet. Create or upload one to get started.'}
                  </td>
                </tr>
              ) : (
                paginatedBOQs.map((boq) => (
                  <tr
                    key={boq.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/advisory/matflow/${projectId}/boq/${boq.id}`)}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{boq.name}</p>
                        {boq.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">
                            {boq.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn('px-2 py-1 text-xs font-medium rounded', STATUS_COLORS[boq.status])}>
                        {boq.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      {boq.version || '1.0'}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-gray-900">
                      {formatCurrency(boq.summary?.totalValue || 0)}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-700">{boq.summary?.itemCount || 0} items</p>
                      <p className="text-xs text-gray-500">{boq.summary?.sectionCount || 0} sections</p>
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      {formatDate(boq.updatedAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(menuOpen === boq.id ? null : boq.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-500" />
                        </button>

                        {menuOpen === boq.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen(null);
                              }}
                            />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction('view', boq);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" /> View
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction('edit', boq);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" /> Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction('duplicate', boq);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" /> Duplicate
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction('parse', boq);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Bot className="w-4 h-4" /> AI Parse
                              </button>
                              <hr className="my-1 border-gray-200" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction('delete', boq);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, filteredBOQs.length)} of {filteredBOQs.length}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * rowsPerPage >= filteredBOQs.length}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BOQList;
