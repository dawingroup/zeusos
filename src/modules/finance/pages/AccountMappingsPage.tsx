// ============================================================================
// ACCOUNT MAPPINGS PAGE
// ZeusOS v2.0 - Financial Management Module
// Wrapper for QBO Account Mapping settings
// ============================================================================

import { Link } from 'react-router-dom';
import { QBOAccountMappingSettings } from '../components/settings/QBOAccountMappingSettings';

const COMPANY_ID = 'dawinos';

export default function AccountMappingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/finance/settings" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Settings
        </Link>
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">QBO Account Mappings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure how ZeusOS accounts map to QuickBooks Online
        </p>
      </div>
      <QBOAccountMappingSettings companyId={COMPANY_ID} />
    </div>
  );
}
