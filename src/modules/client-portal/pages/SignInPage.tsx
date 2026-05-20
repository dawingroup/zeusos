import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Btn, Eyebrow, Img } from '../components/primitives';
import { Icon } from '../components/Icon';
import {
  sendPortalMagicLink,
  sendPortalPhoneCode,
  confirmPortalPhoneCode,
  makePortalRecaptcha,
} from '@/modules/customer-hub/services/client-portal/portalAuth';
import '../styles/portal.css';

type Method = 'email' | 'phone';
type EmailState = 'idle' | 'sending' | 'sent' | 'error';
type PhoneState = 'idle' | 'sending' | 'awaiting-code' | 'verifying' | 'error';

const RECAPTCHA_CONTAINER_ID = 'portal-recaptcha-container';

export default function SignInPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [method, setMethod] = useState<Method>('email');

  // Already signed in — let staff users see the picker directly.
  if (user) {
    return (
      <div className="portal-root portal-canvas" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
          <Eyebrow>Already signed in</Eyebrow>
          <div className="h-d3">Welcome back, {user.displayName || user.email || user.phoneNumber}.</div>
          <Btn primary lg full iconRight="arrow-r" onClick={() => navigate('/portal/projects')}>
            Continue to your projects
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-root portal-canvas" style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch' }}>
      <div className="h-signin-grid" style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '7fr 5fr',
        minHeight: '100vh',
      }}>
        <BrandPanel />

        <div className="h-signin-form" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 64px',
          background: 'var(--bg-app)',
        }}>
          <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <Eyebrow>Sign in to your portal</Eyebrow>
              <div className="h-d3" style={{ marginTop: 10 }}>Welcome back.</div>
              <div className="h-p is-dim" style={{ marginTop: 8, fontSize: 14 }}>
                Sign in with your work email or your phone number — your project director
                shared which is on file for you.
              </div>
            </div>

            <MethodSwitch method={method} onChange={setMethod} />

            {method === 'email' ? <EmailForm /> : <PhoneForm />}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
              <span style={{
                font: '500 10.5px/1 var(--font-mono)',
                color: 'var(--fg-tertiary)',
                letterSpacing: '0.12em',
              }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
            </div>

            <Btn lg full type="button" onClick={() => navigate('/auth/login')}>
              Staff sign-in ↗
            </Btn>

            <div className="h-p is-quiet" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
              By continuing you agree to the <u>Engagement Letter</u> on file.
              Trouble signing in? Contact your project director.
            </div>

            {/* Invisible reCAPTCHA target — Firebase mounts the widget here.
                Always rendered (even when the user is on the email tab) so
                Firebase can attach without remount races. */}
            <div id={RECAPTCHA_CONTAINER_ID} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Method switch ───────────────────────────────────────────

function MethodSwitch({ method, onChange }: { method: Method; onChange: (m: Method) => void }) {
  return (
    <div className="h-segment" role="tablist" aria-label="Sign-in method">
      <button
        type="button"
        role="tab"
        aria-selected={method === 'email'}
        onClick={() => onChange('email')}
        className={'h-segment-i' + (method === 'email' ? ' is-on' : '')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Icon name="mail" size={12} /> Email
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={method === 'phone'}
        onClick={() => onChange('phone')}
        className={'h-segment-i' + (method === 'phone' ? ' is-on' : '')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Icon name="chat" size={12} /> Phone
      </button>
    </div>
  );
}

// ── Email form ──────────────────────────────────────────────

function EmailForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<EmailState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || state === 'sending') return;
    setState('sending');
    setError(null);
    try {
      await sendPortalMagicLink(email.trim());
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send link');
      setState('error');
    }
  }

  if (state === 'sent') {
    return <SentConfirmation email={email} onReset={() => setState('idle')} />;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Eyebrow style={{ marginBottom: 8 }}>Work email</Eyebrow>
        <InputBox icon="mail">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={state === 'sending'}
            style={inputStyle}
          />
        </InputBox>
      </div>

      {error ? <ErrorLine>{error}</ErrorLine> : null}

      <Btn primary lg full iconRight="arrow-r" type="submit" disabled={!email || state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send magic link'}
      </Btn>
    </form>
  );
}

function SentConfirmation({ email, onReset }: { email: string; onReset: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Eyebrow>Check your inbox</Eyebrow>
      <div className="h-d3">Magic link sent.</div>
      <div className="h-p is-dim" style={{ fontSize: 14 }}>
        We sent a sign-in link to <strong style={{ color: 'var(--fg-primary)' }}>{email}</strong>.
        Click it on this device to enter your portal. It expires in 1 hour.
      </div>
      <div style={{
        padding: '14px 18px',
        background: 'var(--bg-sunken)',
        borderRadius: 10,
        font: '400 12.5px/1.55 var(--font-mono)',
        color: 'var(--fg-secondary)',
      }}>
        Didn't get it? Check spam, or wait a minute and try again. The link
        works on this device only.
      </div>
      <Btn full onClick={onReset}>Use a different email</Btn>
    </div>
  );
}

// ── Phone form ──────────────────────────────────────────────

function PhoneForm() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [state, setState] = useState<PhoneState>('idle');
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  // Tear down the reCAPTCHA verifier when this form is unmounted so
  // re-mounting the page doesn't leave dangling widgets.
  useEffect(() => {
    return () => {
      verifierRef.current?.clear();
      verifierRef.current = null;
    };
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || state === 'sending') return;
    setState('sending');
    setError(null);
    try {
      if (!verifierRef.current) {
        verifierRef.current = makePortalRecaptcha(RECAPTCHA_CONTAINER_ID);
      }
      const result = await sendPortalPhoneCode(phone.trim(), verifierRef.current);
      confirmRef.current = result;
      setState('awaiting-code');
    } catch (err) {
      // Reset the verifier on failure so the next attempt creates a
      // fresh one (Firebase invalidates the existing widget on auth/captcha errors).
      try { verifierRef.current?.clear(); } catch { /* ignore */ }
      verifierRef.current = null;
      const e = err as { code?: string; message?: string };
      setError(translatePhoneError(e.code, e.message));
      setState('error');
    }
  }

  async function handleConfirmCode(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmRef.current || !code) return;
    setState('verifying');
    setError(null);
    try {
      await confirmPortalPhoneCode(confirmRef.current, code.trim());
      // useAuth state change navigates the picker automatically once
      // user is non-null on the next render.
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(translatePhoneError(e.code, e.message));
      setState('error');
    }
  }

  function resetToPhone() {
    confirmRef.current = null;
    setCode('');
    setError(null);
    setState('idle');
  }

  if (state === 'awaiting-code' || state === 'verifying' || (state === 'error' && confirmRef.current)) {
    return (
      <form onSubmit={handleConfirmCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Verification code</Eyebrow>
          <InputBox icon="chat">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={state === 'verifying'}
              autoFocus
              style={{ ...inputStyle, letterSpacing: '0.3em' }}
            />
          </InputBox>
          <div className="h-p is-dim" style={{ fontSize: 12.5, marginTop: 8 }}>
            We sent a 6-digit code to <strong style={{ color: 'var(--fg-primary)' }}>{phone}</strong>.
            Standard SMS rates apply.
          </div>
        </div>

        {error ? <ErrorLine>{error}</ErrorLine> : null}

        <Btn primary lg full iconRight="check" type="submit" disabled={code.length < 6 || state === 'verifying'}>
          {state === 'verifying' ? 'Verifying…' : 'Verify & sign in'}
        </Btn>
        <Btn full type="button" onClick={resetToPhone}>Use a different number</Btn>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Eyebrow style={{ marginBottom: 8 }}>Phone number</Eyebrow>
        <InputBox icon="chat">
          <input
            type="tel"
            required
            autoComplete="tel"
            placeholder="+971 5x xxx xxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={state === 'sending'}
            style={inputStyle}
          />
        </InputBox>
        <div className="h-p is-dim" style={{ fontSize: 12, marginTop: 6 }}>
          Include the country code, e.g. <code style={monoInline}>+971</code> for UAE,{' '}
          <code style={monoInline}>+966</code> for KSA, <code style={monoInline}>+256</code> for Uganda.
        </div>
      </div>

      {error ? <ErrorLine>{error}</ErrorLine> : null}

      <Btn primary lg full iconRight="arrow-r" type="submit" disabled={!phone || state === 'sending'}>
        {state === 'sending' ? 'Sending code…' : 'Send code by SMS'}
      </Btn>
    </form>
  );
}

function translatePhoneError(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number isn\'t valid. Include the country code (e.g. +9715xxxxxxxx).';
    case 'auth/missing-phone-number':
      return 'Please enter a phone number.';
    case 'auth/invalid-verification-code':
      return 'That code doesn\'t match. Double-check the SMS and try again.';
    case 'auth/code-expired':
      return 'The code has expired. Request a new one.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes before trying again.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded for today. Try email sign-in or contact your project director.';
    case 'auth/captcha-check-failed':
      return 'Anti-bot check failed. Refresh the page and try again.';
    default:
      return fallback || 'Could not complete sign-in. Please try again.';
  }
}

// ── Shared ──────────────────────────────────────────────────

function InputBox({ icon, children }: { icon: 'mail' | 'chat'; children: React.ReactNode }) {
  return (
    <div style={{
      height: 48, padding: '0 16px',
      border: '1px solid var(--border-default)', borderRadius: 10,
      background: 'var(--bg-surface)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Icon name={icon} size={16} color="var(--fg-tertiary)" />
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 0,
  outline: 'none',
  background: 'transparent',
  font: '400 14px/1 var(--font-sans)',
  color: 'var(--fg-primary)',
};

const monoInline: React.CSSProperties = {
  font: '500 11px/1 var(--font-mono)',
  background: 'var(--bg-sunken)',
  padding: '1px 5px',
  borderRadius: 3,
};

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      font: '400 12.5px/1.4 var(--font-sans)',
      color: 'var(--rag-red)',
      background: 'var(--rag-red-soft)',
      padding: '8px 12px',
      borderRadius: 8,
    }}>{children}</div>
  );
}

// ── Brand panel (left side) ─────────────────────────────────

function BrandPanel() {
  return (
    <div className="h-signin-brand" style={{
      position: 'relative',
      background: '#1f1d18',
      color: '#fff',
      padding: '64px 72px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflow: 'hidden',
    }}>
      <Img tone="interior-warm" hero style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(20,18,14,0.5) 0%, rgba(20,18,14,0.7) 100%)',
      }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: '600 17px/1 var(--font-display)', letterSpacing: '-0.02em',
        }}>D</div>
        <div>
          <div style={{ font: '600 16px/1.1 var(--font-sans)', letterSpacing: '-0.015em' }}>
            Dawin<span style={{ opacity: 0.65 }}>OS</span>
          </div>
          <div style={{
            font: '500 9.5px/1 var(--font-mono)',
            color: 'rgba(255,255,255,0.65)',
            marginTop: 4,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>Client Portal</div>
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 520 }}>
        <div className="h-eyebrow" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.18em' }}>
          Issue · 14 · May 2026
        </div>
        <div style={{
          font: '600 52px/1.02 var(--font-display)',
          letterSpacing: '-0.035em',
          color: '#fff',
        }}>
          Every approval,<br />
          drawing &amp; payment<br />
          <span style={{ color: 'rgba(255,255,255,0.62)', fontStyle: 'italic' }}>— in one place.</span>
        </div>
        <div style={{
          font: '400 14px/1.55 var(--font-sans)',
          color: 'rgba(255,255,255,0.75)',
          maxWidth: 460,
        }}>
          The DawinOS Client Portal gives you a live view of your Finishes and Advisory projects.
          Sign off on the right things, at the right time.
        </div>
      </div>

      <div style={{
        position: 'relative',
        display: 'flex',
        gap: 32,
        font: '500 10.5px/1 var(--font-mono)',
        color: 'rgba(255,255,255,0.55)',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}>
        <span>Finishes fit-out</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>Advisory rollouts</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>Matflow procurement</span>
      </div>
    </div>
  );
}
