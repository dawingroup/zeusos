// ============================================================================
// SOCIAL INTELLIGENCE SECTION
// ZeusOS v2.0 - Market Intelligence Module
// Competitor social media tracking: metrics cards, post feed, AI analysis
// ============================================================================

import React, { useState } from 'react';
import {
  RefreshCw,
  Loader2,
  Sparkles,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  BarChart3,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Facebook,
  Music2,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { KPICard } from '@/shared/components/data-display';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';

import { useSocialIntelligence } from '../../hooks/useSocialIntelligence';
import {
  SocialPost,
  SocialMetrics,
  SocialPlatform,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_COLORS,
  STRATEGY_COLORS,
  TONE_COLORS,
} from '../../types/socialIntelligence.types';
import { MODULE_COLOR } from '../../constants';

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------

interface SocialIntelligenceSectionProps {
  competitorId: string;
  competitorName: string;
}

// --------------------------------------------------------------------------
// Platform Icon Component
// --------------------------------------------------------------------------

const PlatformIcon: React.FC<{ platform: SocialPlatform; className?: string }> = ({ platform, className = 'h-4 w-4' }) => {
  const icons: Record<SocialPlatform, React.ReactNode> = {
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
// Helpers
// --------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(timestamp: unknown): string {
  if (!timestamp) return '';
  // Handle Firestore Timestamp
  const date = typeof (timestamp as { toDate?: () => Date }).toDate === 'function'
    ? (timestamp as { toDate: () => Date }).toDate()
    : new Date(timestamp as string);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --------------------------------------------------------------------------
// Metrics Summary Cards
// --------------------------------------------------------------------------

const MetricsCards: React.FC<{ metrics: SocialMetrics[] }> = ({ metrics }) => {
  if (metrics.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No social metrics yet. Sync social profiles to start tracking.
      </div>
    );
  }

  const totalFollowers = metrics.reduce((sum, m) => sum + (m.followers || 0), 0);
  const avgEngagement = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + (m.engagementRate || 0), 0) / metrics.length
    : 0;
  const totalFollowersDelta = metrics.reduce((sum, m) => sum + (m.followersDelta || 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Followers */}
      <KPICard
        label="Total Followers"
        value={formatNumber(totalFollowers)}
        delta={
          totalFollowersDelta !== 0
            ? `${totalFollowersDelta > 0 ? '+' : ''}${formatNumber(totalFollowersDelta)}`
            : undefined
        }
        trend={totalFollowersDelta !== 0 ? (totalFollowersDelta > 0 ? 'up' : 'down') : undefined}
      />

      {/* Avg Engagement */}
      <KPICard
        label="Avg Engagement"
        value={`${avgEngagement.toFixed(2)}%`}
        delta={`Across ${metrics.length} platform${metrics.length !== 1 ? 's' : ''}`}
      />

      {/* Platform Breakdown */}
      {metrics.slice(0, 2).map(m => (
        <Card key={m.platform}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">
                {SOCIAL_PLATFORM_LABELS[m.platform] || m.platform}
              </span>
              <PlatformIcon platform={m.platform} className="h-4 w-4" />
            </div>
            <div className="text-2xl font-bold">{formatNumber(m.followers)}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>{formatNumber(m.totalPosts)} posts</span>
              {m.engagementRate > 0 && (
                <span className="text-green-600">{m.engagementRate.toFixed(1)}% eng.</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// --------------------------------------------------------------------------
// Post Card
// --------------------------------------------------------------------------

const PostCard: React.FC<{
  post: SocialPost;
  selected: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpand: () => void;
}> = ({ post, selected, onToggle, expanded, onExpand }) => {
  const platformColor = SOCIAL_PLATFORM_COLORS[post.platform] || '#6B7280';
  const ai = post.aiAnalysis;

  return (
    <Card className={`transition-all ${selected ? 'ring-2' : ''}`}
      style={selected ? { borderColor: MODULE_COLOR } : {}}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Select checkbox */}
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="mt-1 h-4 w-4 rounded cursor-pointer"
            style={{ accentColor: MODULE_COLOR }}
          />

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge
                className="text-xs gap-1"
                style={{ backgroundColor: `${platformColor}20`, color: platformColor }}
              >
                <PlatformIcon platform={post.platform} className="h-3 w-3" />
                {SOCIAL_PLATFORM_LABELS[post.platform]}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatDate(post.publishedAt)}</span>

              {ai && (
                <>
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: `${STRATEGY_COLORS[ai.strategy] || '#6B7280'}20`,
                      color: STRATEGY_COLORS[ai.strategy] || '#6B7280',
                    }}
                  >
                    {ai.strategy}
                  </Badge>
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: `${TONE_COLORS[ai.tone] || '#6B7280'}20`,
                      color: TONE_COLORS[ai.tone] || '#6B7280',
                    }}
                  >
                    {ai.tone}
                  </Badge>
                </>
              )}
            </div>

            {/* Content */}
            <p className={`text-sm ${expanded ? '' : 'line-clamp-3'}`}>
              {post.contentText || '(No text content)'}
            </p>

            {/* Metrics Row */}
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              {post.likes > 0 && (
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" /> {formatNumber(post.likes)}
                </span>
              )}
              {post.comments > 0 && (
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" /> {formatNumber(post.comments)}
                </span>
              )}
              {post.shares > 0 && (
                <span className="flex items-center gap-1">
                  <Share2 className="h-3 w-3" /> {formatNumber(post.shares)}
                </span>
              )}
              {post.views > 0 && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {formatNumber(post.views)}
                </span>
              )}
            </div>

            {/* Expanded: AI Analysis Details */}
            {expanded && ai && (
              <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                {ai.summary && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI Summary</span>
                    <p className="mt-0.5">{ai.summary}</p>
                  </div>
                )}
                {ai.targetAudience && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Target Audience</span>
                    <p className="mt-0.5">{ai.targetAudience}</p>
                  </div>
                )}
                {ai.strategicPillars && ai.strategicPillars.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strategic Pillars</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {ai.strategicPillars.map(p => (
                        <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {ai.sentiment != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sentiment</span>
                    <div className="flex items-center gap-1">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.abs(ai.sentiment) * 60 + 20}px`,
                          backgroundColor: ai.sentiment > 0.3 ? '#22C55E' : ai.sentiment < -0.3 ? '#EF4444' : '#F59E0B',
                        }}
                      />
                      <span className="text-xs">{ai.sentiment.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hashtags */}
            {post.hashtags.length > 0 && expanded && (
              <div className="flex flex-wrap gap-1 mt-2">
                {post.hashtags.slice(0, 8).map(h => (
                  <span key={h} className="text-xs text-blue-600">{h}</span>
                ))}
                {post.hashtags.length > 8 && (
                  <span className="text-xs text-muted-foreground">+{post.hashtags.length - 8}</span>
                )}
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={onExpand}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// --------------------------------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------------------------------

export const SocialIntelligenceSection: React.FC<SocialIntelligenceSectionProps> = ({
  competitorId,
  competitorName,
}) => {
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const {
    posts,
    metrics,
    loading,
    error,
    syncing,
    analyzing,
    triggerSync,
    analyzeStrategy,
  } = useSocialIntelligence({
    competitorId,
    platform: platformFilter !== 'all' ? platformFilter as SocialPlatform : undefined,
  });

  const togglePost = (id: string) => {
    setSelectedPosts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map(p => p.id)));
    }
  };

  const handleAnalyze = async () => {
    const ids = Array.from(selectedPosts);
    if (ids.length === 0) return;
    const result = await analyzeStrategy(ids, competitorName);
    if (result) {
      setAnalysisResult(result.competitorInsight);
      setSelectedPosts(new Set());
    }
  };

  const handleSync = async () => {
    await triggerSync(competitorId);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Social Intelligence</h3>
          <p className="text-sm text-muted-foreground">Track social media activity and AI-analyze competitor strategy</p>
        </div>
        <div className="flex gap-2">
          {selectedPosts.size > 0 && (
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              size="sm"
              style={{ backgroundColor: MODULE_COLOR }}
            >
              {analyzing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Analyze {selectedPosts.size} Post{selectedPosts.size !== 1 ? 's' : ''}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            style={{ color: MODULE_COLOR, borderColor: MODULE_COLOR }}
          >
            {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      {/* AI Insight Banner */}
      {analysisResult && (
        <Card className="border-l-4" style={{ borderLeftColor: MODULE_COLOR }}>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Zap className="h-5 w-5 shrink-0 mt-0.5" style={{ color: MODULE_COLOR }} />
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MODULE_COLOR }}>AI Competitor Insight</span>
                <p className="text-sm mt-1">{analysisResult}</p>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto shrink-0" onClick={() => setAnalysisResult(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards */}
      <MetricsCards metrics={metrics} />

      {/* Posts Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Posts</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
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

              {posts.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={selectAll}>
                  {selectedPosts.size === posts.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {posts.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h4 className="font-medium mb-1">No social posts yet</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Add social media profiles in the Digital Profiles tab, then sync to start tracking posts.
              </p>
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={syncing}
                style={{ color: MODULE_COLOR, borderColor: MODULE_COLOR }}
              >
                {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Sync Social Profiles
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-2 pr-2">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    selected={selectedPosts.has(post.id)}
                    onToggle={() => togglePost(post.id)}
                    expanded={expandedPosts.has(post.id)}
                    onExpand={() => toggleExpand(post.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
