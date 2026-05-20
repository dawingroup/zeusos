/**
 * SessionManager - Manages multi-clip workflows
 */

import type { ClipSessionData, SessionClip } from '../types/clip';
import type { ExtractedMetadata } from '../types/database';
import { imageCaptureService } from './image-capture';
import { clipService } from './clip-service';

const SESSION_STORAGE_KEY = 'clipperSession';

class SessionManager {
  private currentSession: ClipSessionData | null = null;
  private listeners: ((session: ClipSessionData | null) => void)[] = [];

  /**
   * Start a new clipping session
   */
  async startSession(projectId?: string): Promise<ClipSessionData> {
    // End any existing session
    if (this.currentSession && this.currentSession.clips.length > 0) {
      await this.endSession();
    }

    this.currentSession = {
      id: `session_${Date.now()}`,
      clips: [],
      projectId,
      startedAt: new Date(),
      lastUpdated: new Date(),
    };

    await this.persistSession();
    this.notifyListeners();

    return this.currentSession;
  }

  /**
   * Get current session
   */
  getSession(): ClipSessionData | null {
    return this.currentSession;
  }

  /**
   * Add image to current session
   */
  async addToSession(
    imageUrl: string,
    metadata: ExtractedMetadata = {}
  ): Promise<SessionClip> {
    if (!this.currentSession) {
      await this.startSession();
    }

    const clipId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const sessionClip: SessionClip = {
      id: clipId,
      imageUrl,
      metadata,
      status: 'capturing',
    };

    this.currentSession!.clips.push(sessionClip);
    this.currentSession!.lastUpdated = new Date();
    await this.persistSession();
    this.notifyListeners();

    // Capture thumbnail in background
    try {
      const result = await imageCaptureService.capture(imageUrl);
      const thumbnailDataUrl = await this.blobToDataUrl(result.thumbnailBlob);

      sessionClip.thumbnailDataUrl = thumbnailDataUrl;
      sessionClip.status = 'ready';
    } catch (error) {
      sessionClip.status = 'error';
      sessionClip.error = error instanceof Error ? error.message : 'Unknown error';
    }

    await this.persistSession();
    this.notifyListeners();

    return sessionClip;
  }

  /**
   * Remove clip from session
   */
  async removeFromSession(clipId: string): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.clips = this.currentSession.clips.filter(
      (c) => c.id !== clipId
    );
    this.currentSession.lastUpdated = new Date();

    await this.persistSession();
    this.notifyListeners();
  }

  /**
   * Update clip metadata in session
   */
  async updateSessionClip(
    clipId: string,
    updates: Partial<SessionClip>
  ): Promise<void> {
    if (!this.currentSession) return;

    const clip = this.currentSession.clips.find((c) => c.id === clipId);
    if (clip) {
      Object.assign(clip, updates);
      this.currentSession.lastUpdated = new Date();
      await this.persistSession();
      this.notifyListeners();
    }
  }

  /**
   * Finalize session - save all clips to IndexedDB
   */
  async finalizeSession(): Promise<string[]> {
    if (!this.currentSession) return [];

    const savedIds: string[] = [];
    const sourceUrl = window.location?.href || '';

    for (const sessionClip of this.currentSession.clips) {
      if (sessionClip.status !== 'ready') continue;

      try {
        const clip = await clipService.createClip(
          sessionClip.imageUrl,
          sourceUrl,
          sessionClip.metadata
        );

        // Assign to project if set
        if (this.currentSession.projectId) {
          await clipService.assignToProject(clip.id, this.currentSession.projectId);
        }

        savedIds.push(clip.id);
      } catch (error) {
        console.error('Failed to save session clip:', error);
      }
    }

    await this.endSession();
    return savedIds;
  }

  /**
   * End session without saving
   */
  async endSession(): Promise<void> {
    this.currentSession = null;
    await chrome.storage.local.remove([SESSION_STORAGE_KEY]);
    this.notifyListeners();
  }

  /**
   * Restore session from storage
   */
  async restoreSession(): Promise<ClipSessionData | null> {
    try {
      const result = await chrome.storage.local.get([SESSION_STORAGE_KEY]);
      if (result[SESSION_STORAGE_KEY]) {
        this.currentSession = result[SESSION_STORAGE_KEY];
        // Convert date strings back to Date objects
        if (this.currentSession) {
          this.currentSession.startedAt = new Date(this.currentSession.startedAt);
          this.currentSession.lastUpdated = new Date(this.currentSession.lastUpdated);
        }
        this.notifyListeners();
        return this.currentSession;
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }
    return null;
  }

  /**
   * Set project for current session
   */
  async setSessionProject(projectId: string): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.projectId = projectId;
    this.currentSession.lastUpdated = new Date();
    await this.persistSession();
    this.notifyListeners();
  }

  /**
   * Get session clip count
   */
  getClipCount(): number {
    return this.currentSession?.clips.length || 0;
  }

  /**
   * Get ready clip count
   */
  getReadyClipCount(): number {
    return this.currentSession?.clips.filter((c) => c.status === 'ready').length || 0;
  }

  /**
   * Subscribe to session changes
   */
  subscribe(listener: (session: ClipSessionData | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Persist session to chrome.storage
   */
  private async persistSession(): Promise<void> {
    if (this.currentSession) {
      await chrome.storage.local.set({
        [SESSION_STORAGE_KEY]: this.currentSession,
      });
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentSession);
      } catch (error) {
        console.error('Session listener error:', error);
      }
    }
  }

  /**
   * Convert blob to data URL
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const sessionManager = new SessionManager();
