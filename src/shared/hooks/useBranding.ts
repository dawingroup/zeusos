/**
 * useBranding Hook
 * Manages branding assets state and operations.
 *
 * Single source of truth: organizations/{orgId}/settings/general
 *   → branding.subsidiaries[subsidiaryId].logoUrl / faviconUrl
 *
 * All upload UIs (BrandingSettings, LogoUpload, SubsidiaryBranding)
 * write to the same document, so a single onSnapshot is sufficient.
 */

import { useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/shared/services/firebase';
import {
  uploadLogo,
  uploadFavicon,
  resetBranding,
  type BrandingAssets,
} from '@/shared/services/branding.service';

const DEFAULT_SUBSIDIARY = 'zeus-group';

export function useBranding(subsidiaryId: string = DEFAULT_SUBSIDIARY) {
  const [branding, setBranding] = useState<BrandingAssets>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to org settings after auth is ready
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Tear down previous listener when auth state changes
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (!user) {
        setBranding({});
        setLoading(false);
        return;
      }

      // Listen to the single org-settings document
      const orgSettingsRef = doc(db, 'organizations', 'default', 'settings', 'general');
      unsubFirestore = onSnapshot(
        orgSettingsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const sub = data?.branding?.subsidiaries?.[subsidiaryId];
            const assets: BrandingAssets = {
              logoUrl: sub?.logoUrl || undefined,
              faviconUrl: sub?.faviconUrl || undefined,
            };
            if (import.meta.env.DEV) {
              console.debug('[useBranding] Branding from org settings:', {
                subsidiaryId,
                assets,
              });
            }
            setBranding(assets);
          } else {
            // Expected until Settings → org branding is saved; not an error.
            if (import.meta.env.DEV) {
              console.debug(
                '[useBranding] No org settings document at organizations/default/settings/general'
              );
            }
            setBranding({});
          }
          setLoading(false);
        },
        (err) => {
          console.error('[useBranding] Error listening to org settings:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, [subsidiaryId]);

  const handleUploadLogo = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadLogo(file, subsidiaryId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleUploadFavicon = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadFavicon(file, subsidiaryId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    setUploading(true);
    setError(null);
    try {
      await resetBranding(subsidiaryId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return {
    branding,
    loading,
    uploading,
    error,
    uploadLogo: handleUploadLogo,
    uploadFavicon: handleUploadFavicon,
    resetBranding: handleReset,
  };
}
