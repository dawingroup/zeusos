/**
 * PROJECT PICKER
 *
 * Mobile-first searchable project selector for quick captures.
 * Receives projects as props from the parent (avoids duplicate fetches).
 * Renders as a bottom-sheet overlay on tap.
 */

import { useState, useMemo } from 'react';
import { Search, ChevronDown, X, Loader2, FolderOpen } from 'lucide-react';
import { formatBudgetAmount } from '../../types/project-budget';
import { PROJECT_STATUSES } from '../../types/project';
import type { Project } from '../../types/project';

interface ProjectPickerProps {
  value: string | null;
  selectedName?: string;
  onChange: (projectId: string, projectName: string, programId: string, currency: 'UGX' | 'USD') => void;
  projects: Project[];
  loading?: boolean;
  error?: Error | null;
  /** Project IDs to exclude from the list (e.g. already selected in matrix) */
  excludeIds?: string[];
  /** When true, the picker opens immediately (no trigger button shown) */
  autoOpen?: boolean;
  /** Called when the picker is dismissed without selecting */
  onClose?: () => void;
  className?: string;
}

export function ProjectPicker({ value, selectedName, onChange, projects, loading = false, error = null, excludeIds, autoOpen = false, onClose, className }: ProjectPickerProps) {
  const [open, setOpen] = useState(autoOpen);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const excludeSet = excludeIds ? new Set(excludeIds) : null;
    let list = excludeSet ? projects.filter((p) => !excludeSet.has(p.id)) : projects;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        (p.location?.district || '').toLowerCase().includes(q)
    );
  }, [projects, search, excludeIds]);

  const handleSelect = (project: Project) => {
    onChange(
      project.id,
      project.name,
      project.programId,
      project.budget?.currency || 'UGX'
    );
    setOpen(false);
    setSearch('');
  };

  const handleClose = () => {
    setOpen(false);
    setSearch('');
    onClose?.();
  };

  return (
    <>
      {/* Collapsed trigger button (hidden when autoOpen) */}
      {!autoOpen && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-3 text-left min-h-[48px] bg-white hover:border-gray-400 transition-colors ${className || ''}`}
        >
          {value ? (
            <div className="flex-1 min-w-0">
              <p className="text-base text-gray-900 truncate">{selectedName || value}</p>
            </div>
          ) : (
            <span className="text-gray-400">Select project...</span>
          )}
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
        </button>
      )}

      {/* Bottom-sheet overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white sm:bg-black/50 sm:items-center sm:justify-center">
          <div className="flex-1 flex flex-col bg-white sm:max-w-lg sm:w-full sm:rounded-2xl sm:max-h-[85vh] sm:flex-initial">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Select Project</h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, code, or district..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm min-h-[44px]"
                />
              </div>
            </div>

            {/* Project List */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Loading projects...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-500">Failed to load projects</p>
                  <p className="text-xs text-gray-400 mt-1">{error.message}</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <FolderOpen className="w-8 h-8 mb-2" />
                  <p className="text-sm font-medium text-gray-500">
                    {search ? 'No matching projects' : 'No active projects found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((project) => {
                    const isSelected = value === project.id;
                    const statusConfig = PROJECT_STATUSES[project.status];
                    const budgetRemaining = project.budget?.remaining ?? 0;
                    const budgetCurrency = project.budget?.currency || 'UGX';

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => handleSelect(project)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors min-h-[56px] ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {project.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">{project.projectCode}</span>
                              {statusConfig && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                                  {statusConfig.label}
                                </span>
                              )}
                            </div>
                            {project.location?.district && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {project.location.district}, {project.location.region}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <p className="text-sm font-semibold text-gray-900">
                              {formatBudgetAmount(budgetRemaining, budgetCurrency as 'UGX' | 'USD')}
                            </p>
                            <p className="text-xs text-gray-400">remaining</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
