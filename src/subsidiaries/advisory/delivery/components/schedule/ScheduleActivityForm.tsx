/**
 * Schedule Activity Form - Create/Edit dialog
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type {
  ScheduleActivity,
  ScheduleActivityFormData,
  ScheduleActivityType,
  ScheduleDependency,
  DependencyType,
} from '../../types/schedule';
import { DEPENDENCY_TYPE_LABELS } from '../../types/schedule';

interface ScheduleActivityFormProps {
  activity?: ScheduleActivity;
  activities: ScheduleActivity[];
  onSubmit: (data: ScheduleActivityFormData) => Promise<void>;
  onClose: () => void;
}

function formatDateForInput(date: Date | string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function ScheduleActivityForm({
  activity,
  activities,
  onSubmit,
  onClose,
}: ScheduleActivityFormProps) {
  const isEditing = !!activity;

  const [name, setName] = useState(activity?.name || '');
  const [description, setDescription] = useState(activity?.description || '');
  const [wbsCode, setWbsCode] = useState(activity?.wbsCode || '');
  const [activityType, setActivityType] = useState<ScheduleActivityType>(activity?.activityType || 'task');
  const [parentId, setParentId] = useState(activity?.parentId || '');
  const [plannedStartDate, setPlannedStartDate] = useState(formatDateForInput(activity?.plannedStartDate));
  const [plannedEndDate, setPlannedEndDate] = useState(formatDateForInput(activity?.plannedEndDate));
  const [responsibleParty, setResponsibleParty] = useState(activity?.responsibleParty || '');
  const [responsibleRole, setResponsibleRole] = useState(activity?.responsibleRole || '');
  const [notes, setNotes] = useState(activity?.notes || '');
  const [dependencies, setDependencies] = useState<ScheduleDependency[]>(activity?.dependencies || []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phases = activities.filter(a => a.activityType === 'phase');
  const possiblePredecessors = activities.filter(a => a.id !== activity?.id);

  const addDependency = () => {
    setDependencies(prev => [...prev, { activityId: '', type: 'finish_to_start', lagDays: 0 }]);
  };

  const updateDependency = (index: number, updates: Partial<ScheduleDependency>) => {
    setDependencies(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d));
  };

  const removeDependency = (index: number) => {
    setDependencies(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !plannedStartDate || !plannedEndDate) {
      setError('Name, start date, and end date are required');
      return;
    }

    if (new Date(plannedEndDate) <= new Date(plannedStartDate)) {
      setError('End date must be after start date');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data: ScheduleActivityFormData = {
        name: name.trim(),
        description: description.trim() || undefined,
        wbsCode: wbsCode.trim() || undefined,
        activityType,
        parentId: parentId || undefined,
        plannedStartDate: new Date(plannedStartDate),
        plannedEndDate: new Date(plannedEndDate),
        responsibleParty: responsibleParty.trim() || undefined,
        responsibleRole: responsibleRole.trim() || undefined,
        dependencies: dependencies.filter(d => d.activityId),
        notes: notes.trim() || undefined,
      };
      await onSubmit(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">
            {isEditing ? 'Edit Activity' : 'Add Activity'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Activity name"
            />
          </div>

          {/* Type + WBS */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={activityType}
                onChange={e => setActivityType(e.target.value as ScheduleActivityType)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="task">Task</option>
                <option value="milestone">Milestone</option>
                <option value="phase">Phase</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WBS Code</label>
              <input
                type="text"
                value={wbsCode}
                onChange={e => setWbsCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g. 1.2.3"
              />
            </div>
          </div>

          {/* Parent Phase */}
          {activityType !== 'phase' && phases.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Phase</label>
              <select
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="">None (top-level)</option>
                {phases.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={plannedStartDate}
                onChange={e => setPlannedStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                value={plannedEndDate}
                onChange={e => setPlannedEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Responsible */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsible Party</label>
              <input
                type="text"
                value={responsibleParty}
                onChange={e => setResponsibleParty(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input
                type="text"
                value={responsibleRole}
                onChange={e => setResponsibleRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g. Site Engineer"
              />
            </div>
          </div>

          {/* Dependencies */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Dependencies</label>
              <button
                type="button"
                onClick={addDependency}
                className="text-xs text-primary hover:underline"
              >
                + Add dependency
              </button>
            </div>
            {dependencies.length === 0 ? (
              <p className="text-xs text-gray-400">No dependencies</p>
            ) : (
              <div className="space-y-2">
                {dependencies.map((dep, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={dep.activityId}
                      onChange={e => updateDependency(i, { activityId: e.target.value })}
                      className="flex-1 px-2 py-1.5 border rounded text-xs bg-white"
                    >
                      <option value="">Select predecessor...</option>
                      {possiblePredecessors.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <select
                      value={dep.type}
                      onChange={e => updateDependency(i, { type: e.target.value as DependencyType })}
                      className="px-2 py-1.5 border rounded text-xs bg-white"
                    >
                      {Object.entries(DEPENDENCY_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeDependency(i)}
                      className="p-1 hover:bg-red-50 rounded"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
              placeholder="Optional description..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
              placeholder="Optional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
