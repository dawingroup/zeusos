/**
 * QuickBooks Account Mapping Settings Component
 * UI for configuring GL account mappings
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import type {
  QBOConfig,
  QBOAccountMapping,
  QBOAccountsByClassification,
  QBOConfigValidation,
  LandedCostMethod,
  QBOItemResolutionEntry,
} from '../../types/qboConfig.types';
import {
  ACCOUNT_MAPPING_LABELS,
  ACCOUNT_MAPPING_DESCRIPTIONS,
  ACCOUNT_MAPPING_REQUIRED,
  validateQBOConfig,
} from '../../types/qboConfig.types';
import {
  getQBOConfig,
  saveQBOConfig,
  getQBOAccountsByClassification,
  getSuggestedAccountMappings,
  validateCurrentConfig,
  getItemResolutionLog,
  approveResolution,
  rejectResolution,
} from '../../services/qboConfigService';
import { batchUpdateBillNumbers } from '../../services/qboSyncService';
// Note: QBO REST API does not support custom fields on Bills (write is silently ignored)

interface QBOAccountMappingSettingsProps {
  companyId: string;
  onSave?: (config: QBOConfig) => void;
  onCancel?: () => void;
}

export function QBOAccountMappingSettings({
  companyId,
  onSave,
  onCancel,
}: QBOAccountMappingSettingsProps) {
  const { user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [_config, setConfig] = useState<QBOConfig | null>(null);
  const [accountMapping, setAccountMapping] = useState<Partial<QBOAccountMapping>>({});
  const [qboAccounts, setQboAccounts] = useState<QBOAccountsByClassification | null>(null);
  const [validation, setValidation] = useState<QBOConfigValidation | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autoCreateBills, setAutoCreateBills] = useState(true);
  const [landedCostMethod, setLandedCostMethod] = useState<LandedCostMethod>('capitalize');
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [resolutionLog, setResolutionLog] = useState<QBOItemResolutionEntry[]>([]);
  const [resolutionLoading, setResolutionLoading] = useState(false);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);
  // Tax code configuration
  const [taxMode, setTaxMode] = useState<'out_of_scope' | 'tax_exclusive' | 'tax_inclusive'>('out_of_scope');
  const [taxCodeNoVat, setTaxCodeNoVat] = useState('');
  const [taxCodeStandardVat, setTaxCodeStandardVat] = useState('');
  const [taxCodeZeroRated, setTaxCodeZeroRated] = useState('');
  // QBO custom fields on Bills are not supported by the REST API (write is silently ignored)

  // Load initial data
  useEffect(() => {
    loadData();
  }, [companyId]);

  async function loadData() {
    try {
      setLoading(true);

      // Load config, accounts, and resolution log in parallel
      const [configData, accountsData, logData] = await Promise.all([
        getQBOConfig(),
        getQBOAccountsByClassification(companyId),
        getItemResolutionLog({ maxResults: 50 }),
      ]);

      setConfig(configData);
      setAccountMapping(configData?.accountMapping || {});
      setAutoCreateBills(configData?.features?.autoCreateBills !== false);
      setLandedCostMethod(configData?.landedCostMethod ?? 'capitalize');
      // Tax code config
      setTaxMode(configData?.taxMode ?? 'out_of_scope');
      setTaxCodeNoVat(configData?.taxCodeMapping?.noVat ?? '');
      setTaxCodeStandardVat(configData?.taxCodeMapping?.standardVat ?? '');
      setTaxCodeZeroRated(configData?.taxCodeMapping?.zeroRated ?? '');
      // Custom field mapping removed — QBO API does not support custom fields on Bills
      setQboAccounts(accountsData);
      setResolutionLog(logData);

      if (!configData) {
        setIsFirstTimeSetup(true);
        setShowSuggestions(true);
        setValidation(null);
      } else {
        setIsFirstTimeSetup(false);
        const validationResult = await validateCurrentConfig();
        setValidation(validationResult);
        if (!configData.isConfigured) {
          setShowSuggestions(true);
        }
      }
    } catch (error) {
      console.error('[QBOAccountMapping] Error loading data:', error);
      alert('Failed to load QuickBooks configuration');
    } finally {
      setLoading(false);
    }
  }

  // Apply suggested mappings
  async function applySuggestions() {
    try {
      const suggestions = await getSuggestedAccountMappings(companyId);
      setAccountMapping((prev) => ({
        ...prev,
        ...suggestions,
      }));
      setShowSuggestions(false);
    } catch (error) {
      console.error('[QBOAccountMapping] Error applying suggestions:', error);
      alert('Failed to apply suggested mappings');
    }
  }

  // Handle account selection
  function handleAccountChange(field: keyof QBOAccountMapping, accountId: string) {
    setAccountMapping((prev) => ({
      ...prev,
      [field]: accountId,
    }));
  }

  // Save configuration
  async function handleSave() {
    if (!user) {
      alert('You must be logged in to save configuration');
      return;
    }

    // Client-side validation before save
    const preCheck = validateQBOConfig({
      accountMapping: accountMapping as QBOAccountMapping,
      landedCostMethod,
    });
    if (!preCheck.isValid) {
      setValidation(preCheck);
      setIsFirstTimeSetup(false); // Switch to show errors
      alert(`Please fix these issues before saving:\n${preCheck.errors.join('\n')}`);
      return;
    }

    try {
      setSaving(true);

      // Build account names lookup so other modules can display QBO names
      const accountNames: Record<string, string> = {};
      if (qboAccounts) {
        const allAccounts = [
          ...(qboAccounts.Asset || []),
          ...(qboAccounts.Liability || []),
          ...(qboAccounts.Equity || []),
          ...(qboAccounts.Revenue || []),
          ...(qboAccounts.Expense || []),
        ];
        for (const [, acctId] of Object.entries(accountMapping)) {
          if (acctId) {
            const found = allAccounts.find((a) => a.id === acctId);
            if (found) accountNames[acctId] = found.name;
          }
        }
      }

      const updatedConfig = await saveQBOConfig(
        {
          accountMapping: accountMapping as QBOAccountMapping,
          accountNames,
          landedCostMethod,
          taxMode,
          taxCodeMapping: {
            noVat: taxCodeNoVat || undefined,
            standardVat: taxCodeStandardVat || undefined,
            zeroRated: taxCodeZeroRated || undefined,
          },
          features: { autoCreateBills },
        },
        user.uid
      );

      setIsFirstTimeSetup(false);
      setValidation({ isValid: true, errors: [], warnings: preCheck.warnings });

      alert('Configuration saved successfully');

      if (onSave) {
        onSave(updatedConfig);
      }
    } catch (error: any) {
      console.error('[QBOAccountMapping] Error saving:', error);
      alert(`Failed to save configuration: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Render account dropdown
  function renderAccountDropdown(
    field: keyof QBOAccountMapping,
    classification: keyof QBOAccountsByClassification
  ) {
    if (!qboAccounts) return null;

    const accounts = qboAccounts[classification];
    const currentValue = accountMapping[field] || '';
    const isRequired = ACCOUNT_MAPPING_REQUIRED[field];

    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {ACCOUNT_MAPPING_LABELS[field]}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        <p className="text-xs text-gray-500 mb-2">{ACCOUNT_MAPPING_DESCRIPTIONS[field]}</p>
        <select
          value={currentValue}
          onChange={(e) => handleAccountChange(field, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required={isRequired}
        >
          <option value="">-- Select Account --</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.fullyQualifiedName} (Balance: {account.currentBalance})
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading QuickBooks accounts...</div>
      </div>
    );
  }

  if (!qboAccounts) {
    return (
      <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-yellow-800 font-semibold mb-2">No QuickBooks Accounts Found</h3>
        <p className="text-yellow-700 text-sm">
          Please sync your QuickBooks chart of accounts first before configuring account mappings.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">QuickBooks Account Mapping</h2>
        <p className="text-gray-600">
          Map ZeusOS transaction types to your QuickBooks chart of accounts for proper
          accounting integration.
        </p>
      </div>

      {/* First-time Setup Banner */}
      {isFirstTimeSetup && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-blue-800 font-semibold mb-2">First-Time Setup</h3>
          <p className="text-blue-700 text-sm">
            Map your QuickBooks accounts below, then click Save to activate the integration.
            All 5 required accounts must be mapped.
          </p>
        </div>
      )}

      {/* Validation Status (only show after config exists) */}
      {!isFirstTimeSetup && validation && !validation.isValid && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-semibold mb-2">Configuration Incomplete</h3>
          <ul className="list-disc list-inside text-red-700 text-sm">
            {validation.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {validation && validation.warnings.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-yellow-800 font-semibold mb-2">Recommendations</h3>
          <ul className="list-disc list-inside text-yellow-700 text-sm">
            {validation.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions Banner */}
      {showSuggestions && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div>
            <h3 className="text-blue-800 font-semibold mb-1">Auto-Detect Mappings?</h3>
            <p className="text-blue-700 text-sm">
              We can suggest account mappings based on your QuickBooks account names.
            </p>
          </div>
          <button
            onClick={applySuggestions}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Apply Suggestions
          </button>
        </div>
      )}

      {/* Account Mapping Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Accounts</h3>

        {renderAccountDropdown('accountsPayable', 'Liability')}
        {renderAccountDropdown('accountsReceivable', 'Asset')}
        {renderAccountDropdown('inventory', 'Asset')}
        {renderAccountDropdown('cogs', 'Expense')}
        {renderAccountDropdown('revenue', 'Revenue')}
      </div>

      {/* Revenue Sub-Accounts */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Revenue Sub-Accounts
          <span className="text-sm font-normal text-gray-500 ml-2">
            (Map each income stream to a specific revenue account in QuickBooks)
          </span>
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          When a sub-account is not mapped, the default Sales Revenue account above is used as fallback.
        </p>

        {renderAccountDropdown('revenueManufactured', 'Revenue')}
        {renderAccountDropdown('revenueProducts', 'Revenue')}
        {renderAccountDropdown('revenueServicesAndProjects', 'Revenue')}
        {renderAccountDropdown('revenueShipping', 'Revenue')}
      </div>

      {/* COGS Sub-Accounts */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          COGS Sub-Accounts
          <span className="text-sm font-normal text-gray-500 ml-2">
            (Map each cost category to a specific COGS account in QuickBooks)
          </span>
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          When a sub-account is not mapped, the default COGS account above is used as fallback.
        </p>

        {renderAccountDropdown('cogsMaterials', 'Expense')}
        {renderAccountDropdown('cogsProducts', 'Expense')}
        {renderAccountDropdown('cogsServicesAndProjects', 'Expense')}
        {renderAccountDropdown('cogsLabour', 'Expense')}
        {renderAccountDropdown('cogsOutsourced', 'Expense')}
      </div>

      {/* PO Line Item Category Accounts */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          PO Line Item Category Accounts
          <span className="text-sm font-normal text-gray-500 ml-2">
            (Route PO line items to specific QBO accounts by category)
          </span>
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Each PO line item has a category (Inventory, Asset, Service, or Overhead) that determines
          which QBO account it posts to on the bill. Map the accounts below so each category routes correctly.
        </p>

        {/* Category routing table */}
        <div className="mb-5 border border-gray-200 rounded-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Routes To</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fallback</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 font-medium text-gray-900">Inventory</td>
                <td className="px-4 py-2 text-gray-700">Inventory Asset account</td>
                <td className="px-4 py-2 text-gray-500 text-xs">Mapped above in Required Accounts</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-gray-900">Asset</td>
                <td className="px-4 py-2 text-gray-700">Fixed Assets account</td>
                <td className="px-4 py-2 text-gray-500 text-xs">Falls back to Inventory Asset if not mapped</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-gray-900">Service</td>
                <td className="px-4 py-2 text-gray-700">COGS - Services &amp; Projects account</td>
                <td className="px-4 py-2 text-gray-500 text-xs">Falls back to default COGS if not mapped</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-gray-900">Overhead</td>
                <td className="px-4 py-2 text-gray-700">Overhead / Operating Expense account</td>
                <td className="px-4 py-2 text-gray-500 text-xs">Falls back to default COGS if not mapped</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-gray-900">Manufacturing Overhead</td>
                <td className="px-4 py-2 text-gray-700">Manufacturing Overhead Expense account</td>
                <td className="px-4 py-2 text-gray-500 text-xs">Falls back to Overhead, then default COGS if not mapped</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mb-4 italic">
          The Inventory and Service accounts are already mapped in the sections above. Map the Asset, Overhead,
          and Manufacturing Overhead accounts below to complete category-based routing.
        </p>

        {renderAccountDropdown('fixedAssets', 'Asset')}
        {renderAccountDropdown('overhead', 'Expense')}
        {renderAccountDropdown('manufacturingOverhead', 'Expense')}
      </div>

      {/* Item Auto-Resolution */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Item Auto-Resolution
          <span className="text-sm font-normal text-gray-500 ml-2">
            (ZeusOS items are automatically matched to QBO items)
          </span>
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          When syncing Sales Orders, Invoices, or Bills, ZeusOS automatically searches QuickBooks
          for matching items by name. If no match is found, a new QBO item is created. Fuzzy matches
          with low confidence are flagged for your review below.
        </p>

        {/* Summary Stats */}
        {resolutionLog.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-center">
              <div className="text-lg font-bold text-green-800">
                {resolutionLog.filter(e => e.matchType === 'exact' || e.matchType === 'linked').length}
              </div>
              <div className="text-xs text-green-700">Exact Matches</div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-center">
              <div className="text-lg font-bold text-blue-800">
                {resolutionLog.filter(e => e.matchType === 'fuzzy').length}
              </div>
              <div className="text-xs text-blue-700">Fuzzy Matches</div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-md text-center">
              <div className="text-lg font-bold text-purple-800">
                {resolutionLog.filter(e => e.matchType === 'created').length}
              </div>
              <div className="text-xs text-purple-700">Auto-Created</div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-center">
              <div className="text-lg font-bold text-amber-800">
                {resolutionLog.filter(e => e.status === 'pending-review').length}
              </div>
              <div className="text-xs text-amber-700">Pending Review</div>
            </div>
          </div>
        )}

        {/* Resolution Log Table */}
        {resolutionLog.length === 0 ? (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-sm text-gray-600">
              No item resolutions yet. Items will appear here as ZeusOS syncs data to QuickBooks.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ZeusOS Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">QBO Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {resolutionLog.map((entry) => (
                  <tr key={entry.id} className={entry.status === 'pending-review' ? 'bg-amber-50' : ''}>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      <div className="font-medium">{entry.dawinosName}</div>
                      {entry.dawinosSku && (
                        <div className="text-xs text-gray-500">{entry.dawinosSku}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">{entry.qboItemName}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        entry.matchType === 'exact' ? 'bg-green-100 text-green-800' :
                        entry.matchType === 'fuzzy' ? 'bg-blue-100 text-blue-800' :
                        entry.matchType === 'created' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {entry.matchType}
                        {entry.matchScore != null && entry.matchType === 'fuzzy' && (
                          <span className="ml-1">({Math.round(entry.matchScore * 100)}%)</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        entry.status === 'auto-approved' || entry.status === 'user-approved'
                          ? 'bg-green-100 text-green-800'
                          : entry.status === 'pending-review'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {entry.status === 'pending-review' && (
                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              if (!user) return;
                              setResolutionLoading(true);
                              try {
                                await approveResolution(entry.id, user.uid);
                                setResolutionLog((prev) =>
                                  prev.map((e) =>
                                    e.id === entry.id ? { ...e, status: 'user-approved' as const } : e
                                  )
                                );
                              } catch (err) {
                                console.error('Failed to approve:', err);
                              } finally {
                                setResolutionLoading(false);
                              }
                            }}
                            disabled={resolutionLoading}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              if (!user) return;
                              setResolutionLoading(true);
                              try {
                                await rejectResolution(entry.id, user.uid);
                                setResolutionLog((prev) =>
                                  prev.map((e) =>
                                    e.id === entry.id ? { ...e, status: 'user-rejected' as const } : e
                                  )
                                );
                              } catch (err) {
                                console.error('Failed to reject:', err);
                              } finally {
                                setResolutionLoading(false);
                              }
                            }}
                            disabled={resolutionLoading}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Landed Cost Handling */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Landed Cost Handling
          <span className="text-sm font-normal text-gray-500 ml-2">
            (How shipping, customs, duties, etc. are posted on QBO bills)
          </span>
        </h3>

        <label className="flex items-start gap-3 cursor-pointer mb-4">
          <input
            type="radio"
            name="landedCostMethod"
            value="capitalize"
            checked={landedCostMethod === 'capitalize'}
            onChange={() => setLandedCostMethod('capitalize')}
            className="mt-1 h-4 w-4 border-gray-300 text-green-600 focus:ring-green-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">
              Capitalize into Inventory (Recommended)
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              Landed costs are added to the inventory asset account on the bill.
              They flow to COGS only when inventory is consumed or sold. Prevents double-counting.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer mb-4">
          <input
            type="radio"
            name="landedCostMethod"
            value="expense"
            checked={landedCostMethod === 'expense'}
            onChange={() => setLandedCostMethod('expense')}
            className="mt-1 h-4 w-4 border-gray-300 text-green-600 focus:ring-green-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">
              Direct Expense (Legacy)
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              Landed costs are posted to separate expense accounts on the bill.
              Warning: since ZeusOS already includes landed costs in inventory valuation,
              this may cause double-counting on your P&amp;L.
            </p>
          </div>
        </label>

        {landedCostMethod === 'capitalize' && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md mb-4">
            <p className="text-xs text-green-800">
              All landed cost line items on QBO bills will be posted to your Inventory Asset account.
              No separate expense account mapping is needed.
            </p>
          </div>
        )}

        {renderAccountDropdown('workInProgress', 'Asset')}

        {landedCostMethod === 'expense' && (
          <>
            {renderAccountDropdown('shippingExpense', 'Expense')}
            {renderAccountDropdown('customsExpense', 'Expense')}
            {renderAccountDropdown('dutiesExpense', 'Expense')}
            {renderAccountDropdown('insuranceExpense', 'Expense')}
            {renderAccountDropdown('handlingExpense', 'Expense')}
            {renderAccountDropdown('otherExpense', 'Expense')}
          </>
        )}
      </div>

      {/* PO Traceability on QBO Bills */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          PO Traceability on Bills
        </h3>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
          <p className="text-sm text-blue-800 font-medium mb-3">
            Every synced bill includes PO references for full traceability in QBO reports
          </p>
          <div className="space-y-2.5 text-xs text-blue-700">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-blue-500 font-bold">&#10003;</span>
              <div>
                <span className="font-medium">Private Note / Memo</span> &mdash; Each bill includes
                &quot;ZeusOS Purchase Order: PO-XXXX-XXX&quot;.
                Searchable in QBO transaction reports and the bill detail view.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-blue-500 font-bold">&#10003;</span>
              <div>
                <span className="font-medium">Line Descriptions</span> &mdash; Every line item is prefixed
                with the PO number, e.g. &quot;[PO-2024-001] Oak Plywood 18mm (SKU: PLY-018)&quot;.
                Visible in Transaction Detail reports for item-level tracing.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-blue-500 font-bold">&#10003;</span>
              <div>
                <span className="font-medium">Doc Number</span> &mdash; The bill&apos;s DocNumber uses the
                ZeusOS PO number for easy cross-referencing between systems.
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-600">About QBO custom fields:</span> The
            QuickBooks REST API does not support reading or writing custom fields on Bill
            transactions. Custom fields created under QBO Settings are only accessible through
            the QBO web interface. PO traceability is achieved through the supported methods above.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={batchUpdating}
            onClick={async () => {
              setBatchUpdating(true);
              setBatchResult(null);
              try {
                const result = await batchUpdateBillNumbers();
                setBatchResult(result.message);
              } catch (err: any) {
                setBatchResult(`Error: ${err.message}`);
              } finally {
                setBatchUpdating(false);
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {batchUpdating ? 'Updating...' : 'Sync Bill Numbers'}
          </button>
          <span className="text-xs text-gray-500">
            Update all existing QBO bills to use the PO number as the bill number
          </span>
        </div>
        {batchResult && (
          <div className={`mt-2 text-sm rounded-md p-3 ${batchResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {batchResult}
          </div>
        )}
      </div>

      {/* Automation Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Automation</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoCreateBills}
            onChange={(e) => setAutoCreateBills(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">
              Auto-create bills when POs are approved
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              Automatically sync approved Purchase Orders to QuickBooks as Bills.
              When disabled, bills must be created manually from the PO detail page.
            </p>
          </div>
        </label>
      </div>

      {/* Tax Configuration */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Tax Configuration</h3>
        <p className="text-xs text-gray-500 mb-4">
          Configure how tax is handled on invoices and sales orders synced to QuickBooks.
        </p>

        {/* Tax Mode */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tax Calculation Mode</label>
          <div className="space-y-2">
            {[
              { value: 'out_of_scope' as const, label: 'Out of Scope (No Tax)', desc: 'Transactions are created without any tax calculation. Best for tax-exempt businesses.' },
              { value: 'tax_exclusive' as const, label: 'Tax Exclusive', desc: 'Tax is calculated on top of line item amounts. Requires tax code IDs below.' },
              { value: 'tax_inclusive' as const, label: 'Tax Inclusive', desc: 'Line item amounts already include tax. Requires tax code IDs below.' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="taxMode"
                  value={opt.value}
                  checked={taxMode === opt.value}
                  onChange={() => setTaxMode(opt.value)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Tax Code IDs — only shown when tax is enabled */}
        {taxMode !== 'out_of_scope' && (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Enter the QBO Tax Code IDs from your QuickBooks tax settings.
              Find these in QuickBooks → Taxes → Tax rates.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">No VAT / Exempt</label>
                <input
                  type="text"
                  value={taxCodeNoVat}
                  onChange={(e) => setTaxCodeNoVat(e.target.value)}
                  placeholder="e.g. NON or 7"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Standard VAT (18%)</label>
                <input
                  type="text"
                  value={taxCodeStandardVat}
                  onChange={(e) => setTaxCodeStandardVat(e.target.value)}
                  placeholder="e.g. TAX or 5"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zero Rated</label>
                <input
                  type="text"
                  value={taxCodeZeroRated}
                  onChange={(e) => setTaxCodeZeroRated(e.target.value)}
                  placeholder="e.g. Z or 6"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-4">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">💡 Configuration Tips</h4>
        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
          <li>All required accounts must be mapped before QuickBooks integration can work</li>
          <li>
            Optional expense accounts help categorize costs more accurately in your financial
            reports
          </li>
          <li>You can change these mappings at any time without affecting historical data</li>
          <li>
            Contact your accountant if you're unsure which accounts to use for specific mappings
          </li>
        </ul>
      </div>
    </div>
  );
}
