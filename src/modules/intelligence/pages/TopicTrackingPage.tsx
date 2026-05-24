// ============================================================================
// TOPIC TRACKING PAGE
// ZeusOS v2.0 - Market Intelligence Module
// Track discussions on topics at global and local levels
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Radio,
  Globe,
  MapPin,
  Map,
  Bell,
  BellOff,
  Pause,
  Play,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Loader2,
  MessageSquare,
  Bookmark,
  Flag,
  RefreshCw,
  Hash,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import { Skeleton } from '@/core/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';

import { useAuth } from '@/shared/hooks/useAuth';
import { topicTrackingService } from '../services/topicTrackingService';
import {
  TrackedTopic,
  TrackedTopicFormInput,
  TopicMention,
  TOPIC_CATEGORIES,
  TOPIC_SCOPE_LABELS,
  TopicScope,
} from '../types/topicTracking.types';
import { MODULE_COLOR } from '../constants';

const TopicTrackingPage: React.FC = () => {
  const { user } = useAuth();
  const [topics, setTopics] = useState<TrackedTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TrackedTopic | null>(null);
  const [mentions, setMentions] = useState<TopicMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch topics
  const fetchTopics = useCallback(async () => {
    try {
      setLoading(true);
      const results = await topicTrackingService.getTopics();
      setTopics(results);
    } catch (err) {
      console.error('Error fetching topics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // Load mentions for selected topic
  const loadMentions = useCallback(async (topicId: string) => {
    try {
      setLoadingMentions(true);
      const results = await topicTrackingService.getMentions(topicId);
      setMentions(results);
    } catch (err) {
      console.error('Error loading mentions:', err);
    } finally {
      setLoadingMentions(false);
    }
  }, []);

  const handleSelectTopic = (topic: TrackedTopic) => {
    setSelectedTopic(topic);
    loadMentions(topic.id);
  };

  const handleScan = async (topicId: string) => {
    setScanning(true);
    try {
      await topicTrackingService.triggerScan(topicId);
      await loadMentions(topicId);
      await fetchTopics();
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleToggleStatus = async (topic: TrackedTopic) => {
    const newStatus = topic.status === 'active' ? 'paused' : 'active';
    await topicTrackingService.updateTopicStatus(topic.id, newStatus);
    await fetchTopics();
  };

  const handleToggleAlerts = async (topic: TrackedTopic) => {
    await topicTrackingService.toggleAlerts(topic.id);
    await fetchTopics();
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Delete this tracked topic and all its mentions?')) return;
    await topicTrackingService.deleteTopic(topicId);
    if (selectedTopic?.id === topicId) {
      setSelectedTopic(null);
      setMentions([]);
    }
    await fetchTopics();
  };

  const handleToggleMentionBookmark = async (mentionId: string) => {
    const mention = mentions.find(m => m.id === mentionId);
    if (!mention) return;
    await topicTrackingService.updateMention(mentionId, { isBookmarked: !mention.isBookmarked });
    setMentions(prev => prev.map(m => m.id === mentionId ? { ...m, isBookmarked: !m.isBookmarked } : m));
  };

  const handleToggleMentionFlag = async (mentionId: string) => {
    const mention = mentions.find(m => m.id === mentionId);
    if (!mention) return;
    await topicTrackingService.updateMention(mentionId, { isFlagged: !mention.isFlagged });
    setMentions(prev => prev.map(m => m.id === mentionId ? { ...m, isFlagged: !m.isFlagged } : m));
  };

  const filteredTopics = topics.filter(t =>
    !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getScopeIcon = (scope: TopicScope) => {
    switch (scope) {
      case 'global': return <Globe className="h-4 w-4" />;
      case 'local': return <MapPin className="h-4 w-4" />;
      case 'regional': return <Map className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'rising': return <TrendingUp className="h-4 w-4 text-[var(--rag-green)]" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-[var(--rag-red)]" />;
      default: return <Minus className="h-4 w-4 text-[var(--fg-tertiary)]" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '#10B981';
      case 'negative': return '#EF4444';
      case 'mixed': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Topic Tracking</h1>
          <p className="text-muted-foreground">Monitor discussions and trends at global and local levels</p>
        </div>
        <Button style={{ backgroundColor: MODULE_COLOR }} onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Track New Topic
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search topics or keywords..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topics List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Tracked Topics ({filteredTopics.length})
          </h3>

          {filteredTopics.length === 0 && (
            <Card className="p-8 text-center">
              <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-3">No topics being tracked yet</p>
              <Button variant="outline" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Topic
              </Button>
            </Card>
          )}

          {filteredTopics.map(topic => (
            <Card
              key={topic.id}
              className={`cursor-pointer hover:shadow-md transition-all ${
                selectedTopic?.id === topic.id ? 'ring-2' : ''
              }`}
              style={{
                borderColor: selectedTopic?.id === topic.id ? MODULE_COLOR : undefined,
              }}
              onClick={() => handleSelectTopic(topic)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getScopeIcon(topic.scope)}
                    <h4 className="font-medium text-sm">{topic.name}</h4>
                  </div>
                  {getTrendIcon(topic.trendDirection)}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {topic.keywords.slice(0, 3).map((kw, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      <Hash className="h-3 w-3 mr-0.5" />
                      {kw}
                    </Badge>
                  ))}
                  {topic.keywords.length > 3 && (
                    <Badge variant="outline" className="text-xs">+{topic.keywords.length - 3}</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex gap-3">
                    <span>{topic.totalMentions} mentions</span>
                    <span
                      className="font-medium"
                      style={{ color: getSentimentColor(topic.overallSentiment) }}
                    >
                      {topic.overallSentiment}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{
                      color: topic.status === 'active' ? '#10B981' : '#F59E0B',
                      borderColor: topic.status === 'active' ? '#10B981' : '#F59E0B',
                    }}
                  >
                    {topic.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Topic Detail & Mentions */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedTopic ? (
            <Card className="p-12 text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Topic</h3>
              <p className="text-muted-foreground">
                Click on a tracked topic to view discussions and mentions
              </p>
            </Card>
          ) : (
            <>
              {/* Topic Header */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getScopeIcon(selectedTopic.scope)}
                        <h2 className="text-xl font-semibold">{selectedTopic.name}</h2>
                        <Badge variant="outline">
                          {TOPIC_SCOPE_LABELS[selectedTopic.scope]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedTopic.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedTopic.keywords.map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            <Hash className="h-3 w-3 mr-0.5" />{kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleScan(selectedTopic.id)}
                        disabled={scanning}
                      >
                        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="ml-1">Scan Now</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleAlerts(selectedTopic)}
                      >
                        {selectedTopic.isAlertEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(selectedTopic)}
                      >
                        {selectedTopic.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[var(--rag-red)]"
                        onClick={() => handleDeleteTopic(selectedTopic.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Mentions</p>
                      <p className="text-lg font-bold">{selectedTopic.totalMentions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last 7 Days</p>
                      <p className="text-lg font-bold">{selectedTopic.mentionsLast7d}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sentiment</p>
                      <p
                        className="text-lg font-bold capitalize"
                        style={{ color: getSentimentColor(selectedTopic.overallSentiment) }}
                      >
                        {selectedTopic.overallSentiment}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Trend</p>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(selectedTopic.trendDirection)}
                        <span className="text-lg font-bold capitalize">{selectedTopic.trendDirection}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mentions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Mentions</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingMentions ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : mentions.length === 0 ? (
                    <div className="text-center py-8">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-3">No mentions found yet</p>
                      <Button
                        variant="outline"
                        onClick={() => handleScan(selectedTopic.id)}
                        disabled={scanning}
                      >
                        {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Run First Scan
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mentions.map(mention => (
                        <div
                          key={mention.id}
                          className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {mention.sourceType}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{mention.sourceName}</span>
                                <Badge
                                  className="text-xs"
                                  style={{
                                    backgroundColor: `${getSentimentColor(mention.sentiment)}20`,
                                    color: getSentimentColor(mention.sentiment),
                                  }}
                                >
                                  {mention.sentiment}
                                </Badge>
                              </div>
                              <a
                                href={mention.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-sm hover:underline line-clamp-1"
                                style={{ color: MODULE_COLOR }}
                              >
                                {mention.title}
                              </a>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {mention.snippet}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {mention.matchedKeywords.map((kw, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleToggleMentionBookmark(mention.id)}
                              >
                                <Bookmark
                                  className={`h-3.5 w-3.5 ${mention.isBookmarked ? 'fill-current text-[var(--rag-amber)]' : ''}`}
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleToggleMentionFlag(mention.id)}
                              >
                                <Flag
                                  className={`h-3.5 w-3.5 ${mention.isFlagged ? 'fill-current text-[var(--rag-red)]' : ''}`}
                                />
                              </Button>
                              <a href={mention.sourceUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Add Topic Dialog */}
      <AddTopicDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={async (input) => {
          await topicTrackingService.createTopic(input, user?.uid || 'unknown');
          await fetchTopics();
        }}
      />
    </div>
  );
};

// ============================================================================
// ADD TOPIC DIALOG
// ============================================================================

interface AddTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: TrackedTopicFormInput) => Promise<void>;
}

const AddTopicDialog: React.FC<AddTopicDialogProps> = ({ open, onOpenChange, onSubmit }) => {
  const [form, setForm] = useState<TrackedTopicFormInput>({
    name: '',
    description: '',
    keywords: [],
    excludeKeywords: [],
    scope: 'global',
    regions: [],
    languages: ['en'],
    category: 'industry',
    scanFrequency: 'daily',
    isAlertEnabled: true,
    alertThreshold: 'any',
    relatedCompetitorIds: [],
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addKeyword = () => {
    if (keywordInput.trim() && !form.keywords.includes(keywordInput.trim())) {
      setForm(prev => ({ ...prev, keywords: [...prev.keywords, keywordInput.trim()] }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    setForm(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }));
  };

  const addExclude = () => {
    if (excludeInput.trim() && !form.excludeKeywords.includes(excludeInput.trim())) {
      setForm(prev => ({ ...prev, excludeKeywords: [...prev.excludeKeywords, excludeInput.trim()] }));
      setExcludeInput('');
    }
  };

  const removeExclude = (kw: string) => {
    setForm(prev => ({ ...prev, excludeKeywords: prev.excludeKeywords.filter(k => k !== kw) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError('Topic name is required'); return; }
    if (form.keywords.length === 0) { setError('Add at least one keyword'); return; }

    setSaving(true);
    try {
      await onSubmit(form);
      setForm({
        name: '', description: '', keywords: [], excludeKeywords: [],
        scope: 'global', regions: [], languages: ['en'], category: 'industry',
        scanFrequency: 'daily', isAlertEnabled: true, alertThreshold: 'any',
        relatedCompetitorIds: [],
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create topic');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Track New Topic</DialogTitle>
          <DialogDescription>
            Define keywords and scope to monitor discussions across the web
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-[var(--rag-red)] bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-md p-3">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="topic-name">Topic Name *</Label>
            <Input
              id="topic-name"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Mobile Money Regulation"
            />
          </div>

          <div>
            <Label htmlFor="topic-desc">Description</Label>
            <Textarea
              id="topic-desc"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What are you tracking and why..."
              rows={2}
            />
          </div>

          <div>
            <Label>Keywords *</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                placeholder="Add keyword..."
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addKeyword}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.keywords.map(kw => (
                <Badge key={kw} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeKeyword(kw)}>
                  <Hash className="h-3 w-3" />{kw} <span className="text-muted-foreground">&times;</span>
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Exclude Keywords</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={excludeInput}
                onChange={e => setExcludeInput(e.target.value)}
                placeholder="Exclude keyword..."
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExclude(); } }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addExclude}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.excludeKeywords.map(kw => (
                <Badge key={kw} variant="destructive" className="gap-1 cursor-pointer text-xs" onClick={() => removeExclude(kw)}>
                  -{kw} <span>&times;</span>
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Scope</Label>
              <Select
                value={form.scope}
                onValueChange={v => setForm(prev => ({ ...prev, scope: v as TopicScope }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TOPIC_SCOPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={v => setForm(prev => ({ ...prev, category: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOPIC_CATEGORIES.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Scan Frequency</Label>
              <Select
                value={form.scanFrequency}
                onValueChange={v => setForm(prev => ({ ...prev, scanFrequency: v as 'hourly' | 'daily' | 'weekly' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Alert Threshold</Label>
              <Select
                value={form.alertThreshold}
                onValueChange={v => setForm(prev => ({ ...prev, alertThreshold: v as 'any' | 'high_volume' | 'sentiment_shift' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any New Mention</SelectItem>
                  <SelectItem value="high_volume">High Volume</SelectItem>
                  <SelectItem value="sentiment_shift">Sentiment Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ backgroundColor: MODULE_COLOR }}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saving ? 'Creating...' : 'Start Tracking'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TopicTrackingPage;
