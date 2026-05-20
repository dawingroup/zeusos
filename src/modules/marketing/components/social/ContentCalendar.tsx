/**
 * ContentCalendar Component
 * Monthly and weekly calendar views for social media posts
 */

import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { SocialMediaPost, CalendarView, PostStatus, SocialPlatform } from '../../types';
import { SOCIAL_PLATFORMS, POST_STATUSES } from '../../constants';

interface ContentCalendarProps {
  posts: SocialMediaPost[];
  loading: boolean;
  onDateSelect: (date: Date) => void;
  onPostClick: (post: SocialMediaPost) => void;
  onCreatePost: (date?: Date) => void;
  onNavigate: (startDate: Date, endDate: Date) => void;
}

const POST_STATUS_ICONS: Record<PostStatus, typeof Clock> = {
  draft: FileText,
  scheduled: Clock,
  published: CheckCircle,
  failed: AlertCircle,
};

const POST_STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'border-l-gray-400 bg-gray-50',
  scheduled: 'border-l-blue-500 bg-blue-50',
  published: 'border-l-green-500 bg-green-50',
  failed: 'border-l-red-500 bg-red-50',
};

function PlatformDots({ platforms }: { platforms: SocialPlatform[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {platforms.map((p) => (
        <span
          key={p}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: SOCIAL_PLATFORMS[p]?.color || '#999' }}
          title={SOCIAL_PLATFORMS[p]?.label}
        />
      ))}
    </div>
  );
}

export function ContentCalendar({
  posts,
  loading,
  onDateSelect,
  onPostClick,
  onCreatePost,
  onNavigate,
}: ContentCalendarProps) {
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Month view helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonthDays = new Date(year, month, 0).getDate();
  const totalSlots = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  // Week view helpers
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Map posts to dates
  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialMediaPost[]>();
    posts.forEach((post) => {
      const date = post.scheduledFor?.toDate() || post.createdAt?.toDate();
      if (date) {
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(post);
      }
    });
    return map;
  }, [posts]);

  function getPostsForDate(date: Date): SocialMediaPost[] {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return postsByDate.get(key) || [];
  }

  function navigate(direction: -1 | 1) {
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(next.getMonth() + direction);
    } else {
      next.setDate(next.getDate() + direction * 7);
    }
    setCurrentDate(next);

    // Notify parent about the new range for data fetching
    if (view === 'month') {
      const start = new Date(next.getFullYear(), next.getMonth(), 1);
      const end = new Date(next.getFullYear(), next.getMonth() + 1, 0, 23, 59, 59);
      onNavigate(start, end);
    } else {
      const start = new Date(next);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59);
      onNavigate(start, end);
    }
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function isToday(date: Date): boolean {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  const headerLabel =
    view === 'month'
      ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `Week of ${weekStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
            {headerLabel}
          </h2>
          <button
            onClick={() => navigate(1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {(['month', 'week'] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm capitalize ${
                  view === v
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={() => onCreatePost()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            <Plus className="h-4 w-4" /> New Post
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}

      {/* Calendar Grid */}
      {view === 'month' ? (
        <MonthView
          year={year}
          month={month}
          daysInMonth={daysInMonth}
          firstDayOfWeek={firstDayOfWeek}
          prevMonthDays={prevMonthDays}
          totalSlots={totalSlots}
          isToday={isToday}
          getPostsForDate={getPostsForDate}
          onDateSelect={onDateSelect}
          onPostClick={onPostClick}
          onCreatePost={onCreatePost}
        />
      ) : (
        <WeekView
          weekDays={weekDays}
          isToday={isToday}
          getPostsForDate={getPostsForDate}
          onDateSelect={onDateSelect}
          onPostClick={onPostClick}
          onCreatePost={onCreatePost}
        />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-200">
        <span className="font-medium">Status:</span>
        {(Object.entries(POST_STATUSES) as [PostStatus, { label: string }][]).map(([key, { label }]) => {
          const Icon = POST_STATUS_ICONS[key];
          return (
            <span key={key} className="flex items-center gap-1">
              <Icon className="h-3 w-3" /> {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ====================================================
// Month View
// ====================================================

interface MonthViewProps {
  year: number;
  month: number;
  daysInMonth: number;
  firstDayOfWeek: number;
  prevMonthDays: number;
  totalSlots: number;
  isToday: (d: Date) => boolean;
  getPostsForDate: (d: Date) => SocialMediaPost[];
  onDateSelect: (d: Date) => void;
  onPostClick: (p: SocialMediaPost) => void;
  onCreatePost: (d?: Date) => void;
}

function MonthView({
  year,
  month,
  daysInMonth,
  firstDayOfWeek,
  prevMonthDays,
  totalSlots,
  isToday,
  getPostsForDate,
  onDateSelect,
  onPostClick,
  onCreatePost,
}: MonthViewProps) {
  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const cells = Array.from({ length: totalSlots }, (_, i) => {
    const dayOffset = i - firstDayOfWeek;
    const day = dayOffset + 1;

    if (dayOffset < 0) {
      // Previous month
      return {
        date: new Date(year, month - 1, prevMonthDays + day),
        isCurrentMonth: false,
      };
    }
    if (day > daysInMonth) {
      // Next month
      return {
        date: new Date(year, month + 1, day - daysInMonth),
        isCurrentMonth: false,
      };
    }
    return { date: new Date(year, month, day), isCurrentMonth: true };
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-semibold text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map(({ date, isCurrentMonth }, i) => {
          const dayPosts = getPostsForDate(date);
          const todayCell = isToday(date);

          return (
            <div
              key={i}
              onClick={() => onDateSelect(date)}
              className={`min-h-[100px] p-1.5 border-b border-r border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                !isCurrentMonth ? 'bg-gray-50/50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    todayCell
                      ? 'bg-primary text-white'
                      : isCurrentMonth
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  {date.getDate()}
                </span>
                {isCurrentMonth && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const d = new Date(date);
                      d.setHours(9, 0, 0, 0);
                      onCreatePost(d);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:!opacity-100 p-0.5 hover:bg-gray-200 rounded transition-all [div:hover>&]:opacity-100"
                  >
                    <Plus className="h-3 w-3 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Post pills */}
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map((post) => {
                  const statusColor = POST_STATUS_COLORS[post.status];
                  return (
                    <button
                      key={post.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPostClick(post);
                      }}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight truncate border-l-2 ${statusColor} hover:brightness-95 transition-colors`}
                      title={post.title}
                    >
                      <div className="flex items-center gap-1">
                        <PlatformDots platforms={post.platforms} />
                        <span className="truncate">{post.title}</span>
                      </div>
                    </button>
                  );
                })}
                {dayPosts.length > 3 && (
                  <div className="text-[10px] text-gray-500 px-1.5">
                    +{dayPosts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ====================================================
// Week View
// ====================================================

interface WeekViewProps {
  weekDays: Date[];
  isToday: (d: Date) => boolean;
  getPostsForDate: (d: Date) => SocialMediaPost[];
  onDateSelect: (d: Date) => void;
  onPostClick: (p: SocialMediaPost) => void;
  onCreatePost: (d?: Date) => void;
}

function WeekView({
  weekDays,
  isToday,
  getPostsForDate,
  onDateSelect: _onDateSelect,
  onPostClick,
  onCreatePost,
}: WeekViewProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-gray-200">
        {weekDays.map((date) => {
          const dayPosts = getPostsForDate(date);
          const todayCell = isToday(date);

          return (
            <div key={date.toISOString()} className="min-h-[300px]">
              {/* Day header */}
              <div
                className={`p-3 border-b border-gray-200 text-center ${
                  todayCell ? 'bg-primary/5' : 'bg-gray-50'
                }`}
              >
                <div className="text-xs text-gray-500 uppercase">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div
                  className={`text-lg font-semibold mt-0.5 ${
                    todayCell ? 'text-primary' : 'text-gray-900'
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>

              {/* Posts */}
              <div className="p-2 space-y-2">
                <button
                  onClick={() => {
                    const d = new Date(date);
                    d.setHours(9, 0, 0, 0);
                    onCreatePost(d);
                  }}
                  className="w-full flex items-center justify-center gap-1 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:border-primary hover:text-primary transition-all"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>

                {dayPosts.map((post) => {
                  const StatusIcon = POST_STATUS_ICONS[post.status];
                  const time = post.scheduledFor?.toDate();

                  return (
                    <button
                      key={post.id}
                      onClick={() => onPostClick(post)}
                      className={`w-full text-left p-2 rounded-lg border-l-2 ${POST_STATUS_COLORS[post.status]} hover:brightness-95 transition-colors`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {post.title}
                          </p>
                          {time && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {time.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                        <StatusIcon className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                      </div>
                      <div className="mt-1">
                        <PlatformDots platforms={post.platforms} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ContentCalendar;
