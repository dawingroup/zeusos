/**
 * Smoke tests for the invite-link helper. The link is admin-visible UX
 * (copy / paste into Slack / email) so an accidental re-shape of the URL
 * — a missing `?`, an un-encoded id — would silently break the whole
 * accept flow. The helper is pure, so a straight unit test is enough.
 */
import { describe, expect, it } from 'vitest';
import { buildInviteLink } from '../settingsService';

describe('buildInviteLink', () => {
  it('builds a /accept-invite URL with the invite id as a query param', () => {
    expect(buildInviteLink('abc123', 'https://os.zeustheagency.com')).toBe(
      'https://os.zeustheagency.com/accept-invite?inviteId=abc123'
    );
  });

  it('url-encodes the invite id so a Firestore doc id with spaces or slashes survives round-trip', () => {
    expect(buildInviteLink('one/two three', 'https://os.zeustheagency.com')).toBe(
      'https://os.zeustheagency.com/accept-invite?inviteId=one%2Ftwo%20three'
    );
  });

  it('falls back to window.location.origin when origin is not supplied', () => {
    // jsdom's default origin is http://localhost:3000 but we only assert the
    // suffix so this test keeps passing if the setup changes it.
    const link = buildInviteLink('xyz');
    expect(link.endsWith('/accept-invite?inviteId=xyz')).toBe(true);
  });
});
