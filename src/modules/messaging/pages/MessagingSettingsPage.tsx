/**
 * MessagingSettingsPage — Phase 4.5.
 *
 * Parent-org admin surface for the comms channel config (commsConfig/*):
 * the WhatsApp + email kill-switches, provider, and per-brand sending
 * addresses. The webhook + send path read these docs; firestore.rules gate
 * writes to parent-org principals.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Loader2, MessageSquare, Mail, Bell } from 'lucide-react';
import { Banner, EmptyStateV2 } from '@/shared/components/data-display';
import { useCurrentDawinUser } from '@/core/settings';
import { isParentOrgUser } from '@/modules/delivery/components/deliveryAccess';
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
  getEmailConfig,
  saveEmailConfig,
  type WhatsAppConfig,
  type EmailConfig,
} from '../services/comms-config.service';

const VAPID_CONFIGURED = Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 text-[13px]"
    >
      <span
        className="inline-flex h-5 w-9 items-center rounded-full transition-colors"
        style={{ backgroundColor: on ? 'var(--accent)' : 'var(--border-default)' }}
      >
        <span className="h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }} />
      </span>
      {label}
    </button>
  );
}

export function MessagingSettingsPage() {
  const { dawinUser } = useCurrentDawinUser();
  const isAdmin = useMemo(() => !!dawinUser && isParentOrgUser(dawinUser), [dawinUser]);

  const [wa, setWa] = useState<WhatsAppConfig | null>(null);
  const [email, setEmail] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [w, e] = await Promise.all([getWhatsAppConfig(), getEmailConfig()]);
        setWa(w);
        setEmail(e);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load config');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!isAdmin) {
    return (
      <div className="px-4 py-6 sm:px-6 max-w-[900px] mx-auto">
        <Banner tone="info" title="Parent-org admins only" message="Comms channel configuration is restricted to parent-org administrators." />
      </div>
    );
  }

  const onSaveWa = async () => {
    if (!wa) return;
    setSaving('wa'); setError(null);
    // Only the sender-roles are hand-edited here. `enabled` + the phone/business
    // IDs are auto-wired from the credential write (Settings → API Keys) — never
    // overwrite them from this form.
    try { await saveWhatsAppConfig({ allowedSenderRoles: wa.allowedSenderRoles }); setSavedAt(new Date().toLocaleTimeString()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(null); }
  };
  const onSaveEmail = async () => {
    if (!email) return;
    setSaving('email'); setError(null);
    try { await saveEmailConfig(email); setSavedAt(new Date().toLocaleTimeString()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(null); }
  };

  return (
    <>
      <Helmet><title>Comms Settings | ZeusOS</title></Helmet>
      <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[900px] mx-auto">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Comms · Settings</div>
          <h1 className="display">Channel configuration</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Kill-switches + provider config for the WhatsApp and email channels
          </p>
        </div>

        {error && <Banner tone="danger" title="Error" message={error} />}
        {savedAt && <p className="text-[12px]" style={{ color: 'var(--rag-green)' }}>Saved at {savedAt}</p>}

        {loading || !wa || !email ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--accent)' }} /></div>
        ) : (
          <>
            {/* WhatsApp — status is auto-wired from Settings → API Keys. The
                channel flips live automatically once the access token +
                phone-number ID + business-account ID are all saved there; this
                card reflects that derived state (no manual enable toggle). */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-[14.5px]"><MessageSquare className="h-4 w-4" /> WhatsApp (Meta)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      background: wa.enabled ? 'var(--rag-green-soft)' : 'var(--rag-amber-soft)',
                      color: wa.enabled ? 'var(--rag-green)' : 'var(--rag-amber)',
                    }}
                    data-testid="wa-status-pill"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
                    {wa.enabled ? 'Connected — live' : 'Not connected'}
                  </span>
                  <span className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
                    Auto-wired from API Keys
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <Label className="text-[10.5px]">Phone Number ID</Label>
                    <div className="font-mono" style={{ color: wa.phoneNumberId ? 'var(--fg-primary)' : 'var(--fg-quaternary)' }}>
                      {wa.phoneNumberId || 'not set'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10.5px]">Business Account ID</Label>
                    <div className="font-mono" style={{ color: wa.businessAccountId ? 'var(--fg-primary)' : 'var(--fg-quaternary)' }}>
                      {wa.businessAccountId || 'not set'}
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Allowed sender roles (comma-separated)</Label>
                  <Input
                    value={wa.allowedSenderRoles.join(', ')}
                    onChange={(e) => setWa({ ...wa, allowedSenderRoles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  />
                </div>

                <p className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
                  The channel goes live automatically once the WhatsApp access token,
                  phone-number ID, and business-account ID are saved in{' '}
                  <Link to="/admin/api-keys" className="underline" style={{ color: 'var(--rag-blue)' }}>Settings → API Keys</Link>.
                  This card only edits the allowed sender roles.
                </p>
                <div className="flex justify-end">
                  <Button size="sm" onClick={onSaveWa} disabled={saving === 'wa'}>{saving === 'wa' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save sender roles</Button>
                </div>
              </CardContent>
            </Card>

            {/* Email */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-[14.5px]"><Mail className="h-4 w-4" /> Email</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Toggle on={email.enabled} onChange={(v) => setEmail({ ...email, enabled: v })} label={email.enabled ? 'Enabled' : 'Disabled (ships dark)'} />
                <div>
                  <Label>Provider</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
                    style={{ borderColor: 'var(--border-default)' }}
                    value={email.provider}
                    onChange={(e) => setEmail({ ...email, provider: e.target.value as EmailConfig['provider'] })}
                  >
                    <option value="">Not configured</option>
                    <option value="resend">Resend</option>
                    <option value="sendgrid">SendGrid</option>
                  </select>
                </div>
                <p className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
                  Email send is a Phase 4.3 follow-up — needs a provider API key (Settings → API Keys) and per-brand DKIM/SPF DNS. Per-brand from-addresses configure here once that lands.
                </p>
                <div className="flex justify-end">
                  <Button size="sm" onClick={onSaveEmail} disabled={saving === 'email'}>{saving === 'email' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Email</Button>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-[14.5px]"><Bell className="h-4 w-4" /> Push notifications</CardTitle></CardHeader>
              <CardContent>
                {VAPID_CONFIGURED ? (
                  <Banner tone="success" title="Web push configured" message="The VAPID public key is set — staff devices can register for new-message alerts." />
                ) : (
                  <EmptyStateV2 title="Web push not configured" message="Set VITE_VAPID_PUBLIC_KEY (and the VAPID secrets on the function) to enable browser alerts. The notification spine is wired and waiting." />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

export default MessagingSettingsPage;
