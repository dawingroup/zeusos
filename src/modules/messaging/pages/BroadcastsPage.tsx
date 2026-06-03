/**
 * BroadcastsPage — /comms/broadcasts.
 *
 * WhatsApp broadcast campaigns (recipient lists, delivery funnel) ported from
 * DawinOS. Requires the Meta provider; gated on `commsConfig/whatsapp.enabled`.
 */

import { Loader2 } from 'lucide-react';
import { useWhatsAppConfig } from '../services/comms-config.service';
import { ChannelNotConfigured } from '../components/ChannelNotConfigured';

export default function BroadcastsPage() {
  const { config, loading } = useWhatsAppConfig();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--fg-tertiary)' }} />
      </div>
    );
  }

  if (!config.enabled) {
    return (
      <ChannelNotConfigured
        channelLabel="Broadcasts"
        blurb="Send an approved template to a recipient list and track the delivery funnel — sent, delivered, read, replied."
      />
    );
  }

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <div className="card card-pad" style={{ color: 'var(--fg-tertiary)', fontSize: 13 }}>
        WhatsApp is enabled. Broadcast scheduling + execution activates once the
        Meta broadcast functions are deployed.
      </div>
    </div>
  );
}
