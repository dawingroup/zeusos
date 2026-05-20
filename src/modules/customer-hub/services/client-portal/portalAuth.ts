/**
 * Authentication helpers for the Client Portal.
 *
 * Two flows supported:
 *
 *   1. **Magic-link email** — `sendPortalMagicLink(email)` emails a link
 *      that lands at `/portal/auth/callback`; `completePortalSignIn()`
 *      exchanges it for a Firebase Auth session.
 *
 *   2. **Phone (SMS OTP)** — `sendPortalPhoneCode(phone, recaptcha)` sends
 *      an SMS code via Firebase; `confirmPortalPhoneCode(result, code)`
 *      verifies the code and returns the signed-in user. The reCAPTCHA
 *      verifier is created lazily by the sign-in page (Firebase requires
 *      it for web phone auth; it's invisible by default).
 *
 * Email persistence:
 *   We stash the email in localStorage so the callback can complete the
 *   sign-in without re-asking for it. If the user clicks the link from a
 *   different device, the callback prompts for the email instead.
 */

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut as fbSignOut,
  type ConfirmationResult,
} from 'firebase/auth';
import { auth } from '@/firebase/config';

const EMAIL_KEY = 'dawinos-portal-email';

export async function sendPortalMagicLink(email: string): Promise<void> {
  const url = `${window.location.origin}/portal/auth/callback`;
  await sendSignInLinkToEmail(auth, email, {
    url,
    handleCodeInApp: true,
  });
  window.localStorage.setItem(EMAIL_KEY, email);
}

export function isPortalMagicLink(href: string = window.location.href): boolean {
  return isSignInWithEmailLink(auth, href);
}

export function getPendingPortalEmail(): string | null {
  return window.localStorage.getItem(EMAIL_KEY);
}

export async function completePortalSignIn(email: string, href: string = window.location.href) {
  const result = await signInWithEmailLink(auth, email, href);
  window.localStorage.removeItem(EMAIL_KEY);
  return result.user;
}

export async function portalSignOut() {
  await fbSignOut(auth);
}

// ── Phone (SMS OTP) ────────────────────────────────────────

/**
 * Create the invisible reCAPTCHA verifier Firebase requires for web
 * phone auth. The verifier element must be a real DOM node — the
 * sign-in page renders a hidden div and passes its id here.
 *
 * Returns the verifier. The caller is responsible for `verifier.clear()`
 * on cleanup so the page can re-mount cleanly.
 */
export function makePortalRecaptcha(containerId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    // Firebase will trigger callbacks when the user solves it; for
    // invisible it's effectively a no-op success path.
    callback: () => undefined,
  });
}

/**
 * Send an SMS verification code to the given E.164 phone number.
 * Returns a `ConfirmationResult` the caller must keep around until the
 * user types the code, then call `confirmPortalPhoneCode` with it.
 */
export async function sendPortalPhoneCode(
  phoneE164: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  if (!/^\+[1-9]\d{6,14}$/.test(phoneE164)) {
    throw new Error('Phone number must be in international format, e.g. +9715xxxxxxxx');
  }
  return signInWithPhoneNumber(auth, phoneE164, verifier);
}

/**
 * Verify the SMS code the user entered. On success Firebase signs the
 * user in and emits an auth state change — the sign-in page redirects
 * to `/portal/projects` on the next render.
 */
export async function confirmPortalPhoneCode(
  result: ConfirmationResult,
  code: string,
) {
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Verification code must be 6 digits.');
  }
  const credential = await result.confirm(code);
  return credential.user;
}
