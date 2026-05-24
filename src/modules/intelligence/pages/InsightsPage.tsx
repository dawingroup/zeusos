// ============================================================================
// INSIGHTS PAGE
// ZeusOS v2.0 - Market Intelligence Module
// AI-generated insights management and generation
// ============================================================================

import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Eye,
  Check,
  RefreshCw,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { Skeleton } from '@/core/components/ui/skeleton';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';

import { useInsights } from '../hooks/useInsights';
import { InsightCard } from '../components/shared/InsightCard';
import { MODULE_COLOR, INSIGHT_TYPES, INDUSTRY_SECTORS } from '../constants';
import { Insight } from '../types';

const insightTypeIcons: Record<string, React.ReactNode> = {
  opportunity: <TrendingUp className="h-4 w-4 text-[var(--rag-green)]" />,
  threat: <AlertTriangle className="h-4 w-4 text-[var(--rag-red)]" />,
  trend: <BarChart3 className="h-4 w-4 text-[var(--rag-blue)]" />,
  anomaly: <AlertCircle className="h-4 w-4 text-[var(--rag-amber)]" />,
  recommendation: <CheckCircle className="h-4 w-4 text-[var(--rag-blue)]" />,
};

const InsightsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [insightType, setInsightType] = useState('all');
  const [sector, setSector] = useState('all');

  // Generator state
  const [generatorTopic, setGeneratorTopic] = useState('');

  // Detail dialog state
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const statusFilter = activeTab === 'new' ? 'new' : activeTab === 'reviewed' ? 'reviewed' : activeTab === 'actioned' ? 'actioned' : undefined;

  const {
    insights,
    loading,
    generating,
    generate,
    updateInsightStatus,
    dismissInsight,
    actionInsight,
  } = useInsights({
    type: insightType !== 'all' ? insightType : undefined,
    priority: undefined,
    status: statusFilter,
  });

  // Filter by search
  const filteredInsights = insights.filter(insight =>
    !searchQuery ||
    insight.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    insight.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count by status
  const counts = {
    total: insights.length,
    new: insights.filter(i => i.status === 'new').length,
    reviewed: insights.filter(i => i.status === 'reviewed').length,
    actioned: insights.filter(i => i.status === 'actioned').length,
  };

  const handleInsightClick = (insight: Insight) => {
    setSelectedInsight(insight);
    setDetailOpen(true);
  };

  const handleAction = async (insight: Insight) => {
    await actionInsight(insight.id);
    setDetailOpen(false);
  };

  const handleDismiss = async (insight: Insight) => {
    await dismissInsight(insight.id);
    setDetailOpen(false);
  };

  const handleGenerate = async () => {
    await generate(
      sector !== 'all' ? sector : undefined,
      generatorTopic.trim() || undefined
    );
    setGeneratorTopic('');
  };

  const suggestedTopics = [
    'Mobile money adoption in rural Uganda',
    'Competitive analysis of fintech startups',
    'Agricultural technology market potential',
    'Digital banking trends in East Africa',
  ];

  const renderInsightsList = () => (
    <>
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search insights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={insightType} onValueChange={setInsightType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {INSIGHT_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {INDUSTRY_SECTORS.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44" />)}
        </div>
      )}

      {/* Insights */}
      {!loading && (
        <div className="space-y-4">
          {filteredInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onClick={() => handleInsightClick(insight)}
              onAction={() => handleAction(insight)}
              onDismiss={() => handleDismiss(insight)}
            />
          ))}

          {filteredInsights.length === 0 && (
            <Card className="p-12 text-center">
              <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Insights Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || insightType !== 'all' || sector !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Generate new insights using AI'}
              </p>
              <Button
                onClick={() => setActiveTab('generate')}
                style={{ backgroundColor: MODULE_COLOR }}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Insights
              </Button>
            </Card>
          )}
        </div>
      )}
    </>
  );

  const renderGenerator = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: MODULE_COLOR }} />
            AI Insight Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="e.g., Market opportunities for mobile money in rural Uganda"
            value={generatorTopic}
            onChange={(e) => setGeneratorTopic(e.target.value)}
            rows={4}
          />

          <div>
            <p className="text-xs text-muted-foreground mb-2">Suggested topics:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedTopics.map((topic) => (
                <Badge
                  key={topic}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setGeneratorTopic(topic)}
                >
                  {topic}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <Select defaultValue="all">
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {INDUSTRY_SECTORS.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Insight Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {INSIGHT_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={generating || !generatorTopic.trim()}
            style={{ backgroundColor: MODULE_COLOR }}
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {generating ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: MODULE_COLOR }} />
              <p className="text-muted-foreground">Analyzing data and generating insights...</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Generated insights will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: MODULE_COLOR }}>
            AI Insights
          </h1>
          <p className="text-muted-foreground">
            AI-generated market insights and recommendations
          </p>
        </div>
      </div>

      {/* Tabs with counts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            All Insights
            <Badge variant="secondary" className="ml-1">{counts.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-2">
            New
            <Badge className="ml-1" style={{ backgroundColor: MODULE_COLOR }}>{counts.new}</Badge>
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="gap-2">
            Reviewed
            <Badge variant="secondary" className="ml-1">{counts.reviewed}</Badge>
          </TabsTrigger>
          <TabsTrigger value="actioned" className="gap-2">
            Actioned
            <Badge variant="secondary" className="ml-1 bg-[var(--rag-green-soft)] text-[var(--rag-green)]">{counts.actioned}</Badge>
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">{renderInsightsList()}</TabsContent>
        <TabsContent value="new" className="mt-6">{renderInsightsList()}</TabsContent>
        <TabsContent value="reviewed" className="mt-6">{renderInsightsList()}</TabsContent>
        <TabsContent value="actioned" className="mt-6">{renderInsightsList()}</TabsContent>
        <TabsContent value="generate" className="mt-6">{renderGenerator()}</TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {selectedInsight && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {insightTypeIcons[selectedInsight.type]}
                  {selectedInsight.title}
                </DialogTitle>
                <DialogDescription>
                  {INSIGHT_TYPES.find(t => t.id === selectedInsight.type)?.label} • 
                  {selectedInsight.priority} priority
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm">{selectedInsight.description}</p>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <p className="font-medium capitalize">{selectedInsight.priority}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="font-medium">{(selectedInsight.confidence * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data Points</p>
                    <p className="font-medium">{selectedInsight.dataPoints || 'N/A'}</p>
                  </div>
                </div>

                {selectedInsight.recommendations && selectedInsight.recommendations.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Recommendations</p>
                    <ul className="space-y-1">
                      {selectedInsight.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-[var(--rag-green)] mt-0.5 shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Close
                </Button>
                {selectedInsight.status === 'new' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      updateInsightStatus(selectedInsight.id, 'reviewed');
                      setDetailOpen(false);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Mark Reviewed
                  </Button>
                )}
                <Button
                  onClick={() => handleAction(selectedInsight)}
                  style={{ backgroundColor: MODULE_COLOR }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Take Action
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InsightsPage;
