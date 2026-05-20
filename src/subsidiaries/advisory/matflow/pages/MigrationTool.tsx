/**
 * MatFlow Data Migration Tool
 *
 * Client-side migration tool that moves projects from
 * root-level matflow_projects to organizations/{orgId}/advisory_projects
 *
 * This runs in the browser using the user's Firebase authentication
 */

import { useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { useGlobalState } from '@/integration/store/GlobalContext';
import { Loader2, Play, Eye, RefreshCw } from 'lucide-react';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

// Status mapping from MatFlow to Core
const STATUS_MAP: Record<string, string> = {
  'draft': 'planning',
  'planning': 'planning',
  'active': 'active',
  'on_hold': 'suspended',
  'completed': 'completed',
  'cancelled': 'cancelled',
};

const SUBCOLLECTIONS = ['boq_items', 'parsing_jobs', 'materials', 'formulas', 'procurement_entries'];

interface MigrationResults {
  totalFound: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: { projectId: string; error: string }[];
  subcollections: Record<string, Record<string, number>>;
}

interface MigrationLog {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export function MigrationTool() {
  const { state } = useGlobalState();
  const [dryRun, setDryRun] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [results, setResults] = useState<MigrationResults | null>(null);

  const orgId = state.currentOrganizationId || 'default';
  const userId = state.auth.userId || 'migration-tool';

  const addLog = (message: string, type: MigrationLog['type'] = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date(), message, type }]);
  };

  const getOrCreateDefaultProgram = async (): Promise<string> => {
    const programsRef = collection(db, `organizations/${orgId}/advisory_programs`);
    const q = query(programsRef, where('code', '==', 'MATFLOW'), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      addLog(`Found existing MatFlow program: ${snapshot.docs[0].id}`, 'success');
      return snapshot.docs[0].id;
    }

    if (dryRun) {
      addLog('[DRY RUN] Would create MatFlow default program', 'info');
      return 'MATFLOW_DEFAULT';
    }

    // Create default program
    const newProgramRef = doc(programsRef);
    await setDoc(newProgramRef, {
      name: 'MatFlow Projects',
      code: 'MATFLOW',
      description: 'Projects migrated from MatFlow module',
      status: 'active',
      implementationType: 'direct',
      location: { country: 'UG', region: 'Central' },
      budget: { currency: 'UGX', totalBudget: 0, spent: 0, remaining: 0 },
      projectStats: {
        total: 0,
        byStatus: {
          planning: 0, procurement: 0, mobilization: 0, active: 0,
          substantial_completion: 0, defects_liability: 0, completed: 0,
          suspended: 0, cancelled: 0,
        },
      },
      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
      isDeleted: false,
    });

    addLog(`Created MatFlow default program: ${newProgramRef.id}`, 'success');
    return newProgramRef.id;
  };

  const migrateSubcollections = async (
    sourceProjectId: string,
    targetProjectId: string
  ): Promise<Record<string, number>> => {
    const results: Record<string, number> = {};

    for (const subcollection of SUBCOLLECTIONS) {
      const sourceRef = collection(db, `matflow_projects/${sourceProjectId}/${subcollection}`);
      const snapshot = await getDocs(sourceRef);

      results[subcollection] = snapshot.size;

      if (snapshot.empty) continue;

      if (dryRun) {
        addLog(`  [DRY RUN] Would copy ${snapshot.size} ${subcollection} documents`, 'info');
        continue;
      }

      // Copy each document in batches
      const targetRef = collection(db, `organizations/${orgId}/advisory_projects/${targetProjectId}/${subcollection}`);
      let count = 0;
      let batch = writeBatch(db);

      for (const docSnap of snapshot.docs) {
        batch.set(doc(targetRef, docSnap.id), {
          ...docSnap.data(),
          migratedAt: Timestamp.now(),
        });
        count++;

        // Commit every 400 docs
        if (count % 400 === 0) {
          await batch.commit();
          addLog(`    Committed ${count} ${subcollection} documents...`, 'info');
          batch = writeBatch(db);
        }
      }

      await batch.commit();
      addLog(`  ✓ Migrated ${snapshot.size} ${subcollection} documents`, 'success');
    }

    return results;
  };

  const runMigration = async () => {
    setIsRunning(true);
    setLogs([]);
    setResults(null);

    const migrationResults: MigrationResults = {
      totalFound: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      subcollections: {},
    };

    try {
      addLog('='.repeat(50), 'info');
      addLog('MatFlow to Advisory Projects Migration', 'info');
      addLog('='.repeat(50), 'info');
      addLog(`Organization: ${orgId}`, 'info');
      addLog(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`, 'info');
      addLog('', 'info');

      // Step 1: Get or create default program
      addLog('📁 Step 1: Setting up default program...', 'info');
      const programId = await getOrCreateDefaultProgram();

      // Step 2: Get all MatFlow projects
      addLog('', 'info');
      addLog('📦 Step 2: Fetching MatFlow projects...', 'info');
      const matflowRef = collection(db, 'matflow_projects');
      const matflowSnapshot = await getDocs(matflowRef);

      migrationResults.totalFound = matflowSnapshot.size;
      addLog(`Found ${matflowSnapshot.size} projects in matflow_projects collection`, 'info');

      if (matflowSnapshot.empty) {
        addLog('', 'warning');
        addLog('⚠ No MatFlow projects found in root matflow_projects collection.', 'warning');
        addLog('', 'info');
        addLog('This could mean:', 'info');
        addLog('  - Projects were created directly in advisory_projects', 'info');
        addLog('  - Projects are under organizations/{orgId}/matflow_projects', 'info');
        addLog('  - No projects have been created yet', 'info');

        // Check if there are projects in advisory_projects
        addLog('', 'info');
        addLog('📋 Checking advisory_projects...', 'info');
        const advisoryRef = collection(db, `organizations/${orgId}/advisory_projects`);
        const advisorySnapshot = await getDocs(advisoryRef);
        if (!advisorySnapshot.empty) {
          addLog(`✓ Found ${advisorySnapshot.size} projects in advisory_projects:`, 'success');
          advisorySnapshot.docs.forEach((d, i) => {
            const data = d.data();
            addLog(`  ${i + 1}. ${data.name || d.id} (${data.status || 'unknown'})`, 'info');
          });
        } else {
          addLog('  No projects found in advisory_projects', 'warning');
        }

        // Check organizations/{orgId}/matflow_projects (nested)
        addLog('', 'info');
        addLog('📋 Checking organizations/{orgId}/matflow_projects...', 'info');
        const nestedMatflowRef = collection(db, `organizations/${orgId}/matflow_projects`);
        const nestedMatflowSnapshot = await getDocs(nestedMatflowRef);
        if (!nestedMatflowSnapshot.empty) {
          addLog(`Found ${nestedMatflowSnapshot.size} projects in nested matflow_projects:`, 'warning');
          nestedMatflowSnapshot.docs.forEach((d, i) => {
            const data = d.data();
            addLog(`  ${i + 1}. ${data.name || d.id} (${data.status || 'unknown'})`, 'info');
          });
          addLog('', 'info');
          addLog('NOTE: These projects need to be migrated from the nested matflow_projects collection.', 'warning');
          addLog('The migration tool currently reads from root-level matflow_projects.', 'warning');
        } else {
          addLog('  No projects found in nested matflow_projects', 'info');
        }

        setResults(migrationResults);
        setIsRunning(false);
        return;
      }

      // Step 3: Migrate each project
      addLog('', 'info');
      addLog('🔄 Step 3: Migrating projects...', 'info');
      addLog('', 'info');

      const targetRef = collection(db, `organizations/${orgId}/advisory_projects`);

      for (const docSnap of matflowSnapshot.docs) {
        const projectId = docSnap.id;
        const data = docSnap.data();

        addLog(`Project: ${data.name || projectId}`, 'info');
        addLog(`  ID: ${projectId}`, 'info');
        addLog(`  Status: ${data.status} → ${STATUS_MAP[data.status] || 'planning'}`, 'info');

        // Check if already migrated
        const existingDoc = await getDoc(doc(targetRef, projectId));
        if (existingDoc.exists()) {
          addLog(`  ⚠ Already exists in advisory_projects, skipping`, 'warning');
          migrationResults.skipped++;
          continue;
        }

        // Transform project data
        const transformedProject = {
          ...data,
          programId,
          status: STATUS_MAP[data.status] || 'planning',
          projectType: data.projectType || data.type || 'new_construction',
          location: data.location || { country: 'UG', region: '' },
          budget: data.budget || {
            currency: 'UGX', totalBudget: 0, spent: 0, remaining: 0,
            variance: 0, varianceStatus: 'on_track',
          },
          progress: data.progress || {
            physicalProgress: 0, financialProgress: 0, completionPercent: 0,
          },
          timeline: data.timeline || {
            plannedStartDate: data.startDate || Timestamp.now(),
            plannedEndDate: data.endDate || Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
            isDelayed: false,
          },
          migratedFrom: 'matflow_projects',
          migratedAt: Timestamp.now(),
          originalId: projectId,
          isDeleted: data.isDeleted || false,
          version: data.version || 1,
        };

        if (dryRun) {
          addLog(`  [DRY RUN] Would migrate project with transformed data`, 'info');
          const subResults = await migrateSubcollections(projectId, projectId);
          migrationResults.subcollections[projectId] = subResults;
          migrationResults.migrated++;
        } else {
          try {
            await setDoc(doc(targetRef, projectId), transformedProject);
            addLog(`  ✓ Migrated project data`, 'success');

            const subResults = await migrateSubcollections(projectId, projectId);
            migrationResults.subcollections[projectId] = subResults;
            migrationResults.migrated++;
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            addLog(`  ✗ Error: ${error}`, 'error');
            migrationResults.failed++;
            migrationResults.errors.push({ projectId, error });
          }
        }

        addLog('', 'info');
      }

      // Step 4: Update program stats
      if (!dryRun && migrationResults.migrated > 0) {
        addLog('📊 Step 4: Updating program stats...', 'info');
        await updateDoc(doc(db, `organizations/${orgId}/advisory_programs/${programId}`), {
          'projectStats.total': migrationResults.migrated,
          updatedAt: Timestamp.now(),
        });
        addLog(`  ✓ Updated program with ${migrationResults.migrated} projects`, 'success');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`❌ Migration failed: ${errorMsg}`, 'error');
      migrationResults.errors.push({ projectId: 'global', error: errorMsg });
    }

    // Print summary
    addLog('', 'info');
    addLog('='.repeat(50), 'info');
    addLog('MIGRATION SUMMARY', 'info');
    addLog('='.repeat(50), 'info');
    addLog(`Total projects found: ${migrationResults.totalFound}`, 'info');
    addLog(`Migrated: ${migrationResults.migrated}`, migrationResults.migrated > 0 ? 'success' : 'info');
    addLog(`Skipped (already exists): ${migrationResults.skipped}`, 'warning');
    addLog(`Failed: ${migrationResults.failed}`, migrationResults.failed > 0 ? 'error' : 'info');
    addLog(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`, 'info');
    addLog('='.repeat(50), 'info');

    setResults(migrationResults);
    setIsRunning(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">MatFlow Data Migration</h1>
        <p className="text-gray-600 mt-1">
          Migrate projects from legacy <code className="bg-gray-100 px-1 rounded">matflow_projects</code> to{' '}
          <code className="bg-gray-100 px-1 rounded">organizations/{orgId}/advisory_projects</code>
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Dry Run</span>
              <span className="text-xs text-gray-500">(preview without changes)</span>
            </label>
          </div>

          <button
            onClick={runMigration}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : dryRun
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : dryRun ? (
              <>
                <Eye className="w-4 h-4" />
                Preview Migration
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Migration
              </>
            )}
          </button>
        </div>

        {!dryRun && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> Live mode will write data to Firestore. Make sure you've tested with dry run first.
            </p>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {results && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Results</h2>
          <KPIGrid cols={4}>
            <KPICard label="Found" value={results.totalFound} />
            <KPICard label="Migrated" value={results.migrated} trend="up" />
            <KPICard label="Skipped" value={results.skipped} trend="flat" />
            <KPICard label="Failed" value={results.failed} trend={results.failed > 0 ? 'down' : 'flat'} />
          </KPIGrid>
        </div>
      )}

      {/* Log Output */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Migration Log</h2>
            <button
              onClick={() => setLogs([])}
              className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Clear
            </button>
          </div>
          <div className="font-mono text-sm max-h-96 overflow-y-auto space-y-1">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`${
                  log.type === 'error'
                    ? 'text-red-400'
                    : log.type === 'success'
                    ? 'text-green-400'
                    : log.type === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }`}
              >
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MigrationTool;
