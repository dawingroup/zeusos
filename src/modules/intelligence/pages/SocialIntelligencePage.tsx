// ============================================================================
// SOCIAL INTELLIGENCE PAGE
// ZeusOS v2.0 - Market Intelligence Module
// Cross-competitor social media dashboard
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Loader2,
  Sparkles,
  Users,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Facebook,
  Music2,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  ArrowRight,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';

import { socialIntelligenceService } from '../services/socialIntelligenceService';
import { useCompetitors } from '../hooks/useCompetitors';
import {
  SocialMetrics,
  SocialPost,
  SocialPlatform,
  SOCIAL_PLATFORM_COLORS,
  STRATEGY_COLORS,
} from '../types/socialIntelligence.types';
import { MODULE_COLOR } from '../constants';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(timestamp: unknown): string {
  if (!timestamp) return '';
  const date = typeof (timestamp as { toDate?: () => Date }).toDate === 'function'
    ? (timestamp as { toDate: () => Date }).toDate()
    : new Date(timestamp as string);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PlatformIcon: React.FC<{ platform: SocialPlatform; className?: string }> = ({ platform, className = 'h-4 w-4' }) => {
  const icons: Record<string, React.ReactNode> = {
    instagram: <Instagram className={className} />,
    twitter: <Twitter className={className} />,
    tiktok: <Music2 className={className} />,
    facebook: <Facebook className={className} />,
    linkedin: <Linkedin className={className} />,
    youtube: <Youtube className={className} />,
  };
  return <>{icons[platform] || null}</>;
};

// --------------------------------------------------------------------------
// Main Page
// --------------------------------------------------------------------------

const SocialIntelligencePage: React.FC = () => {
  const navigate = useNavigate();
  const { competitors, loading: competitorsLoading } = useCompetitors({});
  const [allMetrics, setAllMetrics] = useState<SocialMetrics[]>([]);
  const [topPosts, setTopPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      setLoading(true);
      const metrics = await socialIntelligenceService.getAllLatestMetrics();
      setAllMetrics(metrics);

      // Load top posts from first few competitors
      const posts: SocialPost[] = [];
      const competitorIds = [...new Set(metrics.map(m => m.competitorId))];
      for (const cid of competitorIds.slice(0, 10)) {
        const competitorPosts = await socialIntelligenceService.getPostsByCompetitor(cid, { limit: 5 });
        posts.push(...competitorPosts);
      }
      // Sort by engagement (likes + comments + shares)
      posts.sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares));
      setTopPosts(posts.slice(0, 20));
    } catch (err) {
      console.error('Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load social data');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setError(null);
    try {
      await socialIntelligenceService.triggerSync();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Group metrics by competitor
  const competitorMetricsMap = new Map<string, SocialMetrics[]>();
  const filteredMetrics = platformFilter === 'all'
    ? allMetrics
    : allMetrics.filter(m => m.platform === platformFilter);

  filteredMetrics.forEach(m => {
    const list = competitorMetricsMap.get(m.competitorId) || [];
    list.push(m);
    competitorMetricsMap.set(m.competitorId, list);
  });

  // Build leaderboard
  const leaderboard = Array.from(competitorMetricsMap.entries())
    .map(([competitorId, metrics]) => {
      const competitor = competitors.find(c => c.id === competitorId);
      const totalFollowers = metrics.reduce((sum, m) => sum + (m.followers || 0), 0);
      const avgEngagement = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.engagementRate || 0), 0) / metrics.length
        : 0;
      const totalFollowersDelta = metrics.reduce((sum, m) => sum + (m.followersDelta || 0), 0);

      return {
        competitorId,
        competitorName: competitor?.name || competitorId,
        metrics,
        totalFollowers,
        avgEngagement,
        totalFollowersDelta,
        platforms: metrics.map(m => m.platform as SocialPlatform),
      };
    })
    .sort((a, b) => b.totalFollowers - a.totalFollowers);

  // Overall stats
  const totalFollowersAll = leaderboard.reduce((sum, c) => sum + c.totalFollowers, 0);
  const avgEngagementAll = leaderboard.length > 0
    ? leaderboard.reduce((sum, c) => sum + c.avgEngagement, 0) / leaderboard.length
    : 0;
  const platformCount = new Set(allMetrics.map(m => m.platform)).size;

  const filteredTopPosts = platformFilter === 'all'
    ? topPosts
    : topPosts.filter(p => p.platform === platformFilter);

  if (loading || competitorsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
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
          <h1 className="text-2xl font-semibold">Social Tracker</h1>
          <p className="text-muted-foreground">Cross-competitor social media intelligence</p>
        </div>
        <div className="flex gap-2">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="twitter">X (Twitter)</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleSyncAll}
            disabled={syncing}
            style={{ backgroundColor: MODULE_COLOR }}
          >
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {syncing ? 'Syncing...' : 'Sync All'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-[var(--rag-red)] bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-md p-3">{error}</div>
      )}

      {/* Overview Stats */}
      <KPIGrid cols={4}>
        <KPICard
          label="Tracked Competitors"
          value={leaderboard.length}
          delta="with social profiles"
        />
        <KPICard
          label="Total Followers"
          value={formatNumber(totalFollowersAll)}
          delta="across all competitors"
        />
        <KPICard
          label="Avg Engagement"
          value={`${avgEngagementAll.toFixed(2)}%`}
          delta="industry average"
        />
        <KPICard
          label="Platforms Tracked"
          value={platformCount}
          delta={`${allMetrics.length} total profiles`}
        />
      </KPIGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitor Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Follower Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No social data yet. Add social profiles to competitors and sync.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.competitorId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/market-intel/competitors/${entry.competitorId}`)}
                  >
                    <span className="text-lg font-bold text-muted-foreground w-6 text-right">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{entry.competitorName}</span>
                        <div className="flex gap-0.5">
                          {entry.platforms.map(p => (
                            <span key={p} style={{ color: SOCIAL_PLATFORM_COLORS[p] }}>
                              <PlatformIcon platform={p} className="h-3 w-3" />
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatNumber(entry.totalFollowers)} followers</span>
                        <span>{entry.avgEngagement.toFixed(1)}% eng.</span>
                        {entry.totalFollowersDelta !== 0 && (
                          <span className={entry.totalFollowersDelta > 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}>
                            {entry.totalFollowersDelta > 0 ? '+' : ''}{formatNumber(entry.totalFollowersDelta)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performing Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Posts by Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTopPosts.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No posts captured yet. Sync social profiles to fetch posts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTopPosts.slice(0, 8).map(post => {
                  const competitor = competitors.find(c => c.id === post.competitorId);
                  const platformColor = SOCIAL_PLATFORM_COLORS[post.platform] || '#6B7280';

                  return (
                    <div key={post.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <Badge
                        className="shrink-0 gap-1"
                        style={{ backgroundColor: `${platformColor}20`, color: platformColor }}
                      >
                        <PlatformIcon platform={post.platform} className="h-3 w-3" />
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium">{competitor?.name || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(post.publishedAt)}</span>
                          {post.aiAnalysis?.strategy && (
                            <Badge
                              className="text-[10px] h-4"
                              style={{
                                backgroundColor: `${STRATEGY_COLORS[post.aiAnalysis.strategy] || '#6B7280'}20`,
                                color: STRATEGY_COLORS[post.aiAnalysis.strategy] || '#6B7280',
                              }}
                            >
                              {post.aiAnalysis.strategy}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs line-clamp-2 text-muted-foreground">{post.contentText}</p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {post.likes > 0 && (
                            <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{formatNumber(post.likes)}</span>
                          )}
                          {post.comments > 0 && (
                            <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{formatNumber(post.comments)}</span>
                          )}
                          {post.shares > 0 && (
                            <span className="flex items-center gap-0.5"><Share2 className="h-3 w-3" />{formatNumber(post.shares)}</span>
                          )}
                          {post.views > 0 && (
                            <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{formatNumber(post.views)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SocialIntelligencePage;
