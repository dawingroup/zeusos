/**
 * Project Scope Page
 * Project scope definition and work breakdown
 */

import { useOutletContext } from 'react-router-dom';
import type { ProjectOutletContext } from '../components/projects/ProjectLayout';

export function ProjectScopePage() {
  const { project } = useOutletContext<ProjectOutletContext>();

  return (
    <div className="p-6 text-center text-gray-500">
      <p>Scope management for {project.name} coming soon...</p>
    </div>
  );
}

export default ProjectScopePage;
