/**
 * AssetUsageList — list of references to where this asset has been used.
 *
 * Each row links back to the subject (campaign, master job, production
 * job, media buy) — though the actual deep links are wired up by the
 * parent page since route shapes differ per subject type.
 */

import type {
  AssetUsage,
  AssetUsageSubjectType,
} from '../types/asset-usage.types';

interface Props {
  usages: AssetUsage[];
}

const SUBJECT_LABEL: Record<AssetUsageSubjectType, string> = {
  CAMPAIGN:       'Campaign',
  MASTER_JOB:     'Master Job',
  PRODUCTION_JOB: 'Production Job',
  MEDIA_BUY:      'Media Buy',
};

const SUBJECT_HREF: Record<AssetUsageSubjectType, (id: string) => string> = {
  CAMPAIGN:       (id) => `/advisory/campaigns/${id}`,
  MASTER_JOB:     (id) => `/master-jobs/${id}`,
  PRODUCTION_JOB: (id) => `/production/${id}`,
  MEDIA_BUY:      (id) => `/media/${id}`,
};

function fmtTimestamp(ts: AssetUsage['addedAt']): string {
  if (typeof ts === 'string') return ts;
  if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  return '—';
}

export function AssetUsageList({ usages }: Props) {
  if (usages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This asset hasn't been linked to a campaign or job yet.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded border">
      {usages.map((u) => (
        <li key={u.id} className="flex items-center justify-between p-3">
          <div className="space-y-0.5">
            <a
              href={SUBJECT_HREF[u.subjectType](u.subjectId)}
              className="text-sm font-medium hover:underline"
            >
              {SUBJECT_LABEL[u.subjectType]}: {u.subjectId}
            </a>
            {u.notes && (
              <p className="text-xs text-muted-foreground">{u.notes}</p>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{u.addedBy}</p>
            <p>{fmtTimestamp(u.addedAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
