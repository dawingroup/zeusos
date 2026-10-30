/**
 * What to tell a person when a call to a Cloud Function fails.
 *
 * A function that REFUSES answers in words ("This IWO is already accepted")
 * and those are shown as they are. But when the request never arrives — the
 * connection dropped, DNS failed, the function timed out — the Firebase SDK
 * reports only the code `internal` with the message "internal", and that is
 * what used to reach the screen: a toast reading "internal".
 */

const NO_ANSWER = new Set(['internal', 'unavailable', 'deadline-exceeded', 'unknown', 'cancelled']);

function codeOf(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code.replace(/^functions\//, '') : '';
}

/** True when the failure is "no answer came back", not a refusal with a reason. */
export function isNoAnswerError(err: unknown): boolean {
  const message = ((err as { message?: unknown } | null)?.message ?? '') as string;
  const code = codeOf(err);
  // A refusal carries its own sentence; a bare code echoed as the message does not.
  const hasOwnWords = typeof message === 'string' && message.trim().length > 0
    && message.trim().toLowerCase() !== code && !/^(internal|unavailable|deadline[- ]exceeded|failed to fetch|load failed|network ?error)/i.test(message.trim());
  if (hasOwnWords) return false;
  return code === '' ? /failed to fetch|load failed|network ?error/i.test(message) : NO_ANSWER.has(code);
}

/**
 * The sentence to show. `what` names the act that did not happen, as a
 * clause: "issue the IWO", "approve the quote".
 *
 * It does NOT promise that nothing changed: a reply can be lost after the
 * server has acted. The callers' acts are safe to try again.
 */
export function describeCallableError(
  err: unknown,
  what: string,
  online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine !== false,
): string {
  if (isNoAnswerError(err)) {
    return online
      ? `Couldn't reach the server to ${what}. Check your connection and try again.`
      : `You're offline, so we couldn't ${what}. Reconnect and try again.`;
  }
  const message = ((err as { message?: unknown } | null)?.message ?? '') as string;
  return typeof message === 'string' && message.trim() ? message.trim() : `Couldn't ${what}. Try again.`;
}
