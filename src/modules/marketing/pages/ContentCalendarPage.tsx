/**
 * ContentCalendarPage
 * Full social media content calendar with post management
 */

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { ContentCalendar } from '../components/social/ContentCalendar';
import { SocialPostForm } from '../components/social/SocialPostForm';
import { PostScheduler } from '../components/social/PostScheduler';
import { useSocialPosts } from '../hooks/useSocialPosts';
import { useSocialAccounts } from '../hooks/useSocialAccounts';
import { POST_STATUSES, SOCIAL_PLATFORMS } from '../constants';
import type { SocialMediaPost, SocialPostFormData, PostStatus, SocialPlatform } from '../types';
import {
  Search,
  List,
  Calendar as CalendarIcon,
  MoreHorizontal,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';

const STATUS_ICONS: Record<PostStatus, typeof Clock> = {
  draft: FileText,
  scheduled: Clock,
  published: CheckCircle,
  failed: AlertCircle,
};

export default function ContentCalendarPage() {
  const { user } = useAuth();
  const { currentSubsidiary } = useSubsidiary();

  // State
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialMediaPost | undefined>();
  const [formInitialDate, setFormInitialDate] = useState<Date | undefined>();
  const [schedulerPost, setSchedulerPost] = useState<SocialMediaPost | null>(null);
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Date range for calendar data fetching
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };
  });

  const { posts, loading, error, create, update, changeStatus, schedule, remove } =
    useSocialPosts(
      user?.companyId,
      {
        status: statusFilter || undefined,
        platforms: platformFilter ? [platformFilter] : undefined,
        search: searchQuery || undefined,
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
      },
      user?.email || undefined,
      user?.displayName || user?.email || undefined,
      currentSubsidiary?.id
    );

  const { accounts } = useSocialAccounts(currentSubsidiary?.id, user?.email || undefined);

  const handleCreatePost = useCallback((date?: Date) => {
    setEditingPost(undefined);
    setFormInitialDate(date);
    setShowForm(true);
  }, []);

  const handleEditPost = useCallback((post: SocialMediaPost) => {
    setEditingPost(post);
    setFormInitialDate(undefined);
    setShowForm(true);
  }, []);

  const handleFormSubmit = useCallback(
    async (data: SocialPostFormData) => {
      if (editingPost) {
        await update(editingPost.id, data);
      } else {
        await create(data);
      }
    },
    [editingPost, create, update]
  );

  const handleNavigate = useCallback((start: Date, end: Date) => {
    setDateRange({ start, end });
  }, []);

  const handleDeletePost = useCallback(
    async (postId: string) => {
      if (window.confirm('Are you sure you want to delete this post?')) {
        await remove(postId);
      }
    },
    [remove]
  );

  // Stats
  const stats = useMemo(() => {
    const draft = posts.filter((p) => p.status === 'draft').length;
    const scheduled = posts.filter((p) => p.status === 'scheduled').length;
    const published = posts.filter((p) => p.status === 'published').length;
    const failed = posts.filter((p) => p.status === 'failed').length;
    return { draft, scheduled, published, failed, total: posts.length };
  }, [posts]);

  if (error) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error loading posts: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <p className="text-muted-foreground">
            Schedule and manage social media posts
            {currentSubsidiary && (
              <>
                {' '}for{' '}
                <span style={{ color: currentSubsidiary.color }} className="font-medium">
                  {currentSubsidiary.name}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowList(!showList)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
              showList
                ? 'bg-primary text-white border-primary'
                : 'text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <List className="h-4 w-4" /> List View
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatBadge label="Total" count={stats.total} color="text-gray-900" bg="bg-gray-100" />
        <StatBadge label="Drafts" count={stats.draft} color="text-gray-700" bg="bg-gray-50" />
        <StatBadge label="Scheduled" count={stats.scheduled} color="text-blue-700" bg="bg-blue-50" />
        <StatBadge label="Published" count={stats.published} color="text-green-700" bg="bg-green-50" />
        <StatBadge label="Failed" count={stats.failed} color="text-red-700" bg="bg-red-50" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PostStatus | '')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Statuses</option>
            {(Object.entries(POST_STATUSES) as [PostStatus, { label: string }][]).map(
              ([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as SocialPlatform | '')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Platforms</option>
            {(Object.entries(SOCIAL_PLATFORMS) as [SocialPlatform, { label: string }][]).map(
              ([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Calendar or List View */}
      {showList ? (
        <PostListView
          posts={posts}
          loading={loading}
          onEdit={handleEditPost}
          onDelete={handleDeletePost}
          onSchedule={(post) => setSchedulerPost(post)}
          onChangeStatus={changeStatus}
        />
      ) : (
        <ContentCalendar
          posts={posts}
          loading={loading}
          onDateSelect={(date) => handleCreatePost(date)}
          onPostClick={handleEditPost}
          onCreatePost={handleCreatePost}
          onNavigate={handleNavigate}
        />
      )}

      {/* Post Form Modal */}
      {showForm && (
        <SocialPostForm
          post={editingPost}
          initialDate={formInitialDate}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingPost(undefined);
            setFormInitialDate(undefined);
          }}
        />
      )}

      {/* Scheduler Popover */}
      {schedulerPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl">
            <PostScheduler
              postId={schedulerPost.id}
              currentDate={schedulerPost.scheduledFor?.toDate()}
              post={schedulerPost}
              accounts={accounts}
              onSchedule={schedule}
              onClose={() => setSchedulerPost(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function StatBadge({
  label,
  count,
  color,
  bg,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-lg px-3 py-2 text-center`}>
      <div className={`text-lg font-bold ${color}`}>{count}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function PostListView({
  posts,
  loading,
  onEdit,
  onDelete,
  onSchedule,
  onChangeStatus,
}: {
  posts: SocialMediaPost[];
  loading: boolean;
  onEdit: (p: SocialMediaPost) => void;
  onDelete: (id: string) => void;
  onSchedule: (p: SocialMediaPost) => void;
  onChangeStatus: (id: string, status: PostStatus) => void;
}) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900">No posts found</h3>
        <p className="text-gray-500 mt-1">Create your first post or adjust your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Post</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Platforms</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Scheduled</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {posts.map((post) => {
            const StatusIcon = STATUS_ICONS[post.status];
            const scheduled = post.scheduledFor?.toDate();

            return (
              <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <button onClick={() => onEdit(post)} className="text-left">
                    <div className="font-medium text-gray-900">{post.title}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[300px]">
                      {post.content}
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {post.platforms.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 text-[10px] font-medium text-white rounded-full"
                        style={{ backgroundColor: SOCIAL_PLATFORMS[p]?.color }}
                      >
                        {SOCIAL_PLATFORMS[p]?.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                      POST_STATUSES[post.status]?.color === 'gray'
                        ? 'bg-gray-100 text-gray-700'
                        : POST_STATUSES[post.status]?.color === 'blue'
                        ? 'bg-blue-100 text-blue-700'
                        : POST_STATUSES[post.status]?.color === 'green'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {POST_STATUSES[post.status]?.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {scheduled
                    ? scheduled.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 relative">
                    <button
                      onClick={() => onEdit(post)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => onSchedule(post)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Schedule"
                    >
                      <Clock className="h-4 w-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() =>
                        setMenuOpen(menuOpen === post.id ? null : post.id)
                      }
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4 text-gray-500" />
                    </button>

                    {menuOpen === post.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-40">
                        {post.status === 'draft' && (
                          <button
                            onClick={() => {
                              onChangeStatus(post.id, 'scheduled');
                              setMenuOpen(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Mark Scheduled
                          </button>
                        )}
                        {post.status === 'scheduled' && (
                          <button
                            onClick={() => {
                              onChangeStatus(post.id, 'published');
                              setMenuOpen(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Mark Published
                          </button>
                        )}
                        <button
                          onClick={() => {
                            onDelete(post.id);
                            setMenuOpen(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          <span className="flex items-center gap-2">
                            <Trash2 className="h-3 w-3" /> Delete
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
