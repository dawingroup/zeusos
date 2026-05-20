/**
 * Project List - List view of all projects with filtering
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, LayoutGrid, List, Table2, Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectTable } from '../components/projects/ProjectTable';
import { FilterBar } from '../components/common/FilterBar';
import { ProjectStatus } from '@/subsidiaries/advisory/core/project/types/project.types';
import { useAllProjects } from '../hooks/project-hooks';
import { db } from '@/core/services/firebase';

export function ProjectList() {
  const { projects, loading, error, refresh } = useAllProjects(db);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [regionFilter, setRegionFilter] = useState<string | 'all'>('all');

  const regions = useMemo(() => {
    const uniqueRegions = new Set(projects.map(p => p.location?.region).filter(Boolean));
    return Array.from(uniqueRegions).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    if (regionFilter !== 'all') {
      result = result.filter(p => p.location?.region === regionFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.projectCode?.toLowerCase().includes(query) ||
        p.location?.siteName?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [projects, statusFilter, regionFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
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

  if (projects.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600">0 projects</p>
          </div>
          <Link
            to="/advisory/delivery/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        </div>
        <div className="bg-white rounded-lg border p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No projects yet</h3>
          <p className="text-gray-600 mb-4">Create your first project to get started</p>
          <Link
            to="/advisory/delivery/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">
            {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-gray-100' : 'bg-white'}`}
              title="Table view"
            >
              <Table2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'bg-white'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'bg-white'}`}
              title="List view"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
          
          <Link
            to="/advisory/delivery/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        regionFilter={regionFilter}
        onRegionChange={setRegionFilter}
        regions={regions}
      />

      {/* Results */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
          <p className="text-gray-600 mt-2">
            Try adjusting your filters or search query
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <ProjectTable projects={filteredProjects} />
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-4'
        }>
          {filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
