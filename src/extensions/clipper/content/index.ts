/**
 * Content Script - Runs on every page
 * Handles image detection, selection, and clipping
 */

import './styles.css';
import type { Message } from '../types/messages';
import { metadataExtractor } from './metadata-extractor';

let isClippingModeActive = false;
let hoveredImageUrl: string | null = null;

// Initialize
console.log('Dawin Clipper content script loaded');

// Global hover tracking for quick-clip keyboard shortcut (Alt+C).
// These run at all times, not just during clipping mode.
document.addEventListener('mouseover', (event) => {
  const target = event.target as HTMLElement;
  const imageUrl = getImageUrl(target);
  if (imageUrl) {
    hoveredImageUrl = imageUrl;
  }
});

document.addEventListener('mouseout', (event) => {
  const target = event.target as HTMLElement;
  if (getImageUrl(target) === hoveredImageUrl) {
    hoveredImageUrl = null;
  }
});

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message: Message, _sender: any, sendResponse: any) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error('Content script error:', error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'TOGGLE_CLIPPING_MODE':
      toggleClippingMode();
      return { success: true, isActive: isClippingModeActive };

    case 'QUICK_CLIP':
      if ('imageUrl' in message) {
        return quickClip(message.imageUrl);
      }
      return { success: false, error: 'No image URL' };

    case 'QUICK_CLIP_FOCUSED':
      if (hoveredImageUrl) {
        return quickClip(hoveredImageUrl);
      }
      // No focused image, toggle clipping mode instead
      toggleClippingMode();
      return { success: false, message: 'No focused image' };

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

function toggleClippingMode(): void {
  isClippingModeActive = !isClippingModeActive;

  if (isClippingModeActive) {
    activateClippingMode();
  } else {
    deactivateClippingMode();
  }
}

function activateClippingMode(): void {
  console.log('Clipping mode activated');
  document.body.classList.add('dawin-clipping-active');

  // Add clipping-mode-specific event listeners (highlight + click handling only)
  document.addEventListener('mouseover', handleClippingMouseOver);
  document.addEventListener('mouseout', handleClippingMouseOut);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown);

  showToast('Clipping mode active. Click an image to clip. Press ESC to cancel.');
}

function deactivateClippingMode(): void {
  console.log('Clipping mode deactivated');
  document.body.classList.remove('dawin-clipping-active');

  // Remove clipping-mode-specific event listeners
  document.removeEventListener('mouseover', handleClippingMouseOver);
  document.removeEventListener('mouseout', handleClippingMouseOut);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown);

  // Remove any highlights
  removeAllHighlights();
}

// Clipping mode hover: only handles visual highlights (hover tracking is global)
function handleClippingMouseOver(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const imageUrl = getImageUrl(target);
  if (imageUrl) {
    highlightElement(target);
  }
}

function handleClippingMouseOut(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  removeHighlight(target);
}

function handleClick(event: MouseEvent): void {
  if (!isClippingModeActive) return;

  const target = event.target as HTMLElement;
  const imageUrl = getImageUrl(target);

  if (imageUrl) {
    event.preventDefault();
    event.stopPropagation();
    quickClip(imageUrl);
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    isClippingModeActive = false;
    deactivateClippingMode();
    showToast('Clipping cancelled');
  }
}

/**
 * Get the image URL from an element, using the imageDetector for
 * high-res URL resolution when possible.
 */
function getImageUrl(element: HTMLElement): string | null {
  // Standard img element
  if (element instanceof HTMLImageElement) {
    return element.currentSrc || element.src;
  }

  // Background image
  const bgImage = window.getComputedStyle(element).backgroundImage;
  if (bgImage && bgImage !== 'none') {
    const match = bgImage.match(/url\(["']?(.+?)["']?\)/);
    if (match) {
      return match[1];
    }
  }

  // Check for lazy-loaded images
  const lazyAttrs = ['data-src', 'data-lazy-src', 'data-original'];
  for (const attr of lazyAttrs) {
    const value = element.getAttribute(attr);
    if (value) return value;
  }

  return null;
}

function highlightElement(element: HTMLElement): void {
  element.classList.add('dawin-highlight');
}

function removeHighlight(element: HTMLElement): void {
  element.classList.remove('dawin-highlight');
}

function removeAllHighlights(): void {
  document.querySelectorAll('.dawin-highlight').forEach((el) => {
    el.classList.remove('dawin-highlight');
  });
}

async function quickClip(imageUrl: string): Promise<{ success: boolean }> {
  try {
    showToast('Preparing clip...');

    // Try to get a higher resolution URL for the specific image being clipped.
    // We avoid the expensive full-page detectImages() scan here because it calls
    // getComputedStyle on every DOM element, which freezes the page on heavy sites.
    const bestUrl = findHighResUrl(imageUrl);

    // Request image fetch through service worker (handles CORS)
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_IMAGE',
      url: bestUrl,
    });

    if (!response.success) {
      // Fall back to original URL if high-res fetch failed
      if (bestUrl !== imageUrl) {
        const fallbackResponse = await chrome.runtime.sendMessage({
          type: 'FETCH_IMAGE',
          url: imageUrl,
        });
        if (!fallbackResponse.success) {
          showToast('Failed to clip image: ' + fallbackResponse.error, 'error');
          return { success: false };
        }
      } else {
        showToast('Failed to clip image: ' + response.error, 'error');
        return { success: false };
      }
    }

    // Extract page metadata
    const metadata = extractPageMetadata();

    // Store pending clip data for the popup form
    const pendingClipData = {
      imageUrl: bestUrl,
      sourceUrl: window.location.href,
      title: metadata.title,
      metadata,
      timestamp: Date.now(),
    };

    await chrome.storage.local.set({ pendingClip: pendingClipData });

    // Deactivate clipping mode
    isClippingModeActive = false;
    deactivateClippingMode();

    showToast('Image captured! Click the Dawin Clipper icon to save with details.', 'success');

    return { success: true };
  } catch (error) {
    console.error('Quick clip failed:', error);
    showToast('Failed to clip image', 'error');
    return { success: false };
  }
}

/**
 * Find a higher-resolution URL for a given image without scanning the entire DOM.
 * Only inspects the specific <img> element that matches the URL.
 */
function findHighResUrl(imageUrl: string): string {
  // Find the matching <img> element directly
  const imgs = document.querySelectorAll<HTMLImageElement>('img');
  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (src !== imageUrl) continue;

    // Check srcset for a larger variant
    if (img.srcset) {
      const entries = img.srcset.split(',').map(s => s.trim());
      let best = '';
      let bestWidth = 0;
      for (const entry of entries) {
        const parts = entry.split(/\s+/);
        if (parts.length >= 2) {
          const wMatch = parts[1].match(/(\d+)w/);
          if (wMatch) {
            const w = parseInt(wMatch[1], 10);
            if (w > bestWidth) {
              bestWidth = w;
              best = parts[0];
            }
          }
        }
      }
      if (best) return best;
    }

    // Check parent <picture> element for higher-res sources
    const picture = img.closest('picture');
    if (picture) {
      let best = '';
      let bestWidth = 0;
      for (const source of picture.querySelectorAll('source')) {
        const srcset = source.srcset;
        if (!srcset) continue;
        for (const entry of srcset.split(',').map(s => s.trim())) {
          const parts = entry.split(/\s+/);
          if (parts.length >= 2) {
            const wMatch = parts[1].match(/(\d+)w/);
            if (wMatch) {
              const w = parseInt(wMatch[1], 10);
              if (w > bestWidth) {
                bestWidth = w;
                best = parts[0];
              }
            }
          }
        }
      }
      if (best) return best;
    }

    // Common high-res URL patterns
    const patterns: Array<{ from: RegExp; to: string }> = [
      { from: /_\d+x\d+/, to: '' },
      { from: /-\d+x\d+/, to: '' },
      { from: /\/w\d+\//, to: '/w2000/' },
      { from: /\bsmall\b/i, to: 'large' },
      { from: /\bthumb\b/i, to: 'full' },
      { from: /\bmedium\b/i, to: 'large' },
    ];
    for (const { from, to } of patterns) {
      if (from.test(src)) return src.replace(from, to);
    }

    break; // Found the matching element, no need to continue
  }

  return imageUrl;
}

function extractPageMetadata() {
  const fullMetadata = metadataExtractor.extract();

  // Fallback title if not extracted
  const title = fullMetadata.title ||
    document.querySelector('h1')?.textContent?.trim() ||
    document.title ||
    'Untitled';

  return {
    title,
    description: fullMetadata.description,
    price: fullMetadata.price,
    brand: fullMetadata.brand,
    sku: fullMetadata.sku,
    category: fullMetadata.category,
    dimensions: fullMetadata.dimensions,
    materials: fullMetadata.materials,
    colors: fullMetadata.colors,
  };
}

// Toast notification
let toastElement: HTMLElement | null = null;
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  if (!toastElement) {
    toastElement = document.createElement('div');
    toastElement.id = 'dawin-toast';
    document.body.appendChild(toastElement);
  }

  const colors = {
    info: '#2563EB',
    success: '#16A34A',
    error: '#DC2626',
  };

  toastElement.textContent = message;
  toastElement.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${colors[type]};
    color: white;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: opacity 0.3s;
  `;

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    if (toastElement) {
      toastElement.style.opacity = '0';
      setTimeout(() => {
        toastElement?.remove();
        toastElement = null;
      }, 300);
    }
  }, 3000);
}
