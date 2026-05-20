/**
 * New Project Page - Create a new project
 */

import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { ProjectFormEnhanced } from '../components/forms/ProjectFormEnhanced';
import { ProjectService } from '../services/project-service';
import { useAllPrograms } from '../hooks/program-hooks';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';

export function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get program info from query params if creating under a program
  const initialProgramId = searchParams.get('programId');
  const initialProgramName = searchParams.get('programName');
  
  // Fetch all programs for selection
  const { programs, loading: programsLoading } = useAllPrograms(db);
  
  // Selected program state
  const [selectedProgramId, setSelectedProgramId] = useState<string>(initialProgramId || '');
  
  // Get selected program details
  const selectedProgram = programs.find(p => p.id === selectedProgramId);

  const handleSubmit = async (data: any) => {
    if (!user) {
      setError('You must be logged in to create a project');
      return;
    }

    if (!selectedProgramId) {
      setError('Please select a program for this project');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const projectService = ProjectService.getInstance(db);
      await projectService.createProject({ ...data, programId: selectedProgramId }, user.uid);
      navigate('/advisory/delivery/projects');
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/advisory/delivery/projects');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <Link 
        to="/advisory/delivery/projects" 
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
        <p className="text-gray-600 mt-1">
          Add a new infrastructure project to a program
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Program Selection */}
      <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Program <span className="text-red-500">*</span>
        </label>
        {programsLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading programs...</span>
          </div>
        ) : programs.length === 0 ? (
          <div className="text-amber-600 text-sm">
            No programs available. <Link to="/advisory/delivery/programs/new" className="underline">Create a program first</Link>.
          </div>
        ) : (
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">-- Select a program --</option>
            {programs.map(program => (
              <option key={program.id} value={program.id}>
                {program.code} - {program.name}
              </option>
            ))}
          </select>
        )}
        {selectedProgram && (
          <p className="mt-2 text-sm text-gray-600">
            {selectedProgram.description || 'No description'}
          </p>
        )}
      </div>

      {/* Loading State */}
      {isSubmitting && (
        <div className="mb-4 flex items-center gap-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Creating project...</span>
        </div>
      )}

      {/* Form */}
      <ProjectFormEnhanced
        programId={selectedProgramId || undefined}
        programName={selectedProgram?.name || initialProgramName || undefined}
        programCode={selectedProgram?.code}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
