/**
 * CustomerList Component
 * Displays filterable grid of customers with search and status filters.
 * Migrated to portal redesign tokens.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Building2, Download, RefreshCw, ChevronRight } from 'lucide-react';
import { useCustomers } from '../hooks';
import type { CustomerStatus, CustomerType } from '../types';
import { syncQBOContactsToFirestore } from '@/modules/finance/services/qboSyncService';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { RagBadge, Banner, EmptyStateV2 } from '@/shared/components/data-display';

const COMPANY_ID = 'dawinos';

const STATUS_CONFIG: Record<
  CustomerStatus,
  { tone: 'green' | 'amber' | 'red' | 'blue' | 'na'; label: string }
> = {
  active: { tone: 'green', label: 'Active' },
  inactive: { tone: 'na', label: 'Inactive' },
  prospect: { tone: 'blue', label: 'Prospect' },
};

const TYPE_LABELS: Record<CustomerType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  contractor: 'Contractor',
  designer: 'Designer',
};

interface CustomerListProps {
  onNewCustomer?: () => void;
}

export function CustomerList({ onNewCustomer }: CustomerListProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<CustomerType | 'all'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleImportFromQuickBooks = async () => {
    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await syncQBOContactsToFirestore(COMPANY_ID, ['customers']);
      if (!result.success) {
        const errorMsg = result.errors ? Object.values(result.errors).join(', ') : 'Import failed';
        throw new Error(errorMsg);
      }
      const stats = result.results.customers;
      setImportResult({
        success: true,
        message: `Imported ${stats?.created ?? 0} new, updated ${stats?.updated ?? 0} existing, skipped ${stats?.skipped ?? 0} (${stats?.total ?? 0} total in QuickBooks)`,
      });
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const { filteredCustomers, loading, error } = useCustomers({
    status: statusFilter === 'all' ? undefined : statusFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
    searchQuery,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-7 w-7 border-2 border-t-transparent"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-6 max-w-[1640px] mx-auto">
        <Banner tone="danger" title="Error loading customers" message={error.message} />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Customers</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Manage your customer database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportFromQuickBooks}
            disabled={isImporting}
          >
            {isImporting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {isImporting ? 'Importing…' : 'Import from QuickBooks'}
          </Button>
          <Button variant="primary" size="sm" onClick={onNewCustomer}>
            <Plus className="h-3.5 w-3.5" /> New Customer
          </Button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <Banner
          tone={importResult.success ? 'success' : 'danger'}
          title={importResult.success ? 'Import complete' : 'Import failed'}
          message={importResult.message}
          onDismiss={() => setImportResult(null)}
        />
      )}

      {/* Filters */}
      <div
        className="rounded-[10px] border bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] p-3.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
              style={{ color: 'var(--fg-tertiary)' }}
            />
            <Input
              placeholder="Search customers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CustomerStatus | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CustomerType | 'all')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="designer">Designer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>
        {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
      </div>

      {/* Customer Table */}
      {filteredCustomers.length === 0 ? (
        <div
          className="rounded-[10px] border bg-[var(--bg-surface)]"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <EmptyStateV2
            icon={<Building2 className="h-6 w-6" />}
            title="No customers found"
            message={
              searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first customer to get started'
            }
            action={
              !searchQuery && statusFilter === 'all' && typeFilter === 'all' ? (
                <Button variant="primary" size="sm" onClick={onNewCustomer}>
                  <Plus className="h-3.5 w-3.5" /> Add Customer
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-[10px] border shadow-[var(--shadow-sm)]"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <table className="min-w-full border-collapse">
            <thead>
              <tr
                className="border-b"
                style={{
                  backgroundColor: 'var(--bg-sunken)',
                  borderColor: 'var(--border-default)',
                }}
              >
                <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider min-w-[200px]" style={{ color: 'var(--fg-tertiary)' }}>Customer</th>
                <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Code</th>
                <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Type</th>
                <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Status</th>
                <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Email</th>
                <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Phone</th>
                <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Primary Contact</th>
                <th className="px-3 py-2.5 text-right w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const statusConfig = STATUS_CONFIG[customer.status];
                const primary = customer.contacts && customer.contacts.length > 0
                  ? customer.contacts.find((c) => c.isPrimary) || customer.contacts[0]
                  : null;
                return (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="border-b transition-colors cursor-pointer"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <td className="px-3 py-2">
                      <div className="text-[13px] font-medium truncate max-w-[200px]" style={{ color: 'var(--fg-primary)' }}>
                        {customer.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono" style={{ color: 'var(--fg-tertiary)' }}>{customer.code}</td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>{TYPE_LABELS[customer.type]}</td>
                    <td className="px-3 py-2">
                      <RagBadge tone={statusConfig.tone}>{statusConfig.label}</RagBadge>
                    </td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>
                      <span className="truncate block max-w-[200px]">{customer.email || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>{customer.phone || '—'}</td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>
                      {primary ? (
                        <span className="truncate block max-w-[180px]">
                          {primary.name}
                          {primary.title ? ` (${primary.title})` : ''}
                          {customer.contacts && customer.contacts.length > 1 ? ` +${customer.contacts.length - 1}` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--fg-quaternary)' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div
            className="px-4 py-2.5 border-t text-[11.5px]"
            style={{
              backgroundColor: 'var(--bg-sunken)',
              borderColor: 'var(--border-default)',
              color: 'var(--fg-tertiary)',
            }}
          >
            {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} shown
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerList;
