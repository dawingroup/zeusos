/**
 * PrivacyPolicyPage
 *
 * Public (unauth) page mounted at /privacy. Pasted into Meta's app config
 * as the "Privacy Policy URL" for the ZeusOS Marketing → Social Publishing
 * feature. Section numbering and the exact phrases ("pages_manage_posts",
 * "instagram_content_publish", "AES-256-GCM", "24 hours", "user data
 * deletion") are load-bearing — Meta reviewers ctrl-F for them.
 *
 * The companion /privacy/data-deletion route lands users who clicked through
 * Meta's deletion-callback URL (with a ticket=<id> query param) into the
 * DataDeletionStatus block below, which fetches publicDataDeletionTickets/{id}.
 */
import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/shared/components/ui/card';
import { fetchDocument } from '@/shared/services/firebase/firestore';

const EFFECTIVE_DATE = '2026-05-19';

interface PublicDeletionTicket {
  ticketId: string;
  completedAt?: { seconds: number; nanoseconds: number } | string | null;
  accountDisplayNames?: string[];
}

const SECTIONS = [
  { id: 'scope',         label: '1. Who this applies to' },
  { id: 'data-collected', label: '2. Data collected from Meta' },
  { id: 'use',           label: '3. How we use this data' },
  { id: 'storage',       label: '4. How we store it' },
  { id: 'retention',     label: '5. How long we keep it' },
  { id: 'deletion',      label: '6. How to delete your data' },
  { id: 'subprocessors', label: '7. Sub-processors' },
  { id: 'contact',       label: '8. Contact' },
  { id: 'effective',     label: '9. Effective date' },
];

function formatTicketTimestamp(ts: PublicDeletionTicket['completedAt']): string {
  if (!ts) return '—';
  if (typeof ts === 'string') return new Date(ts).toLocaleString();
  if (typeof ts === 'object' && 'seconds' in ts) {
    return new Date(ts.seconds * 1000).toLocaleString();
  }
  return '—';
}

function DataDeletionStatus({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<PublicDeletionTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await fetchDocument<PublicDeletionTicket>(
          'publicDataDeletionTickets',
          ticketId
        );
        if (cancelled) return;
        if (!doc) {
          setNotFound(true);
        } else {
          setTicket(doc);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p style={{ color: 'var(--fg-tertiary)' }}>Looking up your deletion ticket…</p>
        </CardContent>
      </Card>
    );
  }

  if (notFound || !ticket) {
    return (
      <Card>
        <CardContent className="py-8 space-y-3">
          <h2 className="text-lg font-semibold">Ticket not found</h2>
          <p style={{ color: 'var(--fg-secondary)' }}>
            We could not locate a deletion ticket with the ID <code>{ticketId}</code>.
            If you believe this is an error, email{' '}
            <a href="mailto:privacy@zeusgroup.co.ug" className="underline">privacy@zeusgroup.co.ug</a>
            {' '}with the subject line "ZeusOS Marketing data deletion request".
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-8 space-y-4">
        <h2 className="text-xl font-semibold">Your ZeusOS Marketing data has been deleted.</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt style={{ color: 'var(--fg-tertiary)' }} className="uppercase text-xs tracking-wide">
              Ticket ID
            </dt>
            <dd className="font-mono break-all">{ticket.ticketId}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--fg-tertiary)' }} className="uppercase text-xs tracking-wide">
              Confirmation code
            </dt>
            <dd className="font-mono break-all">DAWINOS-{ticket.ticketId}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--fg-tertiary)' }} className="uppercase text-xs tracking-wide">
              Completed
            </dt>
            <dd>{formatTicketTimestamp(ticket.completedAt)}</dd>
          </div>
        </dl>
        {ticket.accountDisplayNames && ticket.accountDisplayNames.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Accounts unlinked</h3>
            <ul className="list-disc pl-5 text-sm" style={{ color: 'var(--fg-secondary)' }}>
              {ticket.accountDisplayNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm" style={{ color: 'var(--fg-secondary)' }}>
          All OAuth access tokens and Meta-issued user identifiers tied to your account have
          been removed from our systems. Aggregate engagement metrics may be retained in
          anonymized form for historical reporting.
        </p>
      </CardContent>
    </Card>
  );
}

export default function PrivacyPolicyPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get('ticket');
  const deletionSectionRef = useRef<HTMLElement | null>(null);
  const isDataDeletionRoute = location.pathname.startsWith('/privacy/data-deletion');

  useEffect(() => {
    if (isDataDeletionRoute && deletionSectionRef.current) {
      deletionSectionRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    } else if (location.hash) {
      const id = location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [isDataDeletionRoute, location.hash]);

  return (
    <div
      style={{
        background: 'var(--bg-app)',
        color: 'var(--fg-primary)',
        minHeight: '100vh',
      }}
    >
      <Helmet>
        <title>Privacy Policy — ZeusOS Marketing</title>
        <meta
          name="description"
          content="ZeusOS Marketing privacy notice for Meta (Facebook, Instagram) integration: data collected, retention, and deletion."
        />
      </Helmet>

      <div className="mx-auto max-w-5xl px-6 py-12 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <aside className="hidden lg:block">
          <nav
            className="sticky top-8 text-sm space-y-2"
            aria-label="Privacy policy sections"
          >
            <p
              className="uppercase text-xs tracking-wide mb-3"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              On this page
            </p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block hover:underline"
                style={{ color: 'var(--fg-secondary)' }}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="space-y-8" style={{ padding: 'var(--pad-card, 0)' }}>
          <header className="space-y-3">
            <p
              className="uppercase text-xs tracking-wide"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              ZeusOS Marketing
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Meta Integration Privacy Notice
            </h1>
            <p style={{ color: 'var(--fg-secondary)' }}>
              Addendum to the{' '}
              <a
                href="https://dawinfinishes.com/policies/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Zeus Group Privacy Policy
              </a>
              . This addendum governs the additional data collected when an authorized
              administrator connects a Facebook Page or Instagram Business account to
              ZeusOS Marketing.
            </p>
          </header>

          {isDataDeletionRoute && ticketId && (
            <section aria-labelledby="status-heading" className="space-y-4">
              <h2 id="status-heading" className="text-xl font-semibold">
                Deletion confirmation
              </h2>
              <DataDeletionStatus ticketId={ticketId} />
              <p className="text-sm" style={{ color: 'var(--fg-tertiary)' }}>
                See the full privacy notice below for details on what data is collected
                and how it is processed.
              </p>
            </section>
          )}

          <section id="scope" className="space-y-2">
            <h2 className="text-lg font-semibold">1. Who this applies to</h2>
            <p style={{ color: 'var(--fg-secondary)' }}>
              The ZeusOS Marketing module is an internal tool used by employees of
              Zeus Group Ltd to schedule, publish, and track social media content
              on Zeus Group' own Facebook Page and Instagram Business account.
              This addendum describes the additional data we collect and process when
              an authorized administrator connects a Page or Instagram Business
              account owned by Zeus Group Ltd.
            </p>
          </section>

          <section id="data-collected" className="space-y-2">
            <h2 className="text-lg font-semibold">2. Data collected from Meta</h2>
            <p style={{ color: 'var(--fg-secondary)' }}>
              When you connect a Page or Instagram Business account via Facebook Login,
              we receive and store:
            </p>
            <ul
              className="list-disc pl-6 space-y-1"
              style={{ color: 'var(--fg-secondary)' }}
            >
              <li>Long-lived OAuth access tokens (encrypted at rest with AES-256-GCM)</li>
              <li>Facebook Page ID(s), Page name, and Page profile photo URL</li>
              <li>
                Instagram Business Account ID, username, and profile picture URL
              </li>
              <li>
                Permission scopes granted:{' '}
                <code>pages_show_list</code>, <code>pages_read_engagement</code>,{' '}
                <code>pages_manage_posts</code>, <code>instagram_basic</code>,{' '}
                <code>instagram_content_publish</code>, <code>business_management</code>
              </li>
              <li>
                Post engagement metrics (impressions, reach, likes, comments, shares,
                saves, clicks) for posts published or tracked through ZeusOS
              </li>
            </ul>
          </section>

          <section id="use" className="space-y-2">
            <h2 className="text-lg font-semibold">3. How we use this data</h2>
            <ul
              className="list-disc pl-6 space-y-1"
              style={{ color: 'var(--fg-secondary)' }}
            >
              <li>
                To create scheduled posts on your behalf when you author and schedule
                them inside ZeusOS Marketing
              </li>
              <li>To display performance dashboards in ZeusOS Marketing → Analytics</li>
              <li>
                To benchmark your owned pages against publicly available competitor
                pages (no competitor user data is retrieved beyond what is already
                public on those pages)
              </li>
              <li>
                We do NOT use Meta data for targeted advertising of third parties,
                resale, or any purpose beyond the connected Pages' own analytics.
              </li>
            </ul>
          </section>

          <section id="storage" className="space-y-2">
            <h2 className="text-lg font-semibold">4. How we store it</h2>
            <ul
              className="list-disc pl-6 space-y-1"
              style={{ color: 'var(--fg-secondary)' }}
            >
              <li>
                Access tokens are encrypted with AES-256-GCM and stored in Google
                Firestore (region: us-central1). Encryption keys are held in Google
                Secret Manager and rotated on a quarterly basis.
              </li>
              <li>
                Post metadata and engagement metrics are stored in Firestore and
                mirrored to Google BigQuery for analytics. Both are restricted to
                authorized Zeus Group Ltd employees by Firebase Authentication
                and Firestore security rules.
              </li>
            </ul>
          </section>

          <section id="retention" className="space-y-2">
            <h2 className="text-lg font-semibold">5. How long we keep it</h2>
            <ul
              className="list-disc pl-6 space-y-1"
              style={{ color: 'var(--fg-secondary)' }}
            >
              <li>
                Access tokens: retained for the duration of the connection. On
                disconnect (either from ZeusOS or by removing the app from your
                Facebook account at{' '}
                <a
                  href="https://www.facebook.com/settings/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  facebook.com/settings/apps
                </a>
                ), tokens are deleted within 24 hours.
              </li>
              <li>
                Post content and engagement metrics: retained for 24 months for trend
                analysis, then deleted.
              </li>
              <li>Backup snapshots: retained for 35 days before being purged.</li>
            </ul>
          </section>

          <section
            id="data-deletion"
            ref={(el) => {
              deletionSectionRef.current = el;
            }}
            className="space-y-2 scroll-mt-8"
          >
            <h2 className="text-lg font-semibold">
              6. How to delete your data (user data deletion)
            </h2>
            <p style={{ color: 'var(--fg-secondary)' }}>
              You can revoke ZeusOS Marketing's access at any time by:
            </p>
            <ol
              className="list-decimal pl-6 space-y-1"
              style={{ color: 'var(--fg-secondary)' }}
            >
              <li>
                Disconnecting from ZeusOS Marketing → Social Accounts → "Connected"
                button on the Page row, OR
              </li>
              <li>
                Removing the app at{' '}
                <a
                  href="https://www.facebook.com/settings?tab=applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  facebook.com/settings?tab=applications
                </a>
                .
              </li>
            </ol>
            <p style={{ color: 'var(--fg-secondary)' }}>
              In both cases, we delete all tokens and personal identifiers within 24
              hours. Aggregate engagement metrics may be retained in anonymized form
              for historical reporting.
            </p>
            <p style={{ color: 'var(--fg-secondary)' }}>
              To request full deletion of any data we hold about you, email{' '}
              <a href="mailto:privacy@zeusgroup.co.ug" className="underline">
                privacy@zeusgroup.co.ug
              </a>{' '}
              or{' '}
              <a href="mailto:info@dawinfinishes.com" className="underline">
                info@dawinfinishes.com
              </a>{' '}
              with the subject line "ZeusOS Marketing data deletion request" and your
              Facebook user ID or Page ID. We respond within 30 days.
            </p>
            {!isDataDeletionRoute && (
              <p className="text-sm" style={{ color: 'var(--fg-tertiary)' }}>
                If you arrived here from a Meta deletion confirmation link, visit{' '}
                <Link to="/privacy/data-deletion" className="underline">
                  /privacy/data-deletion
                </Link>{' '}
                with your ticket ID appended (e.g.{' '}
                <code>?ticket=&lt;id&gt;</code>) to view your deletion record.
              </p>
            )}
          </section>

          <section id="subprocessors" className="space-y-2">
            <h2 className="text-lg font-semibold">7. Sub-processors</h2>
            <ul
              className="list-disc pl-6 space-y-1"
              style={{ color: 'var(--fg-secondary)' }}
            >
              <li>Meta Platforms, Inc. — source of the data</li>
              <li>
                Google LLC (Firebase, Cloud Functions, BigQuery, Secret Manager) —
                hosting and storage
              </li>
              <li>
                Apify Limited — public-page scraping for competitor benchmarks only;
                never receives access tokens
              </li>
            </ul>
          </section>

          <section id="contact" className="space-y-2">
            <h2 className="text-lg font-semibold">8. Contact</h2>
            <ul className="space-y-1" style={{ color: 'var(--fg-secondary)' }}>
              <li>
                Data Protection Contact:{' '}
                <a href="mailto:privacy@zeusgroup.co.ug" className="underline">
                  privacy@zeusgroup.co.ug
                </a>
              </li>
              <li>
                General:{' '}
                <a href="mailto:info@dawinfinishes.com" className="underline">
                  info@dawinfinishes.com
                </a>{' '}
                / +256 39 3100493
              </li>
              <li>
                Postal: Kayondo Road, Kyambogo Upper Estate, Jordan House, Kampala, UG
              </li>
            </ul>
          </section>

          <section id="effective" className="space-y-2">
            <h2 className="text-lg font-semibold">9. Effective date</h2>
            <p style={{ color: 'var(--fg-secondary)' }}>{EFFECTIVE_DATE}</p>
          </section>
        </main>
      </div>
    </div>
  );
}
