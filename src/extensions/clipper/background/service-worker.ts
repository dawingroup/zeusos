/**
 * Service Worker - Main background script for Chrome extension
 * CRITICAL: Service workers are ephemeral - never store state in memory
 */

import type { Message, FetchImageMessage, ImageFetchedMessage, SaveClipMessage } from '../types/messages';
import type { ClipRecord } from '../types/database';
import { generateClipId, saveClip as dbSaveClip, addToSyncQueue } from '../lib/database';

// Message router
chrome.runtime.onMessage.addListener((message: Message, sender: any, sendResponse: any) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('Message handler error:', error);
      sendResponse({ type: 'ERROR', code: 'HANDLER_ERROR', message: error.message });
    });
  
  // Return true to indicate async response
  return true;
});

async function handleMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case 'FETCH_IMAGE':
      return fetchImageAsDataUrl((message as FetchImageMessage).url);
    
    case 'REQUEST_SYNC':
      return triggerSync();
    
    case 'TOGGLE_CLIPPING_MODE':
      return toggleClippingMode();
    
    case 'SAVE_CLIP':
      return handleSaveClip(message as SaveClipMessage);
    
    case 'SAVE_DETAILED_CLIP':
      return handleSaveDetailedClip(message);
    
    default:
      console.warn('Unknown message type:', message.type);
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Fetch image and convert to data URL (handles CORS)
 */
async function fetchImageAsDataUrl(url: string): Promise<ImageFetchedMessage> {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // Get dimensions using createImageBitmap
    const bitmap = await createImageBitmap(blob);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();
    
    // Convert to data URL
    const dataUrl = await blobToDataUrl(blob);
    
    return {
      type: 'IMAGE_FETCHED',
      success: true,
      dataUrl,
      width,
      height,
    };
  } catch (error) {
    console.error('Failed to fetch image:', error);
    return {
      type: 'IMAGE_FETCHED',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function triggerSync(): Promise<{ success: boolean }> {
  // Will be implemented in Phase 4
  console.log('Sync requested');
  return { success: true };
}

/**
 * Save a clip directly in the service worker
 */
async function handleSaveClip(message: SaveClipMessage): Promise<{ success: boolean; clipId?: string; error?: string }> {
  try {
    const { imageUrl, sourceUrl, title, metadata } = message.clip;
    
    // Fetch image directly (we're already in the service worker)
    const imageResponse = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: HTTP ${imageResponse.status}`);
    }
    const imageBlob = await imageResponse.blob();
    
    // Generate thumbnail using OffscreenCanvas
    const bitmap = await createImageBitmap(imageBlob);
    const maxSize = 200;
    const ratio = bitmap.width / bitmap.height;
    const thumbWidth = bitmap.width > bitmap.height ? maxSize : Math.round(maxSize * ratio);
    const thumbHeight = bitmap.height > bitmap.width ? maxSize : Math.round(maxSize / ratio);
    
    const canvas = new OffscreenCanvas(thumbWidth, thumbHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight);
    bitmap.close();
    
    const thumbnailBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    
    // Create clip record
    const clip: ClipRecord = {
      id: generateClipId(),
      sourceUrl,
      imageUrl,
      imageBlob,
      thumbnailBlob,
      title: title || 'Untitled',
      description: metadata?.description as string | undefined,
      brand: metadata?.brand as string | undefined,
      tags: [],
      syncStatus: 'pending',
      version: 1,
      lastModified: new Date(),
      createdAt: new Date(),
    };
    
    // Save to IndexedDB
    await dbSaveClip(clip);
    
    // Add to sync queue
    const syncPayload = { ...clip };
    delete (syncPayload as Partial<ClipRecord>).imageBlob;
    delete (syncPayload as Partial<ClipRecord>).thumbnailBlob;
    
    await addToSyncQueue({
      clipId: clip.id,
      operation: 'create',
      payload: syncPayload,
      retryCount: 0,
      createdAt: new Date(),
    });
    
    console.log('Clip saved:', clip.id);
    return { success: true, clipId: clip.id };
  } catch (error) {
    console.error('Failed to save clip:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Handle detailed clip save with all metadata including price
 */
async function handleSaveDetailedClip(message: { data: {
  imageUrl: string;
  sourceUrl: string;
  title: string;
  clipType?: string;
  projectId?: string;
  designItemId?: string;
  notes?: string;
  price?: { amount: number; currency: string; formatted?: string; confidence?: number };
  brand?: string;
  sku?: string;
  dimensions?: { width: number; height: number; depth?: number; unit: string };
  materials?: string[];
  colors?: string[];
  description?: string;
}}): Promise<{ success: boolean; clipId?: string; error?: string }> {
  try {
    const { data } = message;
    console.log('[Service Worker] SAVE_DETAILED_CLIP received:', JSON.stringify(data, null, 2));
    
    // Fetch image
    const imageResponse = await fetch(data.imageUrl, { mode: 'cors', credentials: 'omit' });
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: HTTP ${imageResponse.status}`);
    }
    const imageBlob = await imageResponse.blob();
    
    // Generate thumbnail
    const bitmap = await createImageBitmap(imageBlob);
    const maxSize = 200;
    const ratio = bitmap.width / bitmap.height;
    const thumbWidth = bitmap.width > bitmap.height ? maxSize : Math.round(maxSize * ratio);
    const thumbHeight = bitmap.height > bitmap.width ? maxSize : Math.round(maxSize / ratio);
    
    const canvas = new OffscreenCanvas(thumbWidth, thumbHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight);
    bitmap.close();
    
    const thumbnailBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    
    // Create clip record with all metadata including price
    const clip: ClipRecord = {
      id: generateClipId(),
      sourceUrl: data.sourceUrl,
      imageUrl: data.imageUrl,
      imageBlob,
      thumbnailBlob,
      title: data.title || 'Untitled',
      description: data.description,
      brand: data.brand,
      tags: [],
      projectId: data.projectId,
      designItemId: data.designItemId,
      notes: data.notes,
      // Price and other extracted metadata - ensure formatted is always set
      price: data.price ? {
        amount: data.price.amount,
        currency: data.price.currency,
        formatted: data.price.formatted || `${data.price.currency} ${data.price.amount.toFixed(2)}`,
      } : undefined,
      sku: data.sku,
      dimensions: data.dimensions ? {
        width: data.dimensions.width,
        height: data.dimensions.height,
        depth: data.dimensions.depth,
        unit: (data.dimensions.unit as 'in' | 'cm' | 'mm') || 'in',
      } : undefined,
      materials: data.materials,
      colors: data.colors,
      syncStatus: 'pending',
      version: 1,
      lastModified: new Date(),
      createdAt: new Date(),
    };
    
    // Save to IndexedDB
    await dbSaveClip(clip);
    
    // Add to sync queue (without blobs)
    const syncPayload = { ...clip };
    delete (syncPayload as Partial<ClipRecord>).imageBlob;
    delete (syncPayload as Partial<ClipRecord>).thumbnailBlob;
    
    await addToSyncQueue({
      clipId: clip.id,
      operation: 'create',
      payload: syncPayload,
      retryCount: 0,
      createdAt: new Date(),
    });
    
    console.log('Detailed clip saved with price:', clip.id, data.price);
    return { success: true, clipId: clip.id };
  } catch (error) {
    console.error('Failed to save detailed clip:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function toggleClippingMode(): Promise<{ success: boolean }> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!activeTab?.id) {
    return { success: false };
  }
  
  // Try to send message, inject content script if it fails
  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_CLIPPING_MODE' });
  } catch (error) {
    // Content script not loaded, inject it first
    console.log('Injecting content script...');
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js'],
    });
    // Also inject styles
    await chrome.scripting.insertCSS({
      target: { tabId: activeTab.id },
      css: `
        .dawin-clipping-active { cursor: crosshair !important; }
        .dawin-highlight { outline: 3px solid #872E5C !important; outline-offset: 2px; }
      `,
    });
    // Now send the message
    await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_CLIPPING_MODE' });
  }
  
  return { success: true };
}

// Setup on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Dawin Clipper installed');
  setupContextMenus();
  setupAlarms();
});

// Setup on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Dawin Clipper started');
  setupContextMenus();
});

function setupContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'dawin-clip-image',
      title: 'Clip to Dawin',
      contexts: ['image'],
    });
    
    chrome.contextMenus.create({
      id: 'dawin-start-clipping',
      title: 'Start clipping mode',
      contexts: ['page'],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info: any, tab: any) => {
  if (!tab?.id) return;
  
  if (info.menuItemId === 'dawin-clip-image' && info.srcUrl) {
    // Quick clip the image
    chrome.tabs.sendMessage(tab.id, {
      type: 'QUICK_CLIP',
      imageUrl: info.srcUrl,
    });
  } else if (info.menuItemId === 'dawin-start-clipping') {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_CLIPPING_MODE' });
  }
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener(async (command: any) => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!activeTab?.id) return;
  
  if (command === 'quick-clip') {
    chrome.tabs.sendMessage(activeTab.id, { type: 'QUICK_CLIP_FOCUSED' });
  } else if (command === 'toggle-clipping-mode') {
    chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_CLIPPING_MODE' });
  }
});

// Alarms for periodic sync
function setupAlarms(): void {
  chrome.alarms.create('sync-check', { periodInMinutes: 5 });
}

chrome.alarms.onAlarm.addListener((alarm: any) => {
  if (alarm.name === 'sync-check') {
    triggerSync();
  }
});

// Handle online/offline
self.addEventListener('online', () => {
  console.log('Back online, triggering sync');
  triggerSync();
});
