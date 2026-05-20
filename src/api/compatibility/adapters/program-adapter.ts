/**
 * Program Adapter
 * Adapts v5 Program API calls to v6 Engagement operations
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import {
  APIVersion,
  V5ProgramResponse,
  V6EngagementResponse,
  V5CreateProgramRequest,
  V5UpdateProgramRequest,
} from '../types/api-compat-types';
import { RequestTransformer } from '../transformers/request-transformer';
import { ResponseTransformer } from '../transformers/response-transformer';
import { logDeprecatedUsage } from '../middleware/deprecation-logger';

export interface ProgramQueryOptions {
  status?: string;
  fundingSource?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class ProgramAdapter {
  private version: APIVersion;

  constructor(version: APIVersion = 'v5') {
    this.version = version;
  }

  /**
   * List programs (returns engagements as programs for v5)
   */
  async listPrograms(options: ProgramQueryOptions = {}): Promise<{
    data: V5ProgramResponse[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      status,
      fundingSource,
      limit: pageSize = 50,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Log deprecated usage
    await logDeprecatedUsage('/api/v5/programs', 'GET', this.version, {
      queryParams: { status: status || '', fundingSource: fundingSource || '' },
    });

    // Build query for engagements
    let q = query(
      collection(db, 'engagements'),
      where('type', '==', 'program'),
      orderBy(sortBy, sortOrder),
      firestoreLimit(pageSize)
    );

    if (status) {
      const transformedStatus = status.toLowerCase().replace(/\s+/g, '_');
      q = query(q, where('status', '==', transformedStatus));
    }

    const snapshot = await getDocs(q);
    const engagements = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as V6EngagementResponse[];

    // Transform to v5 format
    const response = ResponseTransformer.transformResponse<V5ProgramResponse[]>(
      engagements,
      'program',
      this.version,
      'v6'
    );

    return {
      data: response.data,
      total: snapshot.size,
      page,
      pageSize,
    };
  }

  /**
   * Get single program by ID
   */
  async getProgram(id: string): Promise<V5ProgramResponse | null> {
    await logDeprecatedUsage(`/api/v5/programs/${id}`, 'GET', this.version);

    const docRef = doc(db, 'engagements', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const engagement = { id: docSnap.id, ...docSnap.data() } as V6EngagementResponse;

    const response = ResponseTransformer.transformResponse<V5ProgramResponse>(
      engagement,
      'program',
      this.version,
      'v6'
    );

    return response.data;
  }

  /**
   * Create new program (creates engagement)
   */
  async createProgram(data: V5CreateProgramRequest): Promise<V5ProgramResponse> {
    await logDeprecatedUsage('/api/v5/programs', 'POST', this.version, {
      body: data,
    });

    // Transform v5 request to v6 format
    const { transformed } = RequestTransformer.transformRequest(
      {
        version: 'v5',
        endpoint: '/api/v5/programs',
        method: 'POST',
        headers: {},
        params: {},
        query: {},
        body: data,
      },
      'program'
    );

    // Add required v6 fields
    const engagementData = {
      ...transformed,
      type: 'program',
      clientId: 'amh_default_client',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Create in engagements collection
    const docRef = await addDoc(collection(db, 'engagements'), engagementData);

    // Fetch and return created document
    const created = await getDoc(docRef);
    const engagement = { id: created.id, ...created.data() } as V6EngagementResponse;

    const response = ResponseTransformer.transformResponse<V5ProgramResponse>(
      engagement,
      'program',
      this.version,
      'v6'
    );

    return response.data;
  }

  /**
   * Update program
   */
  async updateProgram(id: string, data: V5UpdateProgramRequest): Promise<V5ProgramResponse | null> {
    await logDeprecatedUsage(`/api/v5/programs/${id}`, 'PUT', this.version, {
      body: data,
    });

    // Check if document exists
    const docRef = doc(db, 'engagements', id);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      return null;
    }

    // Transform v5 request to v6 format
    const { transformed } = RequestTransformer.transformRequest(
      {
        version: 'v5',
        endpoint: `/api/v5/programs/${id}`,
        method: 'PUT',
        headers: {},
        params: { id },
        query: {},
        body: data,
      },
      'program'
    );

    // Update document
    await updateDoc(docRef, {
      ...transformed,
      updatedAt: Timestamp.now(),
    });

    // Fetch and return updated document
    const updated = await getDoc(docRef);
    const engagement = { id: updated.id, ...updated.data() } as V6EngagementResponse;

    const response = ResponseTransformer.transformResponse<V5ProgramResponse>(
      engagement,
      'program',
      this.version,
      'v6'
    );

    return response.data;
  }

  /**
   * Delete program (soft delete)
   */
  async deleteProgram(id: string): Promise<boolean> {
    await logDeprecatedUsage(`/api/v5/programs/${id}`, 'DELETE', this.version);

    const docRef = doc(db, 'engagements', id);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      return false;
    }

    // Soft delete by updating status
    await updateDoc(docRef, {
      status: 'deleted',
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return true;
  }

  /**
   * Get program projects
   */
  async getProgramProjects(programId: string): Promise<any[]> {
    await logDeprecatedUsage(`/api/v5/programs/${programId}/projects`, 'GET', this.version);

    const q = query(
      collection(db, 'v6_projects'),
      where('engagementId', '==', programId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  /**
   * Get program statistics
   */
  async getProgramStats(programId: string): Promise<{
    projectCount: number;
    totalBudget: number;
    totalSpent: number;
    overallProgress: number;
  }> {
    const projects = await this.getProgramProjects(programId);

    const stats = {
      projectCount: projects.length,
      totalBudget: 0,
      totalSpent: 0,
      overallProgress: 0,
    };

    for (const project of projects) {
      stats.totalBudget += project.budget?.allocated || 0;
      stats.totalSpent += project.budget?.spent || 0;
    }

    if (projects.length > 0) {
      const progressSum = projects.reduce(
        (sum, p) => sum + (p.timeline?.percentComplete || 0),
        0
      );
      stats.overallProgress = progressSum / projects.length;
    }

    return stats;
  }
}

/**
 * Create program adapter instance
 */
export function createProgramAdapter(version: APIVersion = 'v5'): ProgramAdapter {
  return new ProgramAdapter(version);
}
