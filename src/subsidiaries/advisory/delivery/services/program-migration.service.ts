/**
 * PROGRAM MIGRATION SERVICE
 *
 * Migrates programs from the old 'programs' root collection to the new
 * 'organizations/default/advisory_programs' collection path.
 *
 * Also fixes project-program linkage issues caused by the path mismatch.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Firestore,
  Timestamp,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const OLD_PROGRAMS_PATH = 'programs';
const NEW_PROGRAMS_PATH = 'organizations/default/advisory_programs';
const PROJECTS_PATH = 'organizations/default/advisory_projects';
const REQUISITIONS_PATH = 'manual_requisitions';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface MigrationResult {
  success: boolean;
  programsMigrated: number;
  programsSkipped: number;
  projectsFixed: number;
  requisitionsFixed: number;
  errors: string[];
  details: MigrationDetail[];
}

export interface MigrationDetail {
  type: 'program' | 'project' | 'requisition';
  id: string;
  name?: string;
  action: 'migrated' | 'skipped' | 'fixed' | 'error';
  reason?: string;
  oldProgramId?: string;
  newProgramId?: string;
}

export interface MigrationPreview {
  programsToMigrate: { id: string; name: string; code: string }[];
  programsAlreadyMigrated: { id: string; name: string; code: string }[];
  projectsToFix: { id: string; name: string; currentProgramId: string; matchedProgramCode?: string }[];
  requisitionsToFix: { id: string; referenceNumber: string; linkedProgramId: string }[];
}

// ─────────────────────────────────────────────────────────────────
// MIGRATION SERVICE
// ─────────────────────────────────────────────────────────────────

export class ProgramMigrationService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Preview what will be migrated without making changes
   */
  async previewMigration(): Promise<MigrationPreview> {
    const preview: MigrationPreview = {
      programsToMigrate: [],
      programsAlreadyMigrated: [],
      projectsToFix: [],
      requisitionsToFix: [],
    };

    // Get programs from old location
    const oldProgramsSnapshot = await getDocs(collection(this.db, OLD_PROGRAMS_PATH));
    const oldPrograms = oldProgramsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get programs from new location
    const newProgramsSnapshot = await getDocs(collection(this.db, NEW_PROGRAMS_PATH));
    const newProgramsById = new Map(newProgramsSnapshot.docs.map(doc => [doc.id, doc.data()]));
    const newProgramsByCode = new Map(
      newProgramsSnapshot.docs.map(doc => [doc.data().code, { id: doc.id, ...doc.data() }])
    );

    // Check which old programs need migration
    for (const program of oldPrograms) {
      const programData = program as any;
      if (newProgramsById.has(program.id) || newProgramsByCode.has(programData.code)) {
        preview.programsAlreadyMigrated.push({
          id: program.id,
          name: programData.name || 'Unknown',
          code: programData.code || 'N/A',
        });
      } else {
        preview.programsToMigrate.push({
          id: program.id,
          name: programData.name || 'Unknown',
          code: programData.code || 'N/A',
        });
      }
    }

    // Check projects that might have wrong programId
    const projectsSnapshot = await getDocs(collection(this.db, PROJECTS_PATH));
    for (const projectDoc of projectsSnapshot.docs) {
      const project = projectDoc.data();
      const programId = project.programId;

      if (programId) {
        // Check if programId exists in new collection
        const existsInNew = newProgramsById.has(programId);

        if (!existsInNew) {
          // Check if there's a matching program by code in old collection
          const oldProgram = oldPrograms.find(p => p.id === programId);
          const matchedNewProgram = oldProgram
            ? newProgramsByCode.get((oldProgram as any).code)
            : null;

          preview.projectsToFix.push({
            id: projectDoc.id,
            name: project.name || 'Unknown',
            currentProgramId: programId,
            matchedProgramCode: matchedNewProgram ? (matchedNewProgram as any).code : undefined,
          });
        }
      }
    }

    // Check requisitions that might have wrong linkedProgramId
    const requisitionsSnapshot = await getDocs(
      query(collection(this.db, REQUISITIONS_PATH), where('linkStatus', '==', 'linked'))
    );
    for (const reqDoc of requisitionsSnapshot.docs) {
      const req = reqDoc.data();
      const linkedProgramId = req.linkedProgramId;

      if (linkedProgramId && linkedProgramId !== '') {
        const existsInNew = newProgramsById.has(linkedProgramId);

        if (!existsInNew) {
          preview.requisitionsToFix.push({
            id: reqDoc.id,
            referenceNumber: req.referenceNumber || 'N/A',
            linkedProgramId: linkedProgramId,
          });
        }
      }
    }

    return preview;
  }

  /**
   * Migrate programs from old collection to new collection
   */
  async migratePrograms(userId: string): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      programsMigrated: 0,
      programsSkipped: 0,
      projectsFixed: 0,
      requisitionsFixed: 0,
      errors: [],
      details: [],
    };

    try {
      // Step 1: Get all programs from old location
      console.log('[Migration] Fetching programs from old location...');
      const oldProgramsSnapshot = await getDocs(collection(this.db, OLD_PROGRAMS_PATH));
      const oldPrograms = oldProgramsSnapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data(),
      }));
      console.log(`[Migration] Found ${oldPrograms.length} programs in old location`);

      // Step 2: Get existing programs in new location
      const newProgramsSnapshot = await getDocs(collection(this.db, NEW_PROGRAMS_PATH));
      const existingNewProgramIds = new Set(newProgramsSnapshot.docs.map(doc => doc.id));
      const existingNewProgramsByCode = new Map(
        newProgramsSnapshot.docs.map(doc => [doc.data().code, { id: doc.id, data: doc.data() }])
      );
      console.log(`[Migration] Found ${existingNewProgramIds.size} programs in new location`);

      // Step 3: Build mapping of old ID -> new ID (for programs that exist by code)
      const programIdMapping = new Map<string, string>();

      // Step 4: Migrate programs
      for (const oldProgram of oldPrograms) {
        const programData = oldProgram.data as any;
        const programCode = programData.code;

        // Check if already exists by ID
        if (existingNewProgramIds.has(oldProgram.id)) {
          result.programsSkipped++;
          result.details.push({
            type: 'program',
            id: oldProgram.id,
            name: programData.name,
            action: 'skipped',
            reason: 'Already exists in new location with same ID',
          });
          programIdMapping.set(oldProgram.id, oldProgram.id);
          continue;
        }

        // Check if exists by code
        const existingByCode = existingNewProgramsByCode.get(programCode);
        if (existingByCode) {
          result.programsSkipped++;
          result.details.push({
            type: 'program',
            id: oldProgram.id,
            name: programData.name,
            action: 'skipped',
            reason: `Already exists in new location with code ${programCode} (ID: ${existingByCode.id})`,
          });
          programIdMapping.set(oldProgram.id, existingByCode.id);
          continue;
        }

        // Migrate to new location with same ID
        try {
          const newProgramData = {
            ...programData,
            migratedAt: Timestamp.now(),
            migratedBy: userId,
            migratedFrom: OLD_PROGRAMS_PATH,
          };

          await setDoc(doc(this.db, NEW_PROGRAMS_PATH, oldProgram.id), newProgramData);

          result.programsMigrated++;
          result.details.push({
            type: 'program',
            id: oldProgram.id,
            name: programData.name,
            action: 'migrated',
          });
          programIdMapping.set(oldProgram.id, oldProgram.id);
          console.log(`[Migration] Migrated program: ${programData.name} (${oldProgram.id})`);
        } catch (error: any) {
          result.errors.push(`Failed to migrate program ${oldProgram.id}: ${error.message}`);
          result.details.push({
            type: 'program',
            id: oldProgram.id,
            name: programData.name,
            action: 'error',
            reason: error.message,
          });
        }
      }

      // Step 5: Fix projects with incorrect programId
      console.log('[Migration] Checking projects for incorrect programId...');
      const projectsSnapshot = await getDocs(collection(this.db, PROJECTS_PATH));

      for (const projectDoc of projectsSnapshot.docs) {
        const project = projectDoc.data();
        const oldProgramId = project.programId;

        if (oldProgramId && programIdMapping.has(oldProgramId)) {
          const newProgramId = programIdMapping.get(oldProgramId)!;

          // Only update if the ID actually changed
          if (oldProgramId !== newProgramId) {
            try {
              await updateDoc(doc(this.db, PROJECTS_PATH, projectDoc.id), {
                programId: newProgramId,
                updatedAt: serverTimestamp(),
                updatedBy: userId,
              });

              result.projectsFixed++;
              result.details.push({
                type: 'project',
                id: projectDoc.id,
                name: project.name,
                action: 'fixed',
                oldProgramId,
                newProgramId,
              });
              console.log(`[Migration] Fixed project: ${project.name} (${projectDoc.id})`);
            } catch (error: any) {
              result.errors.push(`Failed to fix project ${projectDoc.id}: ${error.message}`);
              result.details.push({
                type: 'project',
                id: projectDoc.id,
                name: project.name,
                action: 'error',
                reason: error.message,
              });
            }
          }
        }
      }

      // Step 6: Fix requisitions with incorrect linkedProgramId
      console.log('[Migration] Checking requisitions for incorrect linkedProgramId...');
      const requisitionsSnapshot = await getDocs(
        query(collection(this.db, REQUISITIONS_PATH), where('linkStatus', '==', 'linked'))
      );

      for (const reqDoc of requisitionsSnapshot.docs) {
        const req = reqDoc.data();
        const oldProgramId = req.linkedProgramId;

        if (oldProgramId && programIdMapping.has(oldProgramId)) {
          const newProgramId = programIdMapping.get(oldProgramId)!;

          // Only update if the ID actually changed
          if (oldProgramId !== newProgramId) {
            try {
              await updateDoc(doc(this.db, REQUISITIONS_PATH, reqDoc.id), {
                linkedProgramId: newProgramId,
                updatedAt: serverTimestamp(),
              });

              result.requisitionsFixed++;
              result.details.push({
                type: 'requisition',
                id: reqDoc.id,
                name: req.referenceNumber,
                action: 'fixed',
                oldProgramId,
                newProgramId,
              });
              console.log(`[Migration] Fixed requisition: ${req.referenceNumber} (${reqDoc.id})`);
            } catch (error: any) {
              result.errors.push(`Failed to fix requisition ${reqDoc.id}: ${error.message}`);
              result.details.push({
                type: 'requisition',
                id: reqDoc.id,
                name: req.referenceNumber,
                action: 'error',
                reason: error.message,
              });
            }
          }
        }
      }

      console.log('[Migration] Migration completed');
      console.log(`  Programs migrated: ${result.programsMigrated}`);
      console.log(`  Programs skipped: ${result.programsSkipped}`);
      console.log(`  Projects fixed: ${result.projectsFixed}`);
      console.log(`  Requisitions fixed: ${result.requisitionsFixed}`);
      console.log(`  Errors: ${result.errors.length}`);

    } catch (error: any) {
      result.success = false;
      result.errors.push(`Migration failed: ${error.message}`);
      console.error('[Migration] Migration failed:', error);
    }

    return result;
  }

  /**
   * Fix project-program linkages by matching on project's linkedProjectId
   * This is for requisitions where the programId wasn't captured correctly
   */
  async fixRequisitionProgramLinks(_userId: string): Promise<{
    fixed: number;
    errors: string[];
  }> {
    const result = { fixed: 0, errors: [] as string[] };

    try {
      // Get all linked requisitions
      const requisitionsSnapshot = await getDocs(
        query(collection(this.db, REQUISITIONS_PATH), where('linkStatus', '==', 'linked'))
      );

      // Get all projects to build lookup
      const projectsSnapshot = await getDocs(collection(this.db, PROJECTS_PATH));
      const projectsMap = new Map(
        projectsSnapshot.docs.map(doc => [doc.id, doc.data()])
      );

      for (const reqDoc of requisitionsSnapshot.docs) {
        const req = reqDoc.data();
        const linkedProjectId = req.linkedProjectId;

        if (linkedProjectId) {
          const project = projectsMap.get(linkedProjectId);
          if (project && project.programId) {
            // Check if the requisition's linkedProgramId matches the project's programId
            if (req.linkedProgramId !== project.programId) {
              try {
                await updateDoc(doc(this.db, REQUISITIONS_PATH, reqDoc.id), {
                  linkedProgramId: project.programId,
                  linkedProgramName: project.programName || '',
                  updatedAt: serverTimestamp(),
                });
                result.fixed++;
                console.log(`[Fix] Updated requisition ${req.referenceNumber} programId to ${project.programId}`);
              } catch (error: any) {
                result.errors.push(`Failed to fix requisition ${reqDoc.id}: ${error.message}`);
              }
            }
          }
        }
      }
    } catch (error: any) {
      result.errors.push(`Fix operation failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Fix a single project's programId
   * Used to reassign orphaned projects to the correct program
   */
  async fixSingleProject(
    projectId: string,
    newProgramId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify project exists
      const projectRef = doc(this.db, PROJECTS_PATH, projectId);
      const projectDoc = await getDoc(projectRef);

      if (!projectDoc.exists()) {
        return { success: false, error: 'Project not found' };
      }

      // Verify new program exists
      const programRef = doc(this.db, NEW_PROGRAMS_PATH, newProgramId);
      const programDoc = await getDoc(programRef);

      if (!programDoc.exists()) {
        return { success: false, error: 'Target program not found' };
      }

      const programData = programDoc.data();
      const projectData = projectDoc.data();
      const oldProgramId = projectData.programId;

      // Update the project
      await updateDoc(projectRef, {
        programId: newProgramId,
        programName: programData.name || '',
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });

      console.log(`[Migration] Fixed project "${projectData.name}" programId: ${oldProgramId} → ${newProgramId}`);

      // Also fix any requisitions linked to this project
      const requisitionsSnapshot = await getDocs(
        query(
          collection(this.db, REQUISITIONS_PATH),
          where('linkedProjectId', '==', projectId)
        )
      );

      for (const reqDoc of requisitionsSnapshot.docs) {
        await updateDoc(doc(this.db, REQUISITIONS_PATH, reqDoc.id), {
          linkedProgramId: newProgramId,
          linkedProgramName: programData.name || '',
          updatedAt: serverTimestamp(),
        });
        console.log(`[Migration] Fixed requisition ${reqDoc.data().referenceNumber} linkedProgramId`);
      }

      return { success: true };
    } catch (error: any) {
      console.error('[Migration] Failed to fix project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fix projects that are linked to "General Projects" (DEFAULT program)
   * and should be moved to a specific target program.
   *
   * This is useful when projects were accidentally created without selecting
   * the correct program, causing them to be assigned to the default program.
   */
  async fixProjectsFromDefaultProgram(
    targetProgramId: string,
    userId: string,
    projectNamesToFix?: string[] // Optional: only fix specific projects by name
  ): Promise<{
    success: boolean;
    projectsFixed: number;
    requisitionsFixed: number;
    details: { projectName: string; projectId: string; requisitionsUpdated: number }[];
    errors: string[];
  }> {
    const result = {
      success: true,
      projectsFixed: 0,
      requisitionsFixed: 0,
      details: [] as { projectName: string; projectId: string; requisitionsUpdated: number }[],
      errors: [] as string[],
    };

    try {
      // Verify target program exists
      const targetProgramRef = doc(this.db, NEW_PROGRAMS_PATH, targetProgramId);
      const targetProgramDoc = await getDoc(targetProgramRef);

      if (!targetProgramDoc.exists()) {
        return { ...result, success: false, errors: ['Target program not found'] };
      }

      const targetProgramData = targetProgramDoc.data();
      console.log(`[Migration] Target program: ${targetProgramData.name} (${targetProgramId})`);

      // Find the "General Projects" / DEFAULT program
      const programsSnapshot = await getDocs(collection(this.db, NEW_PROGRAMS_PATH));
      let defaultProgramId: string | null = null;

      for (const programDoc of programsSnapshot.docs) {
        const data = programDoc.data();
        if (data.code === 'DEFAULT' || data.name === 'General Projects') {
          defaultProgramId = programDoc.id;
          console.log(`[Migration] Found default program: ${data.name} (${programDoc.id})`);
          break;
        }
      }

      if (!defaultProgramId) {
        console.log('[Migration] No default "General Projects" program found');
        return { ...result, success: true }; // Nothing to migrate
      }

      // Get all projects linked to the default program
      const projectsSnapshot = await getDocs(collection(this.db, PROJECTS_PATH));
      const projectsToFix: { id: string; name: string; data: any }[] = [];

      for (const projectDoc of projectsSnapshot.docs) {
        const data = projectDoc.data();
        if (data.programId === defaultProgramId) {
          // Check if we should fix this project
          if (!projectNamesToFix || projectNamesToFix.includes(data.name)) {
            projectsToFix.push({ id: projectDoc.id, name: data.name, data });
          }
        }
      }

      console.log(`[Migration] Found ${projectsToFix.length} projects to fix`);

      // Fix each project
      for (const project of projectsToFix) {
        try {
          // Update the project
          const projectRef = doc(this.db, PROJECTS_PATH, project.id);
          await updateDoc(projectRef, {
            programId: targetProgramId,
            programName: targetProgramData.name || '',
            updatedAt: serverTimestamp(),
            updatedBy: userId,
          });

          console.log(`[Migration] Fixed project: ${project.name}`);

          // Fix requisitions linked to this project
          const requisitionsSnapshot = await getDocs(
            query(
              collection(this.db, REQUISITIONS_PATH),
              where('linkedProjectId', '==', project.id)
            )
          );

          let reqsUpdated = 0;
          for (const reqDoc of requisitionsSnapshot.docs) {
            await updateDoc(doc(this.db, REQUISITIONS_PATH, reqDoc.id), {
              linkedProgramId: targetProgramId,
              linkedProgramName: targetProgramData.name || '',
              updatedAt: serverTimestamp(),
            });
            reqsUpdated++;
            result.requisitionsFixed++;
            console.log(`[Migration] Fixed requisition: ${reqDoc.data().referenceNumber}`);
          }

          result.projectsFixed++;
          result.details.push({
            projectName: project.name,
            projectId: project.id,
            requisitionsUpdated: reqsUpdated,
          });
        } catch (error: any) {
          result.errors.push(`Failed to fix project ${project.name}: ${error.message}`);
          console.error(`[Migration] Failed to fix project ${project.name}:`, error);
        }
      }

      console.log(`[Migration] Complete. Fixed ${result.projectsFixed} projects, ${result.requisitionsFixed} requisitions`);
      return result;
    } catch (error: any) {
      console.error('[Migration] Migration failed:', error);
      return { ...result, success: false, errors: [error.message] };
    }
  }

  /**
   * Preview which projects would be fixed from the default program
   */
  async previewDefaultProgramFix(targetProgramId: string): Promise<{
    targetProgram: { id: string; name: string } | null;
    defaultProgram: { id: string; name: string } | null;
    projectsToFix: { id: string; name: string; linkedRequisitions: number }[];
  }> {
    const result = {
      targetProgram: null as { id: string; name: string } | null,
      defaultProgram: null as { id: string; name: string } | null,
      projectsToFix: [] as { id: string; name: string; linkedRequisitions: number }[],
    };

    // Get target program
    const targetProgramRef = doc(this.db, NEW_PROGRAMS_PATH, targetProgramId);
    const targetProgramDoc = await getDoc(targetProgramRef);
    if (targetProgramDoc.exists()) {
      result.targetProgram = {
        id: targetProgramId,
        name: targetProgramDoc.data().name || 'Unknown',
      };
    }

    // Find default program
    const programsSnapshot = await getDocs(collection(this.db, NEW_PROGRAMS_PATH));
    for (const programDoc of programsSnapshot.docs) {
      const data = programDoc.data();
      if (data.code === 'DEFAULT' || data.name === 'General Projects') {
        result.defaultProgram = { id: programDoc.id, name: data.name };
        break;
      }
    }

    if (!result.defaultProgram) return result;

    // Get projects in default program
    const projectsSnapshot = await getDocs(collection(this.db, PROJECTS_PATH));
    for (const projectDoc of projectsSnapshot.docs) {
      const data = projectDoc.data();
      if (data.programId === result.defaultProgram.id) {
        // Count linked requisitions
        const reqSnapshot = await getDocs(
          query(
            collection(this.db, REQUISITIONS_PATH),
            where('linkedProjectId', '==', projectDoc.id)
          )
        );
        result.projectsToFix.push({
          id: projectDoc.id,
          name: data.name,
          linkedRequisitions: reqSnapshot.size,
        });
      }
    }

    return result;
  }

  /**
   * Get statistics about programs in both locations
   */
  async getStats(): Promise<{
    oldLocation: { count: number; programs: { id: string; name: string; code: string }[] };
    newLocation: { count: number; programs: { id: string; name: string; code: string }[] };
    projectsWithMissingProgram: number;
    requisitionsWithMissingProgram: number;
  }> {
    // Old location
    const oldSnapshot = await getDocs(collection(this.db, OLD_PROGRAMS_PATH));
    const oldPrograms = oldSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Unknown',
      code: doc.data().code || 'N/A',
    }));

    // New location
    const newSnapshot = await getDocs(collection(this.db, NEW_PROGRAMS_PATH));
    const newPrograms = newSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Unknown',
      code: doc.data().code || 'N/A',
    }));
    const newProgramIds = new Set(newSnapshot.docs.map(doc => doc.id));

    // Projects with missing program
    const projectsSnapshot = await getDocs(collection(this.db, PROJECTS_PATH));
    let projectsWithMissingProgram = 0;
    for (const projectDoc of projectsSnapshot.docs) {
      const programId = projectDoc.data().programId;
      if (programId && !newProgramIds.has(programId)) {
        projectsWithMissingProgram++;
      }
    }

    // Requisitions with missing program
    const requisitionsSnapshot = await getDocs(
      query(collection(this.db, REQUISITIONS_PATH), where('linkStatus', '==', 'linked'))
    );
    let requisitionsWithMissingProgram = 0;
    for (const reqDoc of requisitionsSnapshot.docs) {
      const linkedProgramId = reqDoc.data().linkedProgramId;
      if (linkedProgramId && linkedProgramId !== '' && !newProgramIds.has(linkedProgramId)) {
        requisitionsWithMissingProgram++;
      }
    }

    return {
      oldLocation: { count: oldPrograms.length, programs: oldPrograms },
      newLocation: { count: newPrograms.length, programs: newPrograms },
      projectsWithMissingProgram,
      requisitionsWithMissingProgram,
    };
  }
}

// Singleton helper
let migrationServiceInstance: ProgramMigrationService | null = null;

export function getProgramMigrationService(db: Firestore): ProgramMigrationService {
  if (!migrationServiceInstance) {
    migrationServiceInstance = new ProgramMigrationService(db);
  }
  return migrationServiceInstance;
}

// Import serverTimestamp
import { serverTimestamp } from 'firebase/firestore';
