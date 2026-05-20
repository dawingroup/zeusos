/**
 * ShopFloorPage — Route target for /manufacturing/shop-floor
 */

import React from 'react';
import { Box } from '@mui/material';
import { ShopFloorBoard } from '../components/shop-floor/ShopFloorBoard';
import { useGlobalState } from '@/integration/store/GlobalContext';

const ShopFloorPage: React.FC = () => {
  const { state } = useGlobalState();
  const subsidiaryId = state.currentSubsidiaryId ?? 'dawin-finishes';
  const organizationId = state.currentOrganizationId ?? '';

  return (
    <Box sx={{ p: 3 }}>
      <ShopFloorBoard
        subsidiaryId={subsidiaryId}
        organizationId={organizationId}
      />
    </Box>
  );
};

export default ShopFloorPage;
