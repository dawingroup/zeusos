/**
 * Sales Activities Page
 * Activity log and timeline — aggregates manual logs and auto-generated events
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Search, Phone, Mail, Users, MapPin, StickyNote, Send, CheckCircle, XCircle, ArrowRight, FolderPlus, Wrench, DollarSign, CheckSquare, Presentation, FileEdit, BadgeCheck, FileX, Undo2 } from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { Timestamp } from 'firebase/firestore';
import { fetchAllActivities, logActivity } from '../services/crmActivityService';
import { ACTIVITY_TYPE_LABELS } from '../constants/crm.constants';
import { resolveContactPerson } from '@/modules/customer-hub/types/customerContact';
import type { CRMActivity, CRMActivityType, CRMActivitySource } from '../types';

const ACTIVITY_TYPE_ICONS: Record<CRMActivityType, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  site_visit: MapPin,
  presentation: Presentation,
  note: StickyNote,
  quote_sent: Send,
  quote_approved: CheckCircle,
  quote_rejected: XCircle,
  stage_change: ArrowRight,
  project_created: FolderPlus,
  manufacturing_update: Wrench,
  payment_received: DollarSign,
  task_completed: CheckSquare,
  change_order_requested: FileEdit,
  change_order_submitted_to_client: Send,
  change_order_approved: BadgeCheck,
  change_order_rejected: FileX,
  change_order_withdrawn: Undo2,
};

const ACTIVITY_TYPE_COLORS: Record<CRMActivityType, string> = {
  call: 'bg-blue-100 text-blue-600',
  email: 'bg-indigo-100 text-indigo-600',
  meeting: 'bg-purple-100 text-purple-600',
  site_visit: 'bg-amber-100 text-amber-600',
  presentation: 'bg-pink-100 text-pink-600',
  note: 'bg-gray-100 text-gray-600',
  quote_sent: 'bg-cyan-100 text-cyan-600',
  quote_approved: 'bg-green-100 text-green-600',
  quote_rejected: 'bg-red-100 text-red-600',
  stage_change: 'bg-orange-100 text-orange-600',
  project_created: 'bg-teal-100 text-teal-600',
  manufacturing_update: 'bg-yellow-100 text-yellow-700',
  payment_received: 'bg-emerald-100 text-emerald-600',
  task_completed: 'bg-lime-100 text-lime-700',
  change_order_requested: 'bg-sky-100 text-sky-600',
  change_order_submitted_to_client: 'bg-violet-100 text-violet-600',
  change_order_approved: 'bg-emerald-100 text-emerald-700',
  change_order_rejected: 'bg-rose-100 text-rose-600',
  change_order_withdrawn: 'bg-slate-100 text-slate-600',
};

const SOURCE_LABELS: Record<CRMActivitySource, string> = {
  manual: 'Manual',
  auto_design_manager: 'Design Manager',
  auto_manufacturing: 'Manufacturing',
  auto_finance: 'Finance',
  auto_system: 'System',
};

function formatTimestamp(ts: Timestamp | unknown): string {
  if (!ts) return '-';
  const date = (ts as Timestamp).toDate?.() ?? new Date(((ts as { seconds: number }).seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const MANUAL_TYPES: CRMActivityType[] = ['call', 'email', 'meeting', 'site_visit', 'presentation', 'note'];

export default function SalesActivitiesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [showLogForm, setShowLogForm] = useState(false);

  // Log form state
  const [logType, setLogType] = useState<CRMActivityType>('call');
  const [logTitle, setLogTitle] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [logOutcome, setLogOutcome] = useState('');
  const [saving, setSaving] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAllActivities();
      setActivities(data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filtered = useMemo(() => {
    let result = activities;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.performedByName?.toLowerCase().includes(q)
      );
    }
    if (typeFilter) result = result.filter((a) => a.type === typeFilter);
    if (sourceFilter) result = result.filter((a) => a.source === sourceFilter);
    return result;
  }, [activities, search, typeFilter, sourceFilter]);

  const handleLogActivity = async () => {
    if (!user || !logTitle.trim()) return;
    setSaving(true);
    try {
      await logActivity({
        type: logType,
        title: logTitle.trim(),
        description: logDescription.trim() || undefined,
        outcome: logOutcome.trim() || undefined,
        source: 'manual',
        customerId: '',
        performedBy: user.uid,
        performedByName: user.displayName || user.email || 'Unknown',
        performedAt: Timestamp.now(),
      });
      setShowLogForm(false);
      setLogTitle('');
      setLogDescription('');
      setLogOutcome('');
      await loadActivities();
    } catch (err) {
      console.error('Failed to log activity:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Activities</h2>
          <p className="text-sm text-gray-500">
            Track all sales activities including calls, meetings, emails, and site visits.
          </p>
        </div>
        <button
          onClick={() => setShowLogForm(!showLogForm)}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          {showLogForm ? 'Cancel' : 'Log Activity'}
        </button>
      </div>

      {/* Log Activity Form */}
      {showLogForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Log New Activity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value as CRMActivityType)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {MANUAL_TYPES.map((t) => (
                  <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={logTitle}
                onChange={(e) => setLogTitle(e.target.value)}
                placeholder="e.g., Follow-up call with John"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={logDescription}
              onChange={(e) => setLogDescription(e.target.value)}
              rows={2}
              placeholder="Activity details..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Outcome</label>
            <input
              type="text"
              value={logOutcome}
              onChange={(e) => setLogOutcome(e.target.value)}
              placeholder="e.g., Client agreed to site visit next week"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleLogActivity}
              disabled={saving || !logTitle.trim()}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Activity'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[140px]"
          >
            <option value="">All Types</option>
            {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[120px]"
          >
            <option value="">All Sources</option>
            {Object.entries(SOURCE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-sm text-gray-500">{filtered.length} activit{filtered.length !== 1 ? 'ies' : 'y'}</div>

      {/* Activity Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-600 mb-1">No activities yet</h3>
          <p className="text-xs text-gray-400">Activities will appear here as you log calls, meetings, and other events.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((activity) => {
            const Icon = ACTIVITY_TYPE_ICONS[activity.type] || Activity;
            const colorClass = ACTIVITY_TYPE_COLORS[activity.type] || 'bg-gray-100 text-gray-600';
            // P11-5 reader migration: prefer the normalized FK, fall back
            // to the legacy free-text name, render nothing when neither.
            // kind:'id'   → modern row (P11-4 writer populated FK + cache)
            // kind:'name' → legacy row pre-P11-4 (name-only)
            // Visually identical today; the distinction becomes useful
            // once P11-6 adds the contact-detail popover.
            const contact = resolveContactPerson(activity);
            const contactLabel =
              contact?.kind === 'id' ? contact.contactPersonName : contact?.contactPersonName;
            return (
              <div key={activity.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{activity.title}</h4>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{formatTimestamp(activity.performedAt)}</span>
                    </div>
                    {activity.description && <p className="text-sm text-gray-600 mt-1">{activity.description}</p>}
                    {activity.outcome && (
                      <p className="text-sm text-gray-500 mt-1"><span className="font-medium">Outcome:</span> {activity.outcome}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                      <span>{activity.performedByName}</span>
                      {contactLabel && (
                        <span
                          className="px-1.5 py-0.5 bg-blue-50 rounded text-blue-600"
                          title={contact?.kind === 'id' ? 'Linked contact (P11-4 FK)' : 'Legacy contact name'}
                        >
                          {contactLabel}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{ACTIVITY_TYPE_LABELS[activity.type]}</span>
                      <span className="px-1.5 py-0.5 bg-gray-50 rounded text-gray-400">{SOURCE_LABELS[activity.source] || activity.source}</span>
                      {activity.dealId && (
                        <button onClick={() => navigate(`/crm/deals/${activity.dealId}`)} className="text-primary hover:underline">View Deal</button>
                      )}
                      {activity.projectId && (
                        <button onClick={() => navigate(`/crm/projects/${activity.projectId}`)} className="text-primary hover:underline">View Project</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
