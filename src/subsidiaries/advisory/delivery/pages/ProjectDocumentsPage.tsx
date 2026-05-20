/**
 * Project Documents Page
 * Document management and repository
 */

import { useOutletContext } from 'react-router-dom';
import type { ProjectOutletContext } from '../components/projects/ProjectLayout';

export function ProjectDocumentsPage() {
  const { project } = useOutletContext<ProjectOutletContext>();

  return (
    <div className="p-6 text-center text-gray-500">
      <p>Document management for {project.name} coming soon...</p>
    </div>
  );
}

export default ProjectDocumentsPage;
