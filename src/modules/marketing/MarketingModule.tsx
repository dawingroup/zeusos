/**
 * Marketing Module
 * Main router component for Marketing Hub
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import {
  MarketingDashboardPage,
  CampaignListPage,
  CampaignDetailPage,
  CampaignCreatePage,
  ContentCalendarPage,
  TemplateLibraryPage,
  AnalyticsReportsPage,
  MediaLibraryPage,
  MarketingAgentPage,
  KeyDateDetailPage,
  ProjectCaseStudiesPage,
  SocialAccountsPage,
} from './pages';

export function MarketingModule() {
  return (
    <Routes>
      <Route index element={<MarketingDashboardPage />} />
      <Route path="campaigns" element={<CampaignListPage />} />
      <Route path="campaigns/new" element={<CampaignCreatePage />} />
      <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
      <Route path="calendar" element={<ContentCalendarPage />} />
      <Route path="templates" element={<TemplateLibraryPage />} />
      <Route path="analytics" element={<AnalyticsReportsPage />} />
      <Route path="media" element={<MediaLibraryPage />} />
      <Route path="agent" element={<MarketingAgentPage />} />
      <Route path="case-studies" element={<ProjectCaseStudiesPage />} />
      <Route path="accounts" element={<SocialAccountsPage />} />
      <Route path="key-dates/:dateId" element={<KeyDateDetailPage />} />
      <Route path="*" element={<Navigate to="/marketing" replace />} />
    </Routes>
  );
}

export default MarketingModule;
