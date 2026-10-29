import { describe, expect, it } from 'vitest';

import type { DawinUser } from '@/core/settings/types';
import { resolveApprovalsScope } from '../scope';

function user(overrides: Partial<DawinUser>): DawinUser {
  return {
    id: 'u1',
    uid: 'u1',
    email: 'someone@zeusgroup.test',
    displayName: 'Someone',
    globalRole: 'member',
    isActive: true,
    subsidiaryAccess: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  } as DawinUser;
}

const access = (subsidiaryId: string) =>
  ({ subsidiaryId, hasAccess: true, modules: [] }) as unknown as DawinUser['subsidiaryAccess'][number];

describe('resolveApprovalsScope', () => {
  it('is none for a signed-out viewer', () => {
    expect(resolveApprovalsScope(null)).toEqual({ kind: 'none' });
    expect(resolveApprovalsScope(undefined)).toEqual({ kind: 'none' });
  });

  it('is parent for an admin / owner with zeus-group access (the AM population)', () => {
    expect(
      resolveApprovalsScope(user({ globalRole: 'admin', subsidiaryAccess: [access('zeus-group')] })),
    ).toEqual({ kind: 'parent' });
    expect(
      resolveApprovalsScope(user({ globalRole: 'owner', subsidiaryAccess: [access('zeus-group'), access('labyrinth')] })),
    ).toEqual({ kind: 'parent' });
  });

  it('is the home brand for a subsidiary member — a plain member of zeus-group is NOT parent scope', () => {
    expect(resolveApprovalsScope(user({ subsidiaryAccess: [access('labyrinth')] }))).toEqual({
      kind: 'brand',
      orgId: 'labyrinth',
    });
    expect(
      resolveApprovalsScope(user({ globalRole: 'member', subsidiaryAccess: [access('zeus-group'), access('zeus-digital')] })),
    ).toEqual({ kind: 'brand', orgId: 'zeus-digital' });
  });

  it('is none for a user with no org access at all', () => {
    expect(resolveApprovalsScope(user({}))).toEqual({ kind: 'none' });
    expect(resolveApprovalsScope(user({ globalRole: 'member', subsidiaryAccess: [access('zeus-group')] }))).toEqual({
      kind: 'none',
    });
  });
});
