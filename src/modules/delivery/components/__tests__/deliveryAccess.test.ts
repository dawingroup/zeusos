import { describe, it, expect } from 'vitest';
import {
  isParentOrgUser,
  isSubsidiaryUser,
  resolveHomeSubsidiaryId,
} from '../deliveryAccess';
import type { DawinUser } from '@/core/settings/types';

function makeUser(overrides: Partial<DawinUser>): DawinUser {
  return {
    id: 'u1',
    uid: 'uid-1',
    email: 'someone@example.com',
    displayName: 'Test User',
    globalRole: 'member',
    isActive: true,
    subsidiaryAccess: [],
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('isParentOrgUser', () => {
  it('flags admins with zeus-group access as parent-org', () => {
    const u = makeUser({
      globalRole: 'admin',
      subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: true, modules: [] }],
    });
    expect(isParentOrgUser(u)).toBe(true);
  });

  it('flags owners with zeus-group access as parent-org', () => {
    const u = makeUser({
      globalRole: 'owner',
      subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: true, modules: [] }],
    });
    expect(isParentOrgUser(u)).toBe(true);
  });

  it('does not flag members of zeus-group as parent-org', () => {
    const u = makeUser({
      globalRole: 'member',
      subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: true, modules: [] }],
    });
    expect(isParentOrgUser(u)).toBe(false);
  });

  it('does not flag admins without zeus-group access', () => {
    const u = makeUser({
      globalRole: 'admin',
      subsidiaryAccess: [{ subsidiaryId: 'labyrinth', hasAccess: true, modules: [] }],
    });
    expect(isParentOrgUser(u)).toBe(false);
  });

  it('ignores access entries flagged hasAccess: false', () => {
    const u = makeUser({
      globalRole: 'admin',
      subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: false, modules: [] }],
    });
    expect(isParentOrgUser(u)).toBe(false);
  });
});

describe('isSubsidiaryUser', () => {
  it('passes users with at least one non-parent subsidiary access', () => {
    const u = makeUser({
      subsidiaryAccess: [
        { subsidiaryId: 'labyrinth', hasAccess: true, modules: [] },
      ],
    });
    expect(isSubsidiaryUser(u)).toBe(true);
  });

  it('passes hybrid users with both parent + subsidiary access', () => {
    // Real-world: a senior creative on zeus-group leadership AND
    // labyrinth delivery. They should still see the delivery workspace.
    const u = makeUser({
      subsidiaryAccess: [
        { subsidiaryId: 'zeus-group', hasAccess: true, modules: [] },
        { subsidiaryId: 'labyrinth', hasAccess: true, modules: [] },
      ],
    });
    expect(isSubsidiaryUser(u)).toBe(true);
  });

  it('rejects parent-only users', () => {
    const u = makeUser({
      subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: true, modules: [] }],
    });
    expect(isSubsidiaryUser(u)).toBe(false);
  });

  it('rejects users with no access entries', () => {
    expect(isSubsidiaryUser(makeUser({ subsidiaryAccess: [] }))).toBe(false);
  });
});

describe('resolveHomeSubsidiaryId', () => {
  it('returns the first non-parent subsidiary the user has access to', () => {
    const u = makeUser({
      subsidiaryAccess: [
        { subsidiaryId: 'zeus-group', hasAccess: true, modules: [] },
        { subsidiaryId: 'zeus-the-agency', hasAccess: true, modules: [] },
        { subsidiaryId: 'labyrinth', hasAccess: true, modules: [] },
      ],
    });
    expect(resolveHomeSubsidiaryId(u)).toBe('zeus-the-agency');
  });

  it('returns null for parent-only users', () => {
    const u = makeUser({
      subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: true, modules: [] }],
    });
    expect(resolveHomeSubsidiaryId(u)).toBeNull();
  });

  it('returns null when no access entries are flagged true', () => {
    const u = makeUser({
      subsidiaryAccess: [
        { subsidiaryId: 'labyrinth', hasAccess: false, modules: [] },
      ],
    });
    expect(resolveHomeSubsidiaryId(u)).toBeNull();
  });
});
