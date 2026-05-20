/**
 * Admin page for seeding MatFlow data
 * Only visible to administrators
 */

import React, { useState } from 'react';
import { Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { seedFormulas, seedRoles, seedMaterials } from '../scripts/seedFormulas';

const AdminSeed: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  const handleSeed = async () => {
    setStatus('loading');
    setMessage('Seeding database...');
    
    try {
      const formulaResult = await seedFormulas();
      const rolesCount = await seedRoles();
      const materialsCount = await seedMaterials();
      
      if (formulaResult.skipped && rolesCount === 0 && materialsCount === 0) {
        setMessage('Database already seeded. No changes made.');
      } else {
        setMessage(
          `Successfully seeded: ${formulaResult.formulasAdded} formulas, ` +
          `${formulaResult.ratesAdded} material rates, ${rolesCount} roles, ` +
          `${materialsCount} materials`
        );
      }
      setStatus('success');
    } catch (error) {
      console.error('Seeding error:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus('error');
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold">MatFlow Database Setup</h1>
            <p className="text-gray-600 text-sm">Seed standard formulas and configuration</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">This will create:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Standard construction formulas (concrete, masonry, steel, etc.)</li>
              <li>• Material rate reference data (UGX prices)</li>
              <li>• Material library items (cement, sand, rebar, etc.)</li>
              <li>• Role definitions (QS, Site Engineer, PM)</li>
            </ul>
          </div>
          
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <p className="text-green-800">{message}</p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-red-800">{message}</p>
            </div>
          )}
          
          <button
            onClick={handleSeed}
            disabled={status === 'loading'}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Seeding...
              </>
            ) : (
              <>
                <Database className="w-5 h-5" />
                Seed Database
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSeed;
