/**
 * Procurement Advisor Page
 * AI-powered procurement intelligence — supplier enrichment,
 * recommendations, price trends, risk alerts, and market insights.
 * Select a supplier to run full analysis or quick enrichment.
 */

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Building2,
  Star,
  TrendingUp,
  ShieldAlert,
  Package,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { SmartProcurementAdvisor } from '../components/SmartProcurementAdvisor';
import type { Supplier } from '@/modules/suppliers/types/supplier';
import { getSuppliers } from '@/modules/suppliers/services/supplierService';

const SUBSIDIARY_ID = 'finishes';

export default function ProcurementAdvisorPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    getSuppliers({ status: 'active', subsidiaryId: SUBSIDIARY_ID })
      .then(setSuppliers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = searchTerm
    ? suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.categories?.some((c) => c.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : suppliers;

  const handleSupplierUpdated = () => {
    // Re-fetch the supplier after enrichment is applied
    if (selectedSupplier) {
      getSuppliers({ status: 'active', subsidiaryId: SUBSIDIARY_ID }).then((fresh) => {
        const updated = fresh.find((s) => s.id === selectedSupplier.id);
        if (updated) setSelectedSupplier(updated);
        setSuppliers(fresh);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h1 className="text-2xl font-bold text-gray-900">Procurement Advisor</h1>
        </div>
        <p className="text-muted-foreground">
          AI-powered supplier intelligence, enrichment, and procurement recommendations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supplier List (left panel) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300"
                />
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No suppliers found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map((supplier) => {
                    const isSelected = selectedSupplier?.id === supplier.id;
                    const hasIntel = !!supplier.aiIntelligence?.lastAnalyzedAt;

                    return (
                      <button
                        key={supplier.id}
                        onClick={() => setSelectedSupplier(supplier)}
                        className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${
                          isSelected ? 'bg-purple-50 border-l-2 border-l-purple-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {supplier.name}
                              </span>
                              {hasIntel && (
                                <Sparkles className="h-3 w-3 text-purple-400 shrink-0" />
                              )}
                            </div>
                            {supplier.code && (
                              <div className="text-xs text-gray-400 mt-0.5">{supplier.code}</div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {supplier.rating != null && supplier.rating > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-amber-600">
                                  <Star className="h-3 w-3" />
                                  {supplier.rating.toFixed(1)}
                                </span>
                              )}
                              {supplier.totalOrders != null && supplier.totalOrders > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-gray-400">
                                  <Package className="h-3 w-3" />
                                  {supplier.totalOrders} orders
                                </span>
                              )}
                              {supplier.aiIntelligence?.riskAlerts?.some(
                                (r) => r.severity === 'high'
                              ) && (
                                <span className="flex items-center gap-0.5 text-xs text-red-500">
                                  <ShieldAlert className="h-3 w-3" />
                                  Risk
                                </span>
                              )}
                            </div>
                            {supplier.categories && supplier.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {supplier.categories.slice(0, 2).map((cat) => (
                                  <span
                                    key={cat}
                                    className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded"
                                  >
                                    {cat}
                                  </span>
                                ))}
                                {supplier.categories.length > 2 && (
                                  <span className="text-[10px] text-gray-400">
                                    +{supplier.categories.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 ${
                              isSelected ? 'text-purple-500' : 'text-gray-300'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {!loading && (
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
                {filtered.length} supplier{filtered.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Advisor Panel (right) */}
        <div className="lg:col-span-2">
          {selectedSupplier ? (
            <SmartProcurementAdvisor
              supplier={selectedSupplier}
              onSupplierUpdated={handleSupplierUpdated}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-center h-96">
              <div className="text-center text-gray-400">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-purple-300" />
                <p className="text-sm font-medium text-gray-500 mb-1">
                  Select a supplier to begin
                </p>
                <p className="text-xs max-w-xs mx-auto">
                  Choose a supplier from the list to run AI-powered enrichment,
                  procurement recommendations, price trend analysis, and risk assessment
                </p>
              </div>
            </div>
          )}

          {/* Quick Stats for selected supplier */}
          {selectedSupplier && selectedSupplier.aiIntelligence?.lastAnalyzedAt && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <div className="text-xs text-gray-400 mb-1">Recommendations</div>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedSupplier.aiIntelligence.recommendations?.length || 0}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Price Trends
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedSupplier.aiIntelligence.priceTrends?.length || 0}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <ShieldAlert className="h-3 w-3" />
                  Risk Alerts
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedSupplier.aiIntelligence.riskAlerts?.length || 0}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <div className="text-xs text-gray-400 mb-1">Last Analyzed</div>
                <div className="text-sm font-medium text-gray-700">
                  {new Date(selectedSupplier.aiIntelligence.lastAnalyzedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
