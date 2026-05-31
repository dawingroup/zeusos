// ============================================================================
// ACCOUNT MAPPINGS PAGE
// ZeusOS v2.0 - Financial Management Module
// Wrapper for QBO Account Mapping settings
// ============================================================================

import { Link } from 'react-router-dom';
import { QBOAccountMappingSettings } from '../components/settings/QBOAccountMappingSettings';

const COMPANY_ID = 'zeus-group';

export default function AccountMappingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/finance/settings" className="text-sm text-muted-foreground hover:text-muted-foreground">
          &larr; Settings
        </Link>
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">QBO Account Mappings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how ZeusOS accounts map to QuickBooks Online
        </p>
      </div>
      <QBOAccountMappingSettings companyId={COMPANY_ID} />
    </div>
  );
}
