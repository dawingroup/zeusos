/**
 * Payment Adapter
 * Adapts v5 IPC/Requisition API calls to v6 Payment operations
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
  V5IPCResponse,
  V6PaymentResponse,
  V5CreateIPCRequest,
} from '../types/api-compat-types';
import { RequestTransformer } from '../transformers/request-transformer';
import { ResponseTransformer } from '../transformers/response-transformer';
import { logDeprecatedUsage } from '../middleware/deprecation-logger';

export interface PaymentQueryOptions {
  projectId?: string;
  type?: 'ipc' | 'requisition' | 'all';
  status?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class PaymentAdapter {
  private version: APIVersion;

  constructor(version: APIVersion = 'v5') {
    this.version = version;
  }

  /**
   * List IPCs/Payments
   */
  async listPayments(options: PaymentQueryOptions = {}): Promise<{
    data: V5IPCResponse[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      projectId,
      type = 'ipc',
      status,
      limit: pageSize = 50,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    await logDeprecatedUsage('/api/v5/ipcs', 'GET', this.version, {
      queryParams: { projectId: projectId || '', status: status || '' },
    });

    // Build query
    let q = query(
      collection(db, 'v6_payments'),
      orderBy(sortBy, sortOrder),
      firestoreLimit(pageSize)
    );

    if (type !== 'all') {
      q = query(q, where('type', '==', type));
    }

    if (projectId) {
      q = query(q, where('projectId', '==', projectId));
    }

    if (status) {
      const transformedStatus = status.toLowerCase().replace(/\s+/g, '_');
      q = query(q, where('status', '==', transformedStatus));
    }

    const snapshot = await getDocs(q);
    const payments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as V6PaymentResponse[];

    // Transform to v5 format
    const response = ResponseTransformer.transformResponse<V5IPCResponse[]>(
      payments,
      'ipc',
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
   * Get single IPC/Payment by ID
   */
  async getPayment(id: string): Promise<V5IPCResponse | null> {
    await logDeprecatedUsage(`/api/v5/ipcs/${id}`, 'GET', this.version);

    const docRef = doc(db, 'v6_payments', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const payment = { id: docSnap.id, ...docSnap.data() } as V6PaymentResponse;

    // Fetch project info
    if (payment.projectId) {
      const projectDoc = await getDoc(doc(db, 'v6_projects', payment.projectId));
      if (projectDoc.exists()) {
        payment.project = {
          id: projectDoc.id,
          name: projectDoc.data().name || '',
          code: projectDoc.data().code || '',
        };
      }
    }

    const response = ResponseTransformer.transformResponse<V5IPCResponse>(
      payment,
      'ipc',
      this.version,
      'v6'
    );

    return response.data;
  }

  /**
   * Create new IPC
   */
  async createIPC(data: V5CreateIPCRequest): Promise<V5IPCResponse> {
    await logDeprecatedUsage('/api/v5/ipcs', 'POST', this.version, {
      body: data,
    });

    // Transform v5 request to v6 format
    const { transformed } = RequestTransformer.transformRequest(
      {
        version: 'v5',
        endpoint: '/api/v5/ipcs',
        method: 'POST',
        headers: {},
        params: {},
        query: {},
        body: data,
      },
      'ipc'
    );

    // Get engagement ID from project
    let engagementId = '';
    if (data.projectId) {
      const projectDoc = await getDoc(doc(db, 'v6_projects', data.projectId));
      if (projectDoc.exists()) {
        engagementId = projectDoc.data().engagementId || '';
      }
    }

    // Build v6 payment data
    const paymentData = {
      ...transformed,
      type: 'ipc',
      projectId: data.projectId,
      engagementId,
      reference: data.certificateNumber,
      period: {
        from: data.periodFrom,
        to: data.periodTo,
      },
      amounts: {
        cumulative: data.workDone || 0,
        previous: data.previousCertificates || 0,
        current: data.currentCertificate || 0,
        retention: data.retention || 0,
        net: (data.currentCertificate || 0) - (data.retention || 0),
      },
      status: (data.status || 'draft').toLowerCase(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Create in v6_payments collection
    const docRef = await addDoc(collection(db, 'v6_payments'), paymentData);

    // Fetch and return created document
    const created = await getDoc(docRef);
    const payment = { id: created.id, ...created.data() } as V6PaymentResponse;

    const response = ResponseTransformer.transformResponse<V5IPCResponse>(
      payment,
      'ipc',
      this.version,
      'v6'
    );

    return response.data;
  }

  /**
   * Update IPC/Payment
   */
  async updatePayment(id: string, data: Partial<V5CreateIPCRequest>): Promise<V5IPCResponse | null> {
    await logDeprecatedUsage(`/api/v5/ipcs/${id}`, 'PUT', this.version, {
      body: data,
    });

    const docRef = doc(db, 'v6_payments', id);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      return null;
    }

    // Transform v5 request to v6 format
    const { transformed } = RequestTransformer.transformRequest(
      {
        version: 'v5',
        endpoint: `/api/v5/ipcs/${id}`,
        method: 'PUT',
        headers: {},
        params: { id },
        query: {},
        body: data,
      },
      'ipc'
    );

    // Update amounts if provided
    const existingData = existing.data();
    const updatedAmounts = {
      ...existingData.amounts,
    };

    if (data.workDone !== undefined) updatedAmounts.cumulative = data.workDone;
    if (data.previousCertificates !== undefined) updatedAmounts.previous = data.previousCertificates;
    if (data.currentCertificate !== undefined) updatedAmounts.current = data.currentCertificate;
    if (data.retention !== undefined) updatedAmounts.retention = data.retention;
    updatedAmounts.net = updatedAmounts.current - updatedAmounts.retention;

    // Update document
    await updateDoc(docRef, {
      ...transformed,
      amounts: updatedAmounts,
      updatedAt: Timestamp.now(),
    });

    // Fetch and return updated document
    const updated = await getDoc(docRef);
    const payment = { id: updated.id, ...updated.data() } as V6PaymentResponse;

    const response = ResponseTransformer.transformResponse<V5IPCResponse>(
      payment,
      'ipc',
      this.version,
      'v6'
    );

    return response.data;
  }

  /**
   * Delete IPC/Payment (soft delete)
   */
  async deletePayment(id: string): Promise<boolean> {
    await logDeprecatedUsage(`/api/v5/ipcs/${id}`, 'DELETE', this.version);

    const docRef = doc(db, 'v6_payments', id);
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

  /**
   * Submit IPC for approval
   */
  async submitIPC(id: string): Promise<V5IPCResponse | null> {
    const docRef = doc(db, 'v6_payments', id);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      return null;
    }

    await updateDoc(docRef, {
      status: 'submitted',
      submittedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return this.getPayment(id);
  }

  /**
   * Approve IPC
   */
  async approveIPC(id: string, approverId?: string): Promise<V5IPCResponse | null> {
    const docRef = doc(db, 'v6_payments', id);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      return null;
    }

    const approvals = existing.data().approvals || [];
    approvals.push({
      role: 'approver',
      userId: approverId,
      status: 'approved',
      timestamp: Timestamp.now(),
    });

    await updateDoc(docRef, {
      status: 'approved',
      approvals,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return this.getPayment(id);
  }
}

export function createPaymentAdapter(version: APIVersion = 'v5'): PaymentAdapter {
  return new PaymentAdapter(version);
}
