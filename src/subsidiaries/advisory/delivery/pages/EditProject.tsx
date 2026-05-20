/**
 * Edit Project Page - Edit an existing project
 */

import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { ProjectFormEnhanced } from '../components/forms/ProjectFormEnhanced';
import { useProject, useProjectMutations } from '../hooks/project-hooks';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';

export function EditProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { project, loading, error } = useProject(db, projectId || null);
  const { updateProject } = useProjectMutations(db, user?.uid || '');

  const handleSubmit = async (data: any) => {
    if (!user || !projectId) {
      setSubmitError('You must be logged in to edit a project');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Map form data back to project update shape
      const updates: Record<string, any> = {
        name: data.name,
        projectCode: data.code,
        description: data.description || '',
        projectType: data.projectType,
        implementationType: data.implementationType,
        customerId: data.clientId,
        location: {
          siteName: data.siteName,
          region: data.region,
          district: data.district,
          country: 'Uganda',
          ...(data.subcounty ? { subcounty: data.subcounty } : {}),
        },
        'budget.totalBudget': data.totalBudget,
        'budget.currency': data.currency,
        'budget.contingencyPercent': data.contingencyPercent,
        'timeline.plannedStartDate': new Date(data.startDate),
        'timeline.plannedEndDate': new Date(data.endDate),
        'timeline.currentStartDate': new Date(data.startDate),
        'timeline.currentEndDate': new Date(data.endDate),
      };

      // Only include scope fields if provided
      if (data.majorWorks?.length) {
        updates.majorWorks = data.majorWorks.filter((w: string) => w.trim());
      }
      if (data.expectedDeliverables?.length) {
        updates.expectedDeliverables = data.expectedDeliverables.filter((d: string) => d.trim());
      }

      await updateProject(projectId, updates);
      navigate(`/advisory/delivery/projects/${projectId}`);
    } catch (err: any) {
      console.error('Error updating project:', err);
      setSubmitError(err.message || 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/advisory/delivery/projects/${projectId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading project...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center py-12">
        <h2 className="text-xl font-medium text-gray-900">Project not found</h2>
        <p className="text-gray-600 mt-2">The project you're looking for doesn't exist.</p>
        <Link to="/advisory/delivery/projects" className="text-primary hover:underline mt-4 inline-block">
          Back to projects
        </Link>
      </div>
    );
  }

  // Convert project data to form initial data
  const timeline = project.timeline || {} as any;
  const formatDate = (d: any): string => {
    if (!d) return '';
    if (d.toDate) return d.toDate().toISOString().split('T')[0];
    if (d.seconds) return new Date(d.seconds * 1000).toISOString().split('T')[0];
    if (d instanceof Date) return d.toISOString().split('T')[0];
    if (typeof d === 'string') return d.split('T')[0];
    return '';
  };

  const initialData = {
    name: project.name || '',
    code: project.projectCode || '',
    description: project.description || '',
    programId: project.programId || '',
    clientId: project.customerId || '',
    projectType: project.projectType || 'new_construction',
    implementationType: (project as any).implementationType || 'contractor',
    siteName: project.location?.siteName || '',
    region: project.location?.region || '',
    district: project.location?.district || '',
    subcounty: (project.location as any)?.subcounty || '',
    startDate: formatDate(timeline.plannedStartDate),
    endDate: formatDate(timeline.plannedEndDate),
    totalBudget: project.budget?.totalBudget || 0,
    currency: project.budget?.currency || 'UGX',
    contingencyPercent: project.budget?.contingencyPercent || 5,
    majorWorks: (project as any).majorWorks?.length ? (project as any).majorWorks : [''],
    expectedDeliverables: (project as any).expectedDeliverables?.length ? (project as any).expectedDeliverables : [''],
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <Link
        to={`/advisory/delivery/projects/${projectId}`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Project
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
        <p className="text-gray-600 mt-1">
          Update details for <span className="font-medium">{project.name}</span>
        </p>
      </div>

      {/* Error Display */}
      {submitError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {submitError}
        </div>
      )}

      {/* Loading State */}
      {isSubmitting && (
        <div className="mb-4 flex items-center gap-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Saving changes...</span>
        </div>
      )}

      {/* Form */}
      <ProjectFormEnhanced
        programId={project.programId}
        programName={project.programName}
        initialData={initialData}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isEditing
      />
    </div>
  );
}
