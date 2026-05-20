/**
 * Project Team Page
 * Team and contractor information
 */

import { useOutletContext } from 'react-router-dom';
import type { ProjectOutletContext } from '../components/projects/ProjectLayout';

export function ProjectTeamPage() {
  const { project } = useOutletContext<ProjectOutletContext>();

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-medium">
        {project.implementationType === 'contractor' ? 'Contractor' : 'Site Team'}
      </h3>

      {project.contractor ? (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="font-medium text-lg">{project.contractor.companyName}</div>
          <div className="text-gray-600 mt-1">Contract: {project.contractor.contractNumber}</div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="text-sm text-gray-500">Contact Person</div>
              <div className="font-medium">{project.contractor.contactPerson?.name}</div>
              <div className="text-sm text-gray-600">{project.contractor.contactPerson?.role}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Contract Value</div>
              <div className="font-medium">
                UGX {((project.contractor.contractValue ?? 0) / 1000000).toFixed(0)}M
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No contractor information available</p>
        </div>
      )}
    </div>
  );
}

export default ProjectTeamPage;
