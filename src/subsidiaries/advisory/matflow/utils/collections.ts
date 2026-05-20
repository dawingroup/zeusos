/**
 * MatFlow Firestore Collection References
 */

import { collection, doc, CollectionReference, DocumentReference } from 'firebase/firestore';
import { db } from '@/core/services/firebase';

// ============================================================================
// GLOBAL COLLECTIONS
// ============================================================================

export const formulasCollection = () => 
  collection(db, 'matflow', 'data', 'formulas') as CollectionReference;

export const materialRatesCollection = () => 
  collection(db, 'matflow', 'data', 'material_rates') as CollectionReference;

export const rolesCollection = () => 
  collection(db, 'matflow', 'data', 'roles') as CollectionReference;

// ============================================================================
// ORGANIZATION-SCOPED COLLECTIONS
// ============================================================================

export const matflowProjectsCollection = (orgId: string) =>
  collection(db, 'organizations', orgId, 'matflow_projects') as CollectionReference;

export const matflowProjectDoc = (orgId: string, projectId: string) =>
  doc(db, 'organizations', orgId, 'matflow_projects', projectId) as DocumentReference;

// ============================================================================
// PROJECT SUBCOLLECTIONS
// ============================================================================

export const boqItemsCollection = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'matflow_projects', projectId, 'boq_items') as CollectionReference;

export const boqItemDoc = (orgId: string, projectId: string, itemId: string) =>
  doc(db, 'organizations', orgId, 'matflow_projects', projectId, 'boq_items', itemId) as DocumentReference;

export const procurementEntriesCollection = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'matflow_projects', projectId, 'procurement_entries') as CollectionReference;

export const procurementEntryDoc = (orgId: string, projectId: string, entryId: string) =>
  doc(db, 'organizations', orgId, 'matflow_projects', projectId, 'procurement_entries', entryId) as DocumentReference;

export const parsingJobsCollection = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'matflow_projects', projectId, 'parsing_jobs') as CollectionReference;

export const parsingJobDoc = (orgId: string, projectId: string, jobId: string) =>
  doc(db, 'organizations', orgId, 'matflow_projects', projectId, 'parsing_jobs', jobId) as DocumentReference;
