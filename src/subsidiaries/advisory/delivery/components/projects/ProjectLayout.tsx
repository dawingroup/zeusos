/**
 * Project Layout Component
 * Wraps all project-related pages with persistent navigation and context
 * Provides project data to child routes via outlet context
 */

import { Outlet, useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, AlertCircle, Edit, Trash2, Settings } from 'lucide-react';
import { useState } from 'react';
import { ProjectHeader } from './ProjectHeader';
import { ProjectTabs } from './ProjectTabs';
import { Breadcrumbs } from '@/core/components/navigation/Breadcrumbs';
import { useProject, useProjectMutations } from '../../hooks/project-hooks';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import type { Project } from '../../types/project';

export interface ProjectOutletContext {
  project: Project;
}

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { project, loading, error } = useProject(db, projectId || null);
  const { deleteProject, loading: deleting } = useProjectMutations(db, user?.uid || '');

  const handleDelete = async () => {
    if (!projectId || !user) return;
    try {
      await deleteProject(projectId, 'Deleted by user');
      navigate('/advisory/delivery/projects');
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleEdit = () => {
    navigate(`/advisory/delivery/projects/${projectId}/edit`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading project...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
        </div>
      </div>
    );
  }

  // Not found state
  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-medium text-gray-900">Project not found</h2>
          <p className="text-gray-600 mt-2">The project you're looking for doesn't exist.</p>
          <Link to="/advisory/delivery/projects" className="text-primary hover:underline mt-4 inline-block">
            ← Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs and Actions */}
      <div className="flex items-center justify-between">
        <Breadcrumbs projectName={project.name} />

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/advisory/delivery/projects/${projectId}/settings`)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            title="Project Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleEdit}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Confirm?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project Header */}
      <ProjectHeader
        project={project}
        onEdit={handleEdit}
      />

      {/* Persistent Project Tabs */}
      <ProjectTabs />

      {/* Child Routes Render Here */}
      <div className="bg-white rounded-lg border">
        <Outlet context={{ project } satisfies ProjectOutletContext} />
      </div>
    </div>
  );
}

export default ProjectLayout;
