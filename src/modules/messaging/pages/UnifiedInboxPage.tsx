/**
 * UnifiedInboxPage — /comms/inbox.
 *
 * The cross-channel unified inbox (WhatsApp + Team Chat + future Email) ported
 * from DawinOS. The WhatsApp half requires the Meta provider; until it's
 * enabled the page points operators at Team Chat (which is always live) and
 * explains the gap.
 */

import { Link } from 'react-router-dom';
import { Loader2, MessagesSquare, ArrowRight } from 'lucide-react';
import { PageHero } from '@/shared/components/refresh';
import { useWhatsAppConfig } from '../services/comms-config.service';

export default function UnifiedInboxPage() {
  const { config, loading } = useWhatsAppConfig();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--fg-tertiary)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--pad-page)' }} data-testid="unified-inbox-page">
      <PageHero
        eyebrow="Comms · Unified Inbox"
        title="Unified Inbox"
        body="One queue across every channel — WhatsApp, Team Chat, and (later) email. Triage, reply, and link conversations to clients and master jobs without switching tabs."
      />

      <div className="card card-pad" style={{ maxWidth: 560, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <span
          style={{
            width: 40, height: 40, borderRadius: 10, flex: 'none',
            background: 'var(--brand-accent-soft)', color: 'var(--fg-primary)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MessagesSquare size={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {config.enabled ? 'Channels connected' : 'Team Chat is live now'}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--fg-tertiary)', lineHeight: 1.5, margin: 0 }}>
            {config.enabled
              ? 'The merged WhatsApp + Team Chat queue activates once the Meta send/receive functions are deployed.'
              : 'Internal Team Chat is fully available today. The WhatsApp half of the unified queue lights up once a Meta Business provider is enabled under Comms → Settings.'}
          </p>
          <Link to="/comms" className="btn btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>
            Open Team Chat <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
