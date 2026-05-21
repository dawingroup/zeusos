// ============================================================================
// MARKET ANALYSIS PAGE
// ZeusOS v2.0 - Market Intelligence Module
// Comprehensive market and industry analysis
// ============================================================================

import React, { useState } from 'react';
import {
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertTriangle,
  Building2,
  BarChart3,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';

import { useMarketData } from '../hooks/useMarketData';
import { TrendIndicator } from '../components/shared/TrendIndicator';
import { MODULE_COLOR, INDUSTRY_SECTORS } from '../constants';

const MarketAnalysisPage: React.FC = () => {
  const [selectedSector, setSelectedSector] = useState<string>('fintech');
  const [activeTab, setActiveTab] = useState('overview');

  const {
    marketData,
    segments,
    trends,
    ugandaIndicators,
    keyPlayers,
    opportunities,
    threats,
    loading,
    analyzing,
    analyze,
  } = useMarketData({ sector: selectedSector });

  const formatCurrency = (value: number): string => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const sectorConfig = INDUSTRY_SECTORS.find(s => s.id === selectedSector);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: MODULE_COLOR }}>
            Market Analysis
          </h1>
          <p className="text-muted-foreground">
            Industry insights and market intelligence for Uganda & East Africa
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Sector" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_SECTORS.map(sector => (
                <SelectItem key={sector.id} value={sector.id}>{sector.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={analyze}
            disabled={analyzing || loading}
            style={{ borderColor: MODULE_COLOR, color: MODULE_COLOR }}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <KPIGrid cols={4}>
        <KPICard
          label="Market Size"
          value={marketData ? formatCurrency(marketData.marketSizeUSD) : '-'}
          delta="Total Addressable Market"
        />
        <KPICard
          label="Growth Rate"
          value={marketData ? `${marketData.growthRate > 0 ? '+' : ''}${marketData.growthRate}%` : '-'}
          trend={marketData ? (marketData.growthRate >= 0 ? 'up' : 'down') : undefined}
          delta="Year-over-Year"
        />
        <KPICard
          label="Key Players"
          value={keyPlayers.length}
          delta="Major Competitors"
        />
        <KPICard
          label="Data Confidence"
          value={marketData ? `${(marketData.confidence * 100).toFixed(0)}%` : '-'}
          delta="Analysis Reliability"
        />
      </KPIGrid>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="competition">Competition</TabsTrigger>
          <TabsTrigger value="indicators">Economic Indicators</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Key Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {opportunities.map((opp, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-sm">{opp}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Threats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Key Threats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {threats.map((threat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <span className="text-sm">{threat}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Market Summary */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Market Summary - {sectorConfig?.label || selectedSector}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  The {sectorConfig?.label || selectedSector} sector in Uganda is experiencing 
                  {marketData && marketData.growthRate > 10 ? ' strong' : marketData && marketData.growthRate > 5 ? ' moderate' : ' steady'} growth, 
                  driven by increasing digital adoption and supportive regulatory frameworks. 
                  The market is valued at approximately {marketData ? formatCurrency(marketData.marketSizeUSD) : 'N/A'} with 
                  a projected growth rate of {marketData?.projectedGrowthRate || marketData?.growthRate}% over the next 5 years.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Segments Tab */}
        <TabsContent value="segments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Market Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {segments.map((segment, idx) => (
                  <div key={segment.id || idx} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{segment.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(segment.sizeUSD)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${segment.share}%`,
                            backgroundColor: MODULE_COLOR,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12">{segment.share}%</span>
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: segment.growthRate > 0 ? '#4caf5020' : '#f4433620',
                          color: segment.growthRate > 0 ? '#4caf50' : '#f44336',
                        }}
                      >
                        {segment.growthRate > 0 ? '+' : ''}{segment.growthRate}%
                      </Badge>
                    </div>
                    {segment.description && (
                      <p className="text-xs text-muted-foreground">{segment.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="mt-6">
          <div className="space-y-4">
            {trends.map((trend, idx) => (
              <Card key={trend.id || idx}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="p-3 rounded-lg text-white"
                      style={{
                        backgroundColor: trend.direction.includes('up') ? '#4caf50' : trend.direction.includes('down') ? '#f44336' : '#9e9e9e',
                      }}
                    >
                      {trend.direction.includes('up') ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : trend.direction.includes('down') ? (
                        <TrendingDown className="h-5 w-5" />
                      ) : (
                        <Minus className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{trend.title}</h4>
                        <TrendIndicator direction={trend.direction} size="small" />
                        <Badge variant="outline" className="text-xs">
                          {trend.strength}% strength
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{trend.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">{trend.maturity} stage</Badge>
                        <Badge variant="secondary" className="text-xs capitalize">{trend.impactLevel} impact</Badge>
                        <Badge variant="secondary" className="text-xs capitalize">{trend.timeframe?.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {trends.length === 0 && (
              <Card className="p-12 text-center">
                <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No trends data available for this sector</p>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Competition Tab */}
        <TabsContent value="competition" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Market Share Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {keyPlayers.map((player, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{player.name}</span>
                        </div>
                        <span className="font-semibold">{player.marketShare}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${player.marketShare}%`,
                            backgroundColor: MODULE_COLOR,
                            opacity: 1 - (idx * 0.15),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Competitive Landscape</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Key Players</p>
                  <p className="text-2xl font-bold" style={{ color: MODULE_COLOR }}>{keyPlayers.length}</p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground">Top 3 Combined Share</p>
                  <p className="text-2xl font-bold" style={{ color: MODULE_COLOR }}>
                    {keyPlayers.slice(0, 3).reduce((acc, p) => acc + p.marketShare, 0)}%
                  </p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground">Market Concentration</p>
                  <Badge className="mt-1" style={{ backgroundColor: '#ff980020', color: '#ff9800' }}>
                    {keyPlayers.length <= 5 ? 'Concentrated' : 'Fragmented'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Economic Indicators Tab */}
        <TabsContent value="indicators" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Uganda Economic Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {ugandaIndicators.map((indicator) => (
                  <div key={indicator.id} className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">{indicator.label}</p>
                    <p className="text-xl font-bold">{indicator.value}{indicator.unit === '%' ? '%' : ''}</p>
                    {indicator.unit !== '%' && (
                      <p className="text-xs text-muted-foreground">{indicator.unit}</p>
                    )}
                    {indicator.change !== undefined && (
                      <div className={`flex items-center gap-1 mt-1 text-xs ${indicator.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {indicator.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {indicator.change >= 0 ? '+' : ''}{indicator.change}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{indicator.date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketAnalysisPage;
