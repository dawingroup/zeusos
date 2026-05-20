import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Eyebrow } from '../components/primitives';
import {
  completePortalSignIn,
  getPendingPortalEmail,
  isPortalMagicLink,
} from '@/modules/customer-hub/services/client-portal/portalAuth';
import '../styles/portal.css';

type Phase = 'completing' | 'needs-email' | 'error' | 'done';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('completing');
  const [email, setEmail] = useState(getPendingPortalEmail() ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPortalMagicLink()) {
        if (cancelled) return;
        setErrorMessage('This link is not a valid sign-in link, or has already been used.');
        setPhase('error');
        return;
      }
      const pending = getPendingPortalEmail();
      if (!pending) {
        if (cancelled) return;
        setPhase('needs-email');
        return;
      }
      try {
        await completePortalSignIn(pending);
        if (cancelled) return;
        setPhase('done');
        navigate('/portal/projects', { replace: true });
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Sign-in failed');
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  async function handleSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPhase('completing');
    try {
      await completePortalSignIn(email.trim());
      setPhase('done');
      navigate('/portal/projects', { replace: true });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign-in failed');
      setPhase('error');
    }
  }

  return (
    <div className="portal-root portal-canvas" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {phase === 'completing' && (
          <>
            <Eyebrow>Signing you in…</Eyebrow>
            <div className="h-d3">One moment.</div>
            <div className="h-p is-dim" style={{ fontSize: 14 }}>
              Verifying your magic link and loading your portal.
            </div>
          </>
        )}
        {phase === 'needs-email' && (
          <>
            <Eyebrow>Confirm your email</Eyebrow>
            <div className="h-d3">Almost there.</div>
            <div className="h-p is-dim" style={{ fontSize: 14 }}>
              You opened the link on a different device than the one you requested it from.
              Re-enter the email you used so we can complete sign-in.
            </div>
            <form onSubmit={handleSubmitEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  height: 48,
                  padding: '0 16px',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  background: 'var(--surface)',
                  font: '400 14px/1 var(--font-sans)',
                  outline: 'none',
                }}
              />
              <Btn primary lg full iconRight="arrow-r" type="submit">Continue</Btn>
            </form>
          </>
        )}
        {phase === 'error' && (
          <>
            <Eyebrow signal>Sign-in problem</Eyebrow>
            <div className="h-d3">We couldn't sign you in.</div>
            <div className="h-p is-dim" style={{ fontSize: 14 }}>
              {errorMessage ?? 'The link may have expired.'}
            </div>
            <Btn primary lg full onClick={() => navigate('/portal/sign-in')}>Request a new link</Btn>
          </>
        )}
      </div>
    </div>
  );
}
