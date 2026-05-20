/**
 * CatalogHealthPanel
 * First-class catalog health dashboard extracted from AuditPage
 * Shows audit results and catalog-wide health metrics
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Package,
  Loader2,
  RefreshCw,
  Link2Off,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { AuditDashboard } from '../ai-assistant';
import { useLaunchPipeline } from '../../hooks/useLaunchPipeline';
import { auditService } from '../../services/auditService';
import { getUnlinkedShopifyProducts } from '../../services/shopifyService';
import type { AuditResult } from '../../types/audit.types';

interface CatalogHealthPanelProps {
  initialTab?: 'audit' | 'health';
}

interface CatalogHealth {
  totalProducts: number;
  avgScore: number;
  criticalIssues: number;
  highIssues: number;
  scoreDistribution: { excellent: number; good: number; fair: number; poor: number };
}

export function CatalogHealthPanel({ initialTab = 'audit' }: CatalogHealthPanelProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'audit' | 'health'>(initialTab);

  const {
    products,
    isLoading: productsLoading,
    error: productsError,
    refreshProducts,
  } = useLaunchPipeline();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogHealth, setCatalogHealth] = useState<CatalogHealth | null>(null);
  const [criticalProducts, setCriticalProducts] = useState<AuditResult[]>([]);
  const [unlinkedCount, setUnlinkedCount] = useState(0);

  const loadData = async () => {
    try {
      const [health, critical] = await Promise.all([
        auditService.getCatalogHealth(),
        auditService.getProductsWithCriticalIssues(),
      ]);
      setCatalogHealth(health);
      setCriticalProducts(critical);

      // Fetch unlinked Shopify products count (non-blocking)
      try {
        const shopifyData = await getUnlinkedShopifyProducts();
        setUnlinkedCount(shopifyData.unlinked.length);
      } catch {
        // Shopify may not be connected — ignore
      }
    } catch (error) {
      console.error('Error loading audit data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'health') {
      loadData();
    }
  }, [activeTab]);

  const handleRefresh = () => {
    if (activeTab === 'health') {
      setRefreshing(true);
      loadData();
      return;
    }
    refreshProducts();
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-blue-100';
    if (score >= 50) return 'bg-amber-100';
    return 'bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Catalog Health</h2>
          <p className="text-sm text-gray-500">Monitor and improve your product catalog quality</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'audit' | 'health')}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="audit" className="min-h-[44px]">Product Audit</TabsTrigger>
          <TabsTrigger value="health" className="min-h-[44px]">
            Overall Health
            {catalogHealth && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${getScoreBg(catalogHealth.avgScore)} ${getScoreColor(catalogHealth.avgScore)}`}>
                {catalogHealth.avgScore}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-6 mt-4">
          {productsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-[#872E5C]" />
            </div>
          ) : productsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              Error loading products: {productsError}
            </div>
          ) : (
            <AuditDashboard products={products} />
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-6 mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-[#872E5C]" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Products</p>
                        <p className="text-3xl font-bold">{catalogHealth?.totalProducts || 0}</p>
                      </div>
                      <Package className="w-10 h-10 text-gray-300" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Average Score</p>
                        <p className={`text-3xl font-bold ${getScoreColor(catalogHealth?.avgScore || 0)}`}>
                          {catalogHealth?.avgScore || 0}
                        </p>
                      </div>
                      <TrendingUp className={`w-10 h-10 ${getScoreColor(catalogHealth?.avgScore || 0)} opacity-50`} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Critical Issues</p>
                        <p className="text-3xl font-bold text-red-600">{catalogHealth?.criticalIssues || 0}</p>
                      </div>
                      <AlertTriangle className="w-10 h-10 text-red-300" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">High Issues</p>
                        <p className="text-3xl font-bold text-amber-600">{catalogHealth?.highIssues || 0}</p>
                      </div>
                      <AlertTriangle className="w-10 h-10 text-amber-300" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Unlinked Shopify Products Warning */}
              {unlinkedCount > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Link2Off className="w-10 h-10 text-blue-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-blue-900">
                          {unlinkedCount} Shopify product{unlinkedCount !== 1 ? 's' : ''} not linked to the pipeline
                        </p>
                        <p className="text-sm text-blue-700 mt-0.5">
                          These products are live on Shopify but have no audit coverage. Import them to track quality scores.
                        </p>
                      </div>
                      <button
                        onClick={() => navigate('/launch-pipeline?tab=shopify')}
                        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                      >
                        Import Products
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Score Distribution + Critical Products */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Score Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(['excellent', 'good', 'fair', 'poor'] as const).map((tier) => {
                      const colors = {
                        excellent: { bar: 'bg-green-500', text: 'text-green-600' },
                        good: { bar: 'bg-blue-500', text: 'text-blue-600' },
                        fair: { bar: 'bg-amber-500', text: 'text-amber-600' },
                        poor: { bar: 'bg-red-500', text: 'text-red-600' },
                      };
                      const count = catalogHealth?.scoreDistribution[tier] || 0;
                      const total = catalogHealth?.totalProducts || 1;
                      return (
                        <div key={tier} className="flex items-center gap-4">
                          <div className="w-24 text-sm text-gray-600 capitalize">{tier}</div>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${colors[tier].bar} rounded-full transition-all`}
                              style={{ width: `${(count / total) * 100}%` }}
                            />
                          </div>
                          <div className={`w-12 text-right font-medium ${colors[tier].text}`}>
                            {count}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Products Needing Attention
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {criticalProducts.length > 0 ? (
                      <div className="divide-y max-h-64 overflow-y-auto">
                        {criticalProducts.slice(0, 10).map((audit) => (
                          <div
                            key={audit.id}
                            className="py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-4 px-4"
                            onClick={() => navigate(`/launch-pipeline/product/${audit.productId}`)}
                          >
                            <div>
                              <p className="font-medium text-gray-900">{audit.productId}</p>
                              <p className="text-sm text-gray-500">
                                {audit.issues.filter((i: any) => i.severity === 'critical').length} critical,{' '}
                                {audit.issues.filter((i: any) => i.severity === 'high').length} high issues
                              </p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreBg(audit.overallScore)} ${getScoreColor(audit.overallScore)}`}>
                              {audit.overallScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
                        <p>No critical issues found!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Legend */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>Excellent (90-100)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>Good (70-89)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span>Fair (50-69)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Poor (0-49)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CatalogHealthPanel;
