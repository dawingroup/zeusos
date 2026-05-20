/**
 * ChangeOrderDeliveryStatusCard — per-channel outbound delivery
 * history for a CO. Reads from `co.deliveryTracking`; renders nothing
 * if the CO hasn't been sent to the client yet.
 *
 * WhatsApp state has the most resolution (sent/delivered/read/clicked)
 * because Meta webhooks populate those timestamps. Portal + email
 * show a simpler "shared at" line.
 */

import { Phone, Mail, Globe, CheckCheck, Clock, AlertTriangle } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import type { ChangeOrderDeliveryTracking } from '../types';

interface Props {
  tracking?: ChangeOrderDeliveryTracking;
}

function formatTs(ts: Timestamp | undefined): string | null {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts as unknown as string);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChangeOrderDeliveryStatusCard({ tracking }: Props) {
  const hasAny =
    tracking &&
    (tracking.whatsapp?.sentAt ||
      tracking.email?.sentAt ||
      tracking.portal?.lastSharedAt ||
      tracking.whatsapp?.lastError);

  if (!hasAny) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-4 py-2 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Delivery status
        </h3>
      </div>
      <ul className="divide-y divide-gray-100 text-[12px]">
        {tracking?.whatsapp && (
          <li className="px-4 py-2.5">
            <ChannelRow
              icon={<Phone className="h-3.5 w-3.5 text-emerald-600" />}
              label="WhatsApp"
              subtitle={tracking.whatsapp.phoneNumber}
              events={[
                { label: 'Sent', ts: tracking.whatsapp.sentAt },
                { label: 'Delivered', ts: tracking.whatsapp.deliveredAt },
                { label: 'Read', ts: tracking.whatsapp.readAt, icon: <CheckCheck className="h-3 w-3 text-blue-600" /> },
                { label: 'Clicked', ts: tracking.whatsapp.clickedAt, icon: <Globe className="h-3 w-3 text-violet-600" /> },
              ]}
              error={tracking.whatsapp.lastError}
            />
          </li>
        )}
        {tracking?.email && (
          <li className="px-4 py-2.5">
            <ChannelRow
              icon={<Mail className="h-3.5 w-3.5 text-blue-600" />}
              label="Email"
              subtitle={tracking.email.toAddress}
              events={[
                { label: 'Sent', ts: tracking.email.sentAt },
                { label: 'Opened', ts: tracking.email.openedAt },
                { label: 'Clicked', ts: tracking.email.clickedAt, icon: <Globe className="h-3 w-3 text-violet-600" /> },
              ]}
              error={tracking.email.lastError}
            />
          </li>
        )}
        {tracking?.portal && (
          <li className="px-4 py-2.5">
            <ChannelRow
              icon={<Globe className="h-3.5 w-3.5 text-violet-600" />}
              label="Portal link"
              subtitle={tracking.portal.lastShareUrl}
              events={[{ label: 'Shared', ts: tracking.portal.lastSharedAt }]}
            />
          </li>
        )}
      </ul>
    </div>
  );
}

function ChannelRow({
  icon,
  label,
  subtitle,
  events,
  error,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  events: Array<{ label: string; ts: Timestamp | undefined; icon?: React.ReactNode }>;
  error?: string;
}) {
  const firedEvents = events.filter((e) => e.ts);

  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-gray-800">{label}</span>
        {subtitle && (
          <span className="text-[11px] text-gray-500 font-mono truncate max-w-[180px]">
            {subtitle}
          </span>
        )}
      </div>
      {firedEvents.length > 0 ? (
        <div className="mt-1 ml-5 space-y-0.5">
          {firedEvents.map((e) => (
            <div key={e.label} className="flex items-center gap-1.5 text-[11px] text-gray-600">
              {e.icon ?? <Clock className="h-3 w-3 text-gray-400" />}
              <span className="text-gray-500 w-14">{e.label}:</span>
              <span className="text-gray-800">{formatTs(e.ts)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="ml-5 mt-0.5 text-[11px] text-gray-400">Awaiting delivery events…</p>
      )}
      {error && (
        <div className="mt-1.5 ml-5 flex items-start gap-1.5 text-[11px] text-rose-700">
          <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
