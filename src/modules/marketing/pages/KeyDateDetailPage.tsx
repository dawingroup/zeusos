/**
 * Key Date Detail Page
 * Full detail view for a marketing key date with linked tasks, campaigns, and actions
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  MapPin,
  Tag,
  Clock,
  CheckCircle2,
  Circle,
  PlusCircle,
  Megaphone,
  Link2,
  ExternalLink,
  Trash2,
  Edit3,
  Save,
  X,
  Loader2,
  Bot,
  ClipboardList,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/core/components/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  getKeyDate,
  updateKeyDate,
  acknowledgeKeyDate,
  markContentPlanned,
  deleteKeyDate,
} from '../services/marketingAgentService';
import {
  getMarketingTasks,
  createMarketingTask,
  updateTaskStatus,
} from '../services/marketingTaskService';
import { getCampaigns } from '../services/campaignService';
import type { MarketingKeyDate } from '../types/marketing-agent.types';
import type { MarketingTask, MarketingTaskStatus } from '../types/marketing-task.types';
import type { MarketingCampaign } from '../types/campaign.types';
import { TASK_STATUS_CONFIG } from '../types/marketing-task.types';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  holiday: { label: 'Holiday', color: 'bg-purple-100 text-purple-700' },
  industry_event: { label: 'Industry Event', color: 'bg-blue-100 text-blue-700' },
  seasonal: { label: 'Seasonal', color: 'bg-green-100 text-green-700' },
  company_milestone: { label: 'Company Milestone', color: 'bg-amber-100 text-amber-700' },
  product_launch: { label: 'Product Launch', color: 'bg-pink-100 text-pink-700' },
  cultural: { label: 'Cultural', color: 'bg-indigo-100 text-indigo-700' },
  sales_event: { label: 'Sales Event', color: 'bg-red-100 text-red-700' },
  custom: { label: 'Custom', color: 'bg-slate-100 text-slate-700' },
};

export default function KeyDateDetailPage() {
  const { dateId } = useParams<{ dateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyId = (user as any)?.companyId || user?.uid || '';

  const [keyDate, setKeyDate] = useState<MarketingKeyDate | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<MarketingTask[]>([]);
  const [linkedCampaigns, setLinkedCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [creatingTasksFromActions, setCreatingTasksFromActions] = useState(false);

  // Load key date and related data
  const loadData = useCallback(async () => {
    if (!dateId || !companyId) return;
    setLoading(true);
    try {
      const [kd, tasks, campaigns] = await Promise.all([
        getKeyDate(dateId),
        getMarketingTasks(companyId, { linkedKeyDateId: dateId }),
        getCampaigns(companyId),
      ]);
      setKeyDate(kd);
      setLinkedTasks(tasks);
      // Filter campaigns linked to this key date
      if (kd) {
        const linked = campaigns.filter((c) => kd.linkedCampaignIds?.includes(c.id));
        setLinkedCampaigns(linked);
      }
    } catch (err) {
      console.error('Failed to load key date:', err);
    } finally {
      setLoading(false);
    }
  }, [dateId, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format date
  const formatDate = (ts: Timestamp) => {
    try {
      return ts.toDate().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Unknown date';
    }
  };

  // Days until
  const getDaysUntil = (ts: Timestamp) => {
    const now = new Date();
    const date = ts.toDate();
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Acknowledge
  const handleAcknowledge = async () => {
    if (!dateId) return;
    await acknowledgeKeyDate(dateId);
    setKeyDate((prev) => prev ? { ...prev, acknowledged: true } : null);
  };

  // Mark content planned
  const handleMarkContentPlanned = async () => {
    if (!dateId) return;
    await markContentPlanned(dateId);
    setKeyDate((prev) => prev ? { ...prev, contentPlanned: true } : null);
  };

  // Delete
  const handleDelete = async () => {
    if (!dateId || !confirm('Delete this key date?')) return;
    await deleteKeyDate(dateId);
    navigate('/marketing/agent', { replace: true });
  };

  // Create tasks from suggested actions
  const handleCreateTasksFromActions = async () => {
    if (!keyDate || !dateId || !companyId) return;
    setCreatingTasksFromActions(true);
    try {
      const dueDate = new Date(keyDate.date.toDate());
      dueDate.setDate(dueDate.getDate() - (keyDate.leadTimeDays || 14));

      for (const action of keyDate.suggestedActions) {
        await createMarketingTask(
          companyId,
          {
            title: action,
            description: `Task for key date: ${keyDate.name}`,
            taskType: 'event_prep',
            priority: 'medium',
            dueDate,
            source: 'key_date',
            sourceId: dateId,
            sourceName: keyDate.name,
            linkedKeyDateId: dateId,
            linkedKeyDateName: keyDate.name,
            tags: ['auto-generated', 'key-date'],
          },
          user?.uid || '',
          user?.displayName || 'Unknown'
        );
      }
      await loadData();
    } finally {
      setCreatingTasksFromActions(false);
    }
  };

  // Add single task
  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !dateId || !keyDate || !companyId) return;
    setAddingTask(true);
    try {
      await createMarketingTask(
        companyId,
        {
          title: newTaskTitle.trim(),
          description: `Task for key date: ${keyDate.name}`,
          taskType: 'general',
          priority: 'medium',
          source: 'key_date',
          sourceId: dateId,
          sourceName: keyDate.name,
          linkedKeyDateId: dateId,
          linkedKeyDateName: keyDate.name,
          tags: ['key-date'],
        },
        user?.uid || '',
        user?.displayName || 'Unknown'
      );
      setNewTaskTitle('');
      await loadData();
    } finally {
      setAddingTask(false);
    }
  };

  // Change task status
  const handleTaskStatusChange = async (taskId: string, status: MarketingTaskStatus) => {
    await updateTaskStatus(taskId, status);
    setLinkedTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
  };

  // Save description edit
  const handleSaveNotes = async () => {
    if (!dateId) return;
    await updateKeyDate(dateId, { description: editNotes } as any);
    setKeyDate((prev) => prev ? { ...prev, description: editNotes } : null);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!keyDate) {
    return (
      <div>
        <div className="text-center py-16">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Key Date Not Found</h2>
          <p className="text-muted-foreground mb-6">This key date may have been deleted.</p>
          <Button onClick={() => navigate('/marketing/agent')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to AI Agent
          </Button>
        </div>
      </div>
    );
  }

  const daysUntil = getDaysUntil(keyDate.date);
  const isUpcoming = daysUntil > 0 && daysUntil <= keyDate.leadTimeDays;
  const isPast = daysUntil < 0;
  const catConfig = CATEGORY_LABELS[keyDate.category] || CATEGORY_LABELS.custom;

  const completedTasks = linkedTasks.filter((t) => t.status === 'done').length;
  const totalTasks = linkedTasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', catConfig.color)}>
              {catConfig.label}
            </span>
            {keyDate.source === 'ai_generated' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700">
                <Bot className="h-3 w-3" /> AI Discovered
              </span>
            )}
            {isUpcoming && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
                Prep Time — {daysUntil} days left
              </span>
            )}
            {isPast && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                Past
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold">{keyDate.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Date & Details Card */}
          <div className="border rounded-lg p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{formatDate(keyDate.date)}</span>
                </div>
              </div>
              {keyDate.endDate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">End Date</p>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDate(keyDate.endDate)}</span>
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Lead Time</p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{keyDate.leadTimeDays} days</span>
                </div>
              </div>
              {keyDate.region && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Region</p>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{keyDate.region}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Relevance Score */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Relevance Score</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      keyDate.relevanceScore >= 80
                        ? 'bg-green-500'
                        : keyDate.relevanceScore >= 60
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    )}
                    style={{ width: `${keyDate.relevanceScore}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{keyDate.relevanceScore}/100</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Description</p>
                {!editing && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => { setEditing(true); setEditNotes(keyDate.description); }}
                  >
                    <Edit3 className="h-3 w-3 inline mr-1" />Edit
                  </button>
                )}
              </div>
              {editing ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full border rounded-md p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNotes}>
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{keyDate.description}</p>
              )}
            </div>
          </div>

          {/* Suggested Actions */}
          <div className="border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" /> Suggested Actions
              </h3>
              {keyDate.suggestedActions.length > 0 && linkedTasks.length === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateTasksFromActions}
                  disabled={creatingTasksFromActions}
                >
                  {creatingTasksFromActions ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <PlusCircle className="h-3 w-3 mr-1" />
                  )}
                  Create All as Tasks
                </Button>
              )}
            </div>
            {keyDate.suggestedActions.length > 0 ? (
              <ul className="space-y-2">
                {keyDate.suggestedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No suggested actions yet.</p>
            )}
          </div>

          {/* Content Themes */}
          <div className="border rounded-lg p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-primary" /> Suggested Content Themes
            </h3>
            {keyDate.suggestedContentThemes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {keyDate.suggestedContentThemes.map((theme, i) => (
                  <Link
                    key={i}
                    to={`/marketing/agent?tab=generate&topic=${encodeURIComponent(theme)}`}
                    className="px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {theme}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No content themes suggested.</p>
            )}
          </div>

          {/* Linked Tasks */}
          <div className="border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Tasks
                {totalTasks > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    {completedTasks}/{totalTasks} done
                  </span>
                )}
              </h3>
              <Link to="/marketing/tasks" className="text-xs text-primary hover:underline">
                View All Tasks
              </Link>
            </div>

            {/* Task progress bar */}
            {totalTasks > 0 && (
              <div className="mb-4">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Task list */}
            {linkedTasks.length > 0 ? (
              <div className="space-y-2">
                {linkedTasks.map((task) => {
                  const statusConf = TASK_STATUS_CONFIG[task.status];
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group"
                    >
                      <button
                        onClick={() =>
                          handleTaskStatusChange(
                            task.id,
                            task.status === 'done' ? 'todo' : 'done'
                          )
                        }
                        className="flex-shrink-0"
                      >
                        {task.status === 'done' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                        )}
                      </button>
                      <Link
                        to={`/marketing/tasks?task=${task.id}`}
                        className={cn(
                          'flex-1 text-sm',
                          task.status === 'done' && 'line-through text-muted-foreground'
                        )}
                      >
                        {task.title}
                      </Link>
                      <span className={cn('px-2 py-0.5 rounded text-xs', statusConf.color)}>
                        {statusConf.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">No tasks yet.</p>
            )}

            {/* Add task inline */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <input
                type="text"
                placeholder="Add a task..."
                className="flex-1 text-sm border rounded-md px-3 py-1.5 focus:ring-2 focus:ring-primary focus:border-transparent"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <Button size="sm" onClick={handleAddTask} disabled={!newTaskTitle.trim() || addingTask}>
                {addingTask ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <PlusCircle className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-sm">Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Acknowledged</span>
                {keyDate.acknowledged ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" /> Yes
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleAcknowledge}>
                    Acknowledge
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Content Planned</span>
                {keyDate.contentPlanned ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" /> Yes
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleMarkContentPlanned}>
                    Mark Planned
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Days Until</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isPast ? 'text-muted-foreground' : isUpcoming ? 'text-amber-600' : 'text-foreground'
                  )}
                >
                  {isPast ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days`}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border rounded-lg p-5 space-y-3">
            <h3 className="font-semibold text-sm">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                to={`/marketing/agent?tab=generate&topic=${encodeURIComponent(keyDate.name)}&keyDateId=${dateId}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Edit3 className="h-4 w-4" /> Generate Content for this Date
              </Link>
              <Link
                to={`/marketing/campaigns/new?keyDateId=${dateId}&keyDateName=${encodeURIComponent(keyDate.name)}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Megaphone className="h-4 w-4" /> Create Campaign
              </Link>
              <Link
                to={`/marketing/calendar?date=${keyDate.date.toDate().toISOString().slice(0, 10)}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <CalendarDays className="h-4 w-4" /> View on Calendar
              </Link>
              <Link
                to="/marketing/tasks"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ClipboardList className="h-4 w-4" /> Task Tracker
              </Link>
            </div>
          </div>

          {/* Linked Campaigns */}
          <div className="border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Linked Campaigns
              </h3>
            </div>
            {linkedCampaigns.length > 0 ? (
              <div className="space-y-2">
                {linkedCampaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    to={`/marketing/campaigns/${campaign.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-sm group"
                  >
                    <Megaphone className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{campaign.name}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No campaigns linked yet.{' '}
                <Link
                  to={`/marketing/campaigns/new?keyDateId=${dateId}&keyDateName=${encodeURIComponent(keyDate.name)}`}
                  className="text-primary hover:underline"
                >
                  Create one
                </Link>
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="border rounded-lg p-5 space-y-2">
            <h3 className="font-semibold text-sm">Metadata</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Source: {keyDate.source === 'ai_generated' ? 'AI Generated' : keyDate.source === 'system' ? 'System' : 'Manual'}</p>
              {keyDate.aiConfidence && (
                <p>AI Confidence: {Math.round(keyDate.aiConfidence * 100)}%</p>
              )}
              <p>Recurring: {keyDate.isRecurring ? 'Yes' : 'No'}</p>
              {keyDate.recurrencePattern && <p>Pattern: {keyDate.recurrencePattern}</p>}
              <p>Created: {keyDate.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
