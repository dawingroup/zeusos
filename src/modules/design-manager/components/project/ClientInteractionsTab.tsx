/**
 * ClientInteractionsTab
 * Track meetings, calls, site visits, and other client engagements for a project
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Phone, Mail, MapPin, Users, Presentation, Wrench, Truck,
  MessageSquare, Calendar, Clock, ChevronDown, ChevronUp, Edit2,
  Trash2, X, CheckCircle, Circle, ExternalLink, FileText,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClientInteractions } from '../../hooks/useClientInteractions';
import { getProject } from '../../services/firestore';
import { ShareMinutesDialog } from './ShareMinutesDialog';
import type {
  ClientInteraction,
  InteractionType,
  InteractionAttendee,
  InteractionActionItem,
  DesignProject,
} from '../../types';

// ============================================
// Constants
// ============================================

const INTERACTION_TYPES: { value: InteractionType; label: string; icon: typeof Phone; color: string }[] = [
  { value: 'meeting', label: 'Meeting', icon: Users, color: 'bg-blue-100 text-blue-700' },
  { value: 'phone-call', label: 'Phone Call', icon: Phone, color: 'bg-green-100 text-green-700' },
  { value: 'email', label: 'Email', icon: Mail, color: 'bg-purple-100 text-purple-700' },
  { value: 'site-visit', label: 'Site Visit', icon: MapPin, color: 'bg-amber-100 text-amber-700' },
  { value: 'presentation', label: 'Presentation', icon: Presentation, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'workshop', label: 'Workshop', icon: Wrench, color: 'bg-pink-100 text-pink-700' },
  { value: 'approval-session', label: 'Approval Session', icon: CheckCircle, color: 'bg-teal-100 text-teal-700' },
  { value: 'delivery', label: 'Delivery', icon: Truck, color: 'bg-orange-100 text-orange-700' },
  { value: 'other', label: 'Other', icon: MessageSquare, color: 'bg-gray-100 text-gray-700' },
];

function getInteractionConfig(type: InteractionType) {
  return INTERACTION_TYPES.find(t => t.value === type) || INTERACTION_TYPES[INTERACTION_TYPES.length - 1];
}

// ============================================
// Sub-components
// ============================================

interface InteractionFormData {
  type: InteractionType;
  title: string;
  date: string;
  duration: string;
  summary: string;
  notes: string;
  location: string;
  googleMapsUrl: string;
  nextSteps: string;
  followUpDate: string;
  attendees: InteractionAttendee[];
  actionItems: InteractionActionItem[];
}

const emptyForm: InteractionFormData = {
  type: 'meeting',
  title: '',
  date: new Date().toISOString().split('T')[0],
  duration: '',
  summary: '',
  notes: '',
  location: '',
  googleMapsUrl: '',
  nextSteps: '',
  followUpDate: '',
  attendees: [],
  actionItems: [],
};

function InteractionForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: InteractionFormData;
  onSubmit: (data: InteractionFormData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<InteractionFormData>(initial || emptyForm);
  const [newAttendeeName, setNewAttendeeName] = useState('');
  const [newAttendeeRole, setNewAttendeeRole] = useState('');
  const [newAttendeeIsClient, setNewAttendeeIsClient] = useState(true);
  const [newActionDesc, setNewActionDesc] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState('');

  const update = <K extends keyof InteractionFormData>(key: K, value: InteractionFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const addAttendee = () => {
    if (!newAttendeeName.trim()) return;
    update('attendees', [
      ...form.attendees,
      { name: newAttendeeName.trim(), role: newAttendeeRole.trim() || undefined, isClient: newAttendeeIsClient },
    ]);
    setNewAttendeeName('');
    setNewAttendeeRole('');
  };

  const removeAttendee = (idx: number) => {
    update('attendees', form.attendees.filter((_, i) => i !== idx));
  };

  const addAction = () => {
    if (!newActionDesc.trim()) return;
    update('actionItems', [
      ...form.actionItems,
      {
        id: crypto.randomUUID(),
        description: newActionDesc.trim(),
        assignedTo: newActionAssignee.trim() || undefined,
        completed: false,
      },
    ]);
    setNewActionDesc('');
    setNewActionAssignee('');
  };

  const removeAction = (id: string) => {
    update('actionItems', form.actionItems.filter(a => a.id !== id));
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="space-y-5"
    >
      {/* Type + Date row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            value={form.type}
            onChange={e => update('type', e.target.value as InteractionType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
          >
            {INTERACTION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
          <input
            type="date"
            value={form.date}
            onChange={e => update('date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
          <input
            type="number"
            min="0"
            value={form.duration}
            onChange={e => update('duration', e.target.value)}
            placeholder="e.g. 60"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
          />
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={e => update('title', e.target.value)}
          placeholder="e.g. Initial Site Visit with Client"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
          required
        />
      </div>

      {/* Summary */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Summary *</label>
        <textarea
          value={form.summary}
          onChange={e => update('summary', e.target.value)}
          rows={3}
          placeholder="Key discussion points and outcomes..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E] resize-none"
          required
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Notes</label>
        <textarea
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          rows={4}
          placeholder="Additional details, decisions made, client feedback..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E] resize-none"
        />
      </div>

      {/* Location + Google Maps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            type="text"
            value={form.location}
            onChange={e => update('location', e.target.value)}
            placeholder="e.g. Client Office, Project Site"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Link</label>
          <input
            type="url"
            value={form.googleMapsUrl}
            onChange={e => update('googleMapsUrl', e.target.value)}
            placeholder="https://maps.google.com/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
          />
        </div>
      </div>

      {/* Attendees */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Attendees</label>
        {form.attendees.length > 0 && (
          <div className="space-y-1 mb-2">
            {form.attendees.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-1.5 rounded-lg">
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-xs font-medium',
                  a.isClient ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
                )}>
                  {a.isClient ? 'Client' : 'Team'}
                </span>
                <span className="font-medium">{a.name}</span>
                {a.role && <span className="text-gray-500">({a.role})</span>}
                <button type="button" onClick={() => removeAttendee(i)} className="ml-auto text-gray-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newAttendeeName}
            onChange={e => setNewAttendeeName(e.target.value)}
            placeholder="Name"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttendee(); } }}
          />
          <input
            type="text"
            value={newAttendeeRole}
            onChange={e => setNewAttendeeRole(e.target.value)}
            placeholder="Role"
            className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttendee(); } }}
          />
          <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={newAttendeeIsClient}
              onChange={e => setNewAttendeeIsClient(e.target.checked)}
              className="rounded border-gray-300"
            />
            Client
          </label>
          <button type="button" onClick={addAttendee} className="p-1.5 text-[#0A7C8E] hover:bg-[#0A7C8E]/10 rounded-lg">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Items */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Action Items</label>
        {form.actionItems.length > 0 && (
          <div className="space-y-1 mb-2">
            {form.actionItems.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-1.5 rounded-lg">
                <Circle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span>{a.description}</span>
                {a.assignedTo && <span className="text-gray-500 text-xs">({a.assignedTo})</span>}
                <button type="button" onClick={() => removeAction(a.id)} className="ml-auto text-gray-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newActionDesc}
            onChange={e => setNewActionDesc(e.target.value)}
            placeholder="Action item description"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAction(); } }}
          />
          <input
            type="text"
            value={newActionAssignee}
            onChange={e => setNewActionAssignee(e.target.value)}
            placeholder="Assigned to"
            className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAction(); } }}
          />
          <button type="button" onClick={addAction} className="p-1.5 text-[#0A7C8E] hover:bg-[#0A7C8E]/10 rounded-lg">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Next Steps + Follow-up */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Next Steps</label>
          <textarea
            value={form.nextSteps}
            onChange={e => update('nextSteps', e.target.value)}
            rows={2}
            placeholder="What happens next..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
          <input
            type="date"
            value={form.followUpDate}
            onChange={e => update('followUpDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'px-4 py-2 text-sm font-medium text-white rounded-lg',
            loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#0A7C8E] hover:bg-[#086a7a]'
          )}
        >
          {loading ? 'Saving...' : 'Save Interaction'}
        </button>
      </div>
    </form>
  );
}

// ============================================
// Interaction Card
// ============================================

function InteractionCard({
  interaction,
  onEdit,
  onDelete,
  onShareMinutes,
}: {
  interaction: ClientInteraction;
  onEdit: (i: ClientInteraction) => void;
  onDelete: (id: string) => void;
  onShareMinutes: (i: ClientInteraction) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = getInteractionConfig(interaction.type);
  const Icon = config.icon;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    let date: Date;
    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp.seconds !== undefined) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const completedActions = interaction.actionItems?.filter(a => a.completed).length || 0;
  const totalActions = interaction.actionItems?.length || 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={cn('p-2 rounded-lg flex-shrink-0', config.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900 truncate">{interaction.title}</h3>
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', config.color)}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{interaction.summary}</p>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(interaction.date)}
            </span>
            {interaction.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {interaction.duration} min
              </span>
            )}
            {interaction.attendees?.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {interaction.attendees.length} attendee{interaction.attendees.length !== 1 ? 's' : ''}
              </span>
            )}
            {totalActions > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {completedActions}/{totalActions} actions
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Summary */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Summary</h4>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{interaction.summary}</p>
          </div>

          {/* Notes */}
          {interaction.notes && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{interaction.notes}</p>
            </div>
          )}

          {/* Location */}
          {(interaction.location || interaction.geoLocation?.googleMapsUrl) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Location</h4>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-900">{interaction.location}</span>
                {interaction.geoLocation?.googleMapsUrl && (
                  <a
                    href={interaction.geoLocation.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0A7C8E] hover:underline flex items-center gap-1"
                  >
                    Open Map <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Attendees */}
          {interaction.attendees?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Attendees</h4>
              <div className="flex flex-wrap gap-2">
                {interaction.attendees.map((a, i) => (
                  <span
                    key={i}
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      a.isClient ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {a.name}{a.role ? ` (${a.role})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {totalActions > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Action Items</h4>
              <div className="space-y-1">
                {interaction.actionItems.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    {a.completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                    <span className={cn(a.completed && 'line-through text-gray-400')}>{a.description}</span>
                    {a.assignedTo && <span className="text-gray-400 text-xs ml-1">({a.assignedTo})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Steps */}
          {interaction.nextSteps && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Next Steps</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{interaction.nextSteps}</p>
              {interaction.followUpDate && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Follow-up: {formatDate(interaction.followUpDate)}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => onShareMinutes(interaction)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#872E5C] hover:bg-[#6e2449] rounded-lg"
            >
              <FileText className="w-3.5 h-3.5" /> Share Minutes
            </button>
            <button
              onClick={() => onEdit(interaction)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => onDelete(interaction.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export interface ClientInteractionsTabProps {
  projectId: string;
}

export function ClientInteractionsTab({ projectId }: ClientInteractionsTabProps) {
  const { user } = useAuth();
  const userId = user?.email || '';
  const { interactions, loading, error, addInteraction, editInteraction, removeInteraction } = useClientInteractions(projectId);

  const [showForm, setShowForm] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<ClientInteraction | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<InteractionType | 'all'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [shareInteraction, setShareInteraction] = useState<ClientInteraction | null>(null);
  const [project, setProject] = useState<DesignProject | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) return;
    getProject(projectId)
      .then((p) => {
        if (!cancelled) setProject(p);
      })
      .catch(() => {
        /* non-fatal: Share Minutes will still work without client lookup */
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filteredInteractions = useMemo(() => {
    if (filterType === 'all') return interactions;
    return interactions.filter(i => i.type === filterType);
  }, [interactions, filterType]);

  const interactionToForm = (i: ClientInteraction): InteractionFormData => {
    const toDateStr = (ts: any) => {
      if (!ts) return '';
      let d: Date;
      if (ts.toDate) d = ts.toDate();
      else if (ts.seconds !== undefined) d = new Date(ts.seconds * 1000);
      else d = new Date(ts);
      return d.toISOString().split('T')[0];
    };
    return {
      type: i.type,
      title: i.title,
      date: toDateStr(i.date),
      duration: i.duration ? String(i.duration) : '',
      summary: i.summary,
      notes: i.notes || '',
      location: i.location || '',
      googleMapsUrl: i.geoLocation?.googleMapsUrl || '',
      nextSteps: i.nextSteps || '',
      followUpDate: toDateStr(i.followUpDate),
      attendees: i.attendees || [],
      actionItems: i.actionItems || [],
    };
  };

  const handleSubmit = async (data: InteractionFormData) => {
    setSaving(true);
    try {
      const payload: any = {
        type: data.type,
        title: data.title,
        date: { seconds: new Date(data.date).getTime() / 1000, nanoseconds: 0 },
        summary: data.summary,
        notes: data.notes || undefined,
        location: data.location || undefined,
        attendees: data.attendees,
        actionItems: data.actionItems,
        nextSteps: data.nextSteps || undefined,
      };

      if (data.duration) payload.duration = parseInt(data.duration);
      if (data.followUpDate) payload.followUpDate = { seconds: new Date(data.followUpDate).getTime() / 1000, nanoseconds: 0 };
      if (data.googleMapsUrl) payload.geoLocation = { googleMapsUrl: data.googleMapsUrl };

      if (editingInteraction) {
        await editInteraction(editingInteraction.id, payload, userId);
      } else {
        await addInteraction(payload, userId);
      }

      setShowForm(false);
      setEditingInteraction(null);
    } catch {
      // error is handled by hook
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (i: ClientInteraction) => {
    setEditingInteraction(i);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await removeInteraction(id);
      setDeleteConfirmId(null);
    } catch {
      // error handled by hook
    }
  };

  // Stats
  const stats = {
    total: interactions.length,
    meetings: interactions.filter(i => i.type === 'meeting').length,
    siteVisits: interactions.filter(i => i.type === 'site-visit').length,
    pendingActions: interactions.reduce((sum, i) => sum + (i.actionItems?.filter(a => !a.completed).length || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7C8E]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total Interactions</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.meetings}</p>
          <p className="text-xs text-gray-500">Meetings</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.siteVisits}</p>
          <p className="text-xs text-gray-500">Site Visits</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.pendingActions}</p>
          <p className="text-xs text-gray-500">Pending Actions</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as InteractionType | 'all')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
          >
            <option value="all">All Types</option>
            {INTERACTION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            {filteredInteractions.length} record{filteredInteractions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => { setEditingInteraction(null); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#086a7a] transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Interaction
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error.message}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {editingInteraction ? 'Edit Interaction' : 'New Client Interaction'}
          </h3>
          <InteractionForm
            initial={editingInteraction ? interactionToForm(editingInteraction) : undefined}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingInteraction(null); }}
            loading={saving}
          />
        </div>
      )}

      {/* List */}
      {filteredInteractions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No interactions yet</h3>
          <p className="text-gray-500 mt-1">Record meetings, calls, site visits, and other client engagements.</p>
          <button
            onClick={() => { setEditingInteraction(null); setShowForm(true); }}
            className="mt-4 text-[#0A7C8E] hover:underline text-sm"
          >
            Add your first interaction
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInteractions.map(interaction => (
            <div key={interaction.id}>
              <InteractionCard
                interaction={interaction}
                onEdit={handleEdit}
                onDelete={(id) => setDeleteConfirmId(id)}
                onShareMinutes={(i) => setShareInteraction(i)}
              />
              {/* Delete confirm */}
              {deleteConfirmId === interaction.id && (
                <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-red-700">Delete this interaction?</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(interaction.id)}
                      className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Share Minutes dialog */}
      {shareInteraction && (
        <ShareMinutesDialog
          open={!!shareInteraction}
          onClose={() => setShareInteraction(null)}
          interaction={shareInteraction}
          projectId={projectId}
          projectCode={project?.code}
          projectName={project?.name}
          customerId={project?.customerId}
          customerName={project?.customerName}
        />
      )}
    </div>
  );
}

export default ClientInteractionsTab;
