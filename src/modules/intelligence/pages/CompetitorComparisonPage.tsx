// ============================================================================
// COMPETITOR COMPARISON PAGE
// ZeusOS v2.0 - Market Intelligence Module
// Side-by-side competitor comparison
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Download,
  Share2,
  Building2,
  X,
  TrendingUp,
  TrendingDown,
  Star,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Skeleton } from '@/core/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';

import { useCompetitors } from '../hooks/useCompetitors';
import { MODULE_COLOR, THREAT_LEVELS, INDUSTRY_SECTORS } from '../constants';
import { Competitor } from '../types/competitor.types';

const CompetitorComparisonPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<Competitor[]>([]);

  const { competitors, loading } = useCompetitors({});

  // Parse IDs from URL on mount
  useEffect(() => {
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];
    setSelectedIds(ids);
  }, [searchParams]);

  // Update selected competitors when IDs change
  useEffect(() => {
    if (!loading && competitors.length > 0) {
      const selected = competitors.filter((c) => selectedIds.includes(c.id));
      setSelectedCompetitors(selected);
    }
  }, [selectedIds, competitors, loading]);

  const handleAddCompetitor = (competitorId: string) => {
    if (competitorId && !selectedIds.includes(competitorId) && selectedIds.length < 4) {
      const newIds = [...selectedIds, competitorId];
      setSelectedIds(newIds);
      setSearchParams({ ids: newIds.join(',') });
    }
  };

  const handleRemoveCompetitor = (id: string) => {
    const newIds = selectedIds.filter((i) => i !== id);
    setSelectedIds(newIds);
    setSearchParams(newIds.length > 0 ? { ids: newIds.join(',') } : {});
  };

  const availableCompetitors = competitors.filter((c) => !selectedIds.includes(c.id));

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const comparisonMetrics = [
    { key: 'marketShare', label: 'Market Share', format: (v: number | undefined) => v ? `${v.toFixed(1)}%` : 'N/A' },
    { key: 'strengthScore', label: 'Strength Score', format: (v: number | undefined) => v ? `${v}/100` : 'N/A' },
    { key: 'weaknessScore', label: 'Weakness Score', format: (v: number | undefined) => v ? `${v}/100` : 'N/A' },
    { key: 'employeeCount', label: 'Employees', format: (v: number | undefined) => v ? v.toLocaleString() : 'N/A' },
    { key: 'fundingTotalUSD', label: 'Total Funding', format: (v: number | undefined) => v ? `$${(v / 1000000).toFixed(1)}M` : 'N/A' },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate('/market-intel')} className="hover:underline">
          Intelligence
        </button>
        <span>/</span>
        <button onClick={() => navigate('/market-intel/competitors')} className="hover:underline">
          Competitors
        </button>
        <span>/</span>
        <span className="text-foreground">Comparison</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/market-intel/competitors')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold">Competitor Comparison</h1>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Competitor Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Comparing:</span>

            {selectedCompetitors.map((competitor) => (
                <Badge
                  key={competitor.id}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 flex items-center gap-2"
                >
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: MODULE_COLOR }}
                  >
                    {competitor.name.charAt(0)}
                  </div>
                  <span>{competitor.name}</span>
                  <button
                    onClick={() => handleRemoveCompetitor(competitor.id)}
                    className="ml-1 p-0.5 rounded-full hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
            ))}

            {selectedIds.length < 4 && (
              <Select onValueChange={handleAddCompetitor}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Add competitor..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCompetitors.map((competitor) => (
                    <SelectItem key={competitor.id} value={competitor.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {competitor.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedIds.length >= 4 && (
              <span className="text-xs text-muted-foreground">Maximum 4 competitors</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Content */}
      {selectedCompetitors.length >= 2 ? (
        <div className="space-y-6">
          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Side-by-Side Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Metric</th>
                      {selectedCompetitors.map((competitor) => (
                        <th key={competitor.id} className="text-center py-3 px-4 font-medium">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium"
                              style={{ backgroundColor: MODULE_COLOR }}
                            >
                              {competitor.name.charAt(0)}
                            </div>
                            <span>{competitor.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Threat Level */}
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">Threat Level</td>
                      {selectedCompetitors.map((competitor) => {
                        const threatConfig = THREAT_LEVELS.find(t => t.id === competitor.threatLevel);
                        return (
                          <td key={competitor.id} className="text-center py-3 px-4">
                            <Badge style={{ backgroundColor: threatConfig?.color, color: 'white' }}>
                              {threatConfig?.label}
                            </Badge>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Sector */}
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">Sector</td>
                      {selectedCompetitors.map((competitor) => {
                        const primaryIndustry = competitor.industries?.[0];
                        const sectorConfig = INDUSTRY_SECTORS.find(s => s.id === primaryIndustry);
                        return (
                          <td key={competitor.id} className="text-center py-3 px-4">
                            {sectorConfig?.label || primaryIndustry || 'N/A'}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Metrics */}
                    {comparisonMetrics.map((metric) => (
                      <tr key={metric.key} className="border-b">
                        <td className="py-3 px-4 text-muted-foreground">{metric.label}</td>
                        {selectedCompetitors.map((competitor) => {
                          const value = (competitor as any)[metric.key];
                          const maxValue = Math.max(...selectedCompetitors.map(c => (c as any)[metric.key] || 0));
                          const isMax = value === maxValue && value > 0;
                          return (
                            <td key={competitor.id} className="text-center py-3 px-4">
                              <span className={isMax ? 'font-bold' : ''} style={isMax ? { color: MODULE_COLOR } : {}}>
                                {metric.format(value)}
                              </span>
                              {isMax && value > 0 && <Star className="h-3 w-3 inline ml-1 text-[var(--rag-amber)]" />}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Headquarters */}
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">Headquarters</td>
                      {selectedCompetitors.map((competitor) => (
                        <td key={competitor.id} className="text-center py-3 px-4">
                          {competitor.headquarters ? `${competitor.headquarters.city}, ${competitor.headquarters.country}` : 'N/A'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[var(--rag-green)]" />
                  Strengths Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedCompetitors.map((competitor) => (
                    <div key={competitor.id}>
                      <p className="font-medium mb-2">{competitor.name}</p>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--rag-green)]"
                          style={{ width: `${(competitor as any).strengthScore ?? 50}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{(competitor as any).strengthScore ?? 'N/A'}/100</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-[var(--rag-red)]" />
                  Weaknesses Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedCompetitors.map((competitor) => (
                    <div key={competitor.id}>
                      <p className="font-medium mb-2">{competitor.name}</p>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--rag-red)]"
                          style={{ width: `${(competitor as any).weaknessScore ?? 50}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{(competitor as any).weaknessScore ?? 'N/A'}/100</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select Competitors to Compare</h3>
          <p className="text-muted-foreground mb-4">
            Add at least 2 competitors to see a side-by-side comparison
          </p>
          <Button
            onClick={() => navigate('/market-intel/competitors')}
            style={{ backgroundColor: MODULE_COLOR }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Browse Competitors
          </Button>
        </Card>
      )}
    </div>
  );
};

export default CompetitorComparisonPage;
