/**
 * /notification-settings — a person's own notification settings.
 *
 * Only switches the bell honours are shown: which modules to mute. Everything
 * always lands in `notifications` for the person it names; muting a module
 * hides it from the bell and its count, nothing more. Email and push are not
 * channels yet (they arrive with the Google Workspace stream), so there is no
 * switch for them here that would do nothing.
 *
 * Saved through GlobalContext's preferences store
 * (`users/{uid}/settings/preferences.notificationSettings`), each change on
 * its own.
 */
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BellOff, Info } from 'lucide-react';
import { Switch } from '@/core/components/ui/switch';
import { Button } from '@/core/components/ui/button';
import { usePreferences } from '@/integration/store';
import { NOTICE_MODULE_CATALOG } from '@/core/services/inAppNotice';

export default function NotificationSettingsPage() {
  const { preferences, updatePreferences } = usePreferences();
  const navigate = useNavigate();
  const settings = preferences.notificationSettings;
  const muted = new Set(settings.mutedModules ?? []);

  const setMuted = (module: string, mute: boolean) => {
    const next = new Set(muted);
    if (mute) next.add(module); else next.delete(module);
    updatePreferences({ notificationSettings: { ...settings, mutedModules: [...next] } });
  };

  return (
    <>
      <Helmet>
        <title>Notification settings | ZeusOS</title>
      </Helmet>

      <div className="p-6 space-y-6" style={{ maxWidth: 760 }} data-testid="notification-settings">
        <div>
          <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Notification settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything arrives in the bell. These settings decide which of it you see there.
          </p>
        </div>

        <section className="rounded-lg border bg-[var(--bg-surface)]" style={{ borderColor: 'var(--border-default)' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-default)' }}>
            <BellOff className="h-4 w-4 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Muted in the bell</h2>
              <p className="text-xs text-muted-foreground">A muted module's notices are still written and still open from their own pages.</p>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {NOTICE_MODULE_CATALOG.map((m) => (
              <div key={m.module} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
                <Switch checked={!muted.has(m.module)} onCheckedChange={(on) => setMuted(m.module, !on)} aria-label={`Show ${m.label} in the bell`} />
              </div>
            ))}
          </div>
        </section>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Email and push are not notification channels yet; when they are, their switches appear here.
        </p>
      </div>
    </>
  );
}
