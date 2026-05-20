/**
 * SECURITY MODULE INDEX
 * 
 * Re-exports all security utilities for the advisory platform
 */

// Role definitions
export * from './roles';
export type {
  PlatformRole,
  EngagementRole,
  ClientRole,
  FunderRole,
  UserProfile,
  ClientAssociation,
  FunderAssociation,
} from './roles';

// Permission definitions
export * from './permissions';
export type {
  Permission,
  PermissionCategory,
} from './permissions';

// Access control service
export * from './access-control';
export {
  AccessControlService,
  createAccessControl,
  createAccessControlContextValue,
} from './access-control';
export type { AccessControlContext } from './access-control';
