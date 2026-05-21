/**
 * Shared Services
 * External service clients and integrations
 */

export * from './firebase';
export * from './notion';
// `optimization` + `projectService` removed in Phase 1.C — both were design-manager
// save / BOM-cutlist staleness machinery. Will be replaced by `campaignService` in Phase 3.
export * from './ragService';
