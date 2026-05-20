/**
 * DynamicFavicon Component
 * Updates the page favicon based on uploaded branding.
 *
 * Strategy: remove every existing favicon / shortcut-icon link and
 * insert a fresh one pointing at the uploaded URL.  We intentionally
 * omit the `type` attribute so the browser auto-detects the format
 * (Firebase Storage URLs don't always contain a recognisable extension).
 */

import { useEffect } from 'react';
import { useBranding } from '@/shared/hooks/useBranding';

export function DynamicFavicon() {
  const { branding } = useBranding();

  // Use faviconUrl if available, otherwise fall back to logoUrl
  const faviconSrc = branding.faviconUrl || branding.logoUrl;

  useEffect(() => {
    console.log('[DynamicFavicon] Branding:', branding, '→ faviconSrc:', faviconSrc);
    if (!faviconSrc) {
      console.log('[DynamicFavicon] No favicon or logo URL, skipping');
      return;
    }

    console.log('[DynamicFavicon] Setting favicon to:', faviconSrc);

    // Remove ALL existing favicon / shortcut-icon links so there is no conflict
    document
      .querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
      .forEach((el) => el.remove());

    // Create a brand-new link element
    const faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    // Cache-bust so the browser always fetches the latest upload
    faviconLink.href = faviconSrc + (faviconSrc.includes('?') ? '&' : '?') + 'v=' + Date.now();
    document.head.appendChild(faviconLink);

    // Also update apple-touch-icon links
    const appleTouchIcons = document.querySelectorAll("link[rel='apple-touch-icon']") as NodeListOf<HTMLLinkElement>;
    appleTouchIcons.forEach((icon) => {
      icon.href = faviconSrc;
    });
  }, [faviconSrc]);

  return null;
}

export default DynamicFavicon;
