/**
 * ChannelNotConfigured — shown by the WhatsApp-channel tabs (WhatsApp /
 * Unified Inbox / Templates / Broadcasts) when `commsConfig/whatsapp.enabled`
 * is false (no Meta Business Cloud API account/token provisioned for ZeusOS).
 *
 * Keeps the tab navigable + explains the gap, with a deep-link to Settings
 * where a parent-org admin enables + configures the provider. Mirrors the
 * "disabled until enabled per plan §3" stance in CLAUDE.md.
 */

import { Link } from 'react-router-dom';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { PageHero } from '@/shared/components/refresh';

export function ChannelNotConfigured({
  channelLabel,
  blurb,
}: {
  channelLabel: string;
  blurb: string;
}) {
  return (
    <div style={{ padding: 'var(--pad-page)' }} data-testid="channel-not-configured">
      <PageHero eyebrow="Comms · WhatsApp" title={channelLabel} body={blurb} />

      <div
        className="card card-pad"
        style={{ maxWidth: 560, display: 'flex', gap: 16, alignItems: 'flex-start' }}
      >
        <span
          style={{
            width: 40, height: 40, borderRadius: 10, flex: 'none',
            background: 'var(--rag-amber-soft)', color: 'var(--rag-amber)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MessageSquare size={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            WhatsApp isn’t connected yet
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--fg-tertiary)', lineHeight: 1.5, margin: 0 }}>
            The {channelLabel} surface is ready, but it needs a Meta Business
            (Cloud API) account, phone-number ID, and access token. A parent-org
            admin enables the provider under Comms → Settings; the channel goes
            live as soon as the webhook + token are saved.
          </p>
          <Link
            to="/comms/settings"
            className="btn btn-primary"
            style={{ marginTop: 14, display: 'inline-flex' }}
          >
            Open Comms settings <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ChannelNotConfigured;
