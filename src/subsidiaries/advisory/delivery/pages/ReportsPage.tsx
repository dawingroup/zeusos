/**
 * Reports Page
 * Project-level page for generating and viewing reports
 */

import { useParams } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { ReportGeneratorPanel } from '../reports';

export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();

  if (!projectId) {
    return (
      <div className="p-6">
        <p className="text-red-500">Project ID is required</p>
      </div>
    );
  }

  const userName = user?.displayName || user?.email || 'Unknown User';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500">
          Generate Google Docs reports for this project
        </p>
      </div>

      <ReportGeneratorPanel
        orgId="default"
        projectId={projectId}
        userName={userName}
        showHistory={true}
        onReportGenerated={(url) => {
          console.log('Report generated:', url);
        }}
      />

      {/* Info section */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          About Report Generation
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            Reports are created as Google Docs and saved to the project folder
          </li>
          <li>
            Project data (budget, progress, timeline) is automatically populated
          </li>
          <li>
            Generated reports can be edited directly in Google Docs
          </li>
          <li>
            Report history is tracked for future reference
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ReportsPage;
