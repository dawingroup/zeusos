/**
 * Asset Service
 * Handles database operations for the Smart Asset Registry
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp as FirestoreTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  Asset,
  AssetStatus,
  AssetFilters,
  AssetStatusChange,
  Feature,
} from '@/shared/types';
import type { MaintenanceLog, MaintenanceType, AssetCheckout } from '../types';

// ============================================
// Collection References
// ============================================

const COLLECTIONS = {
  ASSETS: 'assets',
  MAINTENANCE_LOGS: 'maintenanceLogs',
  STATUS_CHANGES: 'assetStatusChanges',
  CHECKOUTS: 'assetCheckouts',
  FEATURES: 'features',
} as const;

// ============================================
// Helpers
// ============================================

/** Remove keys whose value is undefined (Firestore rejects undefined) */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

/** Generate a unique asset number: AST-YYYYMMDD-XXXX */
function generateAssetNumber(): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const rand = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
  return `AST-${date}-${rand}`;
}

// ============================================
// Asset Service Class
// ============================================

export class AssetService {
  // ------------------------------------------
  // Asset CRUD Operations
  // ------------------------------------------

  /**
   * Create a new asset in the registry.
   * Auto-generates a serialNumber (asset number) if one is not provided.
   */
  async createAsset(
    assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<Asset> {
    const now = FirestoreTimestamp.now();

    // Auto-generate an asset number when serialNumber is missing
    if (!assetData.serialNumber) {
      assetData = { ...assetData, serialNumber: generateAssetNumber() };
    }

    // Strip undefined values – Firestore does not accept them
    const cleanData = stripUndefined({
      ...assetData,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    });

    const docRef = await addDoc(collection(db, COLLECTIONS.ASSETS), cleanData);

    const asset: Asset = {
      id: docRef.id,
      ...cleanData,
    } as Asset;

    return asset;
  }

  /**
   * Get an asset by ID
   */
  async getAsset(assetId: string): Promise<Asset | null> {
    const docRef = doc(db, COLLECTIONS.ASSETS, assetId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as Asset;
  }

  /**
   * Get all assets with optional filters
   */
  async getAssets(filters?: AssetFilters): Promise<Asset[]> {
    const constraints: QueryConstraint[] = [];

    if (filters?.category) {
      const categories = Array.isArray(filters.category) 
        ? filters.category 
        : [filters.category];
      constraints.push(where('category', 'in', categories));
    }

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) 
        ? filters.status 
        : [filters.status];
      constraints.push(where('status', 'in', statuses));
    }

    if (filters?.zone) {
      constraints.push(where('location.zone', '==', filters.zone));
    }

    constraints.push(orderBy('brand'));

    const q = query(collection(db, COLLECTIONS.ASSETS), ...constraints);
    const querySnapshot = await getDocs(q);

    let assets = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Asset[];

    // Client-side filtering for search (Firestore doesn't support full-text search)
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      assets = assets.filter(asset =>
        asset.brand.toLowerCase().includes(searchLower) ||
        asset.model.toLowerCase().includes(searchLower) ||
        asset.nickname?.toLowerCase().includes(searchLower) ||
        asset.serialNumber?.toLowerCase().includes(searchLower)
      );
    }

    // Filter assets needing maintenance
    if (filters?.needsMaintenance) {
      const now = new Date();
      assets = assets.filter(asset => 
        new Date(asset.maintenance.nextServiceDue) <= now
      );
    }

    return assets;
  }

  /**
   * Update an asset's general information
   */
  async updateAsset(
    assetId: string,
    updates: Partial<Omit<Asset, 'id' | 'createdAt' | 'createdBy'>>,
    userId: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTIONS.ASSETS, assetId);
    
    await updateDoc(docRef, {
      ...updates,
      updatedAt: FirestoreTimestamp.now(),
      updatedBy: userId,
    });
  }

  /**
   * Delete an asset from the registry
   */
  async deleteAsset(assetId: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.ASSETS, assetId);
    await deleteDoc(docRef);
  }

  // ------------------------------------------
  // Status Management
  // ------------------------------------------

  /**
   * Update asset status with logging
   */
  async updateStatus(
    assetId: string,
    newStatus: AssetStatus,
    userId: string,
    reason?: string
  ): Promise<void> {
    // Get current asset to record the transition
    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    const oldStatus = asset.status;
    const now = FirestoreTimestamp.now();

    // Update asset status
    const assetRef = doc(db, COLLECTIONS.ASSETS, assetId);
    await updateDoc(assetRef, {
      status: newStatus,
      updatedAt: now,
      updatedBy: userId,
    });

    // Log status change
    const statusChange: Omit<AssetStatusChange, 'id'> = {
      assetId,
      fromStatus: oldStatus,
      toStatus: newStatus,
      reason,
      changedBy: userId,
      changedAt: now,
    };

    await addDoc(collection(db, COLLECTIONS.STATUS_CHANGES), statusChange);

    // If status affects feature availability, trigger recalculation
    // Note: This will be handled by Firestore triggers in a separate implementation
  }

  /**
   * Check out an asset to a user
   */
  async checkoutAsset(
    assetId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    if (asset.status !== 'ACTIVE') {
      throw new Error(`Asset ${assetId} is not available for checkout (status: ${asset.status})`);
    }

    const now = FirestoreTimestamp.now();

    // Update asset status and location
    const assetRef = doc(db, COLLECTIONS.ASSETS, assetId);
    await updateDoc(assetRef, {
      status: 'CHECKED_OUT',
      'location.checkedOutByUserId': userId,
      updatedAt: now,
      updatedBy: userId,
    });

    // Create checkout record
    const checkout: Omit<AssetCheckout, 'id'> = {
      assetId,
      checkedOutBy: userId,
      checkedOutAt: now,
      notes,
    };

    await addDoc(collection(db, COLLECTIONS.CHECKOUTS), checkout);
  }

  /**
   * Check in an asset
   */
  async checkinAsset(
    assetId: string,
    userId: string
  ): Promise<void> {
    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    if (asset.status !== 'CHECKED_OUT') {
      throw new Error(`Asset ${assetId} is not checked out`);
    }

    const now = FirestoreTimestamp.now();

    // Update asset status
    const assetRef = doc(db, COLLECTIONS.ASSETS, assetId);
    await updateDoc(assetRef, {
      status: 'ACTIVE',
      'location.checkedOutByUserId': null,
      updatedAt: now,
      updatedBy: userId,
    });

    // Update checkout record (find the open checkout)
    const checkoutQuery = query(
      collection(db, COLLECTIONS.CHECKOUTS),
      where('assetId', '==', assetId),
      where('checkedInAt', '==', null)
    );
    const checkoutSnapshot = await getDocs(checkoutQuery);
    
    if (!checkoutSnapshot.empty) {
      const checkoutDoc = checkoutSnapshot.docs[0];
      await updateDoc(checkoutDoc.ref, {
        checkedInAt: now,
        checkedInBy: userId,
      });
    }
  }

  // ------------------------------------------
  // Maintenance Operations
  // ------------------------------------------

  /**
   * Log a maintenance event for an asset
   */
  async logMaintenance(
    assetId: string,
    maintenanceData: {
      type: MaintenanceType;
      description: string;
      tasksCompleted: string[];
      hoursAtService: number;
      partsUsed?: string[];
      cost?: number;
      notes?: string;
      attachments?: string[];
    },
    userId: string
  ): Promise<MaintenanceLog> {
    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    const now = FirestoreTimestamp.now();

    // Create maintenance log entry
    const logEntry: Omit<MaintenanceLog, 'id'> = {
      assetId,
      type: maintenanceData.type,
      description: maintenanceData.description,
      tasksCompleted: maintenanceData.tasksCompleted,
      hoursAtService: maintenanceData.hoursAtService,
      partsUsed: maintenanceData.partsUsed,
      cost: maintenanceData.cost,
      performedBy: userId,
      performedAt: now,
      notes: maintenanceData.notes,
      attachments: maintenanceData.attachments,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.MAINTENANCE_LOGS), logEntry);

    // Calculate next service date based on interval
    const nextServiceDue = new Date();
    nextServiceDue.setTime(
      nextServiceDue.getTime() + 
      (asset.maintenance.intervalHours * 60 * 60 * 1000) // Convert hours to ms
    );

    // Update asset maintenance info
    const assetRef = doc(db, COLLECTIONS.ASSETS, assetId);
    await updateDoc(assetRef, {
      'maintenance.lastServicedAt': now.toDate(),
      'maintenance.nextServiceDue': nextServiceDue,
      updatedAt: now,
      updatedBy: userId,
    });

    // If asset was in MAINTENANCE status, return to ACTIVE
    if (asset.status === 'MAINTENANCE') {
      await this.updateStatus(assetId, 'ACTIVE', userId, 'Maintenance completed');
    }

    return {
      id: docRef.id,
      ...logEntry,
    };
  }

  /**
   * Get maintenance history for an asset
   */
  async getMaintenanceHistory(assetId: string): Promise<MaintenanceLog[]> {
    const q = query(
      collection(db, COLLECTIONS.MAINTENANCE_LOGS),
      where('assetId', '==', assetId),
      orderBy('performedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as MaintenanceLog[];
  }

  /**
   * Get assets due for maintenance
   */
  async getAssetsDueForMaintenance(): Promise<Asset[]> {
    const now = new Date();
    
    const q = query(
      collection(db, COLLECTIONS.ASSETS),
      where('maintenance.nextServiceDue', '<=', now),
      where('status', 'in', ['ACTIVE', 'CHECKED_OUT'])
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Asset[];
  }

  // ------------------------------------------
  // Feature Availability
  // ------------------------------------------

  /**
   * Check availability of assets for a feature
   * Returns availability status and reason
   */
  async checkFeatureAvailability(
    requiredAssetIds: string[]
  ): Promise<{ isAvailable: boolean; reason: string }> {
    if (requiredAssetIds.length === 0) {
      return { isAvailable: true, reason: 'No assets required' };
    }

    const unavailableAssets: string[] = [];
    const maintenanceAssets: string[] = [];

    for (const assetId of requiredAssetIds) {
      const asset = await this.getAsset(assetId);
      
      if (!asset) {
        unavailableAssets.push(`Unknown asset (${assetId})`);
        continue;
      }

      const displayName = asset.nickname || 
        `${asset.brand} ${asset.model}`;

      switch (asset.status) {
        case 'BROKEN':
          unavailableAssets.push(`${displayName} is broken`);
          break;
        case 'MAINTENANCE':
          maintenanceAssets.push(`${displayName} is in maintenance`);
          break;
        case 'RETIRED':
          unavailableAssets.push(`${displayName} has been retired`);
          break;
        // ACTIVE and CHECKED_OUT are considered available
      }
    }

    if (unavailableAssets.length > 0) {
      return {
        isAvailable: false,
        reason: unavailableAssets.join('; '),
      };
    }

    if (maintenanceAssets.length > 0) {
      return {
        isAvailable: false,
        reason: maintenanceAssets.join('; '),
      };
    }

    return {
      isAvailable: true,
      reason: 'All required assets are operational',
    };
  }

  /**
   * Update feature availability based on asset status
   * Called when asset status changes
   */
  async updateFeatureAvailability(assetId: string): Promise<void> {
    // Find all features that require this asset
    const q = query(
      collection(db, COLLECTIONS.FEATURES),
      where('requiredAssetIds', 'array-contains', assetId)
    );

    const querySnapshot = await getDocs(q);
    
    for (const featureDoc of querySnapshot.docs) {
      const feature = featureDoc.data() as Feature;
      const availability = await this.checkFeatureAvailability(feature.requiredAssetIds);
      
      await updateDoc(featureDoc.ref, {
        isAvailable: availability.isAvailable,
        availabilityReason: availability.reason,
        updatedAt: FirestoreTimestamp.now(),
      });
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

export const assetService = new AssetService();
