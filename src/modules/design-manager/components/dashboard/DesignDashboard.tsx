/**
 * Design Dashboard
 * Main dashboard for the Design Manager module
 * Optimized UX - bigger project cards with inline info to reduce clicks
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, AlertCircle, Trash2, MoreVertical, Package, ChevronRight, Calendar, User } from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { DesignProject, DesignItem } from '../../types';
import { subscribeToProjects, deleteProject, subscribeToDesignItems } from '../../services/firestore';
import { NewProjectDialog } from '../project/NewProjectDialog';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

export default function DesignDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [projectItems, setProjectItems] = useState<Record<string, DesignItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToProjects((data) => {
      setProjects(data);
      setLoading(false);
      
      // Subscribe to items for each project
      data.forEach(project => {
        subscribeToDesignItems(project.id, (items) => {
          setProjectItems(prev => ({ ...prev, [project.id]: items }));
        });
      });
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-lg font-medium text-gray-900">Sign in Required</h2>
        <p className="text-gray-600 mt-1">Please sign in to access the Design Manager.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7C8E]"></div>
      </div>
    );
  }

  // Calculate totals
  const totalItems = Object.values(projectItems).flat().length;
  const readyItems = Object.values(projectItems).flat().filter(i => i.overallReadiness >= 80).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Design Manager</h1>
          <p className="text-gray-600 mt-1">
            Track designs through manufacturing stages
          </p>
        </div>
        <button
          onClick={() => setShowNewProject(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#086a7a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Stats Cards */}
      <KPIGrid cols={4}>
        <KPICard label="Active Projects" value={projects.filter(p => p.status === 'active').length} />
        <KPICard label="Total Items" value={totalItems} />
        <KPICard label="Production Ready" value={readyItems} trend="up" />
        <KPICard
          label="Completion Rate"
          value={`${totalItems > 0 ? Math.round((readyItems / totalItems) * 100) : 0}%`}
        />
      </KPIGrid>

      {/* Projects Grid - Bigger Cards */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-500 mb-4">Create your first project to start tracking design items</p>
          <button
            onClick={() => setShowNewProject(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#086a7a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {projects.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              items={projectItems[project.id] || []}
            />
          ))}
        </div>
      )}

      {/* New Project Dialog */}
      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        userId={user?.email || ''}
      />
    </div>
  );
}

interface ProjectCardProps {
  project: DesignProject;
  items: DesignItem[];
}

function ProjectCard({ project, items }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const statusConfig = {
    active: { color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active' },
    'on-hold': { color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-700', label: 'On Hold' },
    completed: { color: '#3B82F6', bg: 'bg-blue-50', text: 'text-blue-700', label: 'Completed' },
    cancelled: { color: '#6B7280', bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cancelled' },
  };

  const currentStatus = statusConfig[project.status];

  // Calculate item stats
  const readyCount = items.filter(i => i.overallReadiness >= 80).length;
  const inProgressCount = items.filter(i => i.overallReadiness > 0 && i.overallReadiness < 80).length;
  const pendingCount = items.filter(i => i.overallReadiness === 0).length;
  const avgReadiness = items.length > 0 
    ? Math.round(items.reduce((sum, i) => sum + i.overallReadiness, 0) / items.length) 
    : 0;

  // Calculate days since last update
  const daysActive = project.updatedAt 
    ? Math.floor((new Date().getTime() - project.updatedAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteProject(project.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative group">
      <Link to={`project/${project.id}`} className="block">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden"
          style={{ borderTop: `4px solid ${currentStatus.color}` }}
        >
          <CardContent className="p-0">
            {/* Card Header */}
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div 
                  className="h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${currentStatus.color}15` }}
                >
                  <FolderOpen className="w-7 h-7" style={{ color: currentStatus.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg truncate">{project.name}</h3>
                      <p className="text-sm text-muted-foreground">{project.code}</p>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={cn('flex-shrink-0 capitalize', currentStatus.bg, currentStatus.text)}
                    >
                      {currentStatus.label}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Customer & Meta Info */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {project.customerName && (
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    {project.customerName}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {daysActive === 0 ? 'Updated today' : `${daysActive}d ago`}
                </span>
              </div>
            </div>

            {/* Progress Section */}
            <div className="px-5 pb-4">
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-semibold" style={{ color: currentStatus.color }}>{avgReadiness}%</span>
              </div>
              <Progress 
                value={avgReadiness} 
                className="h-2" 
                style={{ '--progress-color': currentStatus.color } as React.CSSProperties}
              />
            </div>

            {/* Stats Row */}
            <div className="px-5 pb-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-emerald-600">{readyCount}</p>
                  <p className="text-xs text-emerald-600/80 mt-0.5">Ready</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-amber-600">{inProgressCount}</p>
                  <p className="text-xs text-amber-600/80 mt-0.5">In Progress</p>
                </div>
                <div className="bg-slate-100 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-slate-600">{pendingCount}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Pending</p>
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                <Package className="w-4 h-4 inline mr-1.5" />
                {items.length} design item{items.length !== 1 ? 's' : ''}
              </span>
              <span 
                className="text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all"
                style={{ color: currentStatus.color }}
              >
                View Project <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Menu Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div 
          className="absolute right-4 top-12 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]"
          onMouseLeave={() => setShowMenu(false)}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(false);
              setShowDeleteConfirm(true);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Project?</h3>
            <p className="text-gray-600 mb-4">
              This will permanently delete <strong>{project.name}</strong> and all its design items. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

