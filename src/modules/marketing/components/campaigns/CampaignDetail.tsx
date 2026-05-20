/**
 * CampaignDetail Component
 * Campaign-as-project hub with tabs: Overview, Tasks, Key Dates & Content
 * Campaigns are the central unit — key dates, AI content, calendar, and media feed in/out.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Users, MessageSquare, TrendingUp,
  CheckCircle, CheckCircle2, Circle, Clock, AlertCircle, Edit, PlusCircle,
  Loader2, CalendarDays, Bot, Tag, Trash2, Image, Link2, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/core/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useCampaign, useCampaignSends } from '../../hooks';
import { CampaignMetrics } from './CampaignMetrics';
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS } from '../../constants';
import { getKeyDates } from '../../services/marketingAgentService';
import {
  getMarketingTasks,
  createMarketingTask,
  updateTaskStatus,
  deleteMarketingTask,
} from '../../services/marketingTaskService';
import type { CampaignSend } from '../../types';
import type { MarketingKeyDate } from '../../types/marketing-agent.types';
import type { MarketingTask, MarketingTaskStatus } from '../../types/marketing-task.types';
import { TASK_STATUS_CONFIG } from '../../types/marketing-task.types';

type TabId = 'overview' | 'tasks' | 'connections';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'connections', label: 'Key Dates & Content' },
];

const SEND_STATUS_CONFIG = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Clock },
  sent: { bg: 'bg-blue-100', text: 'text-blue-800', icon: MessageSquare },
  delivered: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  failed: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle },
  read: { bg: 'bg-purple-100', text: 'text-purple-800', icon: CheckCircle },
  replied: { bg: 'bg-orange-100', text: 'text-orange-800', icon: MessageSquare },
};

export function CampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyId = (user as any)?.companyId || user?.uid || '';
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showSends, setShowSends] = useState(false);

  const { campaign, loading: campaignLoading, error: campaignError } = useCampaign(campaignId);
  const { sends, loading: sendsLoading, error: sendsError } = useCampaignSends(
    showSends ? campaignId : undefined,
    100
  );

  // Campaign tasks
  const [tasks, setTasks] = useState<MarketingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // Linked key dates
  const [keyDates, setKeyDates] = useState<MarketingKeyDate[]>([]);
  const [keyDatesLoading, setKeyDatesLoading] = useState(false);

  // Load tasks scoped to this campaign
  const loadTasks = useCallback(async () => {
    if (!companyId || !campaignId) return;
    setTasksLoading(true);
    try {
      const t = await getMarketingTasks(companyId, { linkedCampaignId: campaignId });
      setTasks(t);
    } catch (err) {
      console.error('Failed to load campaign tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  }, [companyId, campaignId]);

  // Load linked key dates
  const loadKeyDates = useCallback(async () => {
    if (!companyId || !campaign) return;
    setKeyDatesLoading(true);
    try {
      const allDates = await getKeyDates(companyId);
      // Filter to dates linked to this campaign
      const linked = allDates.filter(
        (d) => d.linkedCampaignIds?.includes(campaignId || '')
      );
      setKeyDates(linked);
    } catch (err) {
      console.error('Failed to load key dates:', err);
    } finally {
      setKeyDatesLoading(false);
    }
  }, [companyId, campaignId, campaign]);

  useEffect(() => {
    if (campaign) {
      loadTasks();
      loadKeyDates();
    }
  }, [campaign, loadTasks, loadKeyDates]);

  // Add task
  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !companyId || !campaignId || !campaign) return;
    setAddingTask(true);
    try {
      await createMarketingTask(
        companyId,
        {
          title: newTaskTitle.trim(),
          description: `Task for campaign: ${campaign.name}`,
          taskType: 'general',
          priority: 'medium',
          source: 'campaign',
          sourceId: campaignId,
          sourceName: campaign.name,
          linkedCampaignId: campaignId,
          linkedCampaignName: campaign.name,
          tags: ['campaign'],
        },
        user?.uid || '',
        user?.displayName || 'Unknown'
      );
      setNewTaskTitle('');
      await loadTasks();
    } finally {
      setAddingTask(false);
    }
  };

  // Toggle task status
  const handleTaskToggle = async (taskId: string, currentStatus: MarketingTaskStatus) => {
    const next: MarketingTaskStatus = currentStatus === 'done' ? 'todo' : 'done';
    await updateTaskStatus(taskId, next);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: next } : t))
    );
  };

  // Cycle task status
  const handleTaskStatusCycle = async (taskId: string, current: MarketingTaskStatus) => {
    const order: MarketingTaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    await updateTaskStatus(taskId, next);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: next } : t))
    );
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    await deleteMarketingTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Error loading campaign: {campaignError?.message || 'Campaign not found'}
      </div>
    );
  }

  const startDate = campaign.scheduledStartDate?.toDate();
  const endDate = campaign.scheduledEndDate?.toDate();
  const createdDate = campaign.createdAt?.toDate();

  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/marketing/campaigns')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500">
                {CAMPAIGN_TYPE_LABELS[campaign.campaignType]?.label}
              </span>
              <span className="text-sm text-gray-300">•</span>
              <span className="text-sm text-gray-500">
                {CAMPAIGN_STATUS_LABELS[campaign.status]?.label}
              </span>
              {totalTasks > 0 && (
                <>
                  <span className="text-sm text-gray-300">•</span>
                  <span className="text-sm text-gray-500">
                    {completedTasks}/{totalTasks} tasks done
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(`/marketing/campaigns/${campaignId}/edit`)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Edit className="h-4 w-4" />
          Edit Campaign
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {tab.id === 'tasks' && totalTasks > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {totalTasks}
                </span>
              )}
              {tab.id === 'connections' && keyDates.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {keyDates.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* === OVERVIEW TAB === */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Description */}
          {campaign.description && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-gray-700">{campaign.description}</p>
            </div>
          )}

          {/* Campaign Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Schedule</span>
              </div>
              {startDate ? (
                <div className="text-sm text-gray-700">
                  <div>Start: {startDate.toLocaleDateString()}</div>
                  {endDate && <div>End: {endDate.toLocaleDateString()}</div>}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Not scheduled</div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Target Audience</span>
              </div>
              <div className="text-sm text-gray-700">
                <div>Estimated: {campaign.estimatedReach.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {campaign.targetAudience.segmentType === 'all' ? 'All customers' : campaign.targetAudience.segmentType === 'filters' ? 'Filtered segment' : 'Custom segment'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Created</span>
              </div>
              <div className="text-sm text-gray-700">
                {createdDate?.toLocaleString() || 'Unknown'}
              </div>
            </div>
          </div>

          {/* Task progress summary */}
          {totalTasks > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Task Progress</span>
                <span className="text-sm text-muted-foreground">{taskProgress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>{tasks.filter((t) => t.status === 'todo').length} to do</span>
                <span>{tasks.filter((t) => t.status === 'in_progress').length} in progress</span>
                <span>{tasks.filter((t) => t.status === 'review').length} review</span>
                <span>{completedTasks} done</span>
              </div>
            </div>
          )}

          {/* Metrics */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h2>
            <CampaignMetrics
              metrics={campaign.metrics}
              campaignType={campaign.campaignType}
              showROI={!!campaign.budget}
            />
          </div>

          {/* WhatsApp Configuration */}
          {campaign.whatsappConfig && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">WhatsApp Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Template</div>
                  <div className="font-medium text-gray-900">{campaign.whatsappConfig.templateName}</div>
                </div>
                <div>
                  <div className="text-gray-500">Send Rate</div>
                  <div className="font-medium text-gray-900">
                    {campaign.whatsappConfig.sendRate === 'immediate' ? 'Immediate' : 'Throttled'}
                    {campaign.whatsappConfig.throttleConfig &&
                      ` (${campaign.whatsappConfig.throttleConfig.messagesPerMinute}/min)`
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Goals */}
          {campaign.goals && campaign.goals.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Campaign Goals</h3>
              <div className="space-y-2">
                {campaign.goals.map((goal, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-700">{goal.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      Target: {goal.targetValue.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campaign Sends */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={() => setShowSends(!showSends)}
                className="flex items-center justify-between w-full"
              >
                <h3 className="text-sm font-semibold text-gray-900">
                  Campaign Sends ({campaign.metrics.totalSent.toLocaleString()})
                </h3>
                <span className="text-sm text-primary">
                  {showSends ? 'Hide' : 'Show'} Details
                </span>
              </button>
            </div>

            {showSends && (
              <div className="p-4">
                {sendsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : sendsError ? (
                  <div className="text-sm text-red-600 py-4">
                    Error loading sends: {sendsError.message}
                  </div>
                ) : sends.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center">
                    No sends recorded yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {sends.map((send) => (
                      <SendItem key={send.id} send={send} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TASKS TAB === */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Campaign Tasks</h2>
          </div>

          {/* Task progress */}
          {totalTasks > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {completedTasks}/{totalTasks}
              </span>
            </div>
          )}

          {/* Add task */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a task to this campaign..."
              className="flex-1 text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            />
            <Button onClick={handleAddTask} disabled={!newTaskTitle.trim() || addingTask} size="sm">
              {addingTask ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <PlusCircle className="h-4 w-4 mr-1" /> Add
                </>
              )}
            </Button>
          </div>

          {/* Task list by status groups */}
          {tasksLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tasks yet. Add tasks to track work for this campaign.</p>
              <p className="text-xs mt-1">
                You can also create tasks from{' '}
                <button
                  onClick={() => setActiveTab('connections')}
                  className="text-primary hover:underline"
                >
                  linked key dates
                </button>.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {(['todo', 'in_progress', 'review', 'done'] as MarketingTaskStatus[]).map((status) => {
                const group = tasks.filter((t) => t.status === status);
                if (group.length === 0) return null;
                const conf = TASK_STATUS_CONFIG[status];
                return (
                  <div key={status} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', conf.color)}>
                        {conf.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{group.length}</span>
                    </div>
                    <div className="space-y-1">
                      {group.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg border bg-white hover:shadow-sm group transition-shadow"
                        >
                          <button
                            onClick={() => handleTaskToggle(task.id, task.status)}
                            className="flex-shrink-0"
                          >
                            {task.status === 'done' ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span
                              className={cn(
                                'text-sm',
                                task.status === 'done' && 'line-through text-muted-foreground'
                              )}
                            >
                              {task.title}
                            </span>
                            {task.linkedKeyDateName && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                from {task.linkedKeyDateName}
                              </span>
                            )}
                          </div>
                          {task.dueDate && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {task.dueDate.toDate().toLocaleDateString()}
                            </span>
                          )}
                          <button
                            onClick={() => handleTaskStatusCycle(task.id, task.status)}
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80',
                              conf.color
                            )}
                            title="Click to advance status"
                          >
                            {conf.label}
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === KEY DATES & CONTENT TAB === */}
      {activeTab === 'connections' && (
        <div className="space-y-6">
          {/* Linked Key Dates */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Linked Key Dates
              </h3>
              <Link
                to="/marketing/agent?tab=dates"
                className="text-xs text-primary hover:underline"
              >
                Discover Dates
              </Link>
            </div>
            {keyDatesLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : keyDates.length > 0 ? (
              <div className="space-y-3">
                {keyDates.map((kd) => {
                  const dateStr = kd.date?.toDate?.()?.toLocaleDateString() || 'N/A';
                  return (
                    <Link
                      key={kd.id}
                      to={`/marketing/key-dates/${kd.id}`}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 group transition-colors"
                    >
                      <CalendarDays className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{kd.name}</p>
                        <p className="text-xs text-muted-foreground">{dateStr}</p>
                        {kd.suggestedContentThemes?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {kd.suggestedContentThemes.slice(0, 3).map((t, i) => (
                              <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No key dates linked to this campaign yet. Link dates from the{' '}
                <Link to="/marketing/agent?tab=dates" className="text-primary hover:underline">
                  AI Agent
                </Link>{' '}
                key dates panel.
              </p>
            )}
          </div>

          {/* Quick Links to other features */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Link2 className="h-4 w-4" /> Cross-Feature Links
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                to={`/marketing/agent?tab=generate&campaignId=${campaignId}&topic=${encodeURIComponent(campaign.name)}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <Bot className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-sm font-medium">Generate AI Content</p>
                  <p className="text-xs text-muted-foreground">Create posts for this campaign</p>
                </div>
              </Link>
              <Link
                to={`/marketing/calendar?campaign=${campaignId}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Content Calendar</p>
                  <p className="text-xs text-muted-foreground">View scheduled content</p>
                </div>
              </Link>
              <Link
                to="/marketing/templates"
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <Tag className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Templates</p>
                  <p className="text-xs text-muted-foreground">Use or create templates</p>
                </div>
              </Link>
              <Link
                to="/marketing/media"
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <Image className="h-5 w-5 text-pink-500" />
                <div>
                  <p className="text-sm font-medium">Media Library</p>
                  <p className="text-xs text-muted-foreground">Attach images &amp; assets</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Tags */}
          {campaign.tags && campaign.tags.length > 0 && (
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-sm mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {campaign.tags.map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SendItem({ send }: { send: CampaignSend }) {
  const statusConfig = SEND_STATUS_CONFIG[send.status];
  const StatusIcon = statusConfig.icon;
  const sentDate = send.sentAt?.toDate();

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {send.customerName || send.phoneNumber}
          </span>
          <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
            <StatusIcon className="h-3 w-3" />
            {send.status}
          </span>
        </div>
        {sentDate && (
          <div className="text-xs text-gray-500 mt-1">
            {sentDate.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default CampaignDetail;
