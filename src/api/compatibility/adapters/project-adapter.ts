/**
 * Project Adapter
 * Adapts v5 Project API calls to v6 Project operations
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
  V5ProjectResponse,
  V6ProjectResponse,
  V5CreateProjectRequest,
} from '../types/api-compat-types';
import { RequestTransformer } from '../transformers/request-transformer';
import { ResponseTransformer } from '../transformers/response-transformer';
import { logDeprecatedUsage } from '../middleware/deprecation-logger';

export interface ProjectQueryOptions {
  programId?: string;
  engagementId?: string;
  status?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class ProjectAdapter {
  private version: APIVersion;

  constructor(version: APIVersion = 'v5') {
    this.version = version;
  }

  /**
   * List projects
   */
  async listProjects(options: ProjectQueryOptions = {}): Promise<{
    data: V5ProjectResponse[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      programId,
      engagementId,
      status,
      limit: pageSize = 50,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    await logDeprecatedUsage('/api/v5/projects', 'GET', this.version, {
      queryParams: { programId: programId || '', status: status || '' },
    });

    // Build query
    let q = query(
      collection(db, 'v6_projects'),
      orderBy(sortBy, sortOrder),
      firestoreLimit(pageSize)
    );

    // Handle programId (deprecated) or engagementId
    const filterEngagementId = engagementId || programId;
    if (filterEngagementId) {
      q = query(q, where('engagementId', '==', filterEngagementId));
    }

    if (status) {
      const transformedStatus = status.toLowerCase().replace(/\s+/g, '_');
      q = query(q, where('status', '==', transformedStatus));
    }

    const snapshot = await getDocs(q);
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as V6ProjectResponse[];

    // Transform to v5 format
    const response = ResponseTransformer.transformResponse<V5ProjectResponse[]>(
      projects,
      'project',
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
   * Get single project by ID
   */
  async getProject(id: string): Promise<V5ProjectResponse | null> {
    await logDeprecatedUsage(`/api/v5/projects/${id}`, 'GET', this.version);

    const docRef = doc(db, 'v6_projects', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const project = { id: docSnap.id, ...docSnap.data() } as V6ProjectResponse;

    // Fetch engagement info
    if (project.engagementId) {
      const engagementDoc = await getDoc(doc(db, 'engagements', project.engagementId));
      if (engagementDoc.exists()) {
        project.engagement = {
          id: engagementDoc.id,
          name: engagementDoc.data().name || '',
          code: engagementDoc.data().code || '',
        };
      }
    }

    const response = ResponseTransformer.transformResponse<V5ProjectResponse>(
      project,
      'project',
      this.version,
      'v6'
    );

    return response.data;
  }

  /**
   * Create new project
   */
  async createProject(data: V5CreateProjectRequest): Promise<V5ProjectResponse> {
    await logDeprecatedUsage('/api/v5/projects', 'POST', this.version, {
      body: data,
    });

    // Transform v5 request to v6 format
    const { transformed } = RequestTransformer.transformRequest(
      {
        version: 'v5',
        endpoint: '/api/v5/projects',
        method: 'POST',
        headers: {},
        params: {},
        query: {},
        body: data,
      },
      'project'
    );

    // Build v6 project data
    const projectData = {
      ...transformed,
      engagementId: data.programId, // Map programId to engagementId
      location: { name: data.location },
      contractor: data.contractor ? { name: data.contractor } : null,
      budget: {
        allocated: data.budget || 0,
        committed: 0,
        spent: 0,
        currency: 'UGX',
      },
      timeline: {
        percentComplete: 0,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Create in v6_projects collection
    const docRef = await addDoc(collection(db, 'v6_projects'), projectData);

    // Fetch and return created document
    const created = await getDoc(docRef);
    const project = { id: created.id, ...created.data() } as V6ProjectResponse;

    const response = ResponseTransformer.transformResponse<V5ProjectResponse>(
      project,
      'project',
      this.version,
      'v6'
    );

    return response.data;
  }

  /**
   * Update project
   */
  async updateProject(id: string, data: Partial<V5CreateProjectRequest>): Promise<V5ProjectResponse | null> {
    await logDeprecatedUsage(`/api/v5/projects/${id}`, 'PUT', this.version, {
      body: data,
    });

    const docRef = doc(db, 'v6_projects', id);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      return null;
    }

    // Transform v5 request to v6 format
    const { transformed } = RequestTransformer.transformRequest(
      {
        version: 'v5',
        endpoint: `/api/v5/projects/${id}`,
        method: 'PUT',
        headers: {},
        params: { id },
        query: {},
        body: data,
      },
      'project'
    );

    // Update document
    await updateDoc(docRef, {
      ...transformed,
      updatedAt: Timestamp.now(),
    });

    // Fetch and return updated document
    const updated = await getDoc(docRef);
    const project = { id: updated.id, ...updated.data() } as V6ProjectResponse;

    const response = ResponseTransformer.transformResponse<V5ProjectResponse>(
      project,
      'project',
      this.version,
      'v6'
    );

    return response.data;
  }

  /**
   * Delete project (soft delete)
   */
  async deleteProject(id: string): Promise<boolean> {
    await logDeprecatedUsage(`/api/v5/projects/${id}`, 'DELETE', this.version);

    const docRef = doc(db, 'v6_projects', id);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      return false;
    }

    await updateDoc(docRef, {
      status: 'deleted',
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return true;
  }
}

export function createProjectAdapter(version: APIVersion = 'v5'): ProjectAdapter {
  return new ProjectAdapter(version);
}
