/**
 * Reports Page
 */

import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { BarChart3 } from 'lucide-react';

const Reports: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Material variance and project analytics"
        breadcrumbs={[
          { label: 'MatFlow', href: '/advisory/matflow' },
          { label: 'Reports' },
        ]}
      />
      
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No reports available</h3>
          <p className="text-gray-500">Reports will be generated once you have project data.</p>
        </div>
      </div>
    </div>
  );
};

export default Reports;
