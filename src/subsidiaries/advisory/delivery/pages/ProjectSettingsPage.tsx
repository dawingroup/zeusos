/**
 * Project Settings Page
 *
 * Configuration settings for a project including:
 * - Facility Branding (logos, contact info for document generation)
 * - Project settings (tax, wastage, etc.)
 */

import { useOutletContext } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { db } from '@/core/services/firebase';
import { getProjectService } from '../services/project-service';
import { FacilityBrandingEditor } from '../components/FacilityBrandingEditor';
import { FacilityBranding } from '../types/funds-acknowledgement';
import type { ProjectOutletContext } from '../components/projects/ProjectLayout';

export function ProjectSettingsPage() {
  const { project } = useOutletContext<ProjectOutletContext>();
  const { user } = useAuth();

  const handleSaveBranding = async (branding: FacilityBranding) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const projectService = getProjectService(db);
    await projectService.updateFacilityBranding(project.id, branding, user.uid);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-gray-500" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Project Settings</h1>
          <p className="text-sm text-gray-500">
            Configure project settings and branding for document generation
          </p>
        </div>
      </div>

      {/* Facility Branding Section */}
      <div>
        <FacilityBrandingEditor
          branding={project.facilityBranding}
          projectCode={project.projectCode}
          projectId={project.id}
          onSave={handleSaveBranding}
        />
        <p className="text-sm text-gray-500 mt-3">
          Branding is used for generating Funds Received Acknowledgement Forms and other official documents.
        </p>
      </div>
    </div>
  );
}

export default ProjectSettingsPage;
