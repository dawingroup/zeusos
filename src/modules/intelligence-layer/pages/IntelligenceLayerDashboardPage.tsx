// ============================================================================
// INTELLIGENCE LAYER DASHBOARD PAGE
// ZeusOS v2.0 - Intelligence Layer
// Main dashboard for AI intelligence features
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  Brain,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Settings,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { Skeleton } from '@/core/components/ui/skeleton';

import { MODULE_COLOR } from '../constants';
import { useIntelligenceOverview } from '../hooks/useIntelligenceOverview';
import { useSmartSuggestions } from '../hooks/useSmartSuggestions';
import { useAnomalies } from '../hooks/useAnomalies';
import { usePredictions } from '../hooks/usePredictions';
import { useCrossModuleInsights } from '../hooks/useCrossModuleInsights';

import { IntelligenceOverviewCard } from '../components/dashboard/IntelligenceOverviewCard';
import { RecentActivityFeed } from '../components/dashboard/RecentActivityFeed';
import { CrossModuleInsightsPanel } from '../components/dashboard/CrossModuleInsightsPanel';
import { NaturalLanguageSearch } from '../components/query/NaturalLanguageSearch';
import { SuggestionCard } from '../components/shared/SuggestionCard';
import { AnomalyAlert } from '../components/shared/AnomalyAlert';
import { PredictionCard } from '../components/predictions/PredictionCard';
import { AIAssistantFAB } from '../components/assistant/AIAssistantFAB';
import { naturalLanguageQueryService } from '../services/naturalLanguageQueryService';

type TabView = 'overview' | 'suggestions' | 'anomalies' | 'predictions';

const IntelligenceLayerDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>('overview');

  const { overview, loading: overviewLoading, refresh: refreshOverview } = useIntelligenceOverview();
  const { suggestions, loading: suggestionsLoading, acceptSuggestion, dismissSuggestion } = useSmartSuggestions();
  const { anomalies, loading: anomaliesLoading, acknowledgeAnomaly, resolveAnomaly } = useAnomalies();
  const { predictions, loading: predictionsLoading } = usePredictions();
  const { insights, loading: insightsLoading } = useCrossModuleInsights();

  const loading = overviewLoading || suggestionsLoading || anomaliesLoading || predictionsLoading || insightsLoading;

  // Build context for AI Assistant from current page state
  const assistantContext = useMemo(() => ({
    currentModule: 'intelligence_layer' as const,
    currentTab: activeTab,
    activeSuggestions: suggestions.filter((s) => s.status === 'pending').length,
    activeAnomalies: anomalies.filter((a) => a.status === 'new' || a.status === 'investigating').length,
    activePredictions: predictions.filter((p) => p.status === 'active').length,
    activeInsights: insights.filter((i) => i.status === 'new').length,
    summary: {
      suggestions: suggestions.slice(0, 3).map((s) => s.title),
      anomalies: anomalies.slice(0, 3).map((a) => `${a.severity}: ${a.title}`),
      predictions: predictions.slice(0, 3).map((p) => `${p.title} (${Math.round(p.confidence * 100)}% confidence)`),
    },
  }), [activeTab, suggestions, anomalies, predictions, insights]);

  const handleNLQuery = useCallback(async (queryText: string) => {
    return naturalLanguageQueryService.processQuery(queryText);
  }, []);

  const handleRefresh = () => {
    refreshOverview();
  };

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Natural Language Search - Full Width */}
      <div className="lg:col-span-3">
        <NaturalLanguageSearch
          onQuery={handleNLQuery}
          recentQueries={['Show my pending tasks', 'What tasks are overdue?', 'Show recent events']}
          suggestedQueries={[
            'How many tasks do I have?',
            'Which tasks are blocked?',
            'Show recent business events',
            'What is the inventory status?',
            'Show task analytics',
          ]}
        />
      </div>

      {/* Overview Card - Full Width */}
      <div className="lg:col-span-3">
        {overviewLoading ? (
          <Skeleton className="h-52" />
        ) : overview ? (
          <IntelligenceOverviewCard overview={overview} />
        ) : null}
      </div>

      {/* Main Content - 2 columns */}
      <div className="lg:col-span-2 space-y-6">
        {/* Top Suggestions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Smart Suggestions</CardTitle>
            <Badge style={{ backgroundColor: MODULE_COLOR }}>
              {suggestions.filter((s) => s.status === 'pending').length} pending
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestionsLoading ? (
              [...Array(3)].map((_, idx) => <Skeleton key={idx} className="h-28" />)
            ) : (
              suggestions.slice(0, 3).map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={acceptSuggestion}
                  onDismiss={dismissSuggestion}
                  compact
                />
              ))
            )}
            {suggestions.length > 3 && (
              <Button
                variant="ghost"
                className="w-full"
                style={{ color: MODULE_COLOR }}
                onClick={() => setActiveTab('suggestions')}
              >
                View All {suggestions.length} Suggestions
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Active Anomalies */}
        {anomalies.filter((a) => a.status !== 'resolved').length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Active Anomalies</CardTitle>
              <Badge variant="destructive">
                {anomalies.filter((a) => a.status === 'new').length} new
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {anomalies
                .filter((a) => a.status !== 'resolved')
                .slice(0, 2)
                .map((anomaly) => (
                  <AnomalyAlert
                    key={anomaly.id}
                    anomaly={anomaly}
                    onAcknowledge={acknowledgeAnomaly}
                    onResolve={resolveAnomaly}
                  />
                ))}
              <Button
                variant="ghost"
                className="w-full"
                style={{ color: MODULE_COLOR }}
                onClick={() => setActiveTab('anomalies')}
              >
                View All Anomalies
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Cross-Module Insights */}
        <CrossModuleInsightsPanel insights={insights.slice(0, 3)} />
      </div>

      {/* Sidebar - 1 column */}
      <div className="space-y-6">
        {/* Predictions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Active Predictions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {predictionsLoading ? (
              [...Array(2)].map((_, idx) => <Skeleton key={idx} className="h-24" />)
            ) : (
              predictions
                .filter((p) => p.status === 'active')
                .slice(0, 3)
                .map((prediction) => (
                  <PredictionCard key={prediction.id} prediction={prediction} compact />
                ))
            )}
            <Button
              variant="ghost"
              className="w-full"
              style={{ color: MODULE_COLOR }}
              onClick={() => setActiveTab('predictions')}
            >
              View All Predictions
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {overview && (
          <RecentActivityFeed
            activities={overview.recentActivity}
            maxItems={5}
          />
        )}
      </div>
    </div>
  );

  const renderSuggestionsTab = () => (
    <div className="space-y-4">
      {suggestionsLoading ? (
        [...Array(5)].map((_, idx) => <Skeleton key={idx} className="h-44" />)
      ) : (
        suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onAccept={acceptSuggestion}
            onDismiss={dismissSuggestion}
          />
        ))
      )}
      {!suggestionsLoading && suggestions.length === 0 && (
        <Card className="p-12 text-center">
          <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Pending Suggestions</h3>
          <p className="text-muted-foreground">
            AI suggestions will appear here when patterns are detected
          </p>
        </Card>
      )}
    </div>
  );

  const renderAnomaliesTab = () => (
    <div className="space-y-4">
      {anomaliesLoading ? (
        [...Array(3)].map((_, idx) => <Skeleton key={idx} className="h-52" />)
      ) : (
        anomalies.map((anomaly) => (
          <AnomalyAlert
            key={anomaly.id}
            anomaly={anomaly}
            onAcknowledge={acknowledgeAnomaly}
            onResolve={resolveAnomaly}
          />
        ))
      )}
      {!anomaliesLoading && anomalies.length === 0 && (
        <Card className="p-12 text-center">
          <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Anomalies Detected</h3>
          <p className="text-muted-foreground">
            The system is monitoring for unusual patterns across all modules
          </p>
        </Card>
      )}
    </div>
  );

  const renderPredictionsTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {predictionsLoading ? (
        [...Array(4)].map((_, idx) => <Skeleton key={idx} className="h-80" />)
      ) : (
        predictions.map((prediction) => (
          <PredictionCard key={prediction.id} prediction={prediction} />
        ))
      )}
      {!predictionsLoading && predictions.length === 0 && (
        <Card className="md:col-span-2 p-12 text-center">
          <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Predictions</h3>
          <p className="text-muted-foreground">
            AI predictions will appear here as data patterns emerge
          </p>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: `${MODULE_COLOR}15` }}
          >
            <Brain className="h-8 w-8" style={{ color: MODULE_COLOR }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: MODULE_COLOR }}>
              Intelligence Layer
            </h1>
            <p className="text-muted-foreground">
              AI-powered insights and automation across ZeusOS
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabView)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            Suggestions
            <Badge style={{ backgroundColor: MODULE_COLOR }} className="ml-1">
              {suggestions.filter((s) => s.status === 'pending').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-2">
            Anomalies
            <Badge variant="destructive" className="ml-1">
              {anomalies.filter((a) => a.status === 'new').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {renderOverviewTab()}
        </TabsContent>
        <TabsContent value="suggestions" className="mt-6">
          {renderSuggestionsTab()}
        </TabsContent>
        <TabsContent value="anomalies" className="mt-6">
          {renderAnomaliesTab()}
        </TabsContent>
        <TabsContent value="predictions" className="mt-6">
          {renderPredictionsTab()}
        </TabsContent>
      </Tabs>

      {/* AI Assistant FAB */}
      <AIAssistantFAB context={assistantContext} />
    </div>
  );
};

export default IntelligenceLayerDashboardPage;
