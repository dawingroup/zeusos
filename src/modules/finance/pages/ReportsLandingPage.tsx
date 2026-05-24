// ============================================================================
// AI FINANCE REPORTS PAGE
// ZeusOS v2.0 - Finance Module
//
// Generate intelligent financial reports for different stakeholder audiences.
// Uses Gemini AI to produce board reports, investor updates, management
// reports, and team briefs from real P&L data.
// ============================================================================

import { useState, useMemo } from 'react';
import { Briefcase, Users, BarChart3, MessageSquare, Sparkles, Copy, Printer, Check } from 'lucide-react';
import { Card } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { usePLHistory } from '../hooks/usePLHistory';
import { generateFinanceReport } from '../services/financeReportAI';
import type { ReportTemplate, GeneratedReport } from '../services/financeReportAI';
import { periodLabel } from '../types/forecast.types';

// ── Constants ────────────────────────────────────────────────────────────────

const COMPANY_NAME = 'ZeusOS';
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface TemplateCard {
  id: ReportTemplate;
  title: string;
  description: string;
  icon: React.ElementType;
}

const TEMPLATES: TemplateCard[] = [
  {
    id: 'board_report',
    title: 'Board Report',
    description: 'Strategic overview for board of directors',
    icon: Briefcase,
  },
  {
    id: 'investor_update',
    title: 'Investor Update',
    description: 'Performance metrics for investors & stakeholders',
    icon: Users,
  },
  {
    id: 'management_report',
    title: 'Management Report',
    description: 'Detailed analysis for internal management',
    icon: BarChart3,
  },
  {
    id: 'team_brief',
    title: 'Team Brief',
    description: 'Accessible summary for team members',
    icon: MessageSquare,
  },
];

// ── Markdown Renderer ────────────────────────────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
  const elements = useMemo(() => {
    const lines = content.split('\n');
    const result: React.ReactNode[] = [];
    let listItems: string[] = [];
    let key = 0;

    function flushList() {
      if (listItems.length > 0) {
        result.push(
          <ul key={key++} className="list-disc list-inside space-y-1 my-2 text-muted-foreground text-sm">
            {listItems.map((item, i) => (
              <li key={i}>{renderInline(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
    }

    function renderInline(text: string): React.ReactNode {
      // Handle **bold** patterns
      const parts: React.ReactNode[] = [];
      const boldRegex = /\*\*(.+?)\*\*/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = boldRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.slice(lastIndex, match.index));
        }
        parts.push(<strong key={`b-${match.index}`} className="font-semibold">{match[1]}</strong>);
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }

      return parts.length === 1 ? parts[0] : <>{parts}</>;
    }

    for (const line of lines) {
      const trimmed = line.trim();

      // Horizontal rule
      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        flushList();
        result.push(<hr key={key++} className="my-4 border-[var(--border-subtle)]" />);
        continue;
      }

      // H2 heading
      if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
        flushList();
        result.push(
          <h2 key={key++} className="text-lg font-bold text-foreground mt-5 mb-2">
            {renderInline(trimmed.slice(3))}
          </h2>
        );
        continue;
      }

      // H3 heading
      if (trimmed.startsWith('### ')) {
        flushList();
        result.push(
          <h3 key={key++} className="text-base font-semibold text-foreground mt-4 mb-1.5">
            {renderInline(trimmed.slice(4))}
          </h3>
        );
        continue;
      }

      // H1 heading
      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        flushList();
        result.push(
          <h1 key={key++} className="text-xl font-bold text-foreground mt-5 mb-2">
            {renderInline(trimmed.slice(2))}
          </h1>
        );
        continue;
      }

      // List item
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        listItems.push(trimmed.slice(2));
        continue;
      }

      // Numbered list item
      if (/^\d+\.\s/.test(trimmed)) {
        listItems.push(trimmed.replace(/^\d+\.\s/, ''));
        continue;
      }

      // Empty line
      if (trimmed === '') {
        flushList();
        continue;
      }

      // Regular paragraph
      flushList();
      result.push(
        <p key={key++} className="text-sm text-muted-foreground my-1.5 leading-relaxed">
          {renderInline(trimmed)}
        </p>
      );
    }

    flushList();
    return result;
  }, [content]);

  return <div>{elements}</div>;
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <Card className="p-6 space-y-4 animate-pulse">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-3 pt-2">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="space-y-3 pt-2">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function ReportsLandingPage() {
  const { accounts, periodData, periods, loading: dataLoading, error: dataError } = usePLHistory(24);

  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Default period selection when data loads
  useMemo(() => {
    if (periods.length > 0 && !periodStart) {
      setPeriodStart(periods[0]);
      setPeriodEnd(periods[periods.length - 1]);
    }
  }, [periods, periodStart]);

  const canGenerate = selectedTemplate && periodStart && periodEnd && periodStart <= periodEnd && !generating;

  async function handleGenerate() {
    if (!selectedTemplate || !periodStart || !periodEnd) return;

    setGenerating(true);
    setGenError(null);
    setGeneratedReport(null);

    try {
      const report = await generateFinanceReport(
        {
          template: selectedTemplate,
          companyName: COMPANY_NAME,
          periodStart,
          periodEnd,
          additionalContext: additionalContext.trim() || undefined,
        },
        periodData,
        accounts,
      );
      setGeneratedReport(report);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!generatedReport) return;
    try {
      await navigator.clipboard.writeText(generatedReport.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = generatedReport.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handlePrint() {
    window.print();
  }

  // ── No API key configured ──
  if (!GEMINI_KEY) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">AI Finance Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Generate intelligent reports for different stakeholders</p>
        </div>
        <Card className="p-8 text-center">
          <Sparkles className="w-10 h-10 text-[var(--fg-tertiary)] mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">AI reports require a Gemini API key</p>
          <p className="text-sm text-muted-foreground mt-1">
            Configure <code className="bg-[var(--bg-sunken)] px-1.5 py-0.5 rounded text-xs font-mono">VITE_GEMINI_API_KEY</code> in your environment.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">AI Finance Reports</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Generate intelligent reports for different stakeholders</p>
      </div>

      {dataError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{dataError}</div>
      )}

      {/* Template Cards — 2x2 Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          const isSelected = selectedTemplate === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTemplate(t.id);
                setGeneratedReport(null);
                setGenError(null);
              }}
              className={`text-left p-5 rounded-lg border-2 transition-all duration-150
                ${isSelected
                  ? 'border-green-500 bg-green-50/50 shadow-sm'
                  : 'border-[var(--border-subtle)] bg-card hover:border-[var(--border-default)] hover:shadow-sm'
                }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${isSelected ? 'bg-green-100 text-green-700' : 'bg-[var(--bg-sunken)] text-muted-foreground'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${isSelected ? 'text-green-800' : 'text-foreground'}`}>
                    {t.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Configuration Panel — shown when a template is selected */}
      {selectedTemplate && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Report Configuration
          </h3>

          {/* Period Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start Month</label>
              {dataLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <select
                  value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)}
                  className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm bg-card font-medium"
                >
                  {periods.map(p => (
                    <option key={p} value={p}>{periodLabel(p)}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">End Month</label>
              {dataLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <select
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm bg-card font-medium"
                >
                  {periods.map(p => (
                    <option key={p} value={p}>{periodLabel(p)}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {periodStart && periodEnd && periodStart > periodEnd && (
            <p className="text-xs text-red-500">Start month must be before or equal to end month.</p>
          )}

          {/* Additional Context */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Additional Context <span className="text-[var(--fg-tertiary)]">(optional)</span>
            </label>
            <textarea
              value={additionalContext}
              onChange={e => setAdditionalContext(e.target.value)}
              placeholder="E.g., 'We launched a new product line in March' or 'Focus on the cost reduction initiatives'"
              rows={3}
              className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm bg-card resize-none placeholder:text-[var(--fg-tertiary)]"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || dataLoading}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors
              ${canGenerate && !dataLoading
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                : 'bg-[var(--bg-sunken)] text-[var(--fg-tertiary)] cursor-not-allowed'
              }`}
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </Card>
      )}

      {/* Generation Error */}
      {genError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{genError}</div>
      )}

      {/* Loading State */}
      {generating && <ReportSkeleton />}

      {/* Generated Report Preview */}
      {generatedReport && !generating && (
        <Card className="p-6 print:shadow-none print:border-none">
          {/* Report Header */}
          <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">{generatedReport.title}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Generated {generatedReport.generatedAt.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-default)] text-xs font-medium text-muted-foreground bg-card hover:bg-[var(--bg-sunken)] transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy to Clipboard'}
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-default)] text-xs font-medium text-muted-foreground bg-card hover:bg-[var(--bg-sunken)] transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>

          {/* Divider */}
          <hr className="border-[var(--border-subtle)] mb-4" />

          {/* Rendered Markdown Content */}
          <div className="max-w-none">
            <MarkdownRenderer content={generatedReport.content} />
          </div>
        </Card>
      )}

      {/* Empty state — no template selected and no report */}
      {!selectedTemplate && !generatedReport && !dataLoading && (
        <Card className="p-8 text-center">
          <Sparkles className="w-10 h-10 text-[var(--fg-tertiary)] mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Select a report template above to get started</p>
          <p className="text-sm text-[var(--fg-tertiary)] mt-1">
            Choose the audience for your report and we will generate an AI-powered financial analysis.
          </p>
        </Card>
      )}
    </div>
  );
}

export default ReportsLandingPage;
