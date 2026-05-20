/**
 * Advisory Home Page
 * 
 * Entry point for the Advisory module.
 */

import { AdvisoryDashboard } from '../components/dashboard';

interface AdvisoryHomePageProps {
  userId?: string;
}

export function AdvisoryHomePage({ userId = '' }: AdvisoryHomePageProps) {
  return (
    <div>
      <div>
        <AdvisoryDashboard userId={userId} />
      </div>
    </div>
  );
}

export default AdvisoryHomePage;
