/**
 * Program Detail - Comprehensive program view
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  Edit,
  Trash2,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  Users,
  FolderOpen,
  Plus,
  Link2,
  Copy,
  Check,
  ExternalLink,
  X,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { useProgram, useProgramMutations } from '../hooks/program-hooks';
import { useProjects } from '../hooks/project-hooks';
import { StatusBadge } from '../components/common/StatusBadge';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import { getCDPortalService } from '../services/cd-portal.service';
import { PortalAccessToken } from '../types/country-director-dashboard';
import { getProgramMigrationService } from '../services/program-migration.service';

export function ProgramDetail() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPortalDialog, setShowPortalDialog] = useState(false);
  const [portalTokens, setPortalTokens] = useState<PortalAccessToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [newTokenExpiry, setNewTokenExpiry] = useState<number | null>(null);

  const { program, loading, error } = useProgram(db, programId || null);
  const { deleteProgram, loading: deleting } = useProgramMutations(db, user?.uid || '');
  const { projects, loading: projectsLoading } = useProjects(db, programId || null);

  // Debug: Fetch ALL projects to see what programIds exist
  const [allProjectsDebug, setAllProjectsDebug] = useState<{ id: string; name: string; programId: string }[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [fixingProject, setFixingProject] = useState<string | null>(null);

  // Fix orphaned project - assign it to this program using migration service
  const handleFixProjectProgram = async (projectId: string, projectName: string) => {
    if (!programId || !user) return;

    const confirmFix = window.confirm(
      `Move "${projectName}" to this program (${program?.name || programId})?\n\nThis will update the project's programId and any linked requisitions.`
    );

    if (!confirmFix) return;

    setFixingProject(projectId);
    try {
      const migrationService = getProgramMigrationService(db);
      const result = await migrationService.fixSingleProject(projectId, programId, user.uid);

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      // Refresh the debug data
      const { collection, getDocs } = await import('firebase/firestore');
      const projectsRef = collection(db, 'organizations/default/advisory_projects');
      const snapshot = await getDocs(projectsRef);
      const allProjects = snapshot.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        programId: d.data().programId || 'NOT SET',
      }));
      setAllProjectsDebug(allProjects);

      alert(`Successfully moved "${projectName}" to this program. Any linked requisitions were also updated.`);
    } catch (err: any) {
      console.error('Failed to fix project program:', err);
      alert(`Failed to fix project: ${err.message}`);
    } finally {
      setFixingProject(null);
    }
  };

  useEffect(() => {
    // Debug logging
    console.log('[ProgramDetail] Current programId from URL:', programId);
    console.log('[ProgramDetail] Program loaded:', program?.name, 'ID:', program?.id);
    console.log('[ProgramDetail] Projects found for this program:', projects.length);

    // Fetch ALL projects to debug
    const fetchAllProjects = async () => {
      const { collection, getDocs } = await import('firebase/firestore');
      const projectsRef = collection(db, 'organizations/default/advisory_projects');
      const snapshot = await getDocs(projectsRef);
      const allProjects = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        programId: doc.data().programId || 'NOT SET',
      }));
      console.log('[ProgramDetail DEBUG] ALL projects in system:', allProjects);
      setAllProjectsDebug(allProjects);

      // Also fetch all programs
      const programsRef = collection(db, 'organizations/default/advisory_programs');
      const programsSnapshot = await getDocs(programsRef);
      const allPrograms = programsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        code: doc.data().code,
      }));
      console.log('[ProgramDetail DEBUG] ALL programs in system:', allPrograms);
    };

    if (programId) {
      fetchAllProjects();
    }
  }, [programId, program, projects, db]);

  // Load portal tokens when dialog opens
  useEffect(() => {
    if (showPortalDialog && programId) {
      loadPortalTokens();
    }
  }, [showPortalDialog, programId]);

  const loadPortalTokens = async () => {
    if (!programId) return;
    setLoadingTokens(true);
    try {
      const service = getCDPortalService(db);
      const tokens = await service.getTokensForProgram(programId);
      setPortalTokens(tokens);
    } catch (err) {
      console.error('Failed to load portal tokens:', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleCreateToken = async () => {
    if (!programId || !program || !user) return;
    setCreatingToken(true);
    try {
      const service = getCDPortalService(db);
      await service.createToken(programId, program.name, user.uid, {
        label: newTokenLabel || undefined,
        expiresInDays: newTokenExpiry || undefined,
      });
      setNewTokenLabel('');
      setNewTokenExpiry(null);
      await loadPortalTokens();
    } catch (err) {
      console.error('Failed to create portal token:', err);
    } finally {
      setCreatingToken(false);
    }
  };

  const handleToggleToken = async (tokenId: string, isActive: boolean) => {
    try {
      const service = getCDPortalService(db);
      if (isActive) {
        await service.deactivateToken(tokenId);
      } else {
        await service.reactivateToken(tokenId);
      }
      await loadPortalTokens();
    } catch (err) {
      console.error('Failed to toggle token:', err);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    try {
      const service = getCDPortalService(db);
      await service.deleteToken(tokenId);
      await loadPortalTokens();
    } catch (err) {
      console.error('Failed to delete token:', err);
    }
  };

  const copyPortalUrl = (token: string, tokenId: string) => {
    const fullUrl = `${window.location.origin}/cd-portal?token=${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedTokenId(tokenId);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const handleDelete = async () => {
    if (!programId || !user) return;
    try {
      await deleteProgram(programId, 'Deleted by user');
      navigate('/advisory/delivery/programs');
    } catch (err) {
      console.error('Failed to delete program:', err);
    }
  };

  const formatBudget = (amount: number, currency: string) => {
    if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
    return `${currency} ${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading program...</span>
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

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link 
          to="/advisory/delivery/programs" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Programs
        </Link>
        
        <div className="flex items-center gap-2">
          <Link
            to={`/advisory/delivery/programs/${programId}/budget`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <DollarSign className="w-4 h-4" />
            Budget
          </Link>
          <button
            onClick={() => setShowPortalDialog(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Link2 className="w-4 h-4" />
            CD Portal
          </button>
          <Link
            to={`/advisory/delivery/programs/${programId}/edit`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Confirm?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500 font-mono">{program.code}</span>
              <StatusBadge status={program.status} size="sm" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
            <p className="text-gray-600 mt-1">{program.description || 'No description'}</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">Budget</div>
              <div className="font-medium">
                {formatBudget(program.budget?.allocated?.amount || 0, program.budget?.currency || 'USD')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">Projects</div>
              <div className="font-medium">{program.projectIds?.length || 0}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">Countries</div>
              <div className="font-medium">{program.coverage?.countries?.length || 0}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">End Date</div>
              <div className="font-medium">
                {program.endDate?.toDate?.()?.toLocaleDateString('en-GB', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                }) || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel - Shows when there are orphaned projects */}
      {allProjectsDebug.length > 0 && projects.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-800">Data Diagnostic</h3>
              <p className="text-sm text-amber-700 mt-1">
                Found {allProjectsDebug.length} projects in the system, but none are linked to this program (ID: <code className="bg-amber-100 px-1 rounded">{programId}</code>).
              </p>
              <div className="mt-2">
                <button
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="text-sm text-amber-700 underline"
                >
                  {showDebugPanel ? 'Hide details' : 'Show details'}
                </button>
              </div>
              {showDebugPanel && (
                <div className="mt-3 p-3 bg-white rounded border border-amber-200 text-xs overflow-auto max-h-64">
                  <p className="font-semibold mb-2">Projects and their programId:</p>
                  <div className="space-y-2">
                    {allProjectsDebug.map((p) => {
                      const isMismatch = p.programId !== programId;
                      const isFixing = fixingProject === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between p-2 rounded ${
                            isMismatch ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'
                          }`}
                        >
                          <div className="font-mono text-xs">
                            <span className={isMismatch ? 'text-amber-800' : 'text-green-800'}>
                              {p.name}
                            </span>
                            <span className="text-gray-500 ml-2 text-[10px]">
                              programId: {p.programId.substring(0, 8)}...
                            </span>
                            {isMismatch && (
                              <span className="ml-2 px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-[10px]">
                                MISMATCH
                              </span>
                            )}
                          </div>
                          {isMismatch && (
                            <button
                              onClick={() => handleFixProjectProgram(p.id, p.name)}
                              disabled={isFixing}
                              className="px-2 py-1 bg-amber-600 text-white text-[10px] rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isFixing ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Fixing...
                                </>
                              ) : (
                                'Fix'
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {allProjectsDebug.filter(p => p.programId !== programId).length > 1 && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <button
                        onClick={async () => {
                          const mismatchCount = allProjectsDebug.filter(p => p.programId !== programId).length;
                          if (!window.confirm(`This will update ${mismatchCount} mismatched projects. Continue?`)) return;
                          for (const p of allProjectsDebug.filter(proj => proj.programId !== programId)) {
                            await handleFixProjectProgram(p.id, p.name);
                          }
                        }}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded hover:bg-amber-700"
                      >
                        Fix All Mismatched ({allProjectsDebug.filter(p => p.programId !== programId).length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Projects Section */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-medium">Projects</h2>
          <Link
            to={`/advisory/delivery/projects/new?programId=${programId}&programName=${encodeURIComponent(program.name)}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Project
          </Link>
        </div>

        <div className="p-4">
          {projectsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-gray-600">Loading projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FolderOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No projects in this program yet</p>
              {allProjectsDebug.length > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  ({allProjectsDebug.length} projects found with different programId - see diagnostic above)
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(project => (
                <Link
                  key={project.id}
                  to={`/advisory/delivery/projects/${project.id}`}
                  className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-500">{project.projectCode}</span>
                        <StatusBadge status={project.status} size="sm" />
                      </div>
                      <div className="font-medium mt-1">{project.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {project.location?.region} • {project.location?.district}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Progress</div>
                      <div className="font-medium">{project.progress?.physicalProgress || 0}%</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Section */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-medium">Team</h2>
        </div>

        {program.managerId ? (
          <div className="text-gray-600">
            <div className="text-sm text-gray-500">Program Manager</div>
            <div className="font-medium">{program.managerId}</div>
          </div>
        ) : (
          <p className="text-gray-500">No team members assigned</p>
        )}
      </div>

      {/* Portal Access Dialog */}
      {showPortalDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Dialog Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Link2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Country Director Portal</h2>
                  <p className="text-sm text-gray-500">Create shareable access links for {program.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPortalDialog(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Create New Token */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Create New Portal Link</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Label (optional)</label>
                    <input
                      type="text"
                      value={newTokenLabel}
                      onChange={(e) => setNewTokenLabel(e.target.value)}
                      placeholder="e.g., Country Director - Uganda"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Expiration (optional)</label>
                    <select
                      value={newTokenExpiry || ''}
                      onChange={(e) => setNewTokenExpiry(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Never expires</option>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </div>
                  <button
                    onClick={handleCreateToken}
                    disabled={creatingToken}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {creatingToken ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create Portal Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Existing Tokens */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Existing Portal Links</h3>
                  <button
                    onClick={loadPortalTokens}
                    disabled={loadingTokens}
                    className="p-1.5 hover:bg-gray-100 rounded"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${loadingTokens ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : portalTokens.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Link2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No portal links created yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {portalTokens.map((token) => {
                      const isExpired = token.expiresAt &&
                        (token.expiresAt instanceof Date
                          ? token.expiresAt < new Date()
                          : token.expiresAt.toDate() < new Date());

                      return (
                        <div
                          key={token.id}
                          className={`border rounded-lg p-3 ${
                            !token.isActive || isExpired ? 'bg-gray-50 opacity-75' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 text-sm truncate">
                                  {token.label || 'Portal Link'}
                                </span>
                                {!token.isActive && (
                                  <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                                    Inactive
                                  </span>
                                )}
                                {isExpired && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                                    Expired
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                <div>Created: {token.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}</div>
                                {token.expiresAt && (
                                  <div>
                                    Expires:{' '}
                                    {token.expiresAt instanceof Date
                                      ? token.expiresAt.toLocaleDateString()
                                      : token.expiresAt.toDate?.()?.toLocaleDateString() || 'N/A'}
                                  </div>
                                )}
                                <div>Accessed: {token.accessCount} times</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Copy URL */}
                              <button
                                onClick={() => copyPortalUrl(token.token, token.id)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                                title="Copy portal URL"
                              >
                                {copiedTokenId === token.id ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4 text-gray-500" />
                                )}
                              </button>

                              {/* Open Portal */}
                              <a
                                href={`/cd-portal?token=${token.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-gray-100 rounded-lg"
                                title="Open portal"
                              >
                                <ExternalLink className="w-4 h-4 text-gray-500" />
                              </a>

                              {/* Toggle Active */}
                              <button
                                onClick={() => handleToggleToken(token.id, token.isActive)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                                title={token.isActive ? 'Deactivate' : 'Activate'}
                              >
                                {token.isActive ? (
                                  <EyeOff className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <Eye className="w-4 h-4 text-gray-500" />
                                )}
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteToken(token.id)}
                                className="p-2 hover:bg-red-50 rounded-lg"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowPortalDialog(false)}
                className="w-full px-4 py-2 border rounded-lg hover:bg-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
