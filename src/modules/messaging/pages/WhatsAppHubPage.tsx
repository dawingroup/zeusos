/**
 * WhatsAppHubPage — /comms/whatsapp.
 *
 * The WhatsApp conversation hub (thread list + live conversation + customer/
 * 24h-window panel) ported from DawinOS. The full 3-pane UI activates once the
 * Meta Business Cloud API provider is enabled in `commsConfig/whatsapp`; until
 * then it shows the not-configured state so the tab stays navigable.
 */

import { Loader2 } from 'lucide-react';
import { useWhatsAppConfig } from '../services/comms-config.service';
import { ChannelNotConfigured } from '../components/ChannelNotConfigured';

export default function WhatsAppHubPage() {
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
        channelLabel="WhatsApp Hub"
        blurb="Two-way WhatsApp conversations with clients — thread list, live chat, the 24-hour reply window, and AI-drafted replies."
      />
    );
  }

  // Provider enabled — the live 3-pane hub ports in once the Meta send/receive
  // Cloud Functions + whatsappConversations subscription land (follow-up).
  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <div className="card card-pad" style={{ color: 'var(--fg-tertiary)', fontSize: 13 }}>
        WhatsApp is enabled. The live conversation hub activates once the Meta
        send/receive functions are deployed.
      </div>
    </div>
  );
}
