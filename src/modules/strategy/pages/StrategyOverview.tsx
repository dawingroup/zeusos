// ============================================================================
// StrategyOverview PAGE
// ZeusOS v2.0 - CEO Strategy Command Module
// Strategic plans overview and entry point for strategy review
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  ArrowRight,
  LayoutGrid,
  Target,
  Upload,
  Shield,
  FileText,
  Clock,
  Loader2,
  Trash2,
} from 'lucide-react';
import { strategyReviewService } from '../services/strategyReview.service';
import type { StrategyReviewData } from '../types/strategy.types';

export const StrategyOverview: React.FC = () => {
  const navigate = useNavigate();
  const companyId = 'dawin_group';
  const [reviews, setReviews] = useState<StrategyReviewData[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    strategyReviewService
      .getReviews(companyId, { limit: 20 })
      .then(data => {
        console.log('[StrategyOverview] Loaded reviews:', data.length);
        setReviews(data.filter(r => r.id));
      })
      .catch(err => {
        console.error('Failed to load reviews:', err);
        setReviewsError(err.message || 'Failed to load reviews');
      })
      .finally(() => setLoadingReviews(false));
  }, []);

  const handleDelete = async (reviewId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!reviewId) {
      console.error('Delete failed: review has no ID');
      return;
    }
    if (!confirm('Delete this strategy review? This cannot be undone.')) return;
    setDeletingId(reviewId);
    try {
      await strategyReviewService.deleteReview(companyId, reviewId);
      setReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const features = [
    {
      icon: Upload,
      title: 'Upload & Analyze',
      description: 'Upload your current business strategy document and let AI analyze it comprehensively.',
      color: 'bg-blue-500',
    },
    {
      icon: LayoutGrid,
      title: 'Business Model Canvas',
      description: 'Review and update all 9 blocks of the Business Model Canvas with AI suggestions.',
      color: 'bg-emerald-500',
    },
    {
      icon: Shield,
      title: 'SWOT & Risk Analysis',
      description: 'Conduct thorough SWOT analysis and strategic risk assessment with AI guidance.',
      color: 'bg-amber-500',
    },
    {
      icon: Target,
      title: 'OKR & KPI Generation',
      description: 'Auto-generate strategic OKRs and KPIs aligned with your business objectives.',
      color: 'bg-purple-500',
    },
  ];

  const reviewSections = [
    { label: 'Executive Summary', status: 'Review company overview and strategic direction' },
    { label: 'Vision & Mission', status: 'Evaluate and refine organizational purpose' },
    { label: 'Business Model Canvas', status: '9-block canvas analysis and optimization' },
    { label: 'Market Analysis', status: 'Market size, trends, segments, and positioning' },
    { label: 'Competitive Analysis', status: 'Competitor landscape and differentiation' },
    { label: 'SWOT Analysis', status: 'Strengths, Weaknesses, Opportunities, Threats' },
    { label: 'Financial Projections', status: 'Revenue, cost, and profitability targets' },
    { label: 'Risk Assessment', status: 'Strategic risk register with mitigation plans' },
    { label: 'Implementation Roadmap', status: 'Phased execution plan with milestones' },
    { label: 'OKRs & KPIs', status: 'Generate and link strategic metrics' },
  ];

  return (
    <div>
      <div>
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Strategic Plans
            </h1>
            <p className="text-gray-600">
              Review, analyze, and update your organization's business strategy with AI-powered insights.
            </p>
          </div>
          <button
            onClick={() => navigate('/strategy/plans/review/new')}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Strategy Review
          </button>
        </div>

        {/* Hero CTA Card */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-2xl p-8 mb-8 text-white shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-blue-200" />
                <span className="text-sm font-medium text-blue-200">AI-Powered Strategy Review</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">
                Business Strategy Review Tool
              </h2>
              <p className="text-blue-100 max-w-xl">
                Upload your current business strategy and plan, then use our comprehensive guided review
                to analyze every aspect — from Business Model Canvas to financial projections. Claude AI
                assists with analysis, recommendations, and generates OKRs & KPIs to drive execution.
              </p>
            </div>
            <button
              onClick={() => navigate('/strategy/plans/review/new')}
              className="flex items-center gap-2 px-6 py-3 text-base font-semibold text-blue-700 bg-white rounded-xl hover:bg-blue-50 shadow-md transition-colors whitespace-nowrap"
            >
              Start Strategy Review
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className={`${feature.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* Previous Reviews */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Your Strategy Reviews</h3>
            <button
              onClick={() => navigate('/strategy/plans/review/new')}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New Review
            </button>
          </div>

          {reviewsError ? (
            <div className="py-4 px-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {reviewsError}
            </div>
          ) : loadingReviews ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No strategy reviews yet</p>
              <button
                onClick={() => navigate('/strategy/plans/review/new')}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Start your first review
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {reviews.map(review => (
                <div
                  key={review.id}
                  onClick={() => navigate(`/strategy/plans/review/${review.id}`)}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {review.title || review.uploadedDocument?.fileName || 'Untitled Review'}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {review.updatedAt ? new Date(review.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not saved'}
                        </span>
                        {review.overallScore > 0 && (
                          <span className="font-medium text-blue-600">{review.overallScore}/5</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          review.status === 'completed' ? 'bg-green-100 text-green-700' :
                          review.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {review.status === 'in_progress' ? 'In Progress' : review.status === 'completed' ? 'Completed' : 'Draft'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(review.id, e)}
                      disabled={deletingId === review.id}
                      className="p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete review"
                    >
                      {deletingId === review.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Sections Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Review Sections Guide</h3>
            <span className="text-sm text-gray-500">10 sections • Comprehensive assessment</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reviewSections.map((section, i) => (
              <div
                key={section.label}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-blue-700">{i + 1}</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{section.label}</h4>
                  <p className="text-xs text-gray-500">{section.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Info Banner */}
        <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-purple-900">
                Claude AI Strategy Assistant
              </h3>
              <p className="mt-1 text-sm text-purple-700">
                Every section includes an AI assistant powered by Claude that can analyze your current strategy,
                identify gaps, suggest improvements, and generate strategic outputs like OKRs and KPIs.
                Simply click "AI Assist" on any section or open the chat panel for deeper analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyOverview;
