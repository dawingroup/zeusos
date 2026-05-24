// ============================================================================
// INTEGRATIONS PAGE
// ZeusOS v2.0 - Financial Management Module
// QuickBooks Online integration management
// ============================================================================

import { useCallback } from 'react';
import { QBOConnectionCard } from '../components/integrations/QBOConnectionCard';
import { useQBOSync } from '../hooks/useQBOSync';
import type { QBODataCategory } from '../types/integrations.types';

const COMPANY_ID = 'dawinos';

export function IntegrationsPage() {
  const qbo = useQBOSync({
    companyId: COMPANY_ID,
    autoCheckConnection: true,
    subscribeToJobs: true,
  });

  // QBO handlers
  const handleQBOConnect = useCallback(async () => {
    try {
      const url = await qbo.getAuthUrl();
      window.open(url, '_blank', 'width=600,height=700');
    } catch (err) {
      console.error('Failed to get QBO auth URL:', err);
    }
  }, [qbo]);

  const handleQBOSyncAll = useCallback(() => {
    qbo.syncAll();
  }, [qbo]);

  const handleQBOSyncCategory = useCallback(
    (category: QBODataCategory) => {
      qbo.syncCategory(category);
    },
    [qbo]
  );

  const handleViewQBOData = useCallback(() => {
    qbo.loadSyncedData();
  }, [qbo]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Financial Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external accounting and reporting tools to sync financial data
        </p>
      </div>

      {/* Error Messages */}
      {qbo.error && (
        <div className="bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg p-3">
          <p className="text-sm text-[var(--rag-red)]">QuickBooks: {qbo.error}</p>
        </div>
      )}

      {/* Integration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QBOConnectionCard
          connection={qbo.connection}
          connectionLoading={qbo.connectionLoading}
          syncing={qbo.syncing}
          syncJobs={qbo.syncJobs}
          onConnect={handleQBOConnect}
          onSyncAll={handleQBOSyncAll}
          onSyncCategory={handleQBOSyncCategory}
          onViewData={handleViewQBOData}
          accountCount={qbo.accounts.length}
          invoiceCount={qbo.invoices.length}
          billCount={qbo.bills.length}
          transactionCount={qbo.bankTransactions.length}
          hasProfitAndLoss={!!qbo.profitAndLoss}
          hasBalanceSheet={!!qbo.balanceSheet}
        />
      </div>
    </div>
  );
}

export default IntegrationsPage;
