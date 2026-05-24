/**
 * QuickBooks Sync Dashboard
 * Central monitoring and control panel for all QuickBooks integrations
 */

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ShoppingCart,
  FileText,
  DollarSign,
  Package,
} from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  getQBOConnectionStatus,
  syncAllSuppliersToQuickBooks,
  syncMultiplePOsToBills,
} from '../services/qboSyncService';
import type { QBOConnectionStatus } from '../types/integrations.types';

export default function QBOSyncDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<QBOConnectionStatus | null>(null);
  const [syncStats, setSyncStats] = useState({
    pendingPOs: 0,
    pendingQuotes: 0,
    pendingMOs: 0,
    failedPOs: 0,
    failedQuotes: 0,
    failedMOs: 0,
  });
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);

      // Load connection status
      const status = await getQBOConnectionStatus();
      setConnectionStatus(status);

      // Load actual sync statistics from Firestore
      try {
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const { db } = await import('@/shared/services/firebase');

        // Count POs by sync status
        const approvedPOsSnap = await getDocs(
          query(collection(db, 'purchaseOrders'), where('status', 'in', ['approved', 'sent', 'received', 'closed']))
        );
        const pos = approvedPOsSnap.docs.map(d => d.data());
        const pendingPOs = pos.filter(p => !p.qboBillId && !p.qboSyncError).length;
        const failedPOs = pos.filter(p => p.qboSyncStatus === 'error').length;

        setSyncStats({
          pendingPOs,
          pendingQuotes: 0,
          pendingMOs: 0,
          failedPOs,
          failedQuotes: 0,
          failedMOs: 0,
        });
      } catch {
        console.warn('[QBODashboard] Failed to load sync stats');
      }
    } catch (error) {
      console.error('[QBODashboard] Error loading dashboard:', error);
      alert('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncAll(type: 'suppliers' | 'pos' | 'quotes' | 'mos') {
    if (!user) {
      alert('You must be logged in to perform sync operations');
      return;
    }

    setSyncing(type);
    try {
      let result;
      switch (type) {
        case 'suppliers':
          result = await syncAllSuppliersToQuickBooks();
          break;
        case 'pos': {
          // Fetch approved POs that haven't been synced
          const { collection: coll, getDocs: gd, query: q, where: w } = await import('firebase/firestore');
          const { db: fireDb } = await import('@/shared/services/firebase');
          const poSnap = await gd(
            q(coll(fireDb, 'purchaseOrders'),
              w('status', 'in', ['approved', 'sent', 'received', 'closed']),
              w('qboSyncStatus', '!=', 'synced'))
          );
          const poIds = poSnap.docs
            .filter(d => !d.data().qboBillId)
            .map(d => d.id);
          if (poIds.length === 0) {
            alert('No pending POs to sync');
            return;
          }
          result = await syncMultiplePOsToBills(poIds);
          break;
        }
        case 'quotes':
          alert('Quote bulk sync not yet implemented');
          return;
        case 'mos':
          alert('MO bulk sync not yet implemented');
          return;
      }

      if (result?.success) {
        alert(`Successfully synced ${result.synced} items`);
        loadDashboardData();
      } else {
        alert(`Sync completed with errors: ${result?.failed || 0} failed`);
      }
    } catch (error: any) {
      console.error('[QBODashboard] Sync failed:', error);
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isConnected = connectionStatus?.connected;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">QuickBooks Sync Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and manage all QuickBooks integrations across your organization
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Connection Status</h2>
          <button
            onClick={loadDashboardData}
            className="p-2 text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-md"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {isConnected ? (
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-12 h-12 bg-[var(--rag-green-soft)] rounded-full">
              <CheckCircle className="h-6 w-6 text-[var(--rag-green)]" />
            </div>
            <div>
              <p className="font-medium text-foreground">Connected to QuickBooks</p>
              <p className="text-sm text-muted-foreground">
                Company: {connectionStatus?.companyName || 'Unknown'}
              </p>
              {connectionStatus?.lastSyncAt && (
                <p className="text-xs text-[var(--fg-tertiary)]">
                  Last synced: {new Date(connectionStatus.lastSyncAt as any).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-12 h-12 bg-[var(--rag-red-soft)] rounded-full">
              <XCircle className="h-6 w-6 text-[var(--rag-red)]" />
            </div>
            <div>
              <p className="font-medium text-foreground">Not Connected</p>
              <p className="text-sm text-muted-foreground">
                Please connect to QuickBooks in settings to enable sync features
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sync Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Suppliers */}
        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-[var(--rag-blue)]" />
              <h3 className="font-medium text-foreground">Suppliers</h3>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">—</p>
          <p className="text-sm text-muted-foreground">Total synced</p>
          <button
            onClick={() => handleSyncAll('suppliers')}
            disabled={!isConnected || syncing === 'suppliers'}
            className="mt-3 w-full px-3 py-1.5 text-sm bg-[var(--rag-blue)] text-white rounded-md hover:bg-[var(--rag-blue)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing === 'suppliers' ? 'Syncing...' : 'Sync All Suppliers'}
          </button>
        </div>

        {/* Purchase Orders */}
        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
              <h3 className="font-medium text-foreground">Purchase Orders</h3>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">
            {syncStats.pendingPOs + syncStats.failedPOs}
          </p>
          <p className="text-sm text-muted-foreground">
            {syncStats.failedPOs > 0 && (
              <span className="text-[var(--rag-red)]">{syncStats.failedPOs} failed</span>
            )}
            {syncStats.failedPOs === 0 && 'All synced'}
          </p>
          <button
            onClick={() => handleSyncAll('pos')}
            disabled={!isConnected || syncing === 'pos'}
            className="mt-3 w-full px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing === 'pos' ? 'Syncing...' : 'Retry Failed POs'}
          </button>
        </div>

        {/* Quotes */}
        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-[var(--rag-green)]" />
              <h3 className="font-medium text-foreground">Quotes</h3>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">
            {syncStats.pendingQuotes + syncStats.failedQuotes}
          </p>
          <p className="text-sm text-muted-foreground">
            {syncStats.failedQuotes > 0 && (
              <span className="text-[var(--rag-red)]">{syncStats.failedQuotes} failed</span>
            )}
            {syncStats.failedQuotes === 0 && 'All synced'}
          </p>
          <button
            onClick={() => handleSyncAll('quotes')}
            disabled={!isConnected || syncing === 'quotes'}
            className="mt-3 w-full px-3 py-1.5 text-sm bg-[var(--rag-green)] text-white rounded-md hover:bg-[var(--rag-green)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing === 'quotes' ? 'Syncing...' : 'Retry Failed Quotes'}
          </button>
        </div>

        {/* Manufacturing Orders */}
        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-[var(--rag-amber)]" />
              <h3 className="font-medium text-foreground">Manufacturing</h3>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">
            {syncStats.pendingMOs + syncStats.failedMOs}
          </p>
          <p className="text-sm text-muted-foreground">
            {syncStats.failedMOs > 0 && (
              <span className="text-[var(--rag-red)]">{syncStats.failedMOs} failed</span>
            )}
            {syncStats.failedMOs === 0 && 'All synced'}
          </p>
          <button
            onClick={() => handleSyncAll('mos')}
            disabled={!isConnected || syncing === 'mos'}
            className="mt-3 w-full px-3 py-1.5 text-sm bg-[var(--rag-amber)] text-white rounded-md hover:bg-[var(--rag-amber)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing === 'mos' ? 'Syncing...' : 'Retry Failed MOs'}
          </button>
        </div>
      </div>

      {/* Integration Workflows */}
      <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Active Integration Workflows</h2>
        <div className="space-y-3">
          <WorkflowItem
            title="Vendor Sync"
            description="Suppliers → QuickBooks Vendors"
            status="active"
          />
          <WorkflowItem
            title="Purchase Order → Bill"
            description="PO approved → Bill created (Accounts Payable)"
            status="active"
          />
          <WorkflowItem
            title="Quote → Sales Order"
            description="Quote approved → Sales Order created"
            status="active"
          />
          <WorkflowItem
            title="Manufacturing → Invoice"
            description="MO completed → Invoice created (Revenue Recognition)"
            status="active"
          />
          <WorkflowItem
            title="Manufacturing → COGS"
            description="MO completed → COGS Journal Entry (Cost Recognition)"
            status="active"
          />
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-[var(--rag-blue-soft)] border border-[var(--rag-blue)] rounded-lg p-6">
        <h3 className="text-[var(--rag-blue)] font-semibold mb-2">💡 Integration Tips</h3>
        <ul className="text-sm text-[var(--rag-blue)] space-y-1 list-disc list-inside">
          <li>All syncs happen automatically when documents reach the appropriate status</li>
          <li>Use manual sync buttons to retry failed operations</li>
          <li>Configure account mappings in Settings → QuickBooks Configuration</li>
          <li>Check business events for detailed sync history and troubleshooting</li>
          <li>Contact support if you encounter persistent sync errors</li>
        </ul>
      </div>
    </div>
  );
}

// Helper component for workflow items
function WorkflowItem({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: 'active' | 'disabled' | 'error';
}) {
  const statusConfig = {
    active: { icon: CheckCircle, color: 'text-[var(--rag-green)]', bg: 'bg-[var(--rag-green-soft)]' },
    disabled: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-[var(--bg-sunken)]' },
    error: { icon: AlertTriangle, color: 'text-[var(--rag-red)]', bg: 'bg-[var(--rag-red-soft)]' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between p-3 bg-[var(--bg-sunken)] rounded-lg">
      <div className="flex items-center space-x-3">
        <div className={`flex items-center justify-center w-8 h-8 ${config.bg} rounded-full`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
