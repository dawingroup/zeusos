// ============================================================================
// DIGITAL PROFILE SERVICE
// ZeusOS v2.0 - Market Intelligence Module
// Firestore service for digital profile discovery and tracking
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  DigitalProfile,
  DigitalProfileFormInput,
  ProfileSnapshot,
  ProfileDiscoveryResult,
  DigitalPlatform,
} from '../types/digitalProfile.types';

const PROFILES_COLLECTION = 'digital_profiles';
const SNAPSHOTS_COLLECTION = 'profile_snapshots';

// ----------------------------------------------------------------------------
// PLATFORM DETECTION PATTERNS
// ----------------------------------------------------------------------------

const PLATFORM_PATTERNS: { platform: DigitalPlatform; patterns: RegExp[] }[] = [
  { platform: 'linkedin', patterns: [/linkedin\.com\/company\//i, /linkedin\.com\/in\//i] },
  { platform: 'twitter', patterns: [/twitter\.com\//i, /x\.com\//i] },
  { platform: 'facebook', patterns: [/facebook\.com\//i, /fb\.com\//i] },
  { platform: 'instagram', patterns: [/instagram\.com\//i] },
  { platform: 'youtube', patterns: [/youtube\.com\/(channel|c|user|@)/i] },
  { platform: 'tiktok', patterns: [/tiktok\.com\/@/i] },
  { platform: 'github', patterns: [/github\.com\//i] },
  { platform: 'crunchbase', patterns: [/crunchbase\.com\/organization\//i] },
  { platform: 'glassdoor', patterns: [/glassdoor\.(com|co\.\w+)\/Overview/i] },
  { platform: 'medium', patterns: [/medium\.com\/@?/i] },
  { platform: 'reddit', patterns: [/reddit\.com\/r\//i, /reddit\.com\/user\//i] },
  { platform: 'pinterest', patterns: [/pinterest\.com\//i] },
  { platform: 'app_store', patterns: [/apps\.apple\.com\//i] },
  { platform: 'play_store', patterns: [/play\.google\.com\/store\/apps/i] },
  { platform: 'google_business', patterns: [/google\.com\/maps/i, /g\.page\//i] },
];

export function detectPlatform(url: string): DigitalPlatform {
  for (const { platform, patterns } of PLATFORM_PATTERNS) {
    if (patterns.some(p => p.test(url))) return platform;
  }
  // Check if it looks like a blog
  if (/blog\./i.test(url) || /\/blog/i.test(url)) return 'blog';
  return 'website';
}

/**
 * Extract a profile handle/username from a social media URL.
 * E.g. "https://instagram.com/nike" → "nike"
 */
export function extractHandleFromUrl(url: string, platform?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, ''); // trim trailing slashes
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return undefined;

    const p = platform || detectPlatform(url);
    switch (p) {
      case 'instagram':
      case 'twitter':
      case 'pinterest':
      case 'github':
      case 'medium':
        // instagram.com/<handle>, twitter.com/<handle>, x.com/<handle>
        return segments[0]?.replace(/^@/, '') || undefined;
      case 'tiktok':
        // tiktok.com/@<handle>
        return segments[0]?.replace(/^@/, '') || undefined;
      case 'facebook':
        // facebook.com/<handle-or-page>
        return segments[0] || undefined;
      case 'linkedin':
        // linkedin.com/company/<slug>
        if (segments[0] === 'company' && segments[1]) return segments[1];
        if (segments[0] === 'in' && segments[1]) return segments[1];
        return segments[0] || undefined;
      case 'youtube': {
        // youtube.com/@handle or /channel/ID or /c/handle
        const last = segments[segments.length - 1];
        return last?.replace(/^@/, '') || undefined;
      }
      case 'crunchbase':
        // crunchbase.com/organization/<slug>
        if (segments[0] === 'organization' && segments[1]) return segments[1];
        return segments[0] || undefined;
      default:
        return segments[segments.length - 1] || undefined;
    }
  } catch {
    return undefined;
  }
}

// ============================================================================
// DIGITAL PROFILE CRUD
// ============================================================================

export const digitalProfileService = {
  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  async createProfile(
    input: DigitalProfileFormInput,
    userId: string
  ): Promise<string> {
    const now = Timestamp.now();

    const profileData: Omit<DigitalProfile, 'id'> = {
      competitorId: input.competitorId,
      competitorName: input.competitorName,
      platform: input.platform,
      profileUrl: input.profileUrl,
      profileHandle: input.profileHandle,
      profileName: input.profileName,
      verified: false,
      isActive: true,
      isTracking: true,
      discoveredBy: 'manual',
      discoveredAt: now,
      confidence: 100,
      notes: input.notes,
      tags: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    // Remove undefined fields — Firestore rejects them
    const cleanData = Object.fromEntries(
      Object.entries(profileData).filter(([, v]) => v !== undefined)
    );

    const docRef = await addDoc(collection(db, PROFILES_COLLECTION), cleanData);
    return docRef.id;
  },

  async createFromDiscovery(
    result: ProfileDiscoveryResult,
    competitorId: string,
    competitorName: string,
    userId: string
  ): Promise<string> {
    const now = Timestamp.now();
    const handle = extractHandleFromUrl(result.url, result.platform);

    const profileData: Omit<DigitalProfile, 'id'> = {
      competitorId,
      competitorName,
      platform: result.platform,
      profileUrl: result.url,
      profileHandle: handle,
      profileName: result.title,
      verified: false,
      isActive: true,
      isTracking: true,
      discoveredBy: 'auto_search',
      discoveredAt: now,
      confidence: result.confidence,
      tags: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    // Remove undefined fields — Firestore rejects them
    const cleanData = Object.fromEntries(
      Object.entries(profileData).filter(([, v]) => v !== undefined)
    );

    const docRef = await addDoc(collection(db, PROFILES_COLLECTION), cleanData);
    return docRef.id;
  },

  // --------------------------------------------------------------------------
  // READ
  // --------------------------------------------------------------------------

  async getProfile(id: string): Promise<DigitalProfile | null> {
    const docRef = doc(db, PROFILES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as DigitalProfile;
  },

  async getCompetitorProfiles(competitorId: string): Promise<DigitalProfile[]> {
    const q = query(
      collection(db, PROFILES_COLLECTION),
      where('competitorId', '==', competitorId),
      orderBy('platform', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DigitalProfile[];
  },

  async getAllTrackedProfiles(): Promise<DigitalProfile[]> {
    const q = query(
      collection(db, PROFILES_COLLECTION),
      where('isTracking', '==', true),
      orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DigitalProfile[];
  },

  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------

  async updateProfile(id: string, updates: Partial<DigitalProfile>): Promise<void> {
    await updateDoc(doc(db, PROFILES_COLLECTION, id), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  },

  async toggleTracking(id: string): Promise<void> {
    const profile = await this.getProfile(id);
    if (!profile) throw new Error('Profile not found');
    await updateDoc(doc(db, PROFILES_COLLECTION, id), {
      isTracking: !profile.isTracking,
      updatedAt: Timestamp.now(),
    });
  },

  // --------------------------------------------------------------------------
  // DELETE
  // --------------------------------------------------------------------------

  async deleteProfile(id: string): Promise<void> {
    await deleteDoc(doc(db, PROFILES_COLLECTION, id));
  },

  // --------------------------------------------------------------------------
  // SNAPSHOTS
  // --------------------------------------------------------------------------

  async saveSnapshot(snapshot: Omit<ProfileSnapshot, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, SNAPSHOTS_COLLECTION), snapshot);
    return docRef.id;
  },

  async getSnapshots(profileId: string, limit = 30): Promise<ProfileSnapshot[]> {
    const q = query(
      collection(db, SNAPSHOTS_COLLECTION),
      where('profileId', '==', profileId),
      orderBy('capturedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(d => ({
      id: d.id,
      ...d.data(),
    })) as ProfileSnapshot[];
  },

  // --------------------------------------------------------------------------
  // DISCOVERY (Google Custom Search)
  // --------------------------------------------------------------------------

  async discoverProfiles(
    competitorName: string,
    competitorId: string,
    website?: string
  ): Promise<ProfileDiscoveryResult[]> {
    // Call our Cloud Function (callable) for search
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const discoverFn = httpsCallable(functions, 'discoverDigitalProfiles');

      const result = await discoverFn({
        competitorName,
        competitorId,
        website,
      });

      const data = result.data as {
        results: ProfileDiscoveryResult[];
      };

      return data.results || [];
    } catch (error) {
      console.error('Digital profile discovery error:', error);
      // Return empty results on error - the UI will show the manual add option
      return [];
    }
  },
};
