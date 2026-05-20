/**
 * PROJECT LINKING DIALOG
 *
 * Dialog for linking manual requisitions to projects.
 * Allows searching and selecting a project from the system.
 */

import { useState, useMemo } from 'react';
import {
  Search,
  Link as LinkIcon,
  Unlink,
  Building2,
  FolderKanban,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { db } from '@/core/services/firebase';
import { useAllProjects } from '../hooks/project-hooks';
import { ManualRequisition, LinkToProjectData } from '../types/manual-requisition';
import { Project } from '../types/project';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface ProjectLinkingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisition: ManualRequisition;
  onLinkToProject: (data: LinkToProjectData) => Promise<void>;
  onUnlink?: () => Promise<void>;
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function ProjectLinkingDialog({
  open,
  onOpenChange,
  requisition,
  onLinkToProject,
  onUnlink,
  isLoading = false,
}: ProjectLinkingDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [linkingNotes, setLinkingNotes] = useState(requisition.linkingNotes || '');
  const [saving, setSaving] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  // Fetch all projects - no status filter to get all available projects
  const { projects, loading: loadingProjects } = useAllProjects(db, {
    orderBy: 'name',
  });

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.programName?.toLowerCase().includes(query) ||
        p.projectCode?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const handleLinkProject = async () => {
    if (!selectedProject) return;

    setSaving(true);
    try {
      await onLinkToProject({
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        programId: selectedProject.programId || '',
        programName: selectedProject.programName || '',
        linkingNotes: linkingNotes || '', // Use empty string instead of undefined for Firestore
      });
      onOpenChange(false);
      setSelectedProject(null);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to link project:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!onUnlink) return;

    setSaving(true);
    try {
      await onUnlink();
      onOpenChange(false);
      setShowUnlinkConfirm(false);
    } catch (error) {
      console.error('Failed to unlink project:', error);
    } finally {
      setSaving(false);
    }
  };

  const isLinked = requisition.linkStatus !== 'unlinked';

  // ─────────────────────────────────────────────────────────────────
  // RENDER: UNLINK CONFIRMATION
  // ─────────────────────────────────────────────────────────────────

  if (showUnlinkConfirm) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Confirm Unlink
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to unlink this requisition from{' '}
              <strong>{requisition.linkedProjectName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              This will remove the association between this manual requisition and the project.
              The requisition data will be preserved.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlinkConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlink}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Unlinking...
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4 mr-2" />
                  Unlink Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: MAIN DIALOG
  // ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            {isLinked ? 'Manage Project Link' : 'Link to Project'}
          </DialogTitle>
          <DialogDescription>
            {isLinked
              ? `This requisition is linked to ${requisition.linkedProjectName}`
              : 'Search and select a project to link this requisition to'}
          </DialogDescription>
        </DialogHeader>

        {/* Currently Linked Project */}
        {isLinked && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <FolderKanban className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">Currently Linked</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Project:</strong> {requisition.linkedProjectName}
                  </p>
                  {requisition.linkedProgramName && (
                    <p className="text-sm text-blue-600">
                      <strong>Program:</strong> {requisition.linkedProgramName}
                    </p>
                  )}
                  {requisition.linkingNotes && (
                    <p className="text-sm text-blue-600 mt-1">
                      <strong>Notes:</strong> {requisition.linkingNotes}
                    </p>
                  )}
                </div>
              </div>
              {onUnlink && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUnlinkConfirm(true)}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Unlink className="w-4 h-4 mr-1" />
                  Unlink
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search projects by name, code, or program..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto border rounded-lg mt-4 min-h-[200px] max-h-[300px]">
          {loadingProjects ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading projects...</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
              <Building2 className="w-10 h-10 text-gray-300 mb-2" />
              <p>No projects found</p>
              {searchQuery && (
                <p className="text-sm">Try a different search term</p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedProject?.id === project.id
                      ? 'bg-primary/10 border-l-4 border-l-primary'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{project.name}</span>
                        {project.projectCode && (
                          <Badge variant="outline" className="text-xs">
                            {project.projectCode}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            project.status === 'active'
                              ? 'text-green-600 border-green-300'
                              : project.status === 'planning'
                              ? 'text-blue-600 border-blue-300'
                              : 'text-yellow-600 border-yellow-300'
                          }`}
                        >
                          {project.status}
                        </Badge>
                      </div>
                      {project.programName && (
                        <p className="text-sm text-gray-500 mt-1">
                          Program: {project.programName}
                        </p>
                      )}
                      {project.description && (
                        <p className="text-sm text-gray-400 line-clamp-1 mt-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                    {selectedProject?.id === project.id && (
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linking Notes */}
        {selectedProject && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Linking Notes (Optional)
            </label>
            <Textarea
              value={linkingNotes}
              onChange={(e) => setLinkingNotes(e.target.value)}
              placeholder="Add notes about why this requisition is being linked to this project..."
              rows={2}
            />
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleLinkProject}
            disabled={!selectedProject || saving || isLoading}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4 mr-2" />
                {isLinked ? 'Update Link' : 'Link to Project'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectLinkingDialog;
