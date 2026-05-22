/**
 * /talent/:profileId/contracts — list of active contracts for a freelancer.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTalentProfile, listContractsForProfile } from '../services/talent-profile.service';
import type { TalentProfile } from '../types/talent-profile.types';
import type { FreelancerContract } from '../types/freelancer-contract.types';
import { ContractStatusBadge } from '../components/ContractStatusBadge';

export default function FreelancerContractsPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [contracts, setContracts] = useState<FreelancerContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;
    Promise.all([getTalentProfile(profileId), listContractsForProfile(profileId)])
      .then(([p, c]) => { setProfile(p); setContracts(c); })
      .finally(() => setLoading(false));
  }, [profileId]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!profile) return <p className="p-6 text-sm text-muted-foreground">Profile not found.</p>;

  const active = contracts.filter((c) => c.status !== 'EXPIRED');

  return (
    <div className="space-y-6 p-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/talent" className="hover:underline">Talent Roster</Link> ›{' '}
        <Link to={`/talent/${profileId}`} className="hover:underline">{profile.name}</Link> › Contracts
      </nav>

      <h1 className="text-xl font-semibold">Contracts — {profile.name}</h1>
      <p className="text-sm text-muted-foreground">
        {active.length} active contract{active.length !== 1 ? 's' : ''}
      </p>

      {contracts.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No contracts on file for this freelancer.
        </div>
      )}

      <ul className="divide-y rounded border">
        {contracts.map((contract) => (
          <li key={contract.id} className="p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{contract.projectTitle}</span>
              <ContractStatusBadge status={contract.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {contract.startDate} – {contract.endDate}
            </p>
            <p className="text-sm font-mono">
              {contract.currency} {(contract.totalFeeMinor / 100).toLocaleString()}
            </p>
            {contract.signedContractStorageRef && (
              <a
                href={contract.signedContractStorageRef}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline text-muted-foreground"
              >
                View signed contract
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
