/**
 * Audit Page
 * Standalone page for catalog-wide audit dashboard
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Package,
  Loader2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { AuditDashboard } from '../components/ai-assistant';
import { useLaunchPipeline } from '../hooks/useLaunchPipeline';
import { auditService } from '../services/auditService';
import type { AuditResult } from '../types/audit.types';

export default function AuditPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const queryTab = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    return tab === 'health' ? 'health' : 'audit';
  }, [location.search]);

  const [activeTab, setActiveTab] = useState<'audit' | 'health'>(queryTab);

  useEffect(() => {
    setActiveTab(queryTab);
  }, [queryTab]);

  const {
    products,
    isLoading: productsLoading,
    error: productsError,
    refreshProducts,
  } = useLaunchPipeline();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogHealth, setCatalogHealth] = useState<{
    totalProducts: number;
    avgScore: number;
    criticalIssues: number;
    highIssues: number;
    scoreDistribution: { excellent: number; good: number; fair: number; poor: number };
  } | null>(null);
  const [criticalProducts, setCriticalProducts] = useState<AuditResult[]>([]);

  const loadData = async () => {
    try {
      const [health, critical] = await Promise.all([
        auditService.getCatalogHealth(),
        auditService.getProductsWithCriticalIssues(),
      ]);
      setCatalogHealth(health);
      setCriticalProducts(critical);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (activeTab === 'health' && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#872E5C]" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/launch-pipeline')} className="min-h-[44px]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catalog Health</h1>
            <p className="text-gray-500">Monitor and improve your product catalog quality</p>
          </div>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} className="min-h-[44px]">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'audit' | 'health')}>
        <TabsList className="mb-6 w-full justify-start overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="audit" className="min-h-[44px]">Audit</TabsTrigger>
          <TabsTrigger value="health" className="min-h-[44px]">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-6">
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

        <TabsContent value="health" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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

          {/* Score Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">Excellent</div>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${catalogHealth?.totalProducts ? (catalogHealth.scoreDistribution.excellent / catalogHealth.totalProducts) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-12 text-right font-medium text-green-600">
                    {catalogHealth?.scoreDistribution.excellent || 0}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">Good</div>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${catalogHealth?.totalProducts ? (catalogHealth.scoreDistribution.good / catalogHealth.totalProducts) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-12 text-right font-medium text-blue-600">
                    {catalogHealth?.scoreDistribution.good || 0}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">Fair</div>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${catalogHealth?.totalProducts ? (catalogHealth.scoreDistribution.fair / catalogHealth.totalProducts) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-12 text-right font-medium text-amber-600">
                    {catalogHealth?.scoreDistribution.fair || 0}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">Poor</div>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${catalogHealth?.totalProducts ? (catalogHealth.scoreDistribution.poor / catalogHealth.totalProducts) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-12 text-right font-medium text-red-600">
                    {catalogHealth?.scoreDistribution.poor || 0}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products with Critical Issues */}
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
                            {audit.issues.filter(i => i.severity === 'critical').length} critical, {' '}
                            {audit.issues.filter(i => i.severity === 'high').length} high issues
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
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
