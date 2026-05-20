/**
 * CampaignCreatePage
 * Dedicated page for campaign creation
 */

import { useNavigate } from 'react-router-dom';
import { CampaignForm } from '../components/campaigns';

export default function CampaignCreatePage() {
  const navigate = useNavigate();

  return (
    <CampaignForm
      onClose={() => navigate('/marketing/campaigns')}
      onSuccess={(campaignId) => navigate(`/marketing/campaigns/${campaignId}`)}
    />
  );
}
