/**
 * UserMenu — avatar pill in the portal topbar that opens a dropdown
 * with the signed-in user's identity + Sign out. Density / accent
 * controls can be added in a later round; for now the dropdown's
 * primary job is making Sign out discoverable.
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Icon } from './Icon';
import { useClickOutside } from '../hooks/useClickOutside';
import { portalSignOut } from '@/modules/customer-hub/services/client-portal/portalAuth';

export function UserMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open, setOpen, ref } = useClickOutside<HTMLDivElement>();

  const display = user?.displayName
    || user?.email
    || user?.phoneNumber
    || 'Guest';
  const sub = user?.email && user?.displayName
    ? user.email
    : (user?.phoneNumber && user?.displayName ? user.phoneNumber : null);

  async function handleSignOut() {
    setOpen(false);
    try {
      await portalSignOut();
      navigate('/portal/sign-in', { replace: true });
    } catch {
      // Still navigate — Firebase will retry the signOut next time.
      navigate('/portal/sign-in', { replace: true });
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="h-top-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: 'pointer' }}
      >
        <div>
          <div className="h-top-avatar-l">{display.split('@')[0]}</div>
          <div className="h-top-avatar-s">
            {user?.email?.includes('@zeusgroup.co.ug') ? 'Dawin staff' : 'Client'}
          </div>
        </div>
        <div className="h-top-avatar-img" />
      </button>

      {open ? (
        <div className="h-pop" role="menu">
          <div style={{ padding: '8px 10px 6px' }}>
            <div className="h-pop-i-l">{user?.displayName || display.split('@')[0]}</div>
            {sub ? <div className="h-pop-i-s">{sub}</div> : null}
            {!sub && user?.phoneNumber ? <div className="h-pop-i-s">{user.phoneNumber}</div> : null}
            {!sub && user?.email ? <div className="h-pop-i-s">{user.email}</div> : null}
          </div>

          <div className="h-pop-sep" />

          <button
            type="button"
            role="menuitem"
            className="h-pop-i"
            onClick={() => { setOpen(false); navigate('/portal/projects'); }}
          >
            <Icon name="home" size={14} color="var(--fg-tertiary)" />
            <span>Switch project</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="h-pop-i"
            onClick={() => { setOpen(false); }}
            title="Coming soon"
            disabled
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            <Icon name="paperclip" size={14} color="var(--fg-tertiary)" />
            <span>Profile & preferences</span>
            <span className="h-pop-i-meta">soon</span>
          </button>

          <div className="h-pop-sep" />

          <button
            type="button"
            role="menuitem"
            className="h-pop-i is-danger"
            onClick={handleSignOut}
          >
            <Icon name="arrow-r" size={14} />
            <span>Sign out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
