/**
 * Message types for cross-context communication
 */

export type ClipType =
  | 'inspiration'
  | 'reference'
  | 'parts-source'
  | 'procurement'
  | 'material'
  | 'asset'
  | 'product-idea';

export type MessageType =
  | 'FETCH_IMAGE'
  | 'IMAGE_FETCHED'
  | 'SAVE_CLIP'
  | 'SAVE_DETAILED_CLIP'
  | 'CLIP_SAVED'
  | 'GET_CLIPS'
  | 'CLIPS_LIST'
  | 'TOGGLE_CLIPPING'
  | 'CLIPPING_TOGGLED'
  | 'QUICK_CLIP'
  | 'QUICK_CLIP_FOCUSED'
  | 'SYNC_STATUS'
  | 'REQUEST_SYNC'
  | 'GET_SYNC_STATUS'
  | 'SYNC_STATUS_UPDATE'
  | 'SYNC_PROGRESS'
  | 'TOGGLE_CLIPPING_MODE'
  | 'ERROR';

export interface BaseMessage {
  type: MessageType;
}

export interface FetchImageMessage extends BaseMessage {
  type: 'FETCH_IMAGE';
  url: string;
}

export interface ImageFetchedMessage extends BaseMessage {
  type: 'IMAGE_FETCHED';
  success: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface SaveClipMessage extends BaseMessage {
  type: 'SAVE_CLIP';
  clip: {
    imageUrl: string;
    sourceUrl: string;
    title?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface SaveDetailedClipMessage extends BaseMessage {
  type: 'SAVE_DETAILED_CLIP';
  data: {
    imageUrl: string;
    sourceUrl: string;
    title: string;
    clipType?: ClipType;
    projectId?: string;
    designItemId?: string;
    notes?: string;
    price?: { amount: number; currency: string; formatted?: string; confidence?: number };
    brand?: string;
    sku?: string;
    description?: string;
    dimensions?: { width: number; height: number; depth?: number; unit: string };
    materials?: string[];
    colors?: string[];
  };
}

export interface ClipSavedMessage extends BaseMessage {
  type: 'CLIP_SAVED';
  success: boolean;
  clipId?: string;
  error?: string;
}

export interface GetClipsMessage extends BaseMessage {
  type: 'GET_CLIPS';
  filter?: {
    projectId?: string;
    syncStatus?: string;
  };
}

export interface ClipsListMessage extends BaseMessage {
  type: 'CLIPS_LIST';
  clips: unknown[];
}

export interface ToggleClippingMessage extends BaseMessage {
  type: 'TOGGLE_CLIPPING' | 'TOGGLE_CLIPPING_MODE';
}

export interface ClippingToggledMessage extends BaseMessage {
  type: 'CLIPPING_TOGGLED';
  isActive: boolean;
}

export interface QuickClipMessage extends BaseMessage {
  type: 'QUICK_CLIP';
  imageUrl: string;
  projectId?: string;
}

export interface QuickClipFocusedMessage extends BaseMessage {
  type: 'QUICK_CLIP_FOCUSED';
}

export interface SyncStatusMessage extends BaseMessage {
  type: 'SYNC_STATUS';
  status: 'idle' | 'syncing' | 'error';
  pendingCount?: number;
  lastSyncTime?: number;
}

export interface GetSyncStatusMessage extends BaseMessage {
  type: 'GET_SYNC_STATUS';
}

export interface SyncStatusUpdateMessage extends BaseMessage {
  type: 'SYNC_STATUS_UPDATE';
  status: 'idle' | 'syncing' | 'error';
  synced?: number;
  failed?: number;
}

export interface SyncProgressMessage extends BaseMessage {
  type: 'SYNC_PROGRESS';
  synced: number;
  total: number;
}

export interface RequestSyncMessage extends BaseMessage {
  type: 'REQUEST_SYNC';
}

export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  code: string;
  message: string;
}

export type Message =
  | FetchImageMessage
  | ImageFetchedMessage
  | SaveClipMessage
  | SaveDetailedClipMessage
  | ClipSavedMessage
  | GetClipsMessage
  | ClipsListMessage
  | ToggleClippingMessage
  | ClippingToggledMessage
  | QuickClipMessage
  | QuickClipFocusedMessage
  | SyncStatusMessage
  | GetSyncStatusMessage
  | SyncStatusUpdateMessage
  | SyncProgressMessage
  | RequestSyncMessage
  | ErrorMessage;

export type MessageResponse<T extends Message> =
  T extends FetchImageMessage ? ImageFetchedMessage :
  T extends SaveClipMessage ? ClipSavedMessage :
  T extends SaveDetailedClipMessage ? ClipSavedMessage :
  T extends GetClipsMessage ? ClipsListMessage :
  T extends ToggleClippingMessage ? ClippingToggledMessage :
  T extends QuickClipFocusedMessage ? { success: boolean; imageUrl?: string } :
  T extends GetSyncStatusMessage ? { status: string; pendingCount: number; lastSync: string | null; error?: string } :
  void;
