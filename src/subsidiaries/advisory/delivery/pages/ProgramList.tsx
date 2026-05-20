/**
 * Program List Page - View all programs
 */

import { Link } from 'react-router-dom';
import { Plus, Building2, Calendar, DollarSign, MapPin, ChevronRight, Loader2, AlertCircle, FolderOpen, Database, Wrench } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAllPrograms } from '../hooks/program-hooks';
import { db } from '@/core/services/firebase';

export function ProgramList() {
  const { programs, loading, error, refresh } = useAllPrograms(db);

  const formatBudget = (amount: number, currency: string) => {
    if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
    return `${currency} ${amount.toLocaleString()}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600">Loading programs...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
          <button onClick={refresh} className="ml-auto text-sm text-red-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (programs.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
            <p className="text-gray-600">0 programs</p>
          </div>
          <Link
            to="/advisory/delivery/programs/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New Program
          </Link>
        </div>
        <div className="bg-white rounded-lg border p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No programs yet</h3>
          <p className="text-gray-600 mb-4">Create your first delivery program to get started</p>
          <Link
            to="/advisory/delivery/programs/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Create Program
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
          <p className="text-gray-600">{programs.length} program{programs.length !== 1 ? 's' : ''}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Link
            to="/advisory/delivery/data-recovery"
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
          >
            <Wrench className="w-4 h-4" />
            Recovery
          </Link>
          <Link
            to="/advisory/delivery/data-migration"
            className="inline-flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm"
          >
            <Database className="w-4 h-4" />
            Migration
          </Link>
          <Link
            to="/advisory/delivery/programs/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New Program
          </Link>
        </div>
      </div>

      {/* Program Cards */}
      <div className="grid gap-4">
        {programs.map(program => (
          <Link
            key={program.id}
            to={`/advisory/delivery/programs/${program.id}`}
            className="block bg-white rounded-lg border p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-500 font-mono">{program.code}</span>
                    <StatusBadge status={program.status} size="sm" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{program.name}</h2>
                  <p className="text-gray-600">{program.description || 'No description'}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <DollarSign className="w-4 h-4" />
                <span>{formatBudget(program.budget?.allocated?.amount || 0, program.budget?.currency || 'USD')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building2 className="w-4 h-4" />
                <span>{program.projectIds?.length || 0} projects</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{program.coverage?.countries?.length || 0} countries</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>{program.endDate?.toDate?.()?.getFullYear?.() || 'N/A'}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
