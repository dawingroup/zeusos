/**
 * Role-profiles module — Phase 6.UI.A (PR 6) public surface.
 */

export { RoleProfileForm } from './components/RoleProfileForm';
export { RoleAssignmentDialog } from './components/RoleAssignmentDialog';

export { default as RoleProfilesListPage } from './pages/RoleProfilesListPage';
export { default as RoleProfileDetailPage } from './pages/RoleProfileDetailPage';
export { default as RoleAssignmentsListPage } from './pages/RoleAssignmentsListPage';

export {
  createRoleProfileFn,
  updateRoleProfileFn,
  archiveRoleProfileFn,
  assignEmployeeToRoleFn,
  endRoleAssignmentFn,
  subscribeRoleProfile,
  subscribeRoleProfiles,
  subscribeRoleAssignments,
} from './services/role-profile.service';

export type {
  RoleProfile,
  RoleProfileId,
  RoleAssignment,
  JobLevel,
  TaskCapability,
  ApprovalAuthority,
} from './types';
