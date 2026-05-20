import { describe, it, expect } from 'vitest';
import {
  canonicalName,
  canonicalDisplayName,
  canonicalPartCode,
  nameAssemblyParts,
  inferRoleFromCategory,
  inferDrawerPeerBucket,
} from '../partNamingService';
import type { PartRole } from '../../types/workshop-viewer.types';

// ---------------------------------------------------------------------------
// canonicalDisplayName
// ---------------------------------------------------------------------------

describe('canonicalDisplayName', () => {
  it('produces "Left Side Panel" for side + left', () => {
    expect(canonicalDisplayName({ role: 'side', position: 'left' })).toBe('Left Side Panel');
  });

  it('produces "Right Side Panel" for side + right', () => {
    expect(canonicalDisplayName({ role: 'side', position: 'right' })).toBe('Right Side Panel');
  });

  it('produces "Top Panel" for top_bottom + top', () => {
    expect(canonicalDisplayName({ role: 'top_bottom', position: 'top' })).toBe('Top Panel');
  });

  it('produces "Bottom Panel" for top_bottom + bottom', () => {
    expect(canonicalDisplayName({ role: 'top_bottom', position: 'bottom' })).toBe('Bottom Panel');
  });

  it('produces "Back Panel" without double-"Back" for back role', () => {
    expect(canonicalDisplayName({ role: 'back' })).toBe('Back Panel');
  });

  it('does not prepend "Back" position onto back role', () => {
    expect(canonicalDisplayName({ role: 'back', position: 'back' })).toBe('Back Panel');
  });

  it('produces "Door" for a singleton door', () => {
    expect(canonicalDisplayName({ role: 'door', peerCount: 1 })).toBe('Door');
  });

  it('produces "Left Door" when two doors exist', () => {
    expect(canonicalDisplayName({ role: 'door', position: 'left', peerCount: 2 })).toBe('Left Door');
  });

  it('appends sequence when peers > 2', () => {
    expect(canonicalDisplayName({
      role: 'shelf', sequence: 3, peerCount: 4,
    })).toBe('Fixed Shelf 3');
  });

  it('appends sequence when peers > 1 and no position', () => {
    expect(canonicalDisplayName({
      role: 'shelf', sequence: 2, peerCount: 2,
    })).toBe('Fixed Shelf 2');
  });

  it('omits sequence for singletons', () => {
    expect(canonicalDisplayName({
      role: 'shelf', sequence: 1, peerCount: 1,
    })).toBe('Fixed Shelf');
  });

  it('handles center position as empty prefix', () => {
    expect(canonicalDisplayName({ role: 'panel', position: 'center' })).toBe('Panel');
  });

  it('handles cover with position', () => {
    expect(canonicalDisplayName({ role: 'cover', position: 'left' })).toBe('Left Cover Panel');
  });

  it('uses KB prefix when provided', () => {
    expect(canonicalDisplayName({
      role: 'side',
      position: 'left',
      kbPatterns: {
        convention: 'descriptive',
        prefixes: { side: 'Gable' },
        includePosition: true,
        includeNumber: true,
      },
    })).toBe('Left Gable');
  });
});

// ---------------------------------------------------------------------------
// canonicalPartCode
// ---------------------------------------------------------------------------

describe('canonicalPartCode', () => {
  it('produces full code with cabinet + assembly + role + pos + seq', () => {
    expect(canonicalPartCode({
      role: 'side',
      position: 'left',
      sequence: 1,
      cabinetCode: 'KBU1',
      assemblyCode: 'CARC',
    })).toBe('KBU1-CARC-SPL01');
  });

  it('omits position abbreviation for center', () => {
    expect(canonicalPartCode({
      role: 'shelf',
      position: 'center',
      sequence: 2,
      cabinetCode: 'KBU1',
      assemblyCode: 'CARC',
    })).toBe('KBU1-CARC-SH02');
  });

  it('degrades gracefully without cabinet/assembly', () => {
    expect(canonicalPartCode({
      role: 'door',
      position: 'right',
      sequence: 1,
    })).toBe('DRR01');
  });

  it('defaults to sequence 1 when not provided', () => {
    expect(canonicalPartCode({ role: 'back' })).toBe('BK01');
  });

  it('zero-pads sequence to 2 digits', () => {
    expect(canonicalPartCode({ role: 'shelf', sequence: 9 })).toBe('SH09');
  });
});

// ---------------------------------------------------------------------------
// canonicalName (combined)
// ---------------------------------------------------------------------------

describe('canonicalName', () => {
  it('returns displayName, partCode, and compactName', () => {
    const result = canonicalName({
      role: 'side',
      position: 'left',
      sequence: 1,
      cabinetCode: 'WRD1',
      assemblyCode: 'CARC',
    });
    expect(result.displayName).toBe('Left Side Panel');
    expect(result.partCode).toBe('WRD1-CARC-SPL01');
    expect(result.compactName).toBe('L Side');
  });
});

// ---------------------------------------------------------------------------
// nameAssemblyParts (batch)
// ---------------------------------------------------------------------------

describe('nameAssemblyParts', () => {
  it('sequences shelves by Z descending (top first)', () => {
    const parts = [
      { partId: 'sh1', role: 'shelf' as PartRole, sortZ: 100, sortX: 0 },
      { partId: 'sh2', role: 'shelf' as PartRole, sortZ: 600, sortX: 0 },
      { partId: 'sh3', role: 'shelf' as PartRole, sortZ: 300, sortX: 0 },
    ];
    const result = nameAssemblyParts(parts, 'KB1', 'CARC');
    expect(result.get('sh2')!.displayName).toBe('Fixed Shelf 1'); // highest Z
    expect(result.get('sh3')!.displayName).toBe('Fixed Shelf 2');
    expect(result.get('sh1')!.displayName).toBe('Fixed Shelf 3'); // lowest Z
  });

  it('handles mixed roles independently', () => {
    const parts = [
      { partId: 'sp1', role: 'side' as PartRole, position: 'left' as const, sortZ: 0, sortX: -200 },
      { partId: 'sp2', role: 'side' as PartRole, position: 'right' as const, sortZ: 0, sortX: 200 },
      { partId: 'sh1', role: 'shelf' as PartRole, sortZ: 400, sortX: 0 },
    ];
    const result = nameAssemblyParts(parts, 'KB1', 'CARC');
    expect(result.get('sp1')!.displayName).toBe('Left Side Panel');
    expect(result.get('sp2')!.displayName).toBe('Right Side Panel');
    expect(result.get('sh1')!.displayName).toBe('Fixed Shelf');
    expect(result.get('sp1')!.partCode).toBe('KB1-CARC-SPL01');
    expect(result.get('sp2')!.partCode).toBe('KB1-CARC-SPR02');
  });

  it('sequences drawer fronts per PolyBoard drawer column (peerBucket)', () => {
    const parts = [
      { partId: 'a', role: 'drawer' as PartRole, peerBucket: 'D1', sortZ: 0, sortX: 0 },
      { partId: 'b', role: 'drawer' as PartRole, peerBucket: 'D1', sortZ: 0, sortX: 1 },
      { partId: 'c', role: 'drawer' as PartRole, peerBucket: 'D2', sortZ: 0, sortX: 0 },
    ];
    const result = nameAssemblyParts(parts, 'K', 'C');
    expect(result.get('a')!.displayName).toBe('Drawer Front 1');
    expect(result.get('b')!.displayName).toBe('Drawer Front 2');
    expect(result.get('c')!.displayName).toBe('Drawer Front 1');
    expect(result.get('a')!.partCode).toBe('K-C-D1-DF01');
    expect(result.get('b')!.partCode).toBe('K-C-D1-DF02');
    expect(result.get('c')!.partCode).toBe('K-C-D2-DF01');
    expect(result.get('c')!.compactName).toBe('DF 1');
  });
});

describe('inferDrawerPeerBucket', () => {
  it('extracts D1 / D2 from PolyBoard-style labels', () => {
    expect(inferDrawerPeerBucket('X', 'Back_Drawer_2_y')).toBe('D2');
    expect(inferDrawerPeerBucket('Drawer_1 face', 'P1')).toBe('D1');
  });
});

// ---------------------------------------------------------------------------
// inferRoleFromCategory
// ---------------------------------------------------------------------------

describe('inferRoleFromCategory', () => {
  it('maps cover_panel → cover', () => {
    expect(inferRoleFromCategory('cover_panel')).toBe('cover');
  });

  it('maps toe_kick → plinth', () => {
    expect(inferRoleFromCategory('toe_kick')).toBe('plinth');
  });

  it('maps upright → side', () => {
    expect(inferRoleFromCategory('upright')).toBe('side');
  });

  it('maps hardware → other', () => {
    expect(inferRoleFromCategory('hardware')).toBe('other');
  });

  it('maps panel → panel', () => {
    expect(inferRoleFromCategory('panel')).toBe('panel');
  });
});
