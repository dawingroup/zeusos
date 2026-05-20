/**
 * Marketing Module
 * Public API exports
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Schemas
export * from './schemas';

// Services
export * from './services';

// Hooks
export * from './hooks';

// Components (selective to avoid name conflicts with types)
export { CampaignList, CampaignDetail, CampaignForm, AudienceSelector } from './components/campaigns';
export { CampaignMetrics as CampaignMetricsPanel } from './components/campaigns';
export { WhatsAppCampaignConfig as WhatsAppCampaignConfigPanel } from './components/campaigns';
export { SocialPostForm, PostScheduler, ContentCalendar } from './components/social';
export { CampaignPerformanceChart, TypeBreakdownChart, WhatsAppFunnelChart, ROICalculator } from './components/analytics';

// Pages
export * from './pages';

// Module
export { MarketingModule } from './MarketingModule';
