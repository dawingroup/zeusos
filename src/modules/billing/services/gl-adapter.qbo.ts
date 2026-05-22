/**
 * QuickBooks Online GL adapter — skeleton.
 *
 * Phase 5 wires this against the real QBO API (existing
 * `dawinos-mcp-server/qboSyncService` integration is the eventual
 * landing zone). Until then `postJournal()` fails safe — it throws
 * "GL adapter QBO not configured" if the connection record on
 * `gl_connections/{orgId}` does not carry a configured QBO realm/token.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  GLAdapter,
  // (Type-only import to keep this file purely typed.)
} from './gl-adapter.service';
import type {
  GLAdapterName,
  GLConnectionConfig,
  GLConnectionHealth,
  GLJournalEntry,
  GLPostResult,
} from '../types/gl.types';
import { COLLECTIONS } from '../constants/collections';

interface QBOConnectionConfig {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt?: string;
}

function isConfigured(
  config?: Record<string, unknown>,
): config is QBOConnectionConfig & Record<string, unknown> {
  return (
    !!config &&
    typeof config.realmId === 'string' && config.realmId.length > 0 &&
    typeof config.accessToken === 'string' && config.accessToken.length > 0 &&
    typeof config.refreshToken === 'string' && config.refreshToken.length > 0
  );
}

class QBOGLAdapter implements GLAdapter {
  readonly name: GLAdapterName = 'qbo';

  async postJournal(entry: GLJournalEntry): Promise<GLPostResult> {
    const cfg = await this.readConnection(entry.entityOrgId);
    if (!isConfigured(cfg?.config)) {
      throw new Error(
        `[gl-adapter:qbo] not configured for org ${entry.entityOrgId} — ` +
          'set realmId/accessToken on gl_connections/{orgId}.config (Phase 5).',
      );
    }
    throw new Error(
      '[gl-adapter:qbo] postJournal not yet implemented — Phase 5 wires ' +
        'the QBO API client. Until then this adapter intentionally fails ' +
        'closed so postings are not silently lost.',
    );
  }

  async status(orgId: string): Promise<GLConnectionHealth> {
    const cfg = await this.readConnection(orgId);
    if (!cfg) {
      return {
        adapter: this.name,
        status: 'NOT_CONFIGURED',
        queueDepth: 0,
        message: 'No gl_connections document for this organisation.',
      };
    }
    if (!isConfigured(cfg.config)) {
      return {
        adapter: this.name,
        status: 'NOT_CONFIGURED',
        queueDepth: 0,
        message: 'QBO realmId/accessToken missing on connection config.',
      };
    }
    return {
      adapter: this.name,
      status: cfg.status ?? 'DISCONNECTED',
      lastSyncAt: cfg.lastSyncAt,
      queueDepth: cfg.queueDepth ?? 0,
      message: 'QBO adapter skeleton — postings disabled until Phase 5.',
    };
  }

  private async readConnection(orgId: string): Promise<GLConnectionConfig | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.GL_CONNECTIONS, orgId));
      if (!snap.exists()) return null;
      return snap.data() as GLConnectionConfig;
    } catch {
      return null;
    }
  }
}

export const qboGLAdapter = new QBOGLAdapter();
