/**
 * /talent/:profileId — profile detail: info, rate card, contracts, invoices, NDA upload.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import {
  getTalentProfile,
  listContractsForProfile,
} from '../services/talent-profile.service';
import {
  listTalentInvoices,
  submitTalentInvoice,
} from '../services/talent-invoice.service';
import type { TalentProfile } from '../types/talent-profile.types';
import type { FreelancerContract } from '../types/freelancer-contract.types';
import type { TalentInvoice } from '../types/talent-invoice.types';
import { TalentTypeBadge } from '../components/TalentTypeBadge';
import { ContractStatusBadge } from '../components/ContractStatusBadge';
import { TalentInvoiceForm } from '../components/TalentInvoiceForm';
import { InvoiceApprovalPanel } from '../components/InvoiceApprovalPanel';

type Tab = 'info' | 'contracts' | 'invoices';

export default function TalentProfilePage() {
  const { profileId } = useParams<{ profileId: string }>();
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || 'default';
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [contracts, setContracts] = useState<FreelancerContract[]>([]);
  const [invoices, setInvoices] = useState<TalentInvoice[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function reload() {
    if (!profileId) return;
    const [p, c, i] = await Promise.all([
      getTalentProfile(profileId),
      listContractsForProfile(profileId),
      listTalentInvoices({ talentProfileId: profileId }),
    ]);
    setProfile(p);
    setContracts(c);
    setInvoices(i);
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, [profileId]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!profile) return <p className="p-6 text-sm text-muted-foreground">Profile not found.</p>;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'info',      label: 'Info & Rate Card' },
    { id: 'contracts', label: `Contracts (${contracts.length})` },
    { id: 'invoices',  label: `Invoices (${invoices.length})` },
  ];

  return (
    <div className="space-y-6 p-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/talent" className="hover:underline">Talent Roster</Link> › {profile.name}
      </nav>

      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{profile.name}</h1>
            <TalentTypeBadge type={profile.type} />
          </div>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b flex gap-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3">
            {[
              { label: 'Status',     value: profile.status },
              { label: 'Subsidiary', value: profile.subsidiaryOrgId ?? '—' },
              { label: 'Roles',      value: profile.roles.join(', ') || '—' },
              {
                label: 'Daily Rate',
                value: profile.dailyRateMinor
                  ? `${profile.currency ?? ''} ${(profile.dailyRateMinor / 100).toLocaleString()}`
                  : '—',
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded border p-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {profile.ndaStorageRef && (
            <p className="text-sm">
              NDA:{' '}
              <a href={profile.ndaStorageRef} target="_blank" rel="noreferrer" className="underline">
                View document
              </a>
            </p>
          )}
          {profile.notes && (
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{profile.notes}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'contracts' && (
        <div className="space-y-3">
          {contracts.length === 0 && (
            <p className="text-sm text-muted-foreground">No contracts on file.</p>
          )}
          {contracts.map((contract) => (
            <div key={contract.id} className="rounded border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{contract.projectTitle}</span>
                <ContractStatusBadge status={contract.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {contract.startDate} – {contract.endDate} ·{' '}
                {contract.currency} {(contract.totalFeeMinor / 100).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowInvoiceForm(true)}
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              Submit Invoice
            </button>
          </div>

          {showInvoiceForm && (
            <TalentInvoiceForm
              talentProfileId={profile.id}
              orgId={orgId}
              onSave={async (values) => {
                await submitTalentInvoice(values);
                setShowInvoiceForm(false);
                await reload();
              }}
              onCancel={() => setShowInvoiceForm(false)}
            />
          )}

          {invoices.length === 0 && !showInvoiceForm && (
            <p className="text-sm text-muted-foreground">No invoices submitted.</p>
          )}

          {invoices.map((inv) => (
            <InvoiceApprovalPanel key={inv.id} invoice={inv} onUpdated={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
