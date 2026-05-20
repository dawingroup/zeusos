/**
 * Edit Program Page - Edit an existing program
 */

import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { ProgramForm } from '../components/forms/ProgramForm';
import { ProgramService } from '../services/program-service';
import { useProgram } from '../hooks/program-hooks';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';

export function EditProgram() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { program, loading, error: loadError } = useProgram(db, programId || null);

  const handleSubmit = async (data: any) => {
    if (!user || !programId) {
      setError('You must be logged in to update a program');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const programService = ProgramService.getInstance(db);

      // Transform form data to match update format
      const updateData = {
        name: data.name,
        code: data.code,
        description: data.description,
        clientId: data.clientId,
        fundingSource: data.fundingSource,
        implementingAgency: data.implementingAgency,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        budget: {
          currency: data.currency,
          allocated: {
            amount: data.totalBudget,
            currency: data.currency,
          },
        },
        coverage: {
          regions: data.regions,
        },
        objectives: data.objectives.filter((obj: string) => obj.trim() !== ''),
      };

      await programService.updateProgram(programId, updateData as any, user.uid);
      navigate(`/advisory/delivery/programs/${programId}`);
    } catch (err: any) {
      console.error('Error updating program:', err);
      setError(err.message || 'Failed to update program');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/advisory/delivery/programs/${programId}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading program...</span>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{loadError.message}</span>
        </div>
      </div>
    );
  }

  // Not found
  if (!program) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium text-gray-900">Program not found</h2>
        <p className="text-gray-600 mt-2">The program you're looking for doesn't exist.</p>
        <Link to="/advisory/delivery/programs" className="text-primary hover:underline mt-4 inline-block">
          ← Back to programs
        </Link>
      </div>
    );
  }

  // Transform program data to form format
  const initialData = {
    name: program.name,
    code: program.code,
    description: program.description || '',
    clientId: program.clientId || null,
    fundingSource: program.fundingSource || '',
    implementingAgency: program.implementingAgency || '',
    startDate: program.startDate?.toDate?.()?.toISOString().split('T')[0] || '',
    endDate: program.endDate?.toDate?.()?.toISOString().split('T')[0] || '',
    totalBudget: program.budget?.allocated?.amount || 0,
    currency: program.budget?.currency || 'UGX',
    regions: program.coverage?.regions || [],
    objectives: program.objectives?.length ? program.objectives : [''],
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <Link
        to={`/advisory/delivery/programs/${programId}`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Program
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Program</h1>
        <p className="text-gray-600 mt-1">
          Update program details for <span className="font-medium">{program.name}</span>
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isSubmitting && (
        <div className="mb-4 flex items-center gap-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Updating program...</span>
        </div>
      )}

      {/* Form */}
      <ProgramForm
        initialData={initialData}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isEditing
      />
    </div>
  );
}
