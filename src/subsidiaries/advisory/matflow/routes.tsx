/**
 * MatFlow Routes Configuration
 *
 * DEPRECATION NOTICE:
 * MatFlow has been fully integrated into Infrastructure Delivery.
 * All routes now redirect to the deprecation notice page.
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MatFlowDeprecationPage } from './pages/MatFlowDeprecationPage';

export const MatFlowRoutes: React.FC = () => {
  return (
    <Routes>
      {/* All MatFlow routes redirect to deprecation page */}
      <Route path="*" element={<MatFlowDeprecationPage />} />
    </Routes>
  );
};

export default MatFlowRoutes;
