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
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          {ACCOUNT_MAPPING_LABELS[field]}
          {isRequired && <span className="text-[var(--rag-red)] ml-1">*</span>}
        </label>
        <p className="text-xs text-muted-foreground mb-2">{ACCOUNT_MAPPING_DESCRIPTIONS[field]}</p>
        <select
          value={currentValue}
          onChange={(e) => handleAccountChange(field, e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border-default)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
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
        <div className="text-muted-foreground">Loading QuickBooks accounts...</div>
      </div>
    );
  }

  if (!qboAccounts) {
    return (
      <div className="p-8 bg-[var(--rag-amber-soft)] border border-[var(--rag-amber)] rounded-lg">
        <h3 className="text-[var(--rag-amber)] font-semibold mb-2">No QuickBooks Accounts Found</h3>
        <p className="text-[var(--rag-amber)] text-sm">
          Please sync your QuickBooks chart of accounts first before configuring account mappings.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">QuickBooks Account Mapping</h2>
        <p className="text-muted-foreground">
          Map ZeusOS transaction types to your QuickBooks chart of accounts for proper
          accounting integration.
        </p>
      </div>

      {/* First-time Setup Banner */}
      {isFirstTimeSetup && (
        <div className="mb-6 p-4 bg-[var(--rag-blue-soft)] border border-[var(--rag-blue)] rounded-lg">
          <h3 className="text-[var(--rag-blue)] font-semibold mb-2">First-Time Setup</h3>
          <p className="text-[var(--rag-blue)] text-sm">
            Map your QuickBooks accounts below, then click Save to activate the integration.
            All 5 required accounts must be mapped.
          </p>
        </div>
      )}

      {/* Validation Status (only show after config exists) */}
      {!isFirstTimeSetup && validation && !validation.isValid && (
        <div className="mb-6 p-4 bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg">
          <h3 className="text-[var(--rag-red)] font-semibold mb-2">Configuration Incomplete</h3>
          <ul className="list-disc list-inside text-[var(--rag-red)] text-sm">
            {validation.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {validation && validation.warnings.length > 0 && (
        <div className="mb-6 p-4 bg-[var(--rag-amber-soft)] border border-[var(--rag-amber)] rounded-lg">
          <h3 className="text-[var(--rag-amber)] font-semibold mb-2">Recommendations</h3>
          <ul className="list-disc list-inside text-[var(--rag-amber)] text-sm">
            {validation.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions Banner */}
      {showSuggestions && (
        <div className="mb-6 p-4 bg-[var(--rag-blue-soft)] border border-[var(--rag-blue)] rounded-lg flex items-center justify-between">
          <div>
            <h3 className="text-[var(--rag-blue)] font-semibold mb-1">Auto-Detect Mappings?</h3>
            <p className="text-[var(--rag-blue)] text-sm">
              We can suggest account mappings based on your QuickBooks account names.
            </p>
          </div>
          <button
            onClick={applySuggestions}
            className="px-4 py-2 bg-[var(--rag-blue)] text-white rounded-md hover:bg-[var(--rag-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
          >
            Apply Suggestions
          </button>
        </div>
      )}

      {/* Account Mapping Form */}
      <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Required Accounts</h3>

        {renderAccountDropdown('accountsPayable', 'Liability')}
        {renderAccountDropdown('accountsReceivable', 'Asset')}
        {renderAccountDropdown('inventory', 'Asset')}
        {renderAccountDropdown('cogs', 'Expense')}
        {renderAccountDropdown('revenue', 'Revenue')}
      </div>

      {/* Revenue Sub-Accounts */}
      <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Revenue Sub-Accounts
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (Map each income stream to a specific revenue account in QuickBooks)
          </span>
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          When a sub-account is not mapped, the default Sales Revenue account above is used as fallback.
        </p>

        {renderAccountDropdown('revenueManufactured', 'Revenue')}
        {renderAccountDropdown('revenueProducts', 'Revenue')}
        {renderAccountDropdown('revenueServicesAndProjects', 'Revenue')}
        {renderAccountDropdown('revenueShipping', 'Revenue')}
      </div>

      {/* COGS Sub-Accounts */}
      <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          COGS Sub-Accounts
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (Map each cost category to a specific COGS account in QuickBooks)
          </span>
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          When a sub-account is not mapped, the default COGS account above is used as fallback.
        </p>

        {renderAccountDropdown('cogsMaterials', 'Expense')}
        {renderAccountDropdown('cogsProducts', 'Expense')}
        {renderAccountDropdown('cogsServicesAndProjects', 'Expense')}
        {renderAccountDropdown('cogsLabour', 'Expense')}
        {renderAccountDropdown('cogsOutsourced', 'Expense')}
      </div>

      {/* PO Line Item Category Accounts */}
      <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          PO Line Item Category Accounts
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (Route PO line items to specific QBO accounts by category)
          </span>
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Each PO line item has a category (Inventory, Asset, Service, or Overhead) that determines
          which QBO account it posts to on the bill. Map the accounts below so each category routes correctly.
        </p>

        {/* Category routing table */}
        <div className="mb-5 border border-[var(--border-subtle)] rounded-md overflow-hidden">
          <table className="min-w-full divide-y divide-[var(--border-subtle)] text-sm">
            <thead className="bg-[var(--bg-sunken)]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Routes To</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Fallback</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-[var(--border-subtle)]">
              <tr>
                <td className="px-4 py-2 font-medium text-foreground">Inventory</td>
                <td className="px-4 py-2 text-muted-foreground">Inventory Asset account</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">Mapped above in Required Accounts</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-foreground">Asset</td>
                <td className="px-4 py-2 text-muted-foreground">Fixed Assets account</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">Falls back to Inventory Asset if not mapped</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-foreground">Service</td>
                <td className="px-4 py-2 text-muted-foreground">COGS - Services &amp; Projects account</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">Falls back to default COGS if not mapped</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-foreground">Overhead</td>
                <td className="px-4 py-2 text-muted-foreground">Overhead / Operating Expense account</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">Falls back to default COGS if not mapped</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-foreground">Manufacturing Overhead</td>
                <td className="px-4 py-2 text-muted-foreground">Manufacturing Overhead Expense account</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">Falls back to Overhead, then default COGS if not mapped</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground mb-4 italic">
          The Inventory and Service accounts are already mapped in the sections above. Map the Asset, Overhead,
          and Manufacturing Overhead accounts below to complete category-based routing.
        </p>

        {renderAccountDropdown('fixedAssets', 'Asset')}
        {renderAccountDropdown('overhead', 'Expense')}
        {renderAccountDropdown('manufacturingOverhead', 'Expense')}
      </div>

      {/* Item Auto-Resolution */}
      <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Item Auto-Resolution
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (ZeusOS items are automatically matched to QBO items)
          </span>
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          When syncing Sales Orders, Invoices, or Bills, ZeusOS automatically searches QuickBooks
          for matching items by name. If no match is found, a new QBO item is created. Fuzzy matches
          with low confidence are flagged for your review below.
        </p>

        {/* Summary Stats */}
        {resolutionLog.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-[var(--rag-green-soft)] border border-[var(--rag-green)] rounded-md text-center">
              <div className="text-lg font-bold text-[var(--rag-green)]">
                {resolutionLog.filter(e => e.matchType === 'exact' || e.matchType === 'linked').length}
              </div>
              <div className="text-xs text-[var(--rag-green)]">Exact Matches</div>
            </div>
            <div className="p-3 bg-[var(--rag-blue-soft)] border border-[var(--rag-blue)] rounded-md text-center">
              <div className="text-lg font-bold text-[var(--rag-blue)]">
                {resolutionLog.filter(e => e.matchType === 'fuzzy').length}
              </div>
              <div className="text-xs text-[var(--rag-blue)]">Fuzzy Matches</div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-md text-center">
              <div className="text-lg font-bold text-purple-800">
                {resolutionLog.filter(e => e.matchType === 'created').length}
              </div>
              <div className="text-xs text-purple-700">Auto-Created</div>
            </div>
            <div className="p-3 bg-[var(--rag-amber-soft)] border border-[var(--rag-amber)] rounded-md text-center">
              <div className="text-lg font-bold text-[var(--rag-amber)]">
                {resolutionLog.filter(e => e.status === 'pending-review').length}
              </div>
              <div className="text-xs text-[var(--rag-amber)]">Pending Review</div>
            </div>
          </div>
        )}

        {/* Resolution Log Table */}
        {resolutionLog.length === 0 ? (
          <div className="p-3 bg-[var(--bg-sunken)] border border-[var(--border-subtle)] rounded-md">
            <p className="text-sm text-muted-foreground">
              No item resolutions yet. Items will appear here as ZeusOS syncs data to QuickBooks.
            </p>
          </div>
        ) : (
          <div className="border border-[var(--border-subtle)] rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-[var(--border-subtle)]">
              <thead className="bg-[var(--bg-sunken)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">ZeusOS Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">QBO Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Match</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-[var(--border-subtle)]">
                {resolutionLog.map((entry) => (
                  <tr key={entry.id} className={entry.status === 'pending-review' ? 'bg-[var(--rag-amber-soft)]' : ''}>
                    <td className="px-3 py-2 text-sm text-foreground">
                      <div className="font-medium">{entry.dawinosName}</div>
                      {entry.dawinosSku && (
                        <div className="text-xs text-muted-foreground">{entry.dawinosSku}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">{entry.qboItemName}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        entry.matchType === 'exact' ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]' :
                        entry.matchType === 'fuzzy' ? 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]' :
                        entry.matchType === 'created' ? 'bg-purple-100 text-purple-800' :
                        'bg-[var(--bg-sunken)] text-foreground'
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
                          ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]'
                          : entry.status === 'pending-review'
                          ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]'
                          : 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]'
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
                            className="px-2 py-1 text-xs bg-[var(--rag-green)] text-white rounded hover:bg-[var(--rag-green)] disabled:opacity-50"
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
                            className="px-2 py-1 text-xs bg-[var(--rag-red)] text-white rounded hover:bg-[var(--rag-red)] disabled:opacity-50"
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
      <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Landed Cost Handling
          <span className="text-sm font-normal text-muted-foreground ml-2">
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
            className="mt-1 h-4 w-4 border-[var(--border-default)] text-[var(--rag-green)] focus:ring-[var(--rag-green)]"
          />
          <div>
            <span className="text-sm font-medium text-foreground">
              Capitalize into Inventory (Recommended)
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
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
            className="mt-1 h-4 w-4 border-[var(--border-default)] text-[var(--rag-green)] focus:ring-[var(--rag-green)]"
          />
          <div>
            <span className="text-sm font-medium text-foreground">
              Direct Expense (Legacy)
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Landed costs are posted to separate expense accounts on the bill.
              Warning: since ZeusOS already includes landed costs in inventory valuation,
              this may cause double-counting on your P&amp;L.
            </p>
          </div>
        </label>

        {landedCostMethod === 'capitalize' && (
          <div className="mt-2 p-3 bg-[var(--rag-green-soft)] border border-[var(--rag-green)] rounded-md mb-4">
            <p className="text-xs text-[var(--rag-green)]">
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
      <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          PO Traceability on Bills
        </h3>

        <div className="bg-[var(--rag-blue-soft)] border border-[var(--rag-blue)] rounded-md p-4 mb-4">
          <p className="text-sm text-[var(--rag-blue)] font-medium mb-3">
            Every synced bill includes PO references for full traceability in QBO reports
          </p>
          <div className="space-y-2.5 text-xs text-[var(--rag-blue)]">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--rag-blue)] font-bold">&#10003;</span>
              <div>
                <span className="font-medium">Private Note / Memo</span> &mdash; Each bill includes
                &quot;ZeusOS Purchase Order: PO-XXXX-XXX&quot;.
                Searchable in QBO transaction reports and the bill detail view.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--rag-blue)] font-bold">&#10003;</span>
              <div>
                <span className="font-medium">Line Descriptions</span> &mdash; Every line item is prefixed
                with the PO number, e.g. &quot;[PO-2024-001] Oak Plywood 18mm (SKU: PLY-018)&quot;.
                Visible in Transaction Detail reports for item-level tracing.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--rag-blue)] font-bold">&#10003;</span>
              <div>
                <span className="font-medium">Doc Number</span> &mdash; The bill&apos;s DocNumber uses the
                ZeusOS PO number for easy cross-referencing between systems.
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-sunken)] border border-[var(--border-subtle)] rounded-md p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-muted-foreground">About QBO custom fields:</span> The
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
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--rag-blue)] rounded-md hover:bg-[var(--rag-blue)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {batchUpdating ? 'Updating...' : 'Sync Bill Numbers'}
          </button>
          <span className="text-xs text-muted-foreground">
            Update all existing QBO bills to use the PO number as the bill number
          </span>
        </div>
        {batchResult && (
          <div className={`mt-2 text-sm rounded-md p-3 ${batchResult.startsWith('Error') ? 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]' : 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]'}`}>
            {batchResult}
          </div>
        )}
      </div>

      {/* Automation Settings */}
      <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Automation</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoCreateBills}
            onChange={(e) => setAutoCreateBills(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-default)] text-[var(--rag-green)] focus:ring-[var(--rag-green)]"
          />
          <div>
            <span className="text-sm font-medium text-foreground">
              Auto-create bills when POs are approved
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically sync approved Purchase Orders to QuickBooks as Bills.
              When disabled, bills must be created manually from the PO detail page.
            </p>
          </div>
        </label>
      </div>

      {/* Tax Configuration */}
      <div className="border border-[var(--border-subtle)] rounded-lg p-4 bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-1">Tax Configuration</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Configure how tax is handled on invoices and sales orders synced to QuickBooks.
        </p>

        {/* Tax Mode */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">Tax Calculation Mode</label>
          <div className="space-y-2">
            {[
              { value: 'out_of_scope' as const, label: 'Out of Scope (No Tax)', desc: 'Transactions are created without any tax calculation. Best for tax-exempt businesses.' },
              { value: 'tax_exclusive' as const, label: 'Tax Exclusive', desc: 'Tax is calculated on top of line item amounts. Requires tax code IDs below.' },
              { value: 'tax_inclusive' as const, label: 'Tax Inclusive', desc: 'Line item amounts already include tax. Requires tax code IDs below.' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-[var(--bg-sunken)] transition-colors">
                <input
                  type="radio"
                  name="taxMode"
                  value={opt.value}
                  checked={taxMode === opt.value}
                  onChange={() => setTaxMode(opt.value)}
                  className="mt-0.5 text-[var(--rag-blue)] focus:ring-[var(--rag-blue)]"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Tax Code IDs — only shown when tax is enabled */}
        {taxMode !== 'out_of_scope' && (
          <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-muted-foreground">
              Enter the QBO Tax Code IDs from your QuickBooks tax settings.
              Find these in QuickBooks → Taxes → Tax rates.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">No VAT / Exempt</label>
                <input
                  type="text"
                  value={taxCodeNoVat}
                  onChange={(e) => setTaxCodeNoVat(e.target.value)}
                  placeholder="e.g. NON or 7"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Standard VAT (18%)</label>
                <input
                  type="text"
                  value={taxCodeStandardVat}
                  onChange={(e) => setTaxCodeStandardVat(e.target.value)}
                  placeholder="e.g. TAX or 5"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Zero Rated</label>
                <input
                  type="text"
                  value={taxCodeZeroRated}
                  onChange={(e) => setTaxCodeZeroRated(e.target.value)}
                  placeholder="e.g. Z or 6"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
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
            className="px-6 py-2 border border-[var(--border-default)] text-muted-foreground rounded-md hover:bg-[var(--bg-sunken)] focus:outline-none focus:ring-2 focus:ring-[var(--border-default)] disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-[var(--rag-green)] text-white rounded-md hover:bg-[var(--rag-green)] focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-[var(--bg-sunken)] border border-[var(--border-subtle)] rounded-lg">
        <h4 className="text-sm font-semibold text-foreground mb-2">💡 Configuration Tips</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
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
