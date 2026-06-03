/**
 * WATemplatesPage — /comms/templates.
 *
 * WhatsApp message-template manager (predefined + Meta-approved templates,
 * approval status, preview) ported from DawinOS. Requires the Meta provider;
 * gated on `commsConfig/whatsapp.enabled`.
 */

import { Loader2 } from 'lucide-react';
import { useWhatsAppConfig } from '../services/comms-config.service';
import { ChannelNotConfigured } from '../components/ChannelNotConfigured';

export default function WATemplatesPage() {
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
        channelLabel="Message Templates"
        blurb="WhatsApp message templates with Meta approval status, languages, and live previews — used for proactive client messages outside the 24-hour window."
      />
    );
  }

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <div className="card card-pad" style={{ color: 'var(--fg-tertiary)', fontSize: 13 }}>
        WhatsApp is enabled. The template manager activates once the Meta
        template-sync functions are deployed.
      </div>
    </div>
  );
}
