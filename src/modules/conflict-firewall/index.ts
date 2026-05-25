/**
 * Conflict Firewall module — Phase 6.UI.C public surface.
 */

export { ConflictFirewallLayout } from './components/ConflictFirewallLayout';
export { CategoryPickerDialog } from './components/CategoryPickerDialog';

export { default as CategoriesPage } from './pages/CategoriesPage';
export { default as ClientTagsPage } from './pages/ClientTagsPage';
export { default as WallsPage } from './pages/WallsPage';
export { default as BreachRisksPage } from './pages/BreachRisksPage';

export {
  addCategoryFn,
  addClientCategoryFn,
  removeClientCategoryFn,
  addConflictWallFn,
  removeConflictWallFn,
  subscribeCategories,
  subscribeClientCategories,
  subscribeConflictWalls,
  subscribeConflictRisks,
  getCategory,
  type ConflictExclusivityRiskEvent,
} from './services/conflict-firewall.service';
