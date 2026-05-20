/**
 * Design Revision Types — Full schema for the designRevisions Firestore collection
 */

import type { Timestamp } from 'firebase/firestore';

export type RevisionStatus = 'draft' | 'in_review' | 'editing' | 'final';
export type RevisionSource = 'parametric' | 'ai_mesh' | 'manual_upload' | 'external_edit';

export interface RevisionFiles {
  stepUrl?: string;
  xtUrl?: string;     // Parasolid X_T for Shapr3D
  /** Autodesk 3D Studio binary — the primary authoring format for
   *  DawinOS cabinets. Parsed client-side via `parse3DS`, so revisions
   *  uploaded as .3ds are ready for preview immediately (no server-side
   *  regeneration required). */
  threeDsUrl?: string;
  glbUrl: string;
  thumbnailUrl?: string;
}

export interface RevisionAnnotation {
  id: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  text: string;
  createdBy: string;
  createdAt: string;
}

export interface RevisionDiff {
  addedBodies: string[];
  removedBodies: string[];
  modifiedBodies: { name: string; changePercent: number }[];
  bomImpact?: {
    addedMaterials: string[];
    removedMaterials: string[];
    volumeChangePercent: number;
  };
}

export interface DesignRevision {
  id: string;
  moId?: string;
  projectId?: string;
  revisionNumber: number;
  status: RevisionStatus;
  source: RevisionSource;
  files: RevisionFiles;
  materialMapping: Record<string, string>; // 3DS material name → finish library ID
  editNotes?: string;
  annotations: RevisionAnnotation[];
  diffFromPrevious?: RevisionDiff;
  createdBy: string;
  createdAt: Timestamp;
  editedBy?: string;
  editedAt?: Timestamp;
}

export interface CreateRevisionInput {
  moId?: string;
  projectId?: string;
  source: RevisionSource;
  files: RevisionFiles;
  materialMapping?: Record<string, string>;
  editNotes?: string;
}

export interface RevisionFilter {
  moId?: string;
  projectId?: string;
  status?: RevisionStatus;
  source?: RevisionSource;
}
