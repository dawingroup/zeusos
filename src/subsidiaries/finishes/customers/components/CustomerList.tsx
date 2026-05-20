/**
 * CustomerList Component
 * Displays filterable list of customers with search and status filters
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Building2, Download, RefreshCw, ChevronRight } from 'lucide-react';
import { useCustomers } from '../hooks';
import type { CustomerStatus, CustomerType } from '../types';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

const STATUS_CONFIG: Record<CustomerStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactive' },
  prospect: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Prospect' },
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
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<CustomerType | ''>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleImportFromQuickBooks = async () => {
    setIsImporting(true);
    setImportResult(null);
    
    try {
      const response = await fetch(`${API_BASE}/quickbooks/import-customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }
      
      setImportResult({
        success: true,
        message: `Imported ${data.results.imported} new, updated ${data.results.updated} existing (${data.results.total} total in QuickBooks)`,
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
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    searchQuery,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Error loading customers: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleImportFromQuickBooks}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isImporting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isImporting ? 'Importing...' : 'Import from QuickBooks'}
          </button>
          <button
            onClick={onNewCustomer}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Customer
          </button>
        </div>
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div className={`p-3 rounded-lg ${importResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {importResult.message}
          <button onClick={() => setImportResult(null)} className="ml-2 underline text-sm">Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | '')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="prospect">Prospect</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as CustomerType | '')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Types</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="contractor">Contractor</option>
            <option value="designer">Designer</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
      </div>

      {/* Customer Table */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No customers found</h3>
          <p className="text-gray-500 mt-1">
            {searchQuery || statusFilter || typeFilter
              ? 'Try adjusting your filters'
              : 'Create your first customer to get started'}
          </p>
          {!searchQuery && !statusFilter && !typeFilter && (
            <button
              onClick={onNewCustomer}
              className="mt-4 text-primary hover:underline"
            >
              Add Customer
            </button>
          )}
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
                <th className="px-3 py-2.5 text-right w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const statusConfig = STATUS_CONFIG[customer.status];
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
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>
                      <span className="truncate block max-w-[200px]">{customer.email || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>{customer.phone || '—'}</td>
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
