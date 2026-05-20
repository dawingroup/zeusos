/**
 * CreateProjectFromDealModal - Create delivery project from closed deal
 */

import React, { useState } from 'react';
import { useCreateProjectFromDeal } from '../../shared/hooks/cross-module-hooks';
import { ProjectCreationFromDeal } from '../../shared/types/cross-module-link';

interface CreateProjectFromDealModalProps {
  open: boolean;
  onClose: () => void;
  dealId: string;
  dealName: string;
  investmentAmount: number;
  onSuccess?: (projectId: string) => void;
}

const steps = ['Project Details', 'Location & Team', 'Integration'];

export const CreateProjectFromDealModal: React.FC<CreateProjectFromDealModalProps> = ({
  open,
  onClose,
  dealId,
  dealName,
  investmentAmount,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const { createProject, loading, error } = useCreateProjectFromDeal();
  
  // Form state
  const [formData, setFormData] = useState({
    name: dealName + ' - Construction',
    implementationType: 'contractor' as 'contractor' | 'direct',
    programId: '',
    startDate: new Date().toISOString().split('T')[0],
    expectedEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    region: '',
    district: '',
    location: '',
    budgetFromDeal: true,
    budgetOverride: investmentAmount,
    projectManagerId: '',
    contractorId: '',
    createMatFlowBoq: true,
    trackProcurement: true,
    linkDocuments: true,
    linkContacts: true,
    linkMilestones: true,
  });
  
  if (!open) return null;
  
  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };
  
  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };
  
  const handleSubmit = async () => {
    const config: ProjectCreationFromDeal = {
      dealId,
      programId: formData.programId,
      projectConfig: {
        name: formData.name,
        implementationType: formData.implementationType,
        startDate: new Date(formData.startDate),
        expectedEndDate: new Date(formData.expectedEndDate),
        region: formData.region,
        district: formData.district,
        location: formData.location,
        budgetFromDeal: formData.budgetFromDeal,
        budgetOverride: formData.budgetFromDeal ? undefined : formData.budgetOverride,
        projectManagerId: formData.projectManagerId || undefined,
        contractorId: formData.contractorId || undefined,
      },
      matflowConfig: formData.createMatFlowBoq ? {
        createBoq: true,
        trackProcurement: formData.trackProcurement,
      } : undefined,
      autoLink: {
        documents: formData.linkDocuments,
        contacts: formData.linkContacts,
        milestones: formData.linkMilestones,
      },
    };
    
    try {
      const result = await createProject(config);
      onSuccess?.(result.projectId);
      onClose();
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };
  
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Implementation Type *
                </label>
                <select
                  value={formData.implementationType}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    implementationType: e.target.value as 'contractor' | 'direct' 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="contractor">Contractor Implementation</option>
                  <option value="direct">Direct Implementation</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Program *
                </label>
                <select
                  value={formData.programId}
                  onChange={(e) => setFormData({ ...formData, programId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select program...</option>
                  <option value="program-1">AMH Infrastructure Program</option>
                  <option value="program-2">Uganda Healthcare Initiative</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Completion
                </label>
                <input
                  type="date"
                  value={formData.expectedEndDate}
                  onChange={(e) => setFormData({ ...formData, expectedEndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="budgetFromDeal"
                checked={formData.budgetFromDeal}
                onChange={(e) => setFormData({ ...formData, budgetFromDeal: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="budgetFromDeal" className="text-sm text-gray-700">
                Use deal investment amount (${(investmentAmount / 1000000).toFixed(2)}M) as budget
              </label>
            </div>
            
            {!formData.budgetFromDeal && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Budget
                </label>
                <input
                  type="number"
                  value={formData.budgetOverride}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    budgetOverride: parseFloat(e.target.value) 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Location (Uganda)</h4>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Region *
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select region...</option>
                  <option value="central">Central</option>
                  <option value="eastern">Eastern</option>
                  <option value="western">Western</option>
                  <option value="northern">Northern</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  District *
                </label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter district"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location/Site *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter location"
                />
              </div>
            </div>
            
            <h4 className="text-sm font-medium text-gray-700 mt-6">Team</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Manager
                </label>
                <select
                  value={formData.projectManagerId}
                  onChange={(e) => setFormData({ ...formData, projectManagerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select later</option>
                  <option value="pm-1">John Mukasa</option>
                  <option value="pm-2">Sarah Namuli</option>
                </select>
              </div>
              
              {formData.implementationType === 'contractor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contractor
                  </label>
                  <select
                    value={formData.contractorId}
                    onChange={(e) => setFormData({ ...formData, contractorId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select later</option>
                    <option value="contractor-1">ABC Construction Ltd</option>
                    <option value="contractor-2">Uganda Builders Co</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">MatFlow Integration</h4>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="createMatFlowBoq"
                  checked={formData.createMatFlowBoq}
                  onChange={(e) => setFormData({ ...formData, createMatFlowBoq: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="createMatFlowBoq" className="text-sm text-gray-700">
                  Create MatFlow BOQ for material tracking
                </label>
              </div>
              
              {formData.createMatFlowBoq && (
                <div className="flex items-center gap-2 ml-6">
                  <input
                    type="checkbox"
                    id="trackProcurement"
                    checked={formData.trackProcurement}
                    onChange={(e) => setFormData({ ...formData, trackProcurement: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="trackProcurement" className="text-sm text-gray-700">
                    Enable procurement tracking
                  </label>
                </div>
              )}
            </div>
            
            <h4 className="text-sm font-medium text-gray-700 mt-6">Link from Deal</h4>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="linkDocuments"
                  checked={formData.linkDocuments}
                  onChange={(e) => setFormData({ ...formData, linkDocuments: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="linkDocuments" className="text-sm text-gray-700">
                  Copy deal documents to project
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="linkContacts"
                  checked={formData.linkContacts}
                  onChange={(e) => setFormData({ ...formData, linkContacts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="linkContacts" className="text-sm text-gray-700">
                  Link deal contacts to project
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="linkMilestones"
                  checked={formData.linkMilestones}
                  onChange={(e) => setFormData({ ...formData, linkMilestones: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="linkMilestones" className="text-sm text-gray-700">
                  Map deal milestones to project milestones
                </label>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-800">
                  After creation, the project will be linked to this deal and progress updates 
                  will automatically sync back to the investment tracking.
                </p>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Create Project from Deal</h2>
            <p className="text-sm text-gray-500">{dealName}</p>
          </div>
          
          {/* Stepper */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              {steps.map((label, index) => (
                <div key={label} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${index <= activeStep 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                    }
                  `}>
                    {index + 1}
                  </div>
                  <span className={`ml-2 text-sm ${
                    index <= activeStep ? 'text-blue-600 font-medium' : 'text-gray-500'
                  }`}>
                    {label}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-4 ${
                      index < activeStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Content */}
          <div className="px-6 py-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  Failed to create project. Please try again.
                </p>
              </div>
            )}
            
            {renderStepContent(activeStep)}
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            
            <div className="flex items-center gap-2">
              {activeStep > 0 && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Back
                </button>
              )}
              
              {activeStep < steps.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  Create Project
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectFromDealModal;
