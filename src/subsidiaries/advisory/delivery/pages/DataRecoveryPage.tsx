/**
 * Data Recovery Page
 *
 * Utility to check for and recover deleted program data.
 * Access via: /advisory/delivery/data-recovery
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Database,
  Search,
  Plus,
} from 'lucide-react';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

interface ProgramInfo {
  id: string;
  name: string;
  code: string;
  location: 'old' | 'new';
}

interface ProjectInfo {
  id: string;
  name: string;
  programId: string;
  programName?: string;
}

interface TokenInfo {
  id: string;
  programId: string;
  programName: string;
  label: string;
  isActive: boolean;
}

export function DataRecoveryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<ProgramInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Form state for creating program
  const [newProgram, setNewProgram] = useState({
    name: 'AMH Uganda Program',
    code: 'AMH-UG',
    description: 'AMH Uganda infrastructure development program',
  });

  const scanData = async () => {
    setLoading(true);
    setError(null);
    setPrograms([]);
    setProjects([]);

    try {
      // Check old programs collection
      const oldProgramsRef = collection(db, 'programs');
      const oldSnapshot = await getDocs(oldProgramsRef);
      const oldPrograms: ProgramInfo[] = oldSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Unknown',
        code: doc.data().code || 'N/A',
        location: 'old',
      }));

      // Check new programs collection
      const newProgramsRef = collection(db, 'organizations/default/advisory_programs');
      const newSnapshot = await getDocs(newProgramsRef);
      const newPrograms: ProgramInfo[] = newSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Unknown',
        code: doc.data().code || 'N/A',
        location: 'new',
      }));

      setPrograms([...oldPrograms, ...newPrograms]);

      // Check all projects
      const projectsRef = collection(db, 'organizations/default/advisory_projects');
      const projectsSnapshot = await getDocs(projectsRef);
      const allProjects: ProjectInfo[] = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Unknown',
        programId: doc.data().programId || 'NOT SET',
        programName: doc.data().programName,
      }));

      setProjects(allProjects);

      // Check portal_access_tokens collection - this stores programId/programName
      // even if the program document is deleted
      const tokensRef = collection(db, 'portal_access_tokens');
      const tokensSnapshot = await getDocs(tokensRef);
      const allTokens: TokenInfo[] = tokensSnapshot.docs.map(doc => ({
        id: doc.id,
        programId: doc.data().programId || 'Unknown',
        programName: doc.data().programName || 'Unknown',
        label: doc.data().label || 'No label',
        isActive: doc.data().isActive ?? true,
      }));
      setTokens(allTokens);

      console.log('[Recovery] Found programs:', { old: oldPrograms, new: newPrograms });
      console.log('[Recovery] Found projects:', allProjects);
      console.log('[Recovery] Found portal tokens:', allTokens);
    } catch (err: any) {
      setError(err.message || 'Failed to scan data');
      console.error('[Recovery] Scan failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Restore program from token data (uses the stored programId)
  const restoreFromToken = async (token: TokenInfo) => {
    if (!user) {
      setError('You must be logged in');
      return;
    }

    setRestoring(true);
    setError(null);

    try {
      // Create the program with the SAME ID from the token
      const programRef = doc(db, 'organizations/default/advisory_programs', token.programId);

      await setDoc(programRef, {
        name: token.programName,
        code: token.programName.replace(/\s+/g, '-').toUpperCase().substring(0, 10),
        description: `Restored program: ${token.programName}`,
        status: 'active',
        budget: {
          currency: 'UGX',
          allocated: { amount: 0, currency: 'UGX' },
          spent: { amount: 0, currency: 'UGX' },
          remaining: { amount: 0, currency: 'UGX' },
        },
        coverage: {
          countries: ['Uganda'],
          regions: [],
        },
        projectIds: [],
        createdAt: Timestamp.now(),
        createdBy: user.uid,
        updatedAt: Timestamp.now(),
        updatedBy: user.uid,
        restoredAt: Timestamp.now(),
        restoredFrom: 'portal_access_token',
      });

      console.log('[Recovery] Restored program with ID:', token.programId);
      setCreateSuccess(true);
      alert(`Successfully restored "${token.programName}" with ID ${token.programId}!\n\nAll projects and requisitions linked to this program should now work correctly.`);

      // Refresh the scan
      await scanData();
    } catch (err: any) {
      setError(err.message || 'Failed to restore program');
      console.error('[Recovery] Restore failed:', err);
    } finally {
      setRestoring(false);
    }
  };

  const createProgram = async () => {
    if (!user) {
      setError('You must be logged in');
      return;
    }

    setCreating(true);
    setError(null);
    setCreateSuccess(false);

    try {
      const programRef = doc(collection(db, 'organizations/default/advisory_programs'));

      await setDoc(programRef, {
        name: newProgram.name,
        code: newProgram.code,
        description: newProgram.description,
        status: 'active',
        budget: {
          currency: 'UGX',
          allocated: { amount: 0, currency: 'UGX' },
          spent: { amount: 0, currency: 'UGX' },
          remaining: { amount: 0, currency: 'UGX' },
        },
        coverage: {
          countries: ['Uganda'],
          regions: [],
        },
        projectIds: [],
        createdAt: Timestamp.now(),
        createdBy: user.uid,
        updatedAt: Timestamp.now(),
        updatedBy: user.uid,
      });

      console.log('[Recovery] Created program with ID:', programRef.id);
      setCreateSuccess(true);

      // Refresh the scan
      await scanData();
    } catch (err: any) {
      setError(err.message || 'Failed to create program');
      console.error('[Recovery] Create failed:', err);
    } finally {
      setCreating(false);
    }
  };

  // Group projects by programId
  const projectsByProgram = projects.reduce((acc, project) => {
    const key = project.programId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(project);
    return acc;
  }, {} as Record<string, ProjectInfo[]>);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link
        to="/advisory/delivery/programs"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Programs
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Database className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Recovery</h1>
            <p className="text-gray-600">
              Scan for existing programs and recover missing data
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Success Display */}
      {createSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Program created successfully! You can now assign projects to it.
        </div>
      )}

      {/* Scan Button */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-500" />
          Step 1: Scan Database
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Click to scan both old and new program collections and list all projects.
        </p>
        <button
          onClick={scanData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Scan Database
            </>
          )}
        </button>

        {/* Scan Summary - Always visible after scan */}
        {(programs.length > 0 || projects.length > 0 || tokens.length > 0) && (
          <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
            <p className="font-medium mb-1">Scan Results:</p>
            <ul className="text-gray-600 space-y-1">
              <li>• Programs found: {programs.length}</li>
              <li>• Projects found: {projects.length}</li>
              <li>• Portal tokens found: {tokens.length}</li>
              <li>• Orphaned projects (missing program): {
                Object.entries(
                  projects.reduce((acc, p) => {
                    if (!acc[p.programId]) acc[p.programId] = [];
                    acc[p.programId].push(p);
                    return acc;
                  }, {} as Record<string, typeof projects>)
                ).filter(([pid]) => !programs.some(prog => prog.id === pid)).length
              } groups</li>
            </ul>

            {/* Debug: Show all program IDs from projects vs found programs */}
            <div className="mt-3 pt-3 border-t border-gray-300">
              <p className="font-medium mb-1">Debug - Program IDs in projects:</p>
              <ul className="text-xs font-mono text-gray-500">
                {[...new Set(projects.map(p => p.programId))].map(pid => {
                  const exists = programs.some(prog => prog.id === pid);
                  const progName = programs.find(prog => prog.id === pid)?.name;
                  return (
                    <li key={pid} className={exists ? 'text-green-600' : 'text-red-600'}>
                      {pid.substring(0, 20)}... → {exists ? `EXISTS (${progName})` : 'MISSING - NEEDS RESTORE'}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {programs.length > 0 && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Found Programs ({programs.length})</h2>
          <div className="space-y-2">
            {programs.map((program) => (
              <div
                key={`${program.location}-${program.id}`}
                className={`p-3 rounded-lg border ${
                  program.location === 'new' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{program.name}</span>
                    <span className="text-gray-500 ml-2">({program.code})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      program.location === 'new' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {program.location === 'new' ? 'Current' : 'Old Collection'}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{program.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portal Tokens - Critical for recovery */}
      {tokens.length > 0 && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-medium mb-4 text-purple-700">
            Portal Access Tokens ({tokens.length})
            <span className="text-sm font-normal text-gray-500 ml-2">
              These store programId even if program was deleted
            </span>
          </h2>
          <div className="space-y-2">
            {tokens.map((token) => {
              const programExists = programs.some(p => p.id === token.programId);
              return (
                <div
                  key={token.id}
                  className={`p-3 rounded-lg border ${
                    programExists ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{token.programName}</span>
                      <span className="text-gray-500 ml-2 text-sm">({token.label})</span>
                      {!token.isActive && (
                        <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!programExists && (
                        <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded">
                          Program Missing!
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-mono">{token.programId}</span>
                    </div>
                  </div>
                  {!programExists && (
                    <div className="mt-2 pt-2 border-t border-red-200">
                      <button
                        onClick={() => restoreFromToken(token)}
                        disabled={restoring}
                        className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                        {restoring ? 'Restoring...' : `Restore "${token.programName}" with this ID`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Orphaned Projects - Projects with missing programs */}
      {projects.length > 0 && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Projects by Program ({projects.length} total)</h2>

          {/* Check if there are any orphaned projects */}
          {(() => {
            const orphanedGroups = Object.entries(projectsByProgram).filter(
              ([pid]) => !programs.some(prog => prog.id === pid)
            );
            if (orphanedGroups.length === 0) {
              return (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <p className="text-green-800 font-medium">All projects are linked to existing programs.</p>
                  <p className="text-green-600 text-sm">No recovery needed.</p>
                </div>
              );
            }
            return null;
          })()}

          <div className="space-y-4">
            {Object.entries(projectsByProgram).map(([programId, projectList]) => {
              const matchingProgram = programs.find(p => p.id === programId);
              const isOrphaned = !matchingProgram;
              const programNameFromProject = projectList[0]?.programName;

              return (
                <div key={programId} className={`border rounded-lg p-3 ${isOrphaned ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                  <div className="font-medium text-sm mb-2 flex items-center justify-between">
                    <span>
                      Program: {matchingProgram?.name || programNameFromProject || 'Unknown'}
                      <span className="text-gray-500 ml-1">({projectList.length} projects)</span>
                      {isOrphaned ? (
                        <span className="ml-2 px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded">
                          PROGRAM MISSING!
                        </span>
                      ) : (
                        <span className="ml-2 px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded">
                          EXISTS
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{programId}</span>
                  </div>
                  <div className="space-y-1">
                    {projectList.map(project => (
                      <div key={project.id} className="text-sm text-gray-600 pl-4">
                        • {project.name} {project.programName && <span className="text-gray-400">(stored name: {project.programName})</span>}
                      </div>
                    ))}
                  </div>

                  {/* Always show program ID for reference */}
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                    <strong>Program ID:</strong> <code className="bg-gray-100 px-1 rounded">{programId}</code>
                    {matchingProgram && (
                      <span className="ml-4">
                        <strong>Location:</strong> {matchingProgram.location === 'new' ? 'Current collection' : 'Old collection'}
                      </span>
                    )}
                  </div>
                  {isOrphaned && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Enter program name to restore"
                          defaultValue={programNameFromProject || ''}
                          id={`restore-name-${programId}`}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        />
                        <button
                          onClick={async () => {
                            const inputEl = document.getElementById(`restore-name-${programId}`) as HTMLInputElement;
                            const programName = inputEl?.value?.trim();
                            if (!programName) {
                              setError('Please enter a program name');
                              return;
                            }
                            if (!user) {
                              setError('You must be logged in');
                              return;
                            }
                            setRestoring(true);
                            setError(null);
                            try {
                              const programRef = doc(db, 'organizations/default/advisory_programs', programId);
                              await setDoc(programRef, {
                                name: programName,
                                code: programName.replace(/\s+/g, '-').toUpperCase().substring(0, 10),
                                description: `Restored program: ${programName}`,
                                status: 'active',
                                budget: {
                                  currency: 'UGX',
                                  allocated: { amount: 0, currency: 'UGX' },
                                  spent: { amount: 0, currency: 'UGX' },
                                  remaining: { amount: 0, currency: 'UGX' },
                                },
                                coverage: {
                                  countries: ['Uganda'],
                                  regions: [],
                                },
                                projectIds: projectList.map(p => p.id),
                                createdAt: Timestamp.now(),
                                createdBy: user.uid,
                                updatedAt: Timestamp.now(),
                                updatedBy: user.uid,
                                restoredAt: Timestamp.now(),
                                restoredFrom: 'orphaned_projects',
                              });
                              setCreateSuccess(true);
                              alert(`Successfully restored "${programName}" with ID ${programId}!\n\nAll ${projectList.length} projects are now linked correctly.`);
                              await scanData();
                            } catch (err: any) {
                              setError(err.message || 'Failed to restore program');
                            } finally {
                              setRestoring(false);
                            }
                          }}
                          disabled={restoring}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          {restoring ? 'Restoring...' : 'Restore with this ID'}
                        </button>
                      </div>
                      <p className="text-xs text-red-600">
                        This will create the program document with ID: <span className="font-mono">{programId}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Force Restore by ID - Bypass detection logic */}
      <div className="bg-white rounded-lg border border-orange-300 p-6 mb-6">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          Force Restore Program by ID
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          If the scan incorrectly shows a program as "EXISTS" but it doesn't appear in the programs list,
          use this to force-create/restore the program with a specific ID.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program ID (required)</label>
            <input
              type="text"
              id="force-restore-id"
              defaultValue="ZHpnxjuSPiHJkWX3wS2C"
              className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono text-sm"
              placeholder="Enter the exact program ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Name (required)</label>
            <input
              type="text"
              id="force-restore-name"
              defaultValue="AMH Uganda Program"
              className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="Enter the program name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Code</label>
            <input
              type="text"
              id="force-restore-code"
              defaultValue="AMH-UG"
              className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="Enter the program code"
            />
          </div>

          <button
            onClick={async () => {
              const idInput = document.getElementById('force-restore-id') as HTMLInputElement;
              const nameInput = document.getElementById('force-restore-name') as HTMLInputElement;
              const codeInput = document.getElementById('force-restore-code') as HTMLInputElement;

              const programId = idInput?.value?.trim();
              const programName = nameInput?.value?.trim();
              const programCode = codeInput?.value?.trim() || programName?.replace(/\s+/g, '-').toUpperCase().substring(0, 10);

              if (!programId) {
                setError('Please enter a program ID');
                return;
              }
              if (!programName) {
                setError('Please enter a program name');
                return;
              }
              if (!user) {
                setError('You must be logged in');
                return;
              }

              setRestoring(true);
              setError(null);

              try {
                const programRef = doc(db, 'organizations/default/advisory_programs', programId);
                await setDoc(programRef, {
                  name: programName,
                  code: programCode,
                  description: `Force-restored program: ${programName}`,
                  status: 'active',
                  budget: {
                    currency: 'UGX',
                    allocated: { amount: 0, currency: 'UGX' },
                    spent: { amount: 0, currency: 'UGX' },
                    remaining: { amount: 0, currency: 'UGX' },
                  },
                  coverage: {
                    countries: ['Uganda'],
                    regions: [],
                  },
                  projectIds: [],
                  createdAt: Timestamp.now(),
                  createdBy: user.uid,
                  updatedAt: Timestamp.now(),
                  updatedBy: user.uid,
                  restoredAt: Timestamp.now(),
                  restoredFrom: 'force_restore',
                });

                setCreateSuccess(true);
                alert(`Successfully force-restored "${programName}" with ID ${programId}!\n\nAll projects and requisitions linked to this ID should now work correctly.`);
                await scanData();
              } catch (err: any) {
                setError(err.message || 'Failed to force-restore program');
              } finally {
                setRestoring(false);
              }
            }}
            disabled={restoring}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {restoring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Force Restoring...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Force Restore Program
              </>
            )}
          </button>

          <p className="text-xs text-orange-600">
            ⚠️ This will create or overwrite the program document with the specified ID.
          </p>
        </div>
      </div>

      {/* Create New Program */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-gray-500" />
          Step 3: Create NEW Program (Different ID)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          If your program is missing, create it here. You can then use the Data Migration page to move projects to it.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Name</label>
            <input
              type="text"
              value={newProgram.name}
              onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Code</label>
            <input
              type="text"
              value={newProgram.code}
              onChange={(e) => setNewProgram({ ...newProgram, code: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={newProgram.description}
              onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              rows={2}
            />
          </div>

          <button
            onClick={createProgram}
            disabled={creating || !newProgram.name || !newProgram.code}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Program
              </>
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2">Recovery Steps:</h3>
        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
          <li>Click "Scan Database" to see all existing programs and projects</li>
          <li>If AMH Uganda Program is missing, create it using the form above</li>
          <li>Note the new program's ID after creation</li>
          <li>Go to <Link to="/advisory/delivery/data-migration" className="underline">Data Migration</Link> to move projects from "General Projects" to your new program</li>
        </ol>
      </div>
    </div>
  );
}
