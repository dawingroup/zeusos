import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Engagement,
  Client,
  Funder,
  FundingSource,
  Contact,
  Covenant,
  CovenantMeasurement,
  ApprovalRequest,
  ReportingRequirement,
  ReportSubmission,
  Disbursement,
} from '../types';

/**
 * Generic converter factory
 * Creates a simple converter that handles id field
 */
export function createConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data: T) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = data;
      return rest;
    },
    fromFirestore: (
      snapshot: QueryDocumentSnapshot,
      options: SnapshotOptions
    ): T => {
      const data = snapshot.data(options);
      return {
        id: snapshot.id,
        ...data,
      } as T;
    },
  };
}

/**
 * Generic converter with auto-updatedAt
 * Creates a converter that also sets updatedAt on write
 */
export function createConverterWithTimestamp<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data: T) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = data;
      return {
        ...rest,
        updatedAt: serverTimestamp(),
      };
    },
    fromFirestore: (
      snapshot: QueryDocumentSnapshot,
      options: SnapshotOptions
    ): T => {
      const data = snapshot.data(options);
      return {
        id: snapshot.id,
        ...data,
      } as T;
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// ENTITY CONVERTERS
// ─────────────────────────────────────────────────────────────────

/**
 * Engagement converter
 */
export const engagementConverter: FirestoreDataConverter<Engagement> = 
  createConverterWithTimestamp<Engagement>();

/**
 * Client converter
 */
export const clientConverter: FirestoreDataConverter<Client> = 
  createConverterWithTimestamp<Client>();

/**
 * Funder converter
 */
export const funderConverter: FirestoreDataConverter<Funder> = 
  createConverterWithTimestamp<Funder>();

/**
 * Funding source converter
 */
export const fundingSourceConverter: FirestoreDataConverter<FundingSource> = 
  createConverterWithTimestamp<FundingSource>();

/**
 * Contact converter
 */
export const contactConverter: FirestoreDataConverter<Contact> = 
  createConverter<Contact>();

/**
 * Covenant converter
 */
export const covenantConverter: FirestoreDataConverter<Covenant> = 
  createConverterWithTimestamp<Covenant>();

/**
 * Covenant measurement converter
 */
export const covenantMeasurementConverter: FirestoreDataConverter<CovenantMeasurement> = 
  createConverter<CovenantMeasurement>();

/**
 * Approval request converter
 */
export const approvalRequestConverter: FirestoreDataConverter<ApprovalRequest> = 
  createConverterWithTimestamp<ApprovalRequest>();

/**
 * Reporting requirement converter
 */
export const reportingRequirementConverter: FirestoreDataConverter<ReportingRequirement> = 
  createConverter<ReportingRequirement>();

/**
 * Report submission converter
 */
export const reportSubmissionConverter: FirestoreDataConverter<ReportSubmission> = 
  createConverterWithTimestamp<ReportSubmission>();

/**
 * Disbursement converter
 */
export const disbursementConverter: FirestoreDataConverter<Disbursement> = 
  createConverterWithTimestamp<Disbursement>();

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Convert Date to Firestore Timestamp
 */
export function toTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/**
 * Convert Firestore Timestamp to Date
 */
export function fromTimestamp(timestamp: Timestamp): Date {
  return timestamp.toDate();
}

/**
 * Convert Firestore Timestamp to Date (null-safe)
 */
export function fromTimestampSafe(timestamp: Timestamp | null | undefined): Date | undefined {
  return timestamp ? timestamp.toDate() : undefined;
}

/**
 * Create a document with auto-generated ID
 */
export function withId<T extends { id: string }>(data: Omit<T, 'id'>, id: string): T {
  return { ...data, id } as T;
}

/**
 * Strip undefined values from object (Firestore doesn't accept undefined)
 */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Deep strip undefined values from object
 */
export function deepStripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  
  for (const key in obj) {
    const value = obj[key];
    
    if (value === undefined) {
      continue;
    }
    
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !(item instanceof Date) && !(item instanceof Timestamp)
          ? deepStripUndefined(item)
          : item,
      ) as T[Extract<keyof T, string>];
    } else if (value !== null && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Timestamp)) {
      result[key] = deepStripUndefined(value as object) as T[Extract<keyof T, string>];
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Prepare data for Firestore write
 * Strips undefined and adds timestamps
 */
export function prepareForWrite<T extends object>(
  data: T,
  options: { setCreatedAt?: boolean; setUpdatedAt?: boolean } = {}
): object {
  const { setCreatedAt = false, setUpdatedAt = true } = options;
  
  const cleaned = deepStripUndefined(data);
  
  return {
    ...cleaned,
    ...(setCreatedAt && { createdAt: serverTimestamp() }),
    ...(setUpdatedAt && { updatedAt: serverTimestamp() }),
  };
}

/**
 * Convert entity for create (adds both timestamps)
 */
export function prepareForCreate<T extends object>(data: T): object {
  return prepareForWrite(data, { setCreatedAt: true, setUpdatedAt: true });
}

/**
 * Convert entity for update (only updates updatedAt)
 */
export function prepareForUpdate<T extends object>(data: T): object {
  return prepareForWrite(data, { setCreatedAt: false, setUpdatedAt: true });
}
