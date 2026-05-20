/**
 * New Program Page - Create a new program
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { ProgramForm } from '../components/forms/ProgramForm';
import { ProgramService } from '../services/program-service';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';

export function NewProgram() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: any) => {
    if (!user) {
      setError('You must be logged in to create a program');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const programService = ProgramService.getInstance(db);
      await programService.createProgram(data, user.uid);
      navigate(`/advisory/delivery/programs`);
    } catch (err: any) {
      console.error('Error creating program:', err);
      setError(err.message || 'Failed to create program');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/advisory/delivery');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <Link 
        to="/advisory/delivery" 
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Delivery Dashboard
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Program</h1>
        <p className="text-gray-600 mt-1">
          Set up a new infrastructure delivery program
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
          <span>Creating program...</span>
        </div>
      )}

      {/* Form */}
      <ProgramForm 
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
