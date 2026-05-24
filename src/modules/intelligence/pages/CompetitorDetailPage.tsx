// ============================================================================
// COMPETITOR DETAIL PAGE
// ZeusOS v2.0 - Market Intelligence Module
// Comprehensive competitor profile and analysis
// ============================================================================

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Building2,
  Globe,
  Linkedin,
  Twitter,
  MapPin,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  Calendar,
  Rocket,
  DollarSign,
  UserPlus,
  Link2,
  Search,
  Sparkles,
  Trash2,
  Loader2,
  RefreshCw,
  Bookmark,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPICard } from '@/shared/components/data-display';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';

import { useCompetitorDetail } from '../hooks/useCompetitorDetail';
import { useNewsFeed } from '../hooks/useNewsFeed';
import { competitorService } from '../services/competitorService';
import { EditCompetitorDialog } from '../components/competitor/EditCompetitorDialog';
import { DigitalProfilesSection } from '../components/competitor/DigitalProfilesSection';
import { SocialIntelligenceSection } from '../components/competitor/SocialIntelligenceSection';
import { CompetitorFormInput } from '../types/competitor.types';
import { ConfidenceIndicator } from '../components/shared/ConfidenceIndicator';
import { DataSourceBadge } from '../components/shared/DataSourceBadge';
import { MODULE_COLOR, SENTIMENT_LEVELS } from '../constants';
import {
  THREAT_LEVEL_LABELS,
  THREAT_LEVEL_COLORS,
  INDUSTRY_LABELS,
  COMPETITOR_TYPE_LABELS,
} from '../constants/competitor.constants';
import { CompetitorActivity } from '../types';

// --------------------------------------------------------------------------
// News Tab Sub-component (lazy-loaded to avoid fetching unless tab is active)
// --------------------------------------------------------------------------

const CompetitorNewsTab: React.FC<{
  competitorId: string;
  competitorName: string;
}> = ({ competitorId, competitorName }) => {
  const {
    articles,
    loading,
    scanning,
    scan,
    markAsRead,
    bookmarkArticle,
  } = useNewsFeed({ competitorId });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No News Found</h3>
        <p className="text-muted-foreground mb-4">
          No news articles mentioning {competitorName} have been found yet.
        </p>
        <Button
          variant="outline"
          onClick={() => scan()}
          disabled={scanning}
          style={{ borderColor: MODULE_COLOR, color: MODULE_COLOR }}
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {scanning ? 'Scanning...' : 'Scan for News'}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {articles.length} article{articles.length !== 1 ? 's' : ''} found
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => scan()}
          disabled={scanning}
          style={{ borderColor: MODULE_COLOR, color: MODULE_COLOR }}
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {scanning ? 'Scanning...' : 'Scan for More'}
        </Button>
      </div>
      {articles.map(article => {
        const sentimentConfig = SENTIMENT_LEVELS.find(
          s => s.id === article.sentiment,
        );
        return (
          <Card
            key={article.id}
            className="overflow-hidden"
            style={{
              borderLeft: `4px solid ${sentimentConfig?.color || '#9e9e9e'}`,
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4
                    className={`font-medium cursor-pointer hover:underline ${article.isRead ? 'text-muted-foreground' : ''}`}
                    style={{
                      color: article.isRead ? undefined : MODULE_COLOR,
                    }}
                    onClick={() => {
                      if (!article.isRead) markAsRead(article.id);
                      window.open(article.sourceUrl, '_blank');
                    }}
                  >
                    {article.title}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {article.summary}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{article.sourceName}</span>
                    <span>-</span>
                    <span>
                      {new Date(article.publishedAt).toLocaleDateString(
                        'en-US',
                        { year: 'numeric', month: 'short', day: 'numeric' },
                      )}
                    </span>
                    {article.relevanceScore > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {article.relevanceScore}% relevant
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() =>
                    bookmarkArticle(article.id, !article.isBookmarked)
                  }
                >
                  <Bookmark
                    className={`h-4 w-4 ${article.isBookmarked ? 'fill-current text-yellow-500' : 'text-muted-foreground'}`}
                  />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// --------------------------------------------------------------------------
// Main Page Component
// --------------------------------------------------------------------------

const CompetitorDetailPage: React.FC = () => {
  const { competitorId } = useParams<{ competitorId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    competitor,
    swotAnalysis,
    activities,
    recentMoveCount,
    dataConfidence,
    loading,
    swotLoading,
    movesLoading,
    refresh,
  } = useCompetitorDetail(competitorId);

  const getActivityIcon = (type: CompetitorActivity['activityType']) => {
    const icons: Record<string, React.ReactNode> = {
      product_launch: <Rocket className="h-4 w-4 text-blue-500" />,
      funding: <DollarSign className="h-4 w-4 text-green-500" />,
      partnership: <Link2 className="h-4 w-4 text-purple-500" />,
      hiring: <UserPlus className="h-4 w-4 text-blue-500" />,
      expansion: <TrendingUp className="h-4 w-4 text-orange-500" />,
      news: <FileText className="h-4 w-4 text-muted-foreground" />,
      social: <Users className="h-4 w-4 text-blue-400" />,
      other: <Calendar className="h-4 w-4 text-[var(--fg-tertiary)]" />,
    };
    return icons[type] || icons.other;
  };

  // Derive strengths from SWOT analysis or positioning differentiators
  const getStrengths = (): string[] => {
    if (swotAnalysis?.strengths?.length) {
      return swotAnalysis.strengths.map(s => s.description);
    }
    if (competitor?.positioning?.differentiators?.length) {
      return competitor.positioning.differentiators;
    }
    return [];
  };

  // Derive weaknesses from SWOT analysis or positioning weaknessAreas
  const getWeaknesses = (): string[] => {
    if (swotAnalysis?.weaknesses?.length) {
      return swotAnalysis.weaknesses.map(w => w.description);
    }
    if (competitor?.positioning?.weaknessAreas?.length) {
      return competitor.positioning.weaknessAreas;
    }
    return [];
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!competitor) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Competitor Not Found</h3>
          <p className="text-muted-foreground mb-4">The requested competitor could not be found.</p>
          <Button onClick={() => navigate('/market-intel/competitors')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Competitors
          </Button>
        </Card>
      </div>
    );
  }

  const threatColor = THREAT_LEVEL_COLORS[competitor.threatLevel] || '#6B7280';
  const threatLabel = THREAT_LEVEL_LABELS[competitor.threatLevel] || competitor.threatLevel;
  const strengths = getStrengths();
  const weaknesses = getWeaknesses();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card
        className="p-6"
        style={{ background: `linear-gradient(135deg, ${MODULE_COLOR}15 0%, ${MODULE_COLOR}05 100%)` }}
      >
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/market-intel/competitors')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div
            className="h-20 w-20 rounded-xl flex items-center justify-center text-white text-2xl font-bold shrink-0"
            style={{ backgroundColor: MODULE_COLOR }}
          >
            {competitor.logoUrl ? (
              <img src={competitor.logoUrl} alt={competitor.name} className="h-full w-full rounded-xl object-cover" />
            ) : (
              competitor.name.charAt(0)
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{competitor.name}</h1>
              <Badge style={{ backgroundColor: threatColor, color: 'white' }}>
                {threatLabel}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {COMPETITOR_TYPE_LABELS[competitor.type] || competitor.type}
              </Badge>
            </div>

            <p className="text-muted-foreground mb-3">{competitor.description}</p>

            <div className="flex flex-wrap gap-4 text-sm">
              {competitor.website && (
                <a
                  href={competitor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline"
                  style={{ color: MODULE_COLOR }}
                >
                  <Globe className="h-4 w-4" />
                  Website
                </a>
              )}
              {competitor.headquarters && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {competitor.headquarters.city}{competitor.headquarters.country ? `, ${competitor.headquarters.country}` : ''}
                </span>
              )}
              {competitor.employeeCount && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {competitor.employeeCount.toLocaleString()} employees
                </span>
              )}
              {competitor.socialProfiles?.linkedin && (
                <a href={competitor.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-4 w-4 text-muted-foreground hover:text-blue-600" />
                </a>
              )}
              {competitor.socialProfiles?.twitter && (
                <a href={competitor.socialProfiles.twitter} target="_blank" rel="noopener noreferrer">
                  <Twitter className="h-4 w-4 text-muted-foreground hover:text-blue-400" />
                </a>
              )}
              {competitor.industries?.length > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  {competitor.industries.map(i => INDUSTRY_LABELS[i] || i).join(', ')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setEnhancing(true);
                try {
                  const { getFunctions, httpsCallable } = await import('firebase/functions');
                  const functions = getFunctions();
                  const enhanceFn = httpsCallable(functions, 'enhanceCompetitorProfile');
                  await enhanceFn({ competitorId: competitor.id });
                  await refresh();
                } catch (err) {
                  console.error('Enhance error:', err);
                } finally {
                  setEnhancing(false);
                }
              }}
              disabled={enhancing}
              style={{ borderColor: MODULE_COLOR, color: MODULE_COLOR }}
            >
              {enhancing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {enhancing ? 'Enhancing...' : 'Enhance Profile'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
              style={{ borderColor: MODULE_COLOR, color: MODULE_COLOR }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard
          label="Market Share"
          value={
            competitor.estimatedMarketShare != null
              ? `${competitor.estimatedMarketShare.toFixed(1)}%`
              : 'N/A'
          }
        />
        <KPICard label="Status" value={<span className="capitalize">{competitor.status}</span>} />
        <KPICard
          label="Recent Activities"
          value={movesLoading ? <Skeleton className="h-7 w-12" /> : recentMoveCount}
          delta={movesLoading ? undefined : 'Last 30 days'}
        />
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Data Confidence</p>
            <ConfidenceIndicator score={dataConfidence} variant="bar" showLabel />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Activity Timeline
          </TabsTrigger>
          <TabsTrigger value="profiles" className="gap-2">
            <Search className="h-4 w-4" />
            Digital Profiles
          </TabsTrigger>
          <TabsTrigger value="news" className="gap-2">
            <FileText className="h-4 w-4" />
            News & Mentions
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Social Intelligence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Strengths */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Key Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {swotLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : strengths.length > 0 ? (
                  <>
                    <ul className="space-y-2">
                      {strengths.slice(0, 5).map((strength, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                    {swotAnalysis && (
                      <p className="text-xs text-muted-foreground mt-3">
                        Source: SWOT Analysis v{swotAnalysis.version} ({swotAnalysis.status})
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No strengths identified yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Run a SWOT analysis or enhance the profile to discover strengths.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Weaknesses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Key Weaknesses
                </CardTitle>
              </CardHeader>
              <CardContent>
                {swotLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : weaknesses.length > 0 ? (
                  <>
                    <ul className="space-y-2">
                      {weaknesses.slice(0, 5).map((weakness, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <TrendingDown className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                    {swotAnalysis && (
                      <p className="text-xs text-muted-foreground mt-3">
                        Source: SWOT Analysis v{swotAnalysis.version} ({swotAnalysis.status})
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <TrendingDown className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No weaknesses identified yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Run a SWOT analysis or enhance the profile to discover weaknesses.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Business Info */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Industries</p>
                    <p className="font-medium">{competitor.industries?.map(i => INDUSTRY_LABELS[i] || i).join(', ') || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Founded</p>
                    <p className="font-medium">{competitor.foundedYear || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Revenue</p>
                    <p className="font-medium">
                      {competitor.estimatedRevenue
                        ? `${competitor.revenueCurrency || '$'}${(competitor.estimatedRevenue / 1000000).toFixed(1)}M`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Company Size</p>
                    <p className="font-medium capitalize">{competitor.companySize || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {movesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity, index) => (
                    <div
                      key={activity.id}
                      className="flex gap-4 pb-4"
                      style={{ borderBottom: index < activities.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        {getActivityIcon(activity.activityType)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{activity.title}</h4>
                          <Badge variant="outline" className="capitalize text-xs">
                            {activity.activityType.replace('_', ' ')}
                          </Badge>
                          <Badge
                            className="text-xs"
                            style={{
                              backgroundColor: activity.impact === 'high' ? '#f4433620' : activity.impact === 'medium' ? '#ff980020' : '#4caf5020',
                              color: activity.impact === 'high' ? '#f44336' : activity.impact === 'medium' ? '#ff9800' : '#4caf50',
                            }}
                          >
                            {activity.impact} impact
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{new Date(activity.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          <DataSourceBadge source={activity.source} showLabel={false} />
                        </div>
                      </div>
                    </div>
                  ))}

                  {activities.length === 0 && (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground mb-1">No activities recorded yet</p>
                      <p className="text-sm text-muted-foreground">
                        Competitive moves will appear here when tracked.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="mt-6">
          <DigitalProfilesSection
            competitorId={competitor.id}
            competitorName={competitor.name}
            competitorWebsite={competitor.website}
          />
        </TabsContent>

        <TabsContent value="social" className="mt-6">
          {competitor && (
            <SocialIntelligenceSection
              competitorId={competitor.id}
              competitorName={competitor.name}
            />
          )}
        </TabsContent>

        <TabsContent value="news" className="mt-6">
          <CompetitorNewsTab
            competitorId={competitor.id}
            competitorName={competitor.name}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {competitor && (
        <EditCompetitorDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          competitor={competitor}
          onSubmit={async (id: string, updates: Partial<CompetitorFormInput>) => {
            await competitorService.updateCompetitor(id, updates);
            await refresh();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Competitor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{competitor?.name}</strong>? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await competitorService.deleteCompetitor(competitor!.id);
                  navigate('/market-intel/competitors');
                } catch (err) {
                  console.error('Delete error:', err);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompetitorDetailPage;
