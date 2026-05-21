// ============================================================================
// INTELLIGENCE DASHBOARD PAGE
// ZeusOS v2.0 - Market Intelligence Module
// Main dashboard for market intelligence
// ============================================================================

import React from 'react';
import { RefreshCw, Settings, Bell, Lightbulb } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Skeleton } from '@/core/components/ui/skeleton';

import { useIntelligenceDashboard } from '../hooks/useIntelligenceDashboard';
import { InsightCard } from '../components/shared/InsightCard';
import { MarketSentiment, SentimentDistribution } from '../components/shared/MarketSentiment';
import { TrendBadge } from '../components/shared/TrendIndicator';
import { MODULE_COLOR } from '../constants';
import { KPICard, KPIGrid } from '@/shared/components/data-display';

const IntelligenceDashboardPage: React.FC = () => {
  const {
    dashboard,
    loading,
    refresh,
    lastRefresh,
  } = useIntelligenceDashboard();

  const metrics = [
    {
      label: 'Tracked Competitors',
      value: dashboard?.trackedCompetitors || 0,
      sparkColor: 'var(--rag-blue)',
      change: '+2 this week',
    },
    {
      label: 'Active Insights',
      value: dashboard?.activeInsights || 0,
      sparkColor: 'var(--accent)',
      change: '3 new today',
    },
    {
      label: 'Unread News',
      value: dashboard?.unreadNews || 0,
      sparkColor: 'var(--rag-green)',
      change: '12 today',
    },
    {
      label: 'Alerts Today',
      value: dashboard?.alertsToday || 0,
      sparkColor: 'var(--rag-red)',
      change: (dashboard?.alertsToday || 0) > 5 ? 'High activity' : 'Normal',
    },
  ];

  if (loading && !dashboard) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Market Intelligence</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Real-time market insights and competitive analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: 'var(--fg-tertiary)' }}>
            Last updated: {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : 'Never'}
          </span>
          <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-3.5 w-3.5" />
            {(dashboard?.alertsToday || 0) > 0 && (
              <span
                className="absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ring-[var(--bg-surface)]"
                style={{ backgroundColor: 'var(--rag-red)' }}
              />
            )}
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <KPIGrid>
        {metrics.map((metric, index) => (
          <KPICard
            key={index}
            label={metric.label}
            value={metric.value}
            delta={metric.change}
            sparkColor={metric.sparkColor}
          />
        ))}
      </KPIGrid>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Insights & Trends */}
        <div className="lg:col-span-2 space-y-6">
          {/* Market Sentiment Overview */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Market Sentiment</CardTitle>
                <MarketSentiment sentiment={dashboard?.overallSentiment || 'neutral'} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Sentiment Distribution</p>
                  <SentimentDistribution
                    distribution={{
                      very_positive: 15,
                      positive: 35,
                      neutral: 30,
                      negative: 15,
                      very_negative: 5,
                    }}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Trending Topics</p>
                  <div className="flex flex-wrap gap-2">
                    {(dashboard?.topicTrends || []).slice(0, 6).map((topic, idx) => (
                      <TrendBadge key={idx} direction={topic.trend} label={topic.topic} />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Insights */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Active Insights</CardTitle>
                <Button variant="link" style={{ color: MODULE_COLOR }}>View All</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(dashboard?.recentInsights || []).slice(0, 4).map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
              
              {(!dashboard?.recentInsights || dashboard.recentInsights.length === 0) && (
                <div className="text-center py-8">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No active insights at the moment</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Alerts & News */}
        <div className="space-y-6">
          {/* Competitor Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Competitor Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboard?.competitorAlerts || []).slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg bg-muted/50"
                  style={{
                    borderLeft: `3px solid ${
                      alert.impact === 'high' ? '#f44336' : alert.impact === 'medium' ? '#ff9800' : '#4caf50'
                    }`,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                      style={{ backgroundColor: MODULE_COLOR }}
                    >
                      {alert.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize shrink-0">
                      {alert.activityType.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {(!dashboard?.competitorAlerts || dashboard.competitorAlerts.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent competitor activity
                </p>
              )}
              
              <Button variant="ghost" className="w-full" style={{ color: MODULE_COLOR }}>
                View All Alerts
              </Button>
            </CardContent>
          </Card>

          {/* Recent News */}
          <Card>
            <CardHeader>
              <CardTitle>Latest News</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboard?.recentNews || []).slice(0, 5).map((article) => (
                <div
                  key={article.id}
                  className="p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <p className="text-sm font-medium mb-1">{article.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{article.sourceName}</span>
                    <span>•</span>
                    <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                    <MarketSentiment sentiment={article.sentiment} variant="icon" />
                  </div>
                </div>
              ))}
              
              <Button variant="ghost" className="w-full" style={{ color: MODULE_COLOR }}>
                View All News
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceDashboardPage;
