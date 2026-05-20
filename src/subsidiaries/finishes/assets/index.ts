/**
 * Smart Asset Registry Module
 * 
 * Public API for the assets module.
 * This module handles physical tool/machine tracking, maintenance, and feature availability.
 * 
 * @module assets
 */

// Public types
export * from './types';

// Public services
export { AssetService, assetService } from './services/AssetService';

// Public pages
export { default as AssetRegistryPage } from './pages/AssetRegistryPage';
