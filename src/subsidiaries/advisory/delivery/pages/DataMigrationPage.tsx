/**
 * Data Migration Page
 *
 * Utility page to fix data issues like projects linked to wrong programs.
 * Access via: /advisory/delivery/data-migration
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
  ArrowRight,
  Folder,
  FileText,
} from 'lucide-react';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import { getProgramMigrationService } from '../services/program-migration.service';
import { useAllPrograms } from '../hooks/program-hooks';

interface PreviewData {
  targetProgram: { id: string; name: string } | null;
  defaultProgram: { id: string; name: string } | null;
  projectsToFix: { id: string; name: string; linkedRequisitions: number }[];
}

interface MigrationResult {
  success: boolean;
  projectsFixed: number;
  requisitionsFixed: number;
  details: { projectName: string; projectId: string; requisitionsUpdated: number }[];
  errors: string[];
}

export function DataMigrationPage() {
  const { user } = useAuth();
  const { programs, loading: programsLoading } = useAllPrograms(db);

  const [selectedTargetProgramId, setSelectedTargetProgramId] = useState<string>('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load preview when target program is selected
  const loadPreview = async () => {
    if (!selectedTargetProgramId) return;

    setLoadingPreview(true);
    setError(null);
    setMigrationResult(null);

    try {
      const service = getProgramMigrationService(db);
      const previewData = await service.previewDefaultProgramFix(selectedTargetProgramId);
      setPreview(previewData);
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Run migration
  const runMigration = async (projectNames?: string[]) => {
    if (!selectedTargetProgramId || !user) return;

    setMigrating(true);
    setError(null);

    try {
      const service = getProgramMigrationService(db);
      const result = await service.fixProjectsFromDefaultProgram(
        selectedTargetProgramId,
        user.uid,
        projectNames
      );
      setMigrationResult(result);

      // Refresh preview
      await loadPreview();
    } catch (err: any) {
      setError(err.message || 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

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
          <div className="p-2 bg-blue-100 rounded-lg">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Migration</h1>
            <p className="text-gray-600">
              Fix projects that were accidentally linked to "General Projects"
            </p>
          </div>
        </div>
      </div>

      {/* Link to Data Recovery */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-medium">Missing a program?</p>
              <p className="text-red-700">If a program was deleted, use Data Recovery to restore it.</p>
            </div>
          </div>
          <Link
            to="/advisory/delivery/data-recovery"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Go to Data Recovery
          </Link>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">What this does:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Finds projects currently in the "General Projects" (DEFAULT) program</li>
              <li>Moves them to your selected target program</li>
              <li>Updates all linked requisitions to reference the correct program</li>
            </ul>
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

      {/* Migration Result */}
      {migrationResult && (
        <div className={`mb-6 p-4 rounded-lg border ${
          migrationResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            {migrationResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <div className="flex-1">
              <h3 className={`font-medium ${migrationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {migrationResult.success ? 'Migration Complete' : 'Migration Failed'}
              </h3>
              <div className="mt-2 text-sm space-y-1">
                <p>Projects fixed: <strong>{migrationResult.projectsFixed}</strong></p>
                <p>Requisitions updated: <strong>{migrationResult.requisitionsFixed}</strong></p>
              </div>
              {migrationResult.details.length > 0 && (
                <div className="mt-3 text-sm">
                  <p className="font-medium mb-1">Details:</p>
                  <ul className="space-y-1">
                    {migrationResult.details.map((d, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        {d.projectName} ({d.requisitionsUpdated} requisitions)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {migrationResult.errors.length > 0 && (
                <div className="mt-3 text-sm text-red-700">
                  <p className="font-medium mb-1">Errors:</p>
                  <ul className="list-disc list-inside">
                    {migrationResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Select Target Program */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm">1</span>
          Select Target Program
        </h2>

        {programsLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading programs...
          </div>
        ) : (
          <div className="space-y-3">
            <select
              value={selectedTargetProgramId}
              onChange={(e) => {
                setSelectedTargetProgramId(e.target.value);
                setPreview(null);
                setMigrationResult(null);
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">-- Select the program to move projects TO --</option>
              {programs
                .filter(p => p.code !== 'DEFAULT' && p.name !== 'General Projects')
                .map(program => (
                  <option key={program.id} value={program.id}>
                    {program.code} - {program.name}
                  </option>
                ))}
            </select>

            {selectedTargetProgramId && (
              <button
                onClick={loadPreview}
                disabled={loadingPreview}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {loadingPreview ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Load Preview
              </button>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Preview */}
      {preview && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm">2</span>
            Preview Changes
          </h2>

          {/* Programs */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">From</div>
              <div className="px-3 py-2 bg-amber-100 border border-amber-200 rounded-lg">
                <div className="font-medium text-amber-800">
                  {preview.defaultProgram?.name || 'No default program found'}
                </div>
                {preview.defaultProgram && (
                  <div className="text-xs text-amber-600 font-mono">
                    {preview.defaultProgram.id.substring(0, 8)}...
                  </div>
                )}
              </div>
            </div>

            <ArrowRight className="w-6 h-6 text-gray-400" />

            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">To</div>
              <div className="px-3 py-2 bg-green-100 border border-green-200 rounded-lg">
                <div className="font-medium text-green-800">
                  {preview.targetProgram?.name || 'Unknown'}
                </div>
                {preview.targetProgram && (
                  <div className="text-xs text-green-600 font-mono">
                    {preview.targetProgram.id.substring(0, 8)}...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Projects to fix */}
          {preview.projectsToFix.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
              <p>No projects in "General Projects" need to be moved.</p>
              <p className="text-sm mt-1">All projects are correctly assigned.</p>
            </div>
          ) : (
            <div>
              <h3 className="font-medium text-gray-700 mb-3">
                Projects to move ({preview.projectsToFix.length}):
              </h3>
              <div className="space-y-2 mb-4">
                {preview.projectsToFix.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-amber-600" />
                      <div>
                        <div className="font-medium text-amber-800">{project.name}</div>
                        <div className="text-xs text-amber-600 font-mono">{project.id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {project.linkedRequisitions} requisition{project.linkedRequisitions !== 1 ? 's' : ''}
                      </div>
                      <button
                        onClick={() => runMigration([project.name])}
                        disabled={migrating}
                        className="px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 disabled:opacity-50"
                      >
                        {migrating ? 'Moving...' : 'Move'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Move All Button */}
              {preview.projectsToFix.length > 1 && (
                <button
                  onClick={() => runMigration()}
                  disabled={migrating}
                  className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {migrating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Moving all projects...
                    </>
                  ) : (
                    <>
                      Move All {preview.projectsToFix.length} Projects
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
