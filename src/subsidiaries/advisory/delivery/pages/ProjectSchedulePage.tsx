/**
 * Project Schedule Page
 * Schedule management with Gantt chart, activity list, and milestone tracking
 */

import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, BarChart3, List, Flag, Loader2 } from 'lucide-react';
import { useScheduleActivities, useScheduleMutations, useScheduleSummary } from '../hooks/schedule-hooks';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import {
  GanttChart,
  ScheduleActivityList,
  ScheduleActivityForm,
  MilestoneTracker,
  CriticalPathSummary,
  ScheduleStatsBar,
} from '../components/schedule';
import type { ProjectOutletContext } from '../components/projects/ProjectLayout';
import type { ScheduleActivity, ScheduleActivityFormData, ScheduleActivityStatus } from '../types/schedule';

type ScheduleTab = 'gantt' | 'list' | 'milestones';

export function ProjectSchedulePage() {
  const { project } = useOutletContext<ProjectOutletContext>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ScheduleTab>('gantt');
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ScheduleActivity | undefined>();

  const { activities, milestones, loading } = useScheduleActivities(db, project.id);
  const { summary, criticalPath } = useScheduleSummary(db, project.id);
  const {
    createActivity,
    updateActivity,
    deleteActivity,
    updateProgress,
    updateStatus,
  } = useScheduleMutations(db, project.id, user?.uid || '');

  const handleCreate = async (data: ScheduleActivityFormData) => {
    await createActivity(data);
  };

  const handleEdit = (activity: ScheduleActivity) => {
    setEditingActivity(activity);
    setShowForm(true);
  };

  const handleUpdate = async (data: ScheduleActivityFormData) => {
    if (!editingActivity) return;
    await updateActivity(editingActivity.id, {
      name: data.name,
      description: data.description,
      wbsCode: data.wbsCode,
      activityType: data.activityType,
      parentId: data.parentId,
      plannedStartDate: data.plannedStartDate,
      plannedEndDate: data.plannedEndDate,
      responsibleParty: data.responsibleParty,
      responsibleRole: data.responsibleRole,
      dependencies: data.dependencies,
      notes: data.notes,
    });
  };

  const handleDelete = async (activityId: string) => {
    if (!window.confirm('Delete this activity?')) return;
    await deleteActivity(activityId);
  };

  const handleUpdateProgress = async (activityId: string, pct: number) => {
    await updateProgress(activityId, pct);
  };

  const handleUpdateStatus = async (activityId: string, status: ScheduleActivityStatus) => {
    await updateStatus(activityId, status);
  };

  const openNewForm = () => {
    setEditingActivity(undefined);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingActivity(undefined);
  };

  const tabs = [
    { id: 'gantt' as ScheduleTab, label: 'Gantt View', icon: BarChart3 },
    { id: 'list' as ScheduleTab, label: 'List View', icon: List },
    { id: 'milestones' as ScheduleTab, label: 'Milestones', icon: Flag },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading schedule...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats Bar */}
      <ScheduleStatsBar summary={summary} />

      {/* Tab Navigation + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={openNewForm}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'gantt' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-4">
            <GanttChart
              activities={activities}
              criticalPathIds={criticalPath}
            />
          </div>
          <CriticalPathSummary
            activities={activities}
            criticalPathIds={criticalPath}
            summary={summary}
          />
        </div>
      )}

      {activeTab === 'list' && (
        <div className="bg-white rounded-lg border">
          <ScheduleActivityList
            activities={activities}
            criticalPathIds={criticalPath}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpdateProgress={handleUpdateProgress}
            onUpdateStatus={handleUpdateStatus}
          />
        </div>
      )}

      {activeTab === 'milestones' && (
        <div className="bg-white rounded-lg border p-6">
          <MilestoneTracker milestones={milestones} />
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <ScheduleActivityForm
          activity={editingActivity}
          activities={activities}
          onSubmit={editingActivity ? handleUpdate : handleCreate}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

export default ProjectSchedulePage;
