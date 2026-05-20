/**
 * Procurement Page
 */

import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Package, Plus } from 'lucide-react';

const Procurement: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="Procurement"
        description="Track material deliveries and purchases"
        breadcrumbs={[
          { label: 'MatFlow', href: '/advisory/matflow' },
          { label: 'Procurement' },
        ]}
        actions={
          <button
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log Delivery
          </button>
        }
      />
      
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No procurement entries</h3>
          <p className="text-gray-500">Log material deliveries to track procurement.</p>
        </div>
      </div>
    </div>
  );
};

export default Procurement;
