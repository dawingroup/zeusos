/**
 * Matflow Suppliers Page
 *
 * Wrapper around the unified SuppliersPage for Matflow/Advisory subsidiary.
 * Uses the shared supplier module with 'advisory' subsidiary filtering.
 */

import React from 'react';
import { SuppliersPage as UnifiedSuppliersPage } from '@/modules/suppliers';

const SuppliersPage: React.FC = () => {
  return (
    <UnifiedSuppliersPage
      subsidiaryId="advisory"
      title="Suppliers"
      breadcrumbs={[
        { label: 'MatFlow', href: '/advisory/matflow' },
        { label: 'Suppliers' },
      ]}
    />
  );
};

export default SuppliersPage;
