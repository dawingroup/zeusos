/**
 * org-kind resolver — the single source of truth for PARENT vs SUBSIDIARY.
 * Regression coverage for the "Zeus Group owner gets an empty sidebar"
 * bug: a super-user email (or homeOrgId) must resolve PARENT even when
 * subsidiaryAccess lists only a sub-brand.
 */
import { describe, expect, it } from 'vitest';
import { resolveOrgKind, isParentOrgPrincipal } from '../org-kind';

describe('resolveOrgKind', () => {
  it('treats a super-user email as PARENT even with only sub-brand access', () => {
    // The exact production case: owner, no homeOrgId, subsidiaryAccess = ZTA only.
    const user = {
      globalRole: 'owner',
      subsidiaryAccess: [{ subsidiaryId: 'zeus-the-agency', hasAccess: true }],
    };
    expect(resolveOrgKind('onzimaid@gmail.com', user)).toBe('PARENT');
    expect(isParentOrgPrincipal('onzimaid@gmail.com', user)).toBe(true);
  });

  it('is case-insensitive on the super-user email', () => {
    expect(resolveOrgKind('OnzimaID@Gmail.com', { globalRole: 'member' })).toBe('PARENT');
  });

  it('honours homeOrgId === zeus-group → PARENT', () => {
    expect(resolveOrgKind('someone@example.com', { globalRole: 'admin', homeOrgId: 'zeus-group' })).toBe('PARENT');
  });

  it('honours homeOrgId === a sub-brand → SUBSIDIARY (even for admin)', () => {
    expect(resolveOrgKind('admin@example.com', { globalRole: 'admin', homeOrgId: 'labyrinth' })).toBe('SUBSIDIARY');
  });

  it('admin/owner with zeus-group access → PARENT', () => {
    const user = {
      globalRole: 'admin',
      subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: true }],
    };
    expect(resolveOrgKind('x@example.com', user)).toBe('PARENT');
  });

  it('plain sub-brand delivery user → SUBSIDIARY', () => {
    const user = {
      globalRole: 'member',
      subsidiaryAccess: [{ subsidiaryId: 'labyrinth', hasAccess: true }],
    };
    expect(resolveOrgKind('member@example.com', user)).toBe('SUBSIDIARY');
    expect(isParentOrgPrincipal('member@example.com', user)).toBe(false);
  });

  it('null user → SUBSIDIARY (profile not loaded yet; do not grant parent UI early)', () => {
    expect(resolveOrgKind('onzimaid@gmail.com', null)).toBe('SUBSIDIARY');
    expect(resolveOrgKind('x@example.com', null)).toBe('SUBSIDIARY');
  });
});
