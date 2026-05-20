/**
 * Branding Service
 * Manages platform-level logo and favicon uploads.
 *
 * Single source of truth: organizations/{orgId}/settings/general
 *   → branding.subsidiaries[subsidiaryId].logoUrl / faviconUrl
 *
 * Delegates storage & Firestore writes to settingsService so that
 * all branding UIs (BrandingSettings, LogoUpload, SubsidiaryBranding)
 * read/write the same Firestore document.
 */

import {
  uploadSubsidiaryLogo,
  deleteSubsidiaryLogo,
} from '@/core/settings/settingsService';
import type { SubsidiaryBranding } from '@/core/settings/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

export interface BrandingAssets {
  logoUrl?: string;
  faviconUrl?: string;
}

/** Resolved colors for payment receipts and other PDFs. */
export interface ReceiptBrandingColors {
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  muted: string;
  highlightBg: string;
  textDark: string;
  textMedium: string;
  bgLight: string;
}

export const FALLBACK_RECEIPT_BRANDING: ReceiptBrandingColors = {
  primary: '#1a1a2e',
  secondary: '#4b5563',
  accent: '#16a34a',
  border: '#e5e7eb',
  muted: '#9ca3af',
  highlightBg: '#ecfdf5',
  textDark: '#111827',
  textMedium: '#4b5563',
  bgLight: '#f9fafb',
};

export interface SubsidiaryDocumentBranding {
  logoUrl?: string;
  colors: ReceiptBrandingColors;
}

const DEFAULT_SUBSIDIARY = 'zeus-group';

function normalizeHex(hex: string | undefined | null, fallback: string): string {
  if (hex == null || typeof hex !== 'string') return fallback;
  const s = hex.trim();
  if (!s) return fallback;
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return fallback;
}

/** Mix hex colour toward white (`amount` 0 = base, 1 = white). */
function mixTowardsWhite(hex: string, amount: number): string {
  const h = normalizeHex(hex, '#6b7280');
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const t = Math.min(1, Math.max(0, amount));
  const R = Math.round(r + (255 - r) * t);
  const G = Math.round(g + (255 - g) * t);
  const B = Math.round(b + (255 - b) * t);
  return `#${R.toString(16).padStart(2, '0')}${G.toString(16).padStart(2, '0')}${B.toString(16).padStart(2, '0')}`;
}

function resolveReceiptBrandingColors(sub: SubsidiaryBranding | undefined): ReceiptBrandingColors {
  const dp = sub?.documentPalette;
  const basePrimary = normalizeHex(sub?.primaryColor, FALLBACK_RECEIPT_BRANDING.primary);
  const baseSecondary = normalizeHex(sub?.secondaryColor, FALLBACK_RECEIPT_BRANDING.secondary);
  const baseAccent = normalizeHex(
    sub?.accentColor || sub?.primaryColor,
    FALLBACK_RECEIPT_BRANDING.accent,
  );

  const primary = normalizeHex(dp?.primary, basePrimary);
  const secondary = normalizeHex(dp?.secondary, baseSecondary);
  const accent = normalizeHex(dp?.accent, baseAccent);
  const border = normalizeHex(dp?.border, FALLBACK_RECEIPT_BRANDING.border);
  const muted = normalizeHex(dp?.muted, FALLBACK_RECEIPT_BRANDING.muted);
  const highlightBg = normalizeHex(dp?.highlightBg, mixTowardsWhite(accent, 0.88));
  const bgLight = normalizeHex(dp?.tableAltBg, mixTowardsWhite(primary, 0.94));

  return {
    primary,
    secondary,
    accent,
    border,
    muted,
    highlightBg,
    textDark: FALLBACK_RECEIPT_BRANDING.textDark,
    textMedium: secondary,
    bgLight,
  };
}

function subsidiaryIdsToTry(subsidiaryId?: string | null): string[] {
  const raw = subsidiaryId?.trim();
  const ids: string[] = [];
  if (raw) ids.push(raw);
  if (raw === 'finishes') ids.push('zeus-the-agency');
  ids.push(DEFAULT_SUBSIDIARY);
  return [...new Set(ids)];
}

function hasSubsidiaryBrandingContent(s: SubsidiaryBranding | undefined): boolean {
  if (!s) return false;
  if (s.logoUrl?.trim()) return true;
  if (s.primaryColor?.trim()) return true;
  const dp = s.documentPalette;
  if (!dp) return false;
  return [
    dp.primary,
    dp.secondary,
    dp.accent,
    dp.border,
    dp.muted,
    dp.highlightBg,
    dp.tableAltBg,
  ].some((v) => typeof v === 'string' && v.trim().length > 0);
}

function pickSubsidiary(
  subsidiaries: Record<string, SubsidiaryBranding> | undefined,
  tryIds: string[],
): SubsidiaryBranding | undefined {
  if (!subsidiaries) return undefined;
  for (const id of tryIds) {
    const s = subsidiaries[id];
    if (hasSubsidiaryBrandingContent(s)) return s;
  }
  for (const id of tryIds) {
    const s = subsidiaries[id];
    if (s) return s;
  }
  return undefined;
}

/**
 * Logo + resolved document colour palette for the subsidiary (receipt PDFs, etc.).
 */
export async function getSubsidiaryBrandingForDocuments(
  subsidiaryId?: string | null,
): Promise<SubsidiaryDocumentBranding> {
  const tryIds = subsidiaryIdsToTry(subsidiaryId);
  const ref = doc(db, 'organizations', 'default', 'settings', 'general');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { colors: { ...FALLBACK_RECEIPT_BRANDING } };
  }
  const subsidiaries = snap.data()?.branding?.subsidiaries as
    | Record<string, SubsidiaryBranding>
    | undefined;
  const sub = pickSubsidiary(subsidiaries, tryIds);
  const logoUrl =
    typeof sub?.logoUrl === 'string' && sub.logoUrl.trim() ? sub.logoUrl.trim() : undefined;
  return {
    logoUrl,
    colors: resolveReceiptBrandingColors(sub),
  };
}

/**
 * Upload logo file (delegates to org-settings subsidiary upload)
 */
export async function uploadLogo(
  file: File,
  subsidiaryId: string = DEFAULT_SUBSIDIARY
): Promise<string> {
  return uploadSubsidiaryLogo(file, subsidiaryId, 'primary');
}

/**
 * Upload favicon file (delegates to org-settings subsidiary upload)
 */
export async function uploadFavicon(
  file: File,
  subsidiaryId: string = DEFAULT_SUBSIDIARY
): Promise<string> {
  return uploadSubsidiaryLogo(file, subsidiaryId, 'favicon');
}

/**
 * Reset branding to defaults (removes logo and favicon)
 */
export async function resetBranding(
  subsidiaryId: string = DEFAULT_SUBSIDIARY
): Promise<void> {
  await deleteSubsidiaryLogo(subsidiaryId, 'primary');
  await deleteSubsidiaryLogo(subsidiaryId, 'favicon');
}

/**
 * Read uploaded subsidiary logo from org settings (same document as {@link useBranding}).
 * Tries `subsidiaryId` first, then {@link DEFAULT_SUBSIDIARY}.
 */
export async function getSubsidiaryBrandingLogoUrl(
  subsidiaryId?: string | null,
): Promise<string | undefined> {
  const b = await getSubsidiaryBrandingForDocuments(subsidiaryId);
  return b.logoUrl;
}
