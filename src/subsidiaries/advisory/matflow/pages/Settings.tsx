/**
 * Settings Page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Database, Settings as SettingsIcon } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure MatFlow preferences"
        breadcrumbs={[
          { label: 'MatFlow', href: '/advisory/matflow' },
          { label: 'Settings' },
        ]}
      />
      
      <div className="p-6 space-y-6">
        {/* General Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">General Settings</h2>
          </div>
          <p className="text-gray-500">General configuration options will be available here.</p>
        </div>
        
        {/* Admin Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Database Administration</h2>
          </div>
          <p className="text-gray-500 mb-4">Manage formulas, rates, and seed data.</p>
          <Link
            to="/advisory/matflow/admin/seed"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Database className="w-4 h-4" />
            Seed Database
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Settings;
