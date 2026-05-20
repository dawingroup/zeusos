/**
 * Project Create Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2, MapPin, Building2, Users, Link2, Search, X } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { createProject, CreateProjectInput } from '../services/projectService';
import { getCustomersForMatFlow } from '../services/customerService';
import type { MatFlowCustomerSummary } from '../types/customer';
import { useAuth } from '@/shared/hooks';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/core/services/firebase';

const UGANDA_DISTRICTS = [
  'Kampala', 'Wakiso', 'Mukono', 'Jinja', 'Entebbe', 'Mbarara', 
  'Gulu', 'Lira', 'Mbale', 'Soroti', 'Arua', 'Fort Portal',
];

// Delivery project type
interface DeliveryProject {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  customerId?: string;
  customerName?: string;
}

const ProjectCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Customer selection
  const [customers, setCustomers] = useState<MatFlowCustomerSummary[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // Delivery project linking
  const [deliveryProjects, setDeliveryProjects] = useState<DeliveryProject[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [linkToDelivery, setLinkToDelivery] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customerId: '',
    customerName: '',
    district: '',
    address: '',
    linkedDeliveryProjectId: '',
    linkedDeliveryProjectName: '',
  });

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const data = await getCustomersForMatFlow();
        setCustomers(data);
      } catch (err) {
        console.error('Failed to load customers:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };
    loadCustomers();
  }, []);

  // Load delivery projects
  useEffect(() => {
    const loadDeliveryProjects = async () => {
      setLoadingProjects(true);
      try {
        const q = query(
          collection(db, 'projects'),
          where('status', 'in', ['planning', 'active', 'mobilization']),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const projects = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as DeliveryProject[];
        setDeliveryProjects(projects);
      } catch (err) {
        console.error('Failed to load delivery projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    };
    loadDeliveryProjects();
  }, []);

  // Filter customers based on search
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.code?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Filter delivery projects based on search
  const filteredProjects = deliveryProjects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.projectCode?.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const selectCustomer = (customer: MatFlowCustomerSummary) => {
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
    }));
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const selectDeliveryProject = (project: DeliveryProject) => {
    setFormData(prev => ({
      ...prev,
      linkedDeliveryProjectId: project.id,
      linkedDeliveryProjectName: project.name,
      // Also inherit customer from delivery project if available
      customerId: project.customerId || prev.customerId,
      customerName: project.customerName || prev.customerName,
      name: prev.name || project.name,
    }));
    setProjectSearch(project.name);
    setShowProjectDropdown(false);
    if (project.customerName) {
      setCustomerSearch(project.customerName);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create a project');
      return;
    }

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!formData.district) {
      setError('District is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: CreateProjectInput = {
        name: formData.name,
        description: formData.description,
        customerId: formData.customerId || '',
        customerName: formData.customerName || 'Direct Client',
        location: {
          siteName: formData.name,
          district: formData.district,
          address: formData.address,
        },
      };

      // Use 'default' as orgId for now - should come from user context
      const projectId = await createProject('default', user.uid, input);
      navigate(`/advisory/matflow/projects/${projectId}`);
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Create Project"
        description="Set up a new construction project"
        breadcrumbs={[
          { label: 'MatFlow', href: '/advisory/matflow' },
          { label: 'Projects', href: '/advisory/matflow/projects' },
          { label: 'New Project' },
        ]}
      />
      
      <div className="p-6 max-w-3xl">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {isSubmitting && (
          <div className="mb-4 flex items-center gap-2 text-amber-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Creating project...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold">Project Details</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Residential Complex Phase 1"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  placeholder="Describe the project scope..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Customer Selection */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  Customer
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) {
                        setFormData(prev => ({ ...prev, customerId: '', customerName: '' }));
                      }
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Search existing customers or enter new..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                    {loadingCustomers ? (
                      <div className="p-3 text-center text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Loading...
                      </div>
                    ) : (
                      filteredCustomers.slice(0, 10).map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className="w-full px-4 py-2 text-left hover:bg-amber-50 border-b last:border-0"
                        >
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-xs text-gray-500">{customer.code} • {customer.district || 'No location'}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {formData.customerId && (
                  <div className="mt-1 text-xs text-green-600">
                    Selected: {formData.customerName} ({formData.customerId.slice(0, 8)}...)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Link to Infrastructure Delivery Project */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-semibold">Link to Delivery Project</h2>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={linkToDelivery}
                  onChange={(e) => setLinkToDelivery(e.target.checked)}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                Enable linking
              </label>
            </div>
            
            {linkToDelivery && (
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Infrastructure Delivery Project
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => {
                      setProjectSearch(e.target.value);
                      setShowProjectDropdown(true);
                    }}
                    onFocus={() => setShowProjectDropdown(true)}
                    placeholder="Search delivery projects..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                {showProjectDropdown && projectSearch && filteredProjects.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                    {loadingProjects ? (
                      <div className="p-3 text-center text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Loading...
                      </div>
                    ) : (
                      filteredProjects.slice(0, 10).map(project => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => selectDeliveryProject(project)}
                          className="w-full px-4 py-2 text-left hover:bg-amber-50 border-b last:border-0"
                        >
                          <div className="font-medium">{project.name}</div>
                          <div className="text-xs text-gray-500">
                            {project.projectCode} • {project.status} • {project.customerName || 'No customer'}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {formData.linkedDeliveryProjectId && (
                  <div className="mt-2 p-2 bg-amber-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm">
                      Linked to: <strong>{formData.linkedDeliveryProjectName}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          linkedDeliveryProjectId: '',
                          linkedDeliveryProjectName: '',
                        }));
                        setProjectSearch('');
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {!linkToDelivery && (
              <p className="text-sm text-gray-500">
                Enable to link this MatFlow project to an existing Infrastructure Delivery project for unified tracking.
              </p>
            )}
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold">Location</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  District <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.district}
                  onChange={(e) => handleChange('district', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                >
                  <option value="">Select district...</option>
                  {UGANDA_DISTRICTS.map(district => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="e.g., Plot 123, Kololo Hill Drive"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/advisory/matflow/projects')}
              className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectCreate;
