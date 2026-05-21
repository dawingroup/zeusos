/**
 * Advisory Dashboard Page
 * ZeusOS v2.0 - Zeus Group
 * Main dashboard with Capital Hub-style UI patterns
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  HardHat,
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  FolderKanban,
  FileText,
  Plus,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { Skeleton } from '@/core/components/ui/skeleton';
import { QuickActionsGrid } from '@/shared/components/data-display';

import { AdvisoryOverviewCard } from '../components/dashboard/AdvisoryOverviewCard';
import { ModuleCard } from '../components/dashboard/ModuleCard';
import { RecentActivityFeed } from '../components/dashboard/RecentActivityFeed';
import { MODULE_COLOR, ADVISORY_MODULES } from '../constants';
import { useAdvisoryDashboard } from '../hooks/useAdvisoryDashboard';

const AdvisoryDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const { data: dashboardData, moduleStats } = useAdvisoryDashboard();
  const { loading, error } = dashboardData;

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Advisory Overview</h1>
          <p className="text-muted-foreground">
            Construction consulting and project management
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/advisory/investment/reports')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Button>
          <Button
            onClick={() => navigate('/advisory/investment/deals/new')}
            style={{ backgroundColor: MODULE_COLOR }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Deal
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-900">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdvisoryOverviewCard
          title="Active Deals"
          value={dashboardData.activeDeals}
          subtitle="Investment pipeline"
          icon={<FolderKanban className="h-5 w-5" />}
          color={MODULE_COLOR}
          onClick={() => navigate('/advisory/investment/pipeline')}
        />
        <AdvisoryOverviewCard
          title="Pipeline Value"
          value={formatCurrency(dashboardData.totalPipelineValue)}
          subtitle={`${moduleStats.investment.deals} active deals`}
          icon={<DollarSign className="h-5 w-5" />}
          color="#10b981"
          onClick={() => navigate('/advisory/investment/pipeline')}
        />
        <AdvisoryOverviewCard
          title="Active Clients"
          value={dashboardData.activeClients}
          subtitle="Engaged clients"
          icon={<Users className="h-5 w-5" />}
          color="#3b82f6"
        />
        <AdvisoryOverviewCard
          title="Portfolios"
          value={dashboardData.activePortfolios}
          subtitle="Active portfolios"
          icon={<TrendingUp className="h-5 w-5" />}
          color="#8b5cf6"
        />
      </div>

      {/* Quick Actions */}
      <QuickActionsGrid
        columns={4}
        actions={[
          { label: 'New Deal', description: 'Create investment deal', icon: Briefcase, onClick: () => navigate('/advisory/investment/deals/new') },
          { label: 'MatFlow Project', description: 'New material flow project', icon: HardHat, onClick: () => navigate('/advisory/matflow/projects/new') },
          { label: 'Delivery Project', description: 'New delivery project', icon: Building2, onClick: () => navigate('/advisory/delivery/projects/new') },
          { label: 'Import BOQ', description: 'Upload bill of quantities', icon: FileText, onClick: () => navigate('/advisory/matflow/boq/import') },
        ]}
      />

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="overview">Modules</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ADVISORY_MODULES.map((module) => (
              <ModuleCard
                key={module.id}
                {...module}
                stats={
                  module.id === 'investment' 
                    ? [
                        { label: 'Deals', value: moduleStats.investment.deals },
                        { label: 'Pipeline', value: moduleStats.investment.pipelineValue },
                      ]
                    : module.id === 'matflow'
                    ? [
                        { label: 'Portfolios', value: moduleStats.portfolio.active },
                        { label: 'Clients', value: moduleStats.portfolio.clients },
                      ]
                    : [
                        { label: 'Portfolios', value: moduleStats.portfolio.active },
                        { label: 'Clients', value: moduleStats.portfolio.clients },
                      ]
                }
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentActivityFeed activities={[]} maxItems={10} />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/advisory/investment/deals/new')}
                >
                  <Briefcase className="h-4 w-4 mr-3" />
                  Create New Deal
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/advisory/matflow/projects/new')}
                >
                  <HardHat className="h-4 w-4 mr-3" />
                  New MatFlow Project
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/advisory/delivery/projects/new')}
                >
                  <Building2 className="h-4 w-4 mr-3" />
                  New Delivery Project
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Investment Performance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-emerald-500" />
                  Investment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active Deals</span>
                    <span className="font-semibold">{moduleStats.investment.deals}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pipeline Value</span>
                    <span className="font-semibold">{moduleStats.investment.pipelineValue}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Portfolio Performance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                  Portfolios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active Portfolios</span>
                    <span className="font-semibold">{moduleStats.portfolio.active}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Clients</span>
                    <span className="font-semibold">{moduleStats.portfolio.clients}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Performance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  Delivery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active Portfolios</span>
                    <span className="font-semibold">{moduleStats.portfolio.active}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active Clients</span>
                    <span className="font-semibold">{moduleStats.portfolio.clients}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvisoryDashboardPage;
