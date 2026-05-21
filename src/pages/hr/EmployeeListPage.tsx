/**
 * EmployeeListPage.tsx
 * Employee directory with search, filters, and bulk actions
 * ZeusOS v2.0 - Phase 8.6
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Download,
  MoreVertical,
  Mail,
  Eye,
  Edit,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Users,
  Building2,
  Loader2,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Skeleton } from '@/core/components/ui/skeleton';
import { Checkbox } from '@/core/components/ui/checkbox';
import { RagBadge, Banner } from '@/shared/components/data-display';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';

import { useEmployeeList } from '@/modules/hr-central/hooks/useEmployee';
import { bulkSetEmployeeSubsidiary } from '@/modules/hr-central/services/employee.service';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useCurrentUserId } from '@/contexts/AuthContext';
import type { EmploymentStatus } from '@/modules/hr-central/types/employee.types';

const STATUS_TONE: Record<EmploymentStatus, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  active: 'green',
  probation: 'amber',
  on_leave: 'blue',
  suspended: 'red',
  terminated: 'na',
  resigned: 'na',
  notice_period: 'amber',
  retired: 'na',
};

type SortField = 'name' | 'email' | 'department' | 'position' | 'hireDate' | 'status';
type SortOrder = 'asc' | 'desc';

export function EmployeeListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | 'all'>(
    (searchParams.get('status') as EmploymentStatus) || 'all'
  );
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('department') || 'all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(25);

  const { employees, loading, error } = useEmployeeList(
    {
      searchQuery: search || undefined,
      employmentStatuses: statusFilter === 'all' ? undefined : [statusFilter],
      departmentIds: departmentFilter === 'all' ? undefined : [departmentFilter] as any,
    }
  );

  // Mock departments for now - should come from a department hook
  const departments: Array<{ id: string; name: string }> = [];

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (departmentFilter !== 'all') params.set('department', departmentFilter);
    setSearchParams(params, { replace: true });
  }, [search, statusFilter, departmentFilter, setSearchParams]);

  // Sort employees
  const sortedEmployees = useMemo(() => {
    if (!employees) return [];
    
    return [...employees].sort((a, b) => {
      let aVal: string | number | Date = '';
      let bVal: string | number | Date = '';
      
      switch (sortField) {
        case 'name':
          aVal = a.fullName?.toLowerCase() || '';
          bVal = b.fullName?.toLowerCase() || '';
          break;
        case 'email':
          aVal = a.email?.toLowerCase() || '';
          bVal = b.email?.toLowerCase() || '';
          break;
        case 'department':
          aVal = (a.departmentName || a.departmentId || '').toLowerCase();
          bVal = (b.departmentName || b.departmentId || '').toLowerCase();
          break;
        case 'position':
          aVal = a.title?.toLowerCase() || '';
          bVal = b.title?.toLowerCase() || '';
          break;
        case 'hireDate':
          aVal = a.joiningDate?.toDate?.() || new Date(0);
          bVal = b.joiningDate?.toDate?.() || new Date(0);
          break;
        case 'status':
          aVal = a.employmentStatus || '';
          bVal = b.employmentStatus || '';
          break;
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [employees, sortField, sortOrder]);

  // Paginate
  const paginatedEmployees = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedEmployees.slice(start, start + rowsPerPage);
  }, [sortedEmployees, page, rowsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDepartmentFilter('all');
  };

  const hasActiveFilters = search || statusFilter !== 'all' || departmentFilter !== 'all';

  // ── Bulk subsidiary tagging ─────────────────────────────────────────
  const { subsidiaries, currentSubsidiary } = useSubsidiary();
  const userId = useCurrentUserId();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubsidiaryId, setBulkSubsidiaryId] = useState<string>(currentSubsidiary?.id || '');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const subsidiaryNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of subsidiaries) m[s.id] = s.shortName || s.name;
    return m;
  }, [subsidiaries]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePageSelectAll = () => {
    const pageIds = paginatedEmployees.map((e) => e.id);
    setSelectedIds((prev) => {
      const allSelected = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of pageIds) {
        if (allSelected) next.delete(id); else next.add(id);
      }
      return next;
    });
  };

  const selectUntaggedOrMismatched = () => {
    const targetId = bulkSubsidiaryId;
    if (!targetId) return;
    const ids = sortedEmployees
      .filter((e) => !e.subsidiaryId || e.subsidiaryId !== targetId)
      .map((e) => e.id);
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const applyBulkSubsidiary = async () => {
    if (!bulkSubsidiaryId || selectedIds.size === 0 || !userId) return;
    setBulkApplying(true);
    setBulkError(null);
    try {
      await bulkSetEmployeeSubsidiary(Array.from(selectedIds), bulkSubsidiaryId, userId);
      clearSelection();
      // Force a reload — the useEmployeeList hook will re-fetch on
      // next mount; for now the simplest signal is a route refresh.
      window.location.reload();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Bulk update failed');
    } finally {
      setBulkApplying(false);
    }
  };
  // ────────────────────────────────────────────────────────────────────

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      className="flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field && (
        sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
      )}
    </button>
  );

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-6 max-w-[1640px] mx-auto">
        <Banner tone="danger" title="Failed to load employees" message={error.message} />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2">
            <Users className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            Employees
          </h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            {sortedEmployees.length} total employees · People operations across all subsidiaries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/hr/employees/new')}>
            <Plus className="h-3.5 w-3.5" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3.5">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                style={{ color: 'var(--fg-tertiary)' }}
              />
              <Input
                placeholder="Search by name, role, ID, department…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--fg-tertiary)' }}
                  onClick={() => setSearch('')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EmploymentStatus | 'all')}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="probation">Probation</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
                <SelectItem value="resigned">Resigned</SelectItem>
              </SelectContent>
            </Select>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments?.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk subsidiary tagging toolbar */}
      <Card
        style={{
          borderColor: 'var(--rag-blue)',
          backgroundColor: 'var(--rag-blue-soft)',
        }}
      >
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--rag-blue)' }} />
          <span className="text-[12.5px]" style={{ color: 'var(--fg-primary)' }}>
            {selectedIds.size > 0 ? (
              <><span className="font-semibold">{selectedIds.size}</span> selected</>
            ) : (
              <>Tag employees with their company</>
            )}
          </span>
          <Select value={bulkSubsidiaryId} onValueChange={setBulkSubsidiaryId}>
            <SelectTrigger className="w-[200px] h-9 bg-white">
              <SelectValue placeholder="Choose company" />
            </SelectTrigger>
            <SelectContent>
              {subsidiaries.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={selectUntaggedOrMismatched} disabled={!bulkSubsidiaryId}>
            Select untagged + mismatched
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
          )}
          <Button
            size="sm"
            onClick={applyBulkSubsidiary}
            disabled={!bulkSubsidiaryId || selectedIds.size === 0 || bulkApplying}
            className="ml-auto"
          >
            {bulkApplying && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
            Apply to {selectedIds.size || 0}
          </Button>
          {bulkError && (
            <span
              className="basis-full text-[11.5px]"
              style={{ color: 'var(--rag-red)' }}
            >
              {bulkError}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Table — DataTable-style chrome */}
      <div
        className="overflow-x-auto rounded-[10px] border shadow-[var(--shadow-sm)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <table className="w-full border-collapse">
            <thead>
              <tr
                className="border-b"
                style={{
                  backgroundColor: 'var(--bg-sunken)',
                  borderColor: 'var(--border-default)',
                }}
              >
                <th
                  className="w-10 px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-wider text-left"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  <Checkbox
                    checked={paginatedEmployees.length > 0 && paginatedEmployees.every(e => selectedIds.has(e.id))}
                    onCheckedChange={togglePageSelectAll}
                    aria-label="Select all on page"
                  />
                </th>
                <th
                  className="text-left px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  <SortHeader field="name">Employee</SortHeader>
                </th>
                <th
                  className="text-left px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  <SortHeader field="email">Email</SortHeader>
                </th>
                <th
                  className="text-left px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  <SortHeader field="department">Department</SortHeader>
                </th>
                <th
                  className="text-left px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  <SortHeader field="position">Position</SortHeader>
                </th>
                <th
                  className="text-left px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  Company
                </th>
                <th
                  className="text-left px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  <SortHeader field="hireDate">Hire Date</SortHeader>
                </th>
                <th
                  className="text-left px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  <SortHeader field="status">Status</SortHeader>
                </th>
                <th className="w-12 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-4"><Skeleton className="h-4 w-4" /></td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div>
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20 mt-1" />
                        </div>
                      </div>
                    </td>
                    <td className="p-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                    <td className="p-4"><Skeleton className="h-8 w-8 rounded" /></td>
                  </tr>
                ))
              ) : paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center" style={{ color: 'var(--fg-tertiary)' }}>
                    {hasActiveFilters ? 'No employees match your filters' : 'No employees found'}
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={handleClearFilters} className="ml-2">
                        Clear filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((employee) => {
                  const isSelected = selectedIds.has(employee.id);
                  return (
                  <tr
                    key={employee.id}
                    className="border-b transition-colors cursor-pointer"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--accent-soft)' : undefined,
                      height: 'var(--row-h)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.backgroundColor = 'var(--bg-sunken)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => navigate(`/hr/employees/${employee.id}`)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(employee.id)}
                        aria-label={`Select ${employee.fullName}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-8 w-8 rounded-full grid place-items-center text-[11px] font-semibold shrink-0"
                          style={{
                            backgroundColor: 'var(--accent-soft)',
                            color: 'var(--accent)',
                          }}
                        >
                          {employee.fullName?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-[13px] font-medium m-0 truncate"
                            style={{ color: 'var(--fg-primary)' }}
                          >
                            {employee.fullName}
                          </p>
                          <p
                            className="text-[10.5px] font-mono m-0 truncate"
                            style={{ color: 'var(--fg-tertiary)' }}
                          >
                            {employee.employeeNumber || 'No ID'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--fg-secondary)' }}>
                        <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--fg-tertiary)' }} />
                        <span className="truncate">{employee.email}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: 'var(--fg-secondary)' }}>
                      {employee.departmentName || employee.departmentId || '—'}
                    </td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: 'var(--fg-primary)' }}>
                      {employee.title || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {employee.subsidiaryId ? (
                        <RagBadge tone="blue">
                          {subsidiaryNameById[employee.subsidiaryId] || employee.subsidiaryId}
                        </RagBadge>
                      ) : (
                        <RagBadge tone="amber">Untagged</RagBadge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[13px]" style={{ color: 'var(--fg-secondary)' }}>
                      {employee.joiningDate
                        ? new Date(
                            typeof employee.joiningDate === 'string'
                              ? employee.joiningDate
                              : employee.joiningDate.toDate?.() || employee.joiningDate
                          ).toLocaleDateString('en-UG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <RagBadge tone={STATUS_TONE[employee.employmentStatus]}>
                        {employee.employmentStatus?.replace('_', ' ')}
                      </RagBadge>
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/hr/employees/${employee.id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/hr/employees/${employee.id}/edit`)}>
                            <Edit className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            style={{ color: 'var(--rag-red)' }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>

        {/* Pagination */}
        {sortedEmployees.length > rowsPerPage && (
          <div
            className="flex items-center justify-between px-4 py-2.5 border-t"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <p className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>
              Showing {page * rowsPerPage + 1} to{' '}
              {Math.min((page + 1) * rowsPerPage, sortedEmployees.length)} of{' '}
              {sortedEmployees.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * rowsPerPage >= sortedEmployees.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeListPage;
