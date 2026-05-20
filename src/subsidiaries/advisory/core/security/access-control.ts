/**
 * ACCESS-CONTROL.TS
 * Client-side access control validation service
 */

import { doc, getDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  UserProfile, 
  PlatformRole, 
  EngagementRole, 
  ClientRole, 
  FunderRole,
  isPlatformAdmin as checkPlatformAdmin,
  isPlatformStaff as checkPlatformStaff,
} from './roles';
import { 
  Permission, 
  hasPermission as checkRolePermission,
  clientHasPermission,
  funderHasPermission,
} from './permissions';

/**
 * ACCESS CONTROL SERVICE
 * Client-side access control validation
 */
export class AccessControlService {
  private userProfile: UserProfile | null = null;
  private isLoading: boolean = false;
  private loadPromise: Promise<UserProfile | null> | null = null;
  
  constructor(
    private db: Firestore,
    private user: User | null
  ) {}
  
  /**
   * Load user profile
   */
  async loadUserProfile(): Promise<UserProfile | null> {
    if (!this.user) return null;
    
    // Return existing promise if already loading
    if (this.loadPromise) {
      return this.loadPromise;
    }
    
    this.isLoading = true;
    this.loadPromise = this._loadProfile();
    
    try {
      this.userProfile = await this.loadPromise;
      return this.userProfile;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }
  
  private async _loadProfile(): Promise<UserProfile | null> {
    if (!this.user) return null;
    
    try {
      const userDoc = await getDoc(doc(this.db, 'users', this.user.uid));
      if (!userDoc.exists()) return null;
      
      return { uid: userDoc.id, ...userDoc.data() } as UserProfile;
    } catch (error) {
      console.error('Failed to load user profile:', error);
      return null;
    }
  }
  
  /**
   * Get current user profile
   */
  getUserProfile(): UserProfile | null {
    return this.userProfile;
  }
  
  /**
   * Check if profile is loading
   */
  getIsLoading(): boolean {
    return this.isLoading;
  }
  
  /**
   * Set user profile (for testing or external updates)
   */
  setUserProfile(profile: UserProfile | null): void {
    this.userProfile = profile;
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.user !== null;
  }
  
  /**
   * Check if user is platform admin
   */
  isPlatformAdmin(): boolean {
    if (!this.userProfile) return false;
    return checkPlatformAdmin(this.userProfile);
  }
  
  /**
   * Check if user is platform staff
   */
  isPlatformStaff(): boolean {
    if (!this.userProfile) return false;
    return checkPlatformStaff(this.userProfile);
  }
  
  /**
   * Get user's platform role
   */
  getPlatformRole(): PlatformRole | null {
    return this.userProfile?.platformRole || null;
  }
  
  /**
   * Get user's role in an engagement
   */
  getEngagementRole(engagementId: string): EngagementRole | null {
    if (!this.userProfile) return null;
    return this.userProfile.engagementRoles[engagementId] || null;
  }
  
  /**
   * Check if user can access engagement
   */
  canAccessEngagement(engagementId: string): boolean {
    if (this.isPlatformAdmin()) return true;
    return this.getEngagementRole(engagementId) !== null;
  }
  
  /**
   * Check if user has permission in engagement
   */
  hasPermissionInEngagement(engagementId: string, permission: Permission): boolean {
    if (this.isPlatformAdmin()) return true;
    
    const role = this.getEngagementRole(engagementId);
    if (!role) return false;
    
    return checkRolePermission(role, permission);
  }
  
  /**
   * Check if user is engagement leadership
   */
  isEngagementLeadership(engagementId: string): boolean {
    if (this.isPlatformAdmin()) return true;
    
    const role = this.getEngagementRole(engagementId);
    return role === 'engagement_owner' || role === 'engagement_lead';
  }
  
  /**
   * Check if user can manage engagement
   */
  canManageEngagement(engagementId: string): boolean {
    return this.isEngagementLeadership(engagementId);
  }
  
  /**
   * Check if user can approve in engagement
   */
  canApproveInEngagement(engagementId: string): boolean {
    if (this.isPlatformAdmin()) return true;
    
    const role = this.getEngagementRole(engagementId);
    if (!role) return false;
    
    const approverRoles: EngagementRole[] = [
      'engagement_owner',
      'engagement_lead',
      'program_manager',
      'project_manager',
      'deal_lead',
      'portfolio_manager',
      'finance_officer',
    ];
    
    return approverRoles.includes(role);
  }
  
  /**
   * Check if user is associated with client
   */
  isClientAssociated(clientId: string): boolean {
    if (!this.userProfile?.clientAssociations) return false;
    return this.userProfile.clientAssociations.some(a => a.clientId === clientId);
  }
  
  /**
   * Get user's role for a client
   */
  getClientRole(clientId: string): ClientRole | null {
    if (!this.userProfile?.clientAssociations) return null;
    const association = this.userProfile.clientAssociations.find(a => a.clientId === clientId);
    return association?.role || null;
  }
  
  /**
   * Check if user has client permission
   */
  hasClientPermission(clientId: string, permission: Permission): boolean {
    if (this.isPlatformStaff()) return true;
    
    const role = this.getClientRole(clientId);
    if (!role) return false;
    
    return clientHasPermission(role, permission);
  }
  
  /**
   * Check if user is associated with funder
   */
  isFunderAssociated(funderId: string): boolean {
    if (!this.userProfile?.funderAssociations) return false;
    return this.userProfile.funderAssociations.some(a => a.funderId === funderId);
  }
  
  /**
   * Get user's role for a funder
   */
  getFunderRole(funderId: string): FunderRole | null {
    if (!this.userProfile?.funderAssociations) return null;
    const association = this.userProfile.funderAssociations.find(a => a.funderId === funderId);
    return association?.role || null;
  }
  
  /**
   * Check if user has funder permission
   */
  hasFunderPermission(funderId: string, permission: Permission): boolean {
    if (this.isPlatformStaff()) return true;
    
    const role = this.getFunderRole(funderId);
    if (!role) return false;
    
    return funderHasPermission(role, permission);
  }
  
  /**
   * Check multiple permissions (AND)
   */
  hasAllPermissions(engagementId: string, permissions: Permission[]): boolean {
    return permissions.every(p => this.hasPermissionInEngagement(engagementId, p));
  }
  
  /**
   * Check multiple permissions (OR)
   */
  hasAnyPermission(engagementId: string, permissions: Permission[]): boolean {
    return permissions.some(p => this.hasPermissionInEngagement(engagementId, p));
  }
  
  /**
   * Get all engagements user has access to
   */
  getAccessibleEngagementIds(): string[] {
    if (!this.userProfile) return [];
    return Object.keys(this.userProfile.engagementRoles);
  }
  
  /**
   * Get engagements where user has specific role
   */
  getEngagementsWithRole(role: EngagementRole): string[] {
    if (!this.userProfile) return [];
    return Object.entries(this.userProfile.engagementRoles)
      .filter(([_, r]) => r === role)
      .map(([id]) => id);
  }
}

/**
 * Create access control service
 */
export function createAccessControl(db: Firestore, user: User | null): AccessControlService {
  return new AccessControlService(db, user);
}

/**
 * ACCESS CONTROL CONTEXT
 * Interface for React context
 */
export interface AccessControlContext {
  isLoading: boolean;
  userProfile: UserProfile | null;
  isPlatformAdmin: boolean;
  isPlatformStaff: boolean;
  canAccessEngagement: (id: string) => boolean;
  hasPermission: (engagementId: string, permission: Permission) => boolean;
  getEngagementRole: (id: string) => EngagementRole | null;
  isEngagementLeadership: (id: string) => boolean;
  canApproveInEngagement: (id: string) => boolean;
  isClientAssociated: (clientId: string) => boolean;
  isFunderAssociated: (funderId: string) => boolean;
}

/**
 * Create access control context value from service
 */
export function createAccessControlContextValue(
  service: AccessControlService
): AccessControlContext {
  return {
    isLoading: service.getIsLoading(),
    userProfile: service.getUserProfile(),
    isPlatformAdmin: service.isPlatformAdmin(),
    isPlatformStaff: service.isPlatformStaff(),
    canAccessEngagement: (id) => service.canAccessEngagement(id),
    hasPermission: (engagementId, permission) => service.hasPermissionInEngagement(engagementId, permission),
    getEngagementRole: (id) => service.getEngagementRole(id),
    isEngagementLeadership: (id) => service.isEngagementLeadership(id),
    canApproveInEngagement: (id) => service.canApproveInEngagement(id),
    isClientAssociated: (clientId) => service.isClientAssociated(clientId),
    isFunderAssociated: (funderId) => service.isFunderAssociated(funderId),
  };
}
