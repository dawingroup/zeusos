/**
 * MarketingAgentPage
 * AI-powered marketing assistant with chat, content generation, and key dates
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Bot,
  Send,
  Calendar,
  Sparkles,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  RefreshCw,
  Target,
  Clock,
  Tag,
  Globe,
  MessageSquare,
  Settings2,
  X,
  Megaphone,
  ArrowRight,
  CalendarDays,
  Users,
  Lightbulb,
  Hash,
  ChevronRight,
  Upload,
  FileText,
  Brain,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Shield,
  Search,
  ArrowLeft,
  Zap,
  Eye,
  Save,
  ClipboardList,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMarketingAgent } from '../hooks';
import CaseStudyDrafterPanel from '../components/case-studies/CaseStudyDrafterPanel';
import type { StrategyAnalysisResult, StrategyResearchResult } from '../services/marketingAgentService';
import type {
  AgentMessage,
  ContentGenerationRequest,
  ContentTone,
  GeneratedContent,
  MarketingKeyDate,
  MarketingDateCategory,
  CampaignProposal,
} from '../types';
import type { MarketingTask, MarketingTaskStatus } from '../types/marketing-task.types';
import { TASK_PRIORITY_CONFIG, TASK_TYPE_CONFIG } from '../types/marketing-task.types';
import type { AISuggestedTask } from '../services/marketingAgentService';
import { CONTENT_TONES } from '../types/marketing-agent.types';
import type { SocialPlatform } from '../types/campaign.types';
import { SOCIAL_PLATFORMS } from '../constants';

// ============================================
// Simple Markdown Renderer
// ============================================

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) elements.push(<br key={`br-${lineIndex}`} />);

    // Process inline formatting
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let partKey = 0;

    while (remaining.length > 0) {
      // Bold: **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={`${lineIndex}-${partKey++}`}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={`${lineIndex}-${partKey++}`} className="font-semibold">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // List item: - text
      if (remaining.match(/^- /)) {
        parts.push(<span key={`${lineIndex}-${partKey++}`} className="ml-2">{'• '}{remaining.slice(2)}</span>);
        remaining = '';
        continue;
      }

      // Numbered list: 1. text
      const numMatch = remaining.match(/^(\d+)\. /);
      if (numMatch) {
        parts.push(<span key={`${lineIndex}-${partKey++}`} className="ml-2">{remaining}</span>);
        remaining = '';
        continue;
      }

      // No match, output remaining
      parts.push(<span key={`${lineIndex}-${partKey++}`}>{remaining}</span>);
      remaining = '';
    }

    elements.push(...parts);
  });

  return elements;
}

// ============================================
// Chat Message Bubble
// ============================================

function ChatBubble({ message }: { message: AgentMessage }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-purple-100 text-purple-700'
      }`}>
        {isUser ? (
          <MessageSquare className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block text-left rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-gray-100 text-gray-900'
        }`}>
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div>{renderMarkdown(message.content)}</div>
          )}
        </div>

        {/* Actions */}
        {!isUser && (
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={handleCopy}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Copy"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </button>
            <span className="text-[10px] text-gray-400">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Content Generator Panel
// ============================================

function ContentGeneratorPanel({
  onGenerate,
  generating,
}: {
  onGenerate: (request: ContentGenerationRequest) => void;
  generating: boolean;
}) {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<ContentTone>('professional');
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(['instagram']);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);

  const togglePlatform = (p: SocialPlatform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleGenerate = () => {
    if (!topic.trim()) return;
    onGenerate({
      type: 'social_post',
      topic: topic.trim(),
      platforms,
      tone,
      length: 'medium',
      includeHashtags,
      includeCallToAction: includeCTA,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        Generate Content
      </h3>

      {/* Topic */}
      <div>
        <label className="text-xs font-medium text-gray-600">Topic / Theme</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. New Italian marble collection launch, home renovation tips..."
          rows={2}
          className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
        />
      </div>

      {/* Tone */}
      <div>
        <label className="text-xs font-medium text-gray-600">Tone</label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value as ContentTone)}
          className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
        >
          {Object.entries(CONTENT_TONES).map(([key, config]) => (
            <option key={key} value={key}>{config.label} — {config.description}</option>
          ))}
        </select>
      </div>

      {/* Platforms */}
      <div>
        <label className="text-xs font-medium text-gray-600">Platforms</label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {(Object.entries(SOCIAL_PLATFORMS) as [SocialPlatform, { label: string; color: string }][]).map(
            ([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => togglePlatform(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  platforms.includes(key)
                    ? 'text-white border-transparent'
                    : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                style={platforms.includes(key) ? { backgroundColor: color } : undefined}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeHashtags}
            onChange={(e) => setIncludeHashtags(e.target.checked)}
            className="rounded border-gray-300"
          />
          Include Hashtags
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeCTA}
            onChange={(e) => setIncludeCTA(e.target.checked)}
            className="rounded border-gray-300"
          />
          Call to Action
        </label>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generating || !topic.trim() || platforms.length === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm font-medium"
      >
        {generating ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Post
          </>
        )}
      </button>
    </div>
  );
}

// ============================================
// Generated Content Display
// ============================================

function GeneratedContentDisplay({
  content,
}: {
  content: GeneratedContent;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Generated Content</h3>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100"
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Main Content */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap">
          {content.headline && (
            <div className="font-semibold text-base mb-2">{content.headline}</div>
          )}
          {content.content}
        </div>

        {/* Hashtags */}
        {content.hashtags.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500">Hashtags:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {content.hashtags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Strategy Alignment */}
        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-green-600" />
            <span className="text-xs font-semibold text-green-800">Strategy Alignment</span>
            <span className="ml-auto text-sm font-bold text-green-700">{content.strategyAlignment.overall}%</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-green-600">Brand Voice</span>
              <div className="font-medium text-green-800">{content.strategyAlignment.brandVoice}%</div>
            </div>
            <div>
              <span className="text-green-600">Target Audience</span>
              <div className="font-medium text-green-800">{content.strategyAlignment.targetAudience}%</div>
            </div>
            <div>
              <span className="text-green-600">Business Goals</span>
              <div className="font-medium text-green-800">{content.strategyAlignment.businessGoals}%</div>
            </div>
          </div>
        </div>

        {/* Platform Variants */}
        {content.platformVariants.length > 1 && (
          <div>
            <span className="text-xs font-medium text-gray-500">Platform Variants:</span>
            <div className="mt-2 space-y-2">
              {content.platformVariants.map((v) => (
                <div key={v.platform} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold capitalize">{v.platform}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      v.withinLimit ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {v.characterCount} chars {v.withinLimit ? '✓' : '(over limit)'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{v.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Key Dates Panel
// ============================================

const CATEGORY_COLORS: Record<MarketingDateCategory, string> = {
  holiday: 'bg-red-100 text-red-700',
  industry_event: 'bg-blue-100 text-blue-700',
  seasonal: 'bg-green-100 text-green-700',
  company_milestone: 'bg-purple-100 text-purple-700',
  product_launch: 'bg-orange-100 text-orange-700',
  cultural: 'bg-pink-100 text-pink-700',
  sales_event: 'bg-yellow-100 text-yellow-800',
  custom: 'bg-gray-100 text-gray-700',
};

function KeyDatesPanel({
  dates,
  loading,
  onDiscover,
  onAcknowledge,
  onDelete,
}: {
  dates: MarketingKeyDate[];
  loading: boolean;
  onDiscover: () => void;
  onAcknowledge: (id: string) => void;
  onDelete: (id: string) => void;
}) {

  // Show upcoming dates sorted by date
  const upcomingDates = dates
    .filter((d) => d.date.toMillis() >= Date.now())
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());

  const pastDates = dates
    .filter((d) => d.date.toMillis() < Date.now())
    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
    .slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          Key Marketing Dates
        </h3>
        <button
          onClick={onDiscover}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Globe className="h-3 w-3" />
          )}
          Discover Dates
        </button>
      </div>

      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {dates.length === 0 && !loading ? (
          <div className="text-center py-8">
            <Calendar className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No key dates yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Discover Dates" to find marketing opportunities</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 text-gray-300 animate-spin" />
          </div>
        ) : (
          <>
            {upcomingDates.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Upcoming</p>
                {upcomingDates.map((date) => (
                  <KeyDateCard
                    key={date.id}
                    date={date}
                    onAcknowledge={onAcknowledge}
                    onDelete={onDelete}
                  />
                ))}
              </>
            )}
            {pastDates.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">Recent</p>
                {pastDates.map((date) => (
                  <KeyDateCard
                    key={date.id}
                    date={date}
                    onAcknowledge={onAcknowledge}
                    onDelete={onDelete}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KeyDateCard({
  date,
  onAcknowledge,
  onDelete,
}: {
  date: MarketingKeyDate;
  onAcknowledge: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dateObj = date.date.toDate();
  const daysUntil = Math.ceil((dateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isPast = daysUntil < 0;

  return (
    <div className={`border rounded-lg p-3 transition-colors ${
      date.acknowledged ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50/30'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{date.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[date.category]}`}>
              {date.category.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {dateObj.toLocaleDateString()}
            </span>
            {!isPast && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {daysUntil === 0 ? 'Today' : `${daysUntil}d away`}
              </span>
            )}
            {date.leadTimeDays > 0 && !isPast && (
              <span className="text-orange-600">
                Start prep in {Math.max(0, daysUntil - date.leadTimeDays)}d
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!date.acknowledged && (
            <button
              onClick={() => onAcknowledge(date.id)}
              className="p-1 text-blue-500 hover:bg-blue-100 rounded"
              title="Acknowledge"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:bg-gray-200 rounded"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-xs">
          <p className="text-gray-600">{date.description}</p>

          {date.suggestedActions.length > 0 && (
            <div>
              <span className="font-medium text-gray-700">Suggested Actions:</span>
              <ul className="mt-1 space-y-0.5">
                {date.suggestedActions.map((action, i) => (
                  <li key={i} className="text-gray-600 flex items-start gap-1">
                    <span className="text-gray-400 mt-0.5">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {date.suggestedContentThemes.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="h-3 w-3 text-gray-400" />
              {date.suggestedContentThemes.map((theme) => (
                <span key={theme} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                  {theme}
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => onDelete(date.id)}
              className="text-red-500 hover:text-red-700 text-[10px] flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Campaign Proposals Panel
// ============================================

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  social_media: 'Social Media',
  product_promotion: 'Product Promotion',
  hybrid: 'Hybrid',
};

function CampaignProposalsPanel({
  proposals,
  loading,
  onPropose,
  keyDatesCount,
  hasStrategy,
}: {
  proposals: CampaignProposal[];
  loading: boolean;
  onPropose: () => void;
  keyDatesCount: number;
  hasStrategy: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-orange-500" />
              AI Campaign Proposals
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Generate draft campaign ideas based on your strategy and upcoming key dates.
            </p>
          </div>
          <button
            onClick={onPropose}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Propose Campaigns
              </>
            )}
          </button>
        </div>

        {/* Context indicators */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            hasStrategy ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <Target className="h-3 w-3" />
            {hasStrategy ? 'Strategy set' : 'No strategy'}
          </span>
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            keyDatesCount > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <Calendar className="h-3 w-3" />
            {keyDatesCount} key date{keyDatesCount !== 1 ? 's' : ''}
          </span>
          {!hasStrategy && (
            <span className="text-xs text-gray-400">
              Set up your strategy for better proposals
            </span>
          )}
        </div>
      </div>

      {/* Proposals */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 text-orange-400 animate-spin mb-3" />
          <p className="text-sm text-gray-600">Analyzing strategy & key dates...</p>
          <p className="text-xs text-gray-400 mt-1">Generating campaign proposals with AI</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No campaign proposals yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Propose Campaigns" to get AI-generated campaign ideas
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => {
            const isExpanded = expandedId === proposal.id;
            return (
              <div
                key={proposal.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-sm"
              >
                {/* Proposal header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : proposal.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-gray-900">{proposal.name}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[proposal.priority]}`}>
                          {proposal.priority}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {CAMPAIGN_TYPE_LABELS[proposal.campaignType] || proposal.campaignType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{proposal.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {proposal.suggestedStartDate} → {proposal.suggestedEndDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {proposal.durationDays}d
                        </span>
                        {proposal.linkedKeyDateName && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Calendar className="h-3 w-3" />
                            {proposal.linkedKeyDateName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      {/* Strategy alignment */}
                      <div className="text-center">
                        <div className={`text-lg font-bold ${
                          proposal.strategyAlignmentScore >= 80 ? 'text-green-600' :
                          proposal.strategyAlignmentScore >= 60 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {proposal.strategyAlignmentScore}
                        </div>
                        <div className="text-[9px] text-gray-400 uppercase tracking-wide">Alignment</div>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/50">
                    {/* Objective & Audience */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                          <Target className="h-3 w-3" /> Objective
                        </div>
                        <p className="text-xs text-gray-600">{proposal.objective}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                          <Users className="h-3 w-3" /> Target Audience
                        </div>
                        <p className="text-xs text-gray-600">{proposal.targetAudience}</p>
                      </div>
                    </div>

                    {/* Channels */}
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1.5">Channels</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {proposal.channels.map((ch) => (
                          <span key={ch} className="px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 capitalize">
                            {ch}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Content Ideas */}
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                        <Lightbulb className="h-3 w-3" /> Content Ideas ({proposal.suggestedPosts} posts)
                      </div>
                      <ul className="space-y-1">
                        {proposal.contentIdeas.map((idea, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-gray-400 mt-0.5">•</span>
                            {idea}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Key Messages */}
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1.5">Key Messages</div>
                      <div className="space-y-1">
                        {proposal.keyMessages.map((msg, i) => (
                          <div key={i} className="text-xs text-gray-600 bg-white rounded px-2.5 py-1.5 border border-gray-100">
                            "{msg}"
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA & Hashtags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Call to Action</div>
                        <p className="text-xs text-gray-600 italic">"{proposal.callToAction}"</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1">
                          <Hash className="h-3 w-3" /> Hashtags
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {proposal.hashtags.map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Goals */}
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1.5">Goals</div>
                      <ul className="space-y-1">
                        {proposal.goals.map((goal, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                            {goal}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* AI Reasoning */}
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-purple-800 mb-1">
                        <Bot className="h-3 w-3" /> AI Reasoning
                      </div>
                      <p className="text-xs text-purple-700">{proposal.reasoning}</p>
                    </div>

                    {/* Action: Create Campaign */}
                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                      {proposal.estimatedBudget && (
                        <span className="text-xs text-gray-500">
                          Est. budget: {proposal.estimatedBudget}
                        </span>
                      )}
                      <Link
                        to={`/marketing/campaigns/new?name=${encodeURIComponent(proposal.name)}&type=${proposal.campaignType}&description=${encodeURIComponent(proposal.description)}${proposal.linkedKeyDateId ? `&keyDateId=${proposal.linkedKeyDateId}` : ''}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity ml-auto"
                      >
                        <Megaphone className="h-4 w-4" />
                        Create Campaign
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// AI Tasks Panel
// ============================================

function AITasksPanel({
  tasks,
  tasksLoading,
  suggestedTasks,
  suggestingTasks,
  onSuggest,
  onAcceptAll,
  onAcceptOne,
  onDismissSuggestions,
  onStatusChange,
  onRemove,
  onLoadTasks,
  hasStrategy,
  hasKeyDates,
}: {
  tasks: MarketingTask[];
  tasksLoading: boolean;
  suggestedTasks: AISuggestedTask[];
  suggestingTasks: boolean;
  onSuggest: () => void;
  onAcceptAll: () => void;
  onAcceptOne: (task: AISuggestedTask) => void;
  onDismissSuggestions: () => void;
  onStatusChange: (taskId: string, status: MarketingTaskStatus) => void;
  onRemove: (taskId: string) => void;
  onLoadTasks: () => void;
  hasStrategy: boolean;
  hasKeyDates: boolean;
}) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);

  useEffect(() => {
    onLoadTasks();
  }, []);

  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const completedTasks = tasks.filter((t) => t.status === 'done');

  const stats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    review: tasks.filter((t) => t.status === 'review').length,
    done: completedTasks.length,
  };

  return (
    <div className="space-y-6">
      {/* Header + Suggest Button */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-purple-500" />
              AI-Powered Task Manager
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Tasks are generated by the AI Agent based on your strategy, key dates, and campaigns.
            </p>
          </div>
          <button
            onClick={onSuggest}
            disabled={suggestingTasks}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {suggestingTasks ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Suggest Tasks
              </>
            )}
          </button>
        </div>

        {/* Context indicators */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            hasStrategy ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <Target className="h-3 w-3" />
            {hasStrategy ? 'Strategy set' : 'No strategy'}
          </span>
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            hasKeyDates ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <Calendar className="h-3 w-3" />
            {hasKeyDates ? 'Key dates loaded' : 'No key dates'}
          </span>
          {/* Stats */}
          {stats.total > 0 && (
            <div className="ml-auto flex items-center gap-2 text-[11px]">
              <span className="text-gray-500">{stats.todo} to do</span>
              <span className="text-blue-600">{stats.inProgress} active</span>
              <span className="text-green-600">{stats.done} done</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestedTasks.length > 0 && (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-purple-900 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Suggested Tasks ({suggestedTasks.length})
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={onDismissSuggestions}
                className="px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={onAcceptAll}
                className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {suggestedTasks.map((task, idx) => {
              const isExpanded = expandedSuggestion === idx;
              return (
                <div key={idx} className="bg-white rounded-lg border border-purple-100 p-3">
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedSuggestion(isExpanded ? null : idx)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{task.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                    </div>
                    <button
                      onClick={() => onAcceptOne(task)}
                      className="ml-2 flex-shrink-0 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                    >
                      Accept
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-xs">
                      <p className="text-gray-600">{task.description}</p>
                      {task.reasoning && (
                        <div className="bg-purple-50/50 rounded px-2.5 py-1.5">
                          <span className="font-medium text-purple-700">AI Reasoning: </span>
                          <span className="text-purple-600">{task.reasoning}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-gray-500">
                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Due: {task.dueDate}
                          </span>
                        )}
                        {task.linkedKeyDateName && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <CalendarDays className="h-3 w-3" /> {task.linkedKeyDateName}
                          </span>
                        )}
                        {task.linkedCampaignName && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <Megaphone className="h-3 w-3" /> {task.linkedCampaignName}
                          </span>
                        )}
                      </div>
                      {task.checklist && task.checklist.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Checklist:</span>
                          <ul className="mt-1 space-y-0.5">
                            {task.checklist.map((item, i) => (
                              <li key={i} className="text-gray-600 flex items-start gap-1">
                                <Circle className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggesting loading state */}
      {suggestingTasks && (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 text-purple-400 animate-spin mb-3" />
          <p className="text-sm text-gray-600">Analyzing strategy, dates & campaigns...</p>
          <p className="text-xs text-gray-400 mt-1">Generating task suggestions with AI</p>
        </div>
      )}

      {/* Active Tasks */}
      {!suggestingTasks && (
        <div className="space-y-3">
          {activeTasks.length === 0 && suggestedTasks.length === 0 && !tasksLoading ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No active tasks</p>
              <p className="text-xs text-gray-400 mt-1">
                Click "Suggest Tasks" to have the AI generate tasks from your strategy and key dates.
              </p>
            </div>
          ) : tasksLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 text-gray-300 animate-spin" />
            </div>
          ) : (
            <>
              {activeTasks.length > 0 && (
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Active Tasks ({activeTasks.length})
                </p>
              )}
              {activeTasks.map((task) => {
                const priorityCfg = TASK_PRIORITY_CONFIG[task.priority];
                const typeCfg = TASK_TYPE_CONFIG[task.taskType];
                const isOverdue = task.dueDate && task.dueDate.toDate() < new Date() && task.status !== 'done';

                return (
                  <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start gap-3">
                      {/* Status dropdown */}
                      <select
                        value={task.status}
                        onChange={(e) => onStatusChange(task.id, e.target.value as MarketingTaskStatus)}
                        className="mt-0.5 text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">In Review</option>
                        <option value="done">Done</option>
                        <option value="cancelled">Cancelled</option>
                      </select>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{task.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityCfg?.color || ''}`}>
                            {task.priority}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {typeCfg?.label || task.taskType}
                          </span>
                          {task.source === 'ai_suggestion' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">
                              AI
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                          {task.dueDate && (
                            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                              <Clock className="h-3 w-3" />
                              {isOverdue ? 'Overdue: ' : 'Due: '}
                              {task.dueDate.toDate().toLocaleDateString()}
                            </span>
                          )}
                          {task.linkedKeyDateName && (
                            <span className="flex items-center gap-1 text-blue-500">
                              <CalendarDays className="h-3 w-3" /> {task.linkedKeyDateName}
                            </span>
                          )}
                          {task.linkedCampaignName && (
                            <span className="flex items-center gap-1 text-orange-500">
                              <Megaphone className="h-3 w-3" /> {task.linkedCampaignName}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onRemove(task.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0"
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Completed section */}
              {completedTasks.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">
                    Completed ({completedTasks.length})
                  </p>
                  {completedTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="bg-gray-50 rounded-lg border border-gray-100 p-3 opacity-70">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-600 line-through">{task.title}</span>
                        <button
                          onClick={() => onRemove(task.id)}
                          className="ml-auto p-1 text-gray-300 hover:text-red-400 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Page
// ============================================

type ActiveTab = 'chat' | 'generate' | 'dates' | 'campaigns' | 'tasks' | 'case-studies' | 'strategy';

// ============================================
// Strategy Setup Panel (with Document Upload)
// ============================================

const ACCEPTED_FILE_TYPES = '.pdf,.txt,.md,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp';

function StrategySetupPanel({
  context,
  onChange,
  onSave,
  onAnalyzeFile,
  analysis,
  analyzing,
  onResearch,
  research,
  researching,
  keyDates,
  strategyLoaded,
}: {
  context: Record<string, any>;
  onChange: (ctx: Record<string, any>) => void;
  onSave: (ctx: Record<string, any>) => Promise<void>;
  onAnalyzeFile: (file: File) => Promise<StrategyAnalysisResult | null>;
  analysis: StrategyAnalysisResult | null;
  analyzing: boolean;
  onResearch: () => Promise<StrategyResearchResult | null>;
  research: StrategyResearchResult | null;
  researching: boolean;
  keyDates: MarketingKeyDate[];
  strategyLoaded: boolean;
}) {
  // View mode: 'overview' | 'upload' | 'wizard'
  const [view, setView] = useState<'overview' | 'upload' | 'wizard'>('overview');
  const [wizardStep, setWizardStep] = useState(0);

  // Editable fields state
  const [brandVoice, setBrandVoice] = useState(context.brandVoice || '');
  const [targetMarket, setTargetMarket] = useState(context.targetMarket || '');
  const [businessGoals, setBusinessGoals] = useState((context.businessGoals || []).join(', '));
  const [contentPillars, setContentPillars] = useState((context.contentPillars || []).join(', '));
  const [productFocus, setProductFocus] = useState((context.productFocus || []).join(', '));
  const [uniqueSellingPoints, setUniqueSellingPoints] = useState((context.uniqueSellingPoints || []).join(', '));
  const [salesObjectives, setSalesObjectives] = useState((context.salesObjectives || []).join(', '));
  const [marketingObjectives, setMarketingObjectives] = useState((context.marketingObjectives || []).join(', '));
  const [targetAudience, setTargetAudience] = useState((context.targetAudience || []).join(', '));
  const [competitorInsights, setCompetitorInsights] = useState((context.competitorInsights || []).join(', '));
  const [industryTrends, setIndustryTrends] = useState((context.industryTrends || []).join(', '));
  const [pricingStrategy, setPricingStrategy] = useState(context.pricingStrategy || '');

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync fields when context changes
  useEffect(() => {
    setBrandVoice(context.brandVoice || '');
    setTargetMarket(context.targetMarket || '');
    setBusinessGoals((context.businessGoals || []).join(', '));
    setContentPillars((context.contentPillars || []).join(', '));
    setProductFocus((context.productFocus || []).join(', '));
    setUniqueSellingPoints((context.uniqueSellingPoints || []).join(', '));
    setSalesObjectives((context.salesObjectives || []).join(', '));
    setMarketingObjectives((context.marketingObjectives || []).join(', '));
    setTargetAudience((context.targetAudience || []).join(', '));
    setCompetitorInsights((context.competitorInsights || []).join(', '));
    setIndustryTrends((context.industryTrends || []).join(', '));
    setPricingStrategy(context.pricingStrategy || '');
  }, [context]);

  const splitTrim = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const buildContext = () => ({
    ...context,
    brandVoice,
    targetMarket,
    businessGoals: splitTrim(businessGoals),
    contentPillars: splitTrim(contentPillars),
    productFocus: splitTrim(productFocus),
    uniqueSellingPoints: splitTrim(uniqueSellingPoints),
    salesObjectives: splitTrim(salesObjectives),
    marketingObjectives: splitTrim(marketingObjectives),
    targetAudience: splitTrim(targetAudience),
    competitorInsights: splitTrim(competitorInsights),
    industryTrends: splitTrim(industryTrends),
    pricingStrategy,
  });

  const handleSave = async () => {
    setSaving(true);
    const ctx = buildContext();
    onChange(ctx);
    await onSave(ctx);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFileName(file.name);
    await onAnalyzeFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  // Apply AI-suggested strategy from research
  const applyResearchSuggestions = () => {
    if (!research?.suggestedStrategy) return;
    const s = research.suggestedStrategy;
    if (s.brandVoice) setBrandVoice(s.brandVoice);
    if (s.targetMarket) setTargetMarket(s.targetMarket);
    if (s.businessGoals?.length) setBusinessGoals(s.businessGoals.join(', '));
    if (s.contentPillars?.length) setContentPillars(s.contentPillars.join(', '));
    if (s.productFocus?.length) setProductFocus(s.productFocus.join(', '));
    if (s.uniqueSellingPoints?.length) setUniqueSellingPoints(s.uniqueSellingPoints.join(', '));
    if (s.salesObjectives?.length) setSalesObjectives(s.salesObjectives.join(', '));
    if (s.marketingObjectives?.length) setMarketingObjectives(s.marketingObjectives.join(', '));
    if (s.targetAudience?.length) setTargetAudience(s.targetAudience.join(', '));
    if (s.competitorInsights?.length) setCompetitorInsights(s.competitorInsights.join(', '));
    if (s.industryTrends?.length) setIndustryTrends(s.industryTrends.join(', '));
    if (s.pricingStrategy) setPricingStrategy(s.pricingStrategy);
  };

  const hasStrategy = !!(context.brandVoice || context.targetMarket || (context.businessGoals?.length > 0));

  // Wizard steps
  const wizardSteps = [
    { label: 'Review', icon: Eye, desc: 'Current strategy' },
    { label: 'Research', icon: Search, desc: 'AI analysis' },
    { label: 'Edit', icon: Settings2, desc: 'Update fields' },
    { label: 'Save', icon: Save, desc: 'Confirm & save' },
  ];

  // ---- OVERVIEW VIEW ----
  if (view === 'overview') {
    return (
      <div className="space-y-5">
        {/* Strategy Status Card */}
        <div className={`rounded-xl border p-5 ${hasStrategy ? 'bg-white border-gray-200' : 'bg-gray-50 border-dashed border-gray-300'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-500" />
              Marketing Strategy
            </h3>
            {hasStrategy && (
              <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full flex items-center gap-1">
                <Check className="h-3 w-3" /> Active
              </span>
            )}
          </div>

          {!strategyLoaded ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading strategy...
            </div>
          ) : hasStrategy ? (
            <div className="space-y-3">
              {/* Quick summary cards */}
              {context.brandVoice && (
                <div className="text-xs">
                  <span className="font-medium text-gray-500">Brand Voice:</span>{' '}
                  <span className="text-gray-700">{context.brandVoice}</span>
                </div>
              )}
              {context.targetMarket && (
                <div className="text-xs">
                  <span className="font-medium text-gray-500">Target Market:</span>{' '}
                  <span className="text-gray-700">{context.targetMarket}</span>
                </div>
              )}
              {context.businessGoals?.length > 0 && (
                <div className="text-xs">
                  <span className="font-medium text-gray-500">Goals:</span>{' '}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {context.businessGoals.map((g: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">{g}</span>
                    ))}
                  </div>
                </div>
              )}
              {context.productFocus?.length > 0 && (
                <div className="text-xs">
                  <span className="font-medium text-gray-500">Product Focus:</span>{' '}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {context.productFocus.map((p: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {context.contentPillars?.length > 0 && (
                <div className="text-xs">
                  <span className="font-medium text-gray-500">Content Pillars:</span>{' '}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {context.contentPillars.map((c: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {context.marketingObjectives?.length > 0 && (
                <div className="text-xs">
                  <span className="font-medium text-gray-500">Marketing Objectives:</span>{' '}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {context.marketingObjectives.map((m: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <Settings2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No strategy defined yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload a document or create one from scratch</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => setView('upload')}
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/30 transition-all text-left group"
          >
            <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <Upload className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{hasStrategy ? 'Re-upload Strategy Document' : 'Upload Strategy Document'}</p>
              <p className="text-xs text-gray-500">Gemini Pro Deep Think analyzes your document</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>

          <button
            onClick={() => { setWizardStep(hasStrategy ? 0 : 2); setView('wizard'); }}
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group"
          >
            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{hasStrategy ? 'Update Strategy (Guided)' : 'Create Strategy Manually'}</p>
              <p className="text-xs text-gray-500">AI-assisted step-by-step {hasStrategy ? 'update' : 'creation'} with research</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Key Dates Preview */}
        {keyDates.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              Key Dates Informing Strategy ({keyDates.filter((d) => d.date.toMillis() >= Date.now()).length} upcoming)
            </h4>
            <div className="space-y-1">
              {keyDates
                .filter((d) => d.date.toMillis() >= Date.now())
                .sort((a, b) => a.date.toMillis() - b.date.toMillis())
                .slice(0, 5)
                .map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-xs text-gray-600">
                    <CalendarDays className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="font-medium">{d.name}</span>
                    <span className="text-gray-400">{d.date.toDate().toLocaleDateString()}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- UPLOAD VIEW ----
  if (view === 'upload') {
    return (
      <div className="space-y-5">
        <button onClick={() => setView('overview')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to overview
        </button>

        {/* Upload Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            Upload Marketing Strategy
          </h3>
          <p className="text-xs text-gray-500">
            Upload your marketing strategy document and Gemini Pro Deep Think will analyze it to extract your full strategy context automatically.
          </p>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragActive ? 'border-purple-400 bg-purple-50'
              : analyzing ? 'border-purple-300 bg-purple-50/50'
              : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
            }`}
          >
            <input ref={fileInputRef} type="file" accept={ACCEPTED_FILE_TYPES} onChange={handleFileChange} className="hidden" />
            {analyzing ? (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="relative">
                    <Brain className="h-10 w-10 text-purple-400" />
                    <RefreshCw className="h-5 w-5 text-purple-600 animate-spin absolute -bottom-1 -right-1" />
                  </div>
                </div>
                <p className="text-sm font-medium text-purple-700">Deep Think Analysis in Progress</p>
                <p className="text-xs text-purple-500">Gemini Pro is carefully analyzing your strategy...</p>
                <div className="flex justify-center gap-1">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="h-1.5 w-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            ) : uploadedFileName ? (
              <div className="space-y-2">
                <FileText className="h-8 w-8 text-green-500 mx-auto" />
                <p className="text-sm font-medium text-gray-700">{uploadedFileName}</p>
                <p className="text-xs text-gray-400">Click or drop to upload a different file</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-gray-300 mx-auto" />
                <p className="text-sm font-medium text-gray-600">Drop your strategy document here</p>
                <p className="text-xs text-gray-400">Supports PDF, TXT, DOC, DOCX, images, Markdown, CSV</p>
              </div>
            )}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {['PDF', 'DOCX', 'TXT', 'PNG/JPG', 'MD'].map((ext) => (
              <span key={ext} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{ext}</span>
            ))}
          </div>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="bg-white rounded-xl border border-purple-200 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-purple-900">Deep Think Analysis</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{analysis.documentType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-bold ${analysis.confidence >= 80 ? 'text-green-600' : analysis.confidence >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {analysis.confidence}% confidence
                  </div>
                  <button onClick={() => setShowInsights(!showInsights)} className="p-1 text-purple-500 hover:bg-purple-100 rounded">
                    {showInsights ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            {showInsights && (
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Executive Summary</h4>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{analysis.summary}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Key Insights</h4>
                  <div className="space-y-1.5">
                    {analysis.keyInsights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600">{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {analysis.thinkingProcess && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1">
                      <Brain className="h-3 w-3" /> View AI Thinking Process
                    </summary>
                    <div className="mt-2 p-3 bg-purple-50 rounded-lg text-xs text-purple-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {analysis.thinkingProcess}
                    </div>
                  </details>
                )}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-green-700">
                    <span className="font-medium">Strategy auto-saved.</span> Fields have been populated and persisted from the analysis.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- WIZARD VIEW ----
  return (
    <div className="space-y-5">
      <button onClick={() => setView('overview')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to overview
      </button>

      {/* Wizard Steps Header */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-3">
        {wizardSteps.map((step, i) => (
          <button
            key={i}
            onClick={() => setWizardStep(i)}
            className={`flex-1 flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
              i === wizardStep
                ? 'bg-purple-100 text-purple-800 font-semibold'
                : i < wizardStep
                ? 'text-green-700 bg-green-50'
                : 'text-gray-400'
            }`}
          >
            <step.icon className="h-3.5 w-3.5 flex-shrink-0" />
            <div className="hidden sm:block">
              <span>{step.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Step 0: Review Current Strategy */}
      {wizardStep === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-500" />
            Current Strategy Overview
          </h3>
          {!hasStrategy ? (
            <div className="text-center py-6">
              <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No strategy defined yet.</p>
              <p className="text-xs text-gray-400 mt-1">Skip to Edit to create one, or run AI Research first.</p>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {[
                { label: 'Brand Voice', value: context.brandVoice },
                { label: 'Target Market', value: context.targetMarket },
                { label: 'Pricing Strategy', value: context.pricingStrategy },
              ].map((item) => item.value && (
                <div key={item.label}>
                  <span className="font-medium text-gray-500">{item.label}:</span>{' '}
                  <span className="text-gray-700">{item.value}</span>
                </div>
              ))}
              {[
                { label: 'Business Goals', items: context.businessGoals, color: 'purple' },
                { label: 'Product Focus', items: context.productFocus, color: 'blue' },
                { label: 'Content Pillars', items: context.contentPillars, color: 'amber' },
                { label: 'USPs', items: context.uniqueSellingPoints, color: 'green' },
                { label: 'Sales Objectives', items: context.salesObjectives, color: 'indigo' },
                { label: 'Marketing Objectives', items: context.marketingObjectives, color: 'pink' },
                { label: 'Target Audience', items: context.targetAudience, color: 'teal' },
                { label: 'Industry Trends', items: context.industryTrends, color: 'cyan' },
              ].map((group) => group.items?.length > 0 && (
                <div key={group.label}>
                  <span className="font-medium text-gray-500">{group.label}:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {group.items.map((item: string, i: number) => (
                      <span key={i} className={`px-2 py-0.5 bg-${group.color}-50 text-${group.color}-700 rounded-full`}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setWizardStep(1)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Search className="h-4 w-4" /> Next: AI Research
          </button>
        </div>
      )}

      {/* Step 1: AI Research */}
      {wizardStep === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Search className="h-4 w-4 text-indigo-500" />
            AI Strategy Research
          </h3>
          <p className="text-xs text-gray-500">
            Gemini Pro will research market trends, competitor strategies, and opportunities, then propose updates to your strategy aligned with your {keyDates.filter((d) => d.date.toMillis() >= Date.now()).length} upcoming key dates.
          </p>

          {!research && !researching && (
            <button
              onClick={onResearch}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 text-sm font-medium"
            >
              <Brain className="h-4 w-4" /> Start AI Research
            </button>
          )}

          {researching && (
            <div className="text-center py-8">
              <div className="relative inline-block">
                <Brain className="h-12 w-12 text-indigo-400" />
                <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin absolute -bottom-1 -right-1" />
              </div>
              <p className="text-sm font-medium text-indigo-700 mt-3">Researching Strategy Updates...</p>
              <p className="text-xs text-indigo-500 mt-1">Analyzing trends, competitors, and key date opportunities</p>
              <div className="flex justify-center gap-1 mt-3">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}

          {research && !researching && (
            <div className="space-y-4">
              {/* Assessment */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Current Strategy Assessment</h4>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{research.currentAssessment}</p>
              </div>

              {/* Market Trends */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" /> Market Trends
                </h4>
                <div className="space-y-1">
                  {research.marketTrends.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <TrendingUp className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opportunities & Threats */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-green-700 mb-1.5">Opportunities</h4>
                  {research.opportunities.map((o, i) => (
                    <div key={i} className="text-xs text-gray-600 mb-1 flex items-start gap-1">
                      <Lightbulb className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{o}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-red-700 mb-1.5">Threats</h4>
                  {research.threats.map((t, i) => (
                    <div key={i} className="text-xs text-gray-600 mb-1 flex items-start gap-1">
                      <Shield className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Recommendations</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {research.recommendations.map((rec, i) => (
                    <div key={i} className={`p-3 rounded-lg border text-xs ${
                      rec.priority === 'high' ? 'border-red-200 bg-red-50/50' :
                      rec.priority === 'medium' ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-700">{rec.section}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                          rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}>{rec.priority}</span>
                      </div>
                      <p className="text-gray-500 mb-1">{rec.reasoning}</p>
                      <p className="text-gray-700"><span className="font-medium">Suggested:</span> {rec.suggestedUpdate}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Date Alignments */}
              {research.keyDateAlignments?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-blue-500" /> Key Date Strategy
                  </h4>
                  <div className="space-y-1.5">
                    {research.keyDateAlignments.map((kd, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs p-2 bg-blue-50 rounded-lg">
                        <CalendarDays className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-blue-800">{kd.dateName}:</span>{' '}
                          <span className="text-blue-700">{kd.strategicAction}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { applyResearchSuggestions(); setWizardStep(2); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  <Zap className="h-4 w-4" /> Apply Suggestions & Edit
                </button>
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Edit Fields */}
      {wizardStep === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gray-500" />
            Edit Strategy Fields
            {research && (
              <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full ml-auto">AI-enhanced</span>
            )}
          </h3>

          {/* Brand & Market */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-purple-700 border-b border-purple-100 pb-1">Brand & Market</h4>
            <div>
              <label className="text-xs font-medium text-gray-600">Brand Voice</label>
              <input value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="e.g. Professional yet approachable"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Target Market</label>
              <input value={targetMarket} onChange={(e) => setTargetMarket(e.target.value)}
                placeholder="e.g. Homeowners, architects in East Africa"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Pricing Strategy</label>
              <input value={pricingStrategy} onChange={(e) => setPricingStrategy(e.target.value)}
                placeholder="e.g. Premium positioning with value tiers"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
            </div>
          </div>

          {/* Goals & Objectives */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-blue-700 border-b border-blue-100 pb-1">Goals & Objectives</h4>
            <div>
              <label className="text-xs font-medium text-gray-600">Business Goals (comma-separated)</label>
              <input value={businessGoals} onChange={(e) => setBusinessGoals(e.target.value)}
                placeholder="e.g. Increase brand awareness, drive showroom visits"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Sales Objectives (comma-separated)</label>
              <input value={salesObjectives} onChange={(e) => setSalesObjectives(e.target.value)}
                placeholder="e.g. 20% revenue growth, expand to new markets"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Marketing Objectives (comma-separated)</label>
              <input value={marketingObjectives} onChange={(e) => setMarketingObjectives(e.target.value)}
                placeholder="e.g. 10k followers on Instagram, 5% engagement rate"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>

          {/* Products & Content */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-green-700 border-b border-green-100 pb-1">Products & Content</h4>
            <div>
              <label className="text-xs font-medium text-gray-600">Product Focus (comma-separated)</label>
              <input value={productFocus} onChange={(e) => setProductFocus(e.target.value)}
                placeholder="e.g. Italian marble, porcelain tiles, natural stone"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Content Pillars (comma-separated)</label>
              <input value={contentPillars} onChange={(e) => setContentPillars(e.target.value)}
                placeholder="e.g. Design inspiration, product quality, customer stories"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Unique Selling Points (comma-separated)</label>
              <input value={uniqueSellingPoints} onChange={(e) => setUniqueSellingPoints(e.target.value)}
                placeholder="e.g. Direct import from Italy, largest showroom in EA"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
          </div>

          {/* Audience & Competition */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-amber-700 border-b border-amber-100 pb-1">Audience & Competition</h4>
            <div>
              <label className="text-xs font-medium text-gray-600">Target Audience Segments (comma-separated)</label>
              <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Luxury homeowners, commercial developers, architects"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Competitor Insights (comma-separated)</label>
              <input value={competitorInsights} onChange={(e) => setCompetitorInsights(e.target.value)}
                placeholder="e.g. Competitor X focusing on budget tiles, Y expanding digital presence"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Industry Trends (comma-separated)</label>
              <input value={industryTrends} onChange={(e) => setIndustryTrends(e.target.value)}
                placeholder="e.g. Sustainable materials, smart home integration, biophilic design"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
          </div>

          <button
            onClick={() => setWizardStep(3)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
          >
            Next: Review & Save <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step 3: Review & Save */}
      {wizardStep === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Save className="h-4 w-4 text-green-500" />
            Review & Save Strategy
          </h3>

          <div className="space-y-3 text-xs max-h-[400px] overflow-y-auto">
            {[
              { label: 'Brand Voice', value: brandVoice },
              { label: 'Target Market', value: targetMarket },
              { label: 'Pricing Strategy', value: pricingStrategy },
              { label: 'Business Goals', value: businessGoals },
              { label: 'Sales Objectives', value: salesObjectives },
              { label: 'Marketing Objectives', value: marketingObjectives },
              { label: 'Product Focus', value: productFocus },
              { label: 'Content Pillars', value: contentPillars },
              { label: 'Unique Selling Points', value: uniqueSellingPoints },
              { label: 'Target Audience', value: targetAudience },
              { label: 'Competitor Insights', value: competitorInsights },
              { label: 'Industry Trends', value: industryTrends },
            ].filter((f) => f.value).map((field) => (
              <div key={field.label} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-gray-700">{field.label}:</span>{' '}
                  <span className="text-gray-600">{field.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setWizardStep(2)}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
            >
              <ArrowLeft className="h-4 w-4 inline mr-1" /> Back to Edit
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
              ) : saved ? (
                <><Check className="h-4 w-4" /> Strategy Saved!</>
              ) : (
                <><Save className="h-4 w-4" /> Save Strategy to Database</>
              )}
            </button>
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-green-700">
                <span className="font-medium">Strategy saved successfully!</span> Your strategy context is now persisted and will be loaded automatically on your next visit.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MarketingAgentPage() {
  const {
    messages,
    sendMessage,
    clearChat,
    chatLoading,
    generatedContent,
    generatePostContent,
    generating,
    keyDates,
    loadKeyDates,
    discoverDates,
    saveDates,
    acknowledgeDt,
    removeDt,
    datesLoading,
    campaignProposals,
    proposeDraftCampaigns,
    proposingCampaigns,
    strategyContext,
    setStrategyContext,
    saveStrategy,
    strategyLoaded,
    analyzeStrategy,
    strategyAnalysis,
    analyzingStrategy,
    researchStrategy,
    strategyResearch,
    researchingStrategy,
    tasks,
    tasksLoading,
    suggestedTasks,
    suggestingTasks,
    loadTasks,
    suggestTasks,
    acceptSuggestedTasks,
    updateTaskStatus,
    removeTask,
    error,
  } = useMarketingAgent();

  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [inputValue, setInputValue] = useState('');
  const [dismissedError, setDismissedError] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load key dates on mount
  useEffect(() => {
    loadKeyDates();
  }, [loadKeyDates]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset error dismissal when error changes
  useEffect(() => {
    setDismissedError(false);
  }, [error]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  // Send chat message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || chatLoading) return;
    const msg = inputValue;
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(msg);
  }, [inputValue, chatLoading, sendMessage]);

  // Handle content generation
  const handleGenerate = useCallback(async (request: ContentGenerationRequest) => {
    await generatePostContent(request);
  }, [generatePostContent]);

  // Handle discover dates
  const handleDiscoverDates = useCallback(async () => {
    const dates = await discoverDates({ region: 'East Africa', country: 'Uganda', industry: 'interior design' });
    if (dates.length > 0) {
      await saveDates(dates);
    }
  }, [discoverDates, saveDates]);

  // Handle propose campaigns
  const handleProposeCampaigns = useCallback(async () => {
    await proposeDraftCampaigns();
  }, [proposeDraftCampaigns]);

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'generate', label: 'Generate', icon: Sparkles },
    { id: 'dates', label: 'Key Dates', icon: Calendar },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'tasks', label: 'Tasks', icon: ClipboardList },
    { id: 'case-studies', label: 'Case Studies', icon: FileText },
    { id: 'strategy', label: 'Strategy', icon: Settings2 },
  ];

  return (
    <>
      <Helmet>
        <title>Marketing AI Agent | Marketing Hub</title>
      </Helmet>

      <div className="h-[calc(100vh-7rem)] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Marketing AI Agent</h1>
              <p className="text-xs text-gray-500">Strategy-aligned content creation & marketing planning</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.id === 'dates' && keyDates.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full font-semibold">
                      {keyDates.length}
                    </span>
                  )}
                  {tab.id === 'campaigns' && campaignProposals.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded-full font-semibold">
                      {campaignProposals.length}
                    </span>
                  )}
                  {tab.id === 'tasks' && tasks.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded-full font-semibold">
                      {tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
                {chatLoading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-purple-700" />
                    </div>
                    <div className="bg-gray-100 rounded-xl px-4 py-3">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Ask me about marketing dates, content ideas, campaign planning..."
                      rows={1}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
                      style={{ minHeight: '42px', maxHeight: '120px' }}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || chatLoading}
                    className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                  <button
                    onClick={clearChat}
                    className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
                    title="Clear chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Generate Tab */}
          {activeTab === 'generate' && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              <ContentGeneratorPanel onGenerate={handleGenerate} generating={generating} />
              {generatedContent && <GeneratedContentDisplay content={generatedContent} />}
            </div>
          )}

          {/* Key Dates Tab */}
          {activeTab === 'dates' && (
            <div className="h-full overflow-y-auto p-6">
              <KeyDatesPanel
                dates={keyDates}
                loading={datesLoading}
                onDiscover={handleDiscoverDates}
                onAcknowledge={acknowledgeDt}
                onDelete={removeDt}
              />
            </div>
          )}

          {/* Campaigns Tab */}
          {activeTab === 'campaigns' && (
            <div className="h-full overflow-y-auto p-6">
              <CampaignProposalsPanel
                proposals={campaignProposals}
                loading={proposingCampaigns}
                onPropose={handleProposeCampaigns}
                keyDatesCount={keyDates.length}
                hasStrategy={!!(strategyContext.brandVoice || strategyContext.businessGoals?.length)}
              />
            </div>
          )}

          {/* Case Studies Tab — AI drafter from a Design Manager project */}
          {activeTab === 'case-studies' && (
            <div className="h-full overflow-y-auto p-6">
              <CaseStudyDrafterPanel />
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="h-full overflow-y-auto p-6">
              <AITasksPanel
                tasks={tasks}
                tasksLoading={tasksLoading}
                suggestedTasks={dismissedSuggestions ? [] : suggestedTasks}
                suggestingTasks={suggestingTasks}
                onSuggest={async () => {
                  setDismissedSuggestions(false);
                  await suggestTasks();
                }}
                onAcceptAll={async () => {
                  await acceptSuggestedTasks(suggestedTasks);
                  setDismissedSuggestions(false);
                }}
                onAcceptOne={async (task) => {
                  await acceptSuggestedTasks([task]);
                }}
                onDismissSuggestions={() => setDismissedSuggestions(true)}
                onStatusChange={updateTaskStatus}
                onRemove={removeTask}
                onLoadTasks={loadTasks}
                hasStrategy={!!(strategyContext.brandVoice || strategyContext.businessGoals?.length)}
                hasKeyDates={keyDates.length > 0}
              />
            </div>
          )}

          {/* Strategy Tab */}
          {activeTab === 'strategy' && (
            <div className="h-full overflow-y-auto p-6">
              <StrategySetupPanel
                context={strategyContext}
                onChange={setStrategyContext}
                onSave={saveStrategy}
                onAnalyzeFile={analyzeStrategy}
                analysis={strategyAnalysis}
                analyzing={analyzingStrategy}
                onResearch={researchStrategy}
                research={strategyResearch}
                researching={researchingStrategy}
                keyDates={keyDates}
                strategyLoaded={strategyLoaded}
              />
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && !dismissedError && (
          <div className="px-6 pb-2">
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex items-center justify-between">
              <span>{error.message}</span>
              <button
                onClick={() => setDismissedError(true)}
                className="text-red-500 hover:text-red-700 ml-3 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
