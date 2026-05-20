/**
 * NotificationBell — topbar bell with a dropdown showing the
 * signed-in user's open items across all their projects. List is
 * derived from existing data (no separate notifications collection
 * yet) via `usePortalNotifications`.
 *
 * Red-dot indicator reflects the count of urgent items (invoice
 * due, expiring signoffs, pending client signatures).
 */

import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useClickOutside } from '../hooks/useClickOutside';
import { usePortalNotifications, type PortalNotification } from '../hooks/usePortalNotifications';

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, loading } = usePortalNotifications();
  const { open, setOpen, ref } = useClickOutside<HTMLDivElement>();

  const total = notifications.length;
  const urgentCount = notifications.filter((n) => n.urgent).length;
  const dotVisible = urgentCount > 0;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={'h-iconbtn' + (dotVisible ? ' has-dot' : '')}
        aria-label={total > 0 ? `${total} notifications, ${urgentCount} urgent` : 'No notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bell" size={16} />
      </button>

      {open ? (
        <div className="h-pop" role="menu" style={{ width: 360, maxWidth: 'calc(100vw - 32px)' }}>
          <div className="h-pop-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>Notifications</span>
            <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--fg-tertiary)', textTransform: 'none', letterSpacing: 0 }}>
              {loading ? 'Loading…' : `${total} item${total === 1 ? '' : 's'}`}
            </span>
          </div>

          {total === 0 && !loading ? (
            <div style={{
              padding: '24px 14px 18px',
              textAlign: 'center',
              color: 'var(--fg-tertiary)',
              font: '400 12.5px/1.5 var(--font-sans)',
            }}>
              <Icon name="check" size={20} color="var(--rag-green)" />
              <div style={{ marginTop: 8 }}>You're all caught up.</div>
              <div style={{ fontSize: 11.5, marginTop: 4 }}>
                Nothing waiting for your signature or payment.
              </div>
            </div>
          ) : null}

          {notifications.slice(0, 8).map((n) => (
            <NotificationItem
              key={n.id}
              n={n}
              onClick={() => { setOpen(false); navigate(n.href); }}
            />
          ))}

          {total > 8 ? (
            <>
              <div className="h-pop-sep" />
              <div style={{
                padding: '8px 12px',
                font: '400 11.5px/1.4 var(--font-sans)',
                color: 'var(--fg-tertiary)',
                textAlign: 'center',
              }}>
                + {total - 8} more across your projects
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NotificationItem({ n, onClick }: { n: PortalNotification; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="h-pop-i" onClick={onClick} style={{ alignItems: 'flex-start' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 14,
        background: n.urgent ? 'var(--rag-amber-soft)' : 'var(--bg-sunken)',
        color: n.urgent ? 'var(--rag-amber)' : 'var(--fg-secondary)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flex: '0 0 28px',
      }}>
        <Icon name={iconForKind(n.kind)} size={14} stroke={1.6} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-pop-i-l" style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{n.title}</div>
        <div className="h-pop-i-s">{n.sub}</div>
      </div>
      {n.dateLabel ? (
        <div className="h-pop-i-meta" style={{ alignSelf: 'flex-start', marginTop: 2 }}>
          {n.dateLabel}
        </div>
      ) : null}
    </button>
  );
}

function iconForKind(kind: PortalNotification['kind']) {
  switch (kind) {
    case 'invoice':  return 'money' as const;
    case 'approval': return 'doc' as const;
    case 'signoff':  return 'plans' as const;
  }
}
