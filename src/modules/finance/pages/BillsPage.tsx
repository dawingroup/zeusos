// ============================================================================
// BILLS & PAYABLES PAGE
// ZeusOS v2.0 - Finance Module
// Accounts Payable management: QBO-synced bills + PO → Bill conversion
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Receipt, ArrowRightCircle, ShoppingCart } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { RagBadge, Banner, KPIGrid, KPICard } from '@/shared/components/data-display';
import { Skeleton } from '@/core/components/ui/skeleton';
import { db } from '@/shared/services/firebase';
import { getQBOBills, syncQBOCategory, syncMultiplePOsToBills } from '../services/qboSyncService';
import type { QBOBill } from '../types/integrations.types';

const COMPANY_ID = 'dawinos';

function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

function statusBadge(status: string) {
  if (status === 'paid') return <RagBadge tone="green">Paid</RagBadge>;
  if (status === 'overdue') return <RagBadge tone="red">Overdue</RagBadge>;
  return <RagBadge tone="amber">Open</RagBadge>;
}

export function BillsPage() {
  const [bills, setBills] = useState<QBOBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsyncedPOs, setUnsyncedPOs] = useState<{ id: string; poNumber: string; supplierName: string; grandTotal: number }[]>([]);
  const [syncingPOs, setSyncingPOs] = useState(false);
  const [poSyncResult, setPOSyncResult] = useState<{ synced: number; failed: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQBOBills(COMPANY_ID);
      setBills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnsyncedPOs = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'purchaseOrders'),
        where('status', 'in', ['approved', 'sent', 'partially-received', 'received']),
        where('subsidiaryId', '==', 'finishes'),
      );
      const snapshot = await getDocs(q);
      const pos = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((po: any) => po.qboSyncStatus !== 'synced')
        .map((po: any) => ({
          id: po.id,
          poNumber: po.poNumber,
          supplierName: po.supplierName,
          grandTotal: po.totals?.grandTotal ?? 0,
        }));
      setUnsyncedPOs(pos);
    } catch {
      // Non-critical — silently ignore
    }
  }, []);

  useEffect(() => { load(); loadUnsyncedPOs(); }, [load, loadUnsyncedPOs]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncQBOCategory(COMPANY_ID, 'bills');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAllPOs = async () => {
    if (unsyncedPOs.length === 0) return;
    setSyncingPOs(true);
    setPOSyncResult(null);
    try {
      const result = await syncMultiplePOsToBills(unsyncedPOs.map((po) => po.id));
      setPOSyncResult({ synced: result.synced, failed: result.failed });
      await loadUnsyncedPOs();
      await load();
    } catch {
      setPOSyncResult({ synced: 0, failed: unsyncedPOs.length });
    } finally {
      setSyncingPOs(false);
    }
  };

  const totalAmt = bills.reduce((s, b) => s + b.totalAmt, 0);
  const totalBalance = bills.reduce((s, b) => s + b.balance, 0);
  const paidCount = bills.filter(b => b.status === 'paid').length;
  const overdueCount = bills.filter(b => b.status === 'overdue').length;
  const openCount = bills.filter(b => b.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-green-600" />
            Bills & Payables
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Accounts Payable — synced from QuickBooks Online. Convert approved Purchase Orders to Bills from the Manufacturing module.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync from QBO'}
        </Button>
      </div>

      {error && <Banner tone="danger" title="Error" message={error} />}

      {/* PO → Bill Sync Banner */}
      {unsyncedPOs.length > 0 ? (
        <Banner
          tone="info"
          title={`${unsyncedPOs.length} Purchase Order${unsyncedPOs.length !== 1 ? 's' : ''} Ready for Billing`}
          message="Approved POs that haven't been synced to QuickBooks as Bills yet. Sync them to create corresponding bills in your accounts payable."
          icon={<ShoppingCart className="h-4 w-4" />}
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={handleSyncAllPOs}
              disabled={syncingPOs}
            >
              <Receipt className="h-3.5 w-3.5" />
              {syncingPOs ? 'Syncing…' : 'Sync All to QBO'}
            </Button>
          }
        />
      ) : (
        <Banner
          tone="info"
          title="Purchase Order → Bill Conversion"
          message={
            <>
              When Purchase Orders are approved, you can sync them to QuickBooks as
              Bills from <strong>Manufacturing → Purchase Orders</strong> or they will
              auto-sync if enabled in settings.
            </>
          }
          icon={<ArrowRightCircle className="h-4 w-4" />}
        />
      )}

      {/* PO Sync Result */}
      {poSyncResult && (
        <Banner
          tone={poSyncResult.failed === 0 ? 'success' : 'warning'}
          title={poSyncResult.failed === 0 ? 'Sync complete' : 'Sync finished with errors'}
          message={
            <>
              {poSyncResult.synced > 0 &&
                `${poSyncResult.synced} bill${poSyncResult.synced !== 1 ? 's' : ''} created in QuickBooks. `}
              {poSyncResult.failed > 0 &&
                `${poSyncResult.failed} failed — check PO details for errors.`}
            </>
          }
          onDismiss={() => setPOSyncResult(null)}
        />
      )}

      {/* Summary Cards */}
      <KPIGrid cols={4}>
        <KPICard
          label="Total Bills"
          value={loading ? <Skeleton className="h-6 w-24" /> : formatUSD(totalAmt)}
          unit="USD"
          delta={`${bills.length} bills`}
        />
        <KPICard
          label="Amount Due"
          value={loading ? <Skeleton className="h-6 w-24" /> : formatUSD(totalBalance)}
          unit="USD"
          delta={`${openCount} open`}
          trend="down"
        />
        <KPICard
          label="Paid"
          value={loading ? <Skeleton className="h-6 w-8" /> : paidCount}
          trend="up"
        />
        <KPICard
          label="Overdue"
          value={loading ? <Skeleton className="h-6 w-8" /> : overdueCount}
          trend={overdueCount > 0 ? 'down' : 'flat'}
        />
      </KPIGrid>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bill List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : bills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No bills synced yet</p>
              <p className="text-sm mt-1">
                Click "Sync from QBO" to pull existing bills, or convert a Purchase Order from the Manufacturing module.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-sticky-first-col">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Bill #</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Bill Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Balance Due</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bills.map(bill => (
                    <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{bill.docNumber || bill.qboId}</td>
                      <td className="px-4 py-3">{bill.vendorName || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{bill.txnDate || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{bill.dueDate || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatUSD(bill.totalAmt)}</td>
                      <td className="px-4 py-3 text-right">{formatUSD(bill.balance)}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(bill.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BillsPage;
