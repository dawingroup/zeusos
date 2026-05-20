// ============================================================================
// NEWS FEED PAGE
// DawinOS v2.0 - Market Intelligence Module
// News aggregation with sentiment analysis
// ============================================================================

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  Bookmark,
  BookMarked,
  ExternalLink,
  Share2,
  LayoutGrid,
  List,
  TrendingUp,
  Building2,
  ThumbsUp,
  ThumbsDown,
  Meh,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { useNewsFeed } from '../hooks/useNewsFeed';
import { DataSourceBadge } from '../components/shared/DataSourceBadge';
import { MODULE_COLOR, SENTIMENT_LEVELS, NEWS_CATEGORIES } from '../constants';
import { NewsArticle } from '../types';

const NewsFeedPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const competitorIdFromUrl = searchParams.get('competitor');

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const {
    articles,
    summary,
    loading,
    scanning,
    hasMore,
    loadMore,
    scan,
    markAsRead,
    bookmarkArticle,
  } = useNewsFeed({
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    sentiment: sentimentFilter !== 'all' ? sentimentFilter : undefined,
    competitorId: competitorIdFromUrl || undefined,
  });

  // Filter by search query
  const filteredArticles = articles.filter(article =>
    !searchQuery ||
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'very_positive':
      case 'positive':
        return <ThumbsUp className="h-4 w-4 text-green-500" />;
      case 'very_negative':
      case 'negative':
        return <ThumbsDown className="h-4 w-4 text-red-500" />;
      default:
        return <Meh className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleArticleClick = async (article: NewsArticle) => {
    if (!article.isRead) {
      await markAsRead(article.id);
    }
    window.open(article.sourceUrl, '_blank');
  };

  if (loading && articles.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">News Feed</h1>
          <p className="text-muted-foreground">Market news and competitor mentions</p>
        </div>
        <Button
          variant="outline"
          onClick={() => scan()}
          disabled={scanning || loading}
          style={{ borderColor: MODULE_COLOR, color: MODULE_COLOR }}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan News'}
        </Button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <KPIGrid cols={4}>
          <KPICard label="Total Articles" value={summary.totalArticles} />
          <KPICard
            label="Positive Sentiment"
            value={`${summary.totalArticles > 0
              ? Math.round(((summary.bySentiment.positive || 0) + (summary.bySentiment.very_positive || 0)) / summary.totalArticles * 100)
              : 0}%`}
            trend="up"
          />
          <KPICard
            label="Top Topic"
            value={summary.topTopics[0]?.topic || 'N/A'}
            delta={`${summary.topTopics[0]?.count || 0} mentions`}
          />
          <KPICard
            label="Competitor Mentions"
            value={summary.competitorMentions.reduce((acc, m) => acc + m.count, 0)}
          />
        </KPIGrid>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {NEWS_CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiment</SelectItem>
                {SENTIMENT_LEVELS.map(level => (
                  <SelectItem key={level.id} value={level.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: level.color }} />
                      {level.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                className="rounded-r-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="rounded-l-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trending Topics */}
      {summary && summary.topTopics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Trending:</span>
          {summary.topTopics.slice(0, 8).map((topic) => (
            <Badge
              key={topic.topic}
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              onClick={() => setSearchQuery(topic.topic)}
            >
              {topic.topic}
            </Badge>
          ))}
        </div>
      )}

      {/* Articles */}
      <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {filteredArticles.map((article) => {
          const sentimentConfig = SENTIMENT_LEVELS.find(s => s.id === article.sentiment);
          const categoryConfig = NEWS_CATEGORIES.find(c => c.id === article.category);

          return (
            <Card
              key={article.id}
              className={`overflow-hidden transition-all hover:shadow-lg ${article.isRead ? 'opacity-80' : ''}`}
              style={{ borderLeft: `4px solid ${sentimentConfig?.color || '#9e9e9e'}` }}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {article.imageUrl && viewMode === 'list' && (
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-32 h-24 object-cover rounded shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-2">
                      <h3
                        className={`flex-1 cursor-pointer hover:underline ${article.isRead ? 'font-normal' : 'font-semibold'}`}
                        style={{ color: article.isRead ? 'inherit' : MODULE_COLOR }}
                        onClick={() => handleArticleClick(article)}
                      >
                        {article.title}
                      </h3>
                      {getSentimentIcon(article.sentiment)}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {article.summary}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <DataSourceBadge source={article.sourceType} showLabel={false} />
                      <Badge variant="outline" className="text-xs">
                        {categoryConfig?.label || article.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(article.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {article.relevanceScore && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs">
                                {Math.round(article.relevanceScore)}% relevant
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Relevance Score</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    {article.tags && article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {article.tags.slice(0, 4).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs cursor-pointer"
                            onClick={() => setSearchQuery(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {article.tags.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{article.tags.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    {article.mentionedCompetitors && article.mentionedCompetitors.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>Mentions: {article.mentionedCompetitors.length} competitor(s)</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => bookmarkArticle(article.id, !article.isBookmarked)}
                          >
                            {article.isBookmarked ? (
                              <BookMarked className="h-4 w-4" style={{ color: MODULE_COLOR }} />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{article.isBookmarked ? 'Remove bookmark' : 'Bookmark'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button variant="ghost" size="icon" onClick={() => handleArticleClick(article)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>

                    <Button variant="ghost" size="icon">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {!loading && filteredArticles.length === 0 && (
        <Card className="p-12 text-center">
          <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Articles Found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </Card>
      )}

      {/* Load More */}
      {hasMore && !loading && filteredArticles.length > 0 && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={loadMore}
            style={{ borderColor: MODULE_COLOR, color: MODULE_COLOR }}
          >
            Load More Articles
          </Button>
        </div>
      )}
    </div>
  );
};

export default NewsFeedPage;
