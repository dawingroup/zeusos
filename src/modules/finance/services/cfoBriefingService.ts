// ============================================================================
// CFO BRIEFING SERVICE
// ZeusOS v2.0 — AI-powered daily briefings and scenario analysis
// ============================================================================

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/core/services/firebase/firestore';
import { functions } from '@/firebase/config';
import type {
  CFOBriefing,
  ScenarioInput,
  ScenarioResult,
} from '../types/optimizer.types';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function companyCol(companyId: string, colName: string) {
  return collection(db, 'companies', companyId, colName);
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class CFOBriefingService {

  // ══════════════════════════════════════════════════════════════════════════
  // BRIEFINGS
  // ══════════════════════════════════════════════════════════════════════════

  async getDailyBriefing(companyId: string, _date?: string): Promise<CFOBriefing | null> {
    const q = query(
      companyCol(companyId, 'cfo_briefings'),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as CFOBriefing;
  }

  async getBriefingHistory(companyId: string, count: number = 7): Promise<CFOBriefing[]> {
    const q = query(
      companyCol(companyId, 'cfo_briefings'),
      orderBy('generatedAt', 'desc'),
      limit(count)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CFOBriefing));
  }

  async generateBriefing(companyId: string): Promise<CFOBriefing> {
    const callable = httpsCallable(functions, 'generateCFOBriefing');
    const result = await callable({ companyId });
    return (result.data as { briefing: CFOBriefing }).briefing;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIOS
  // ══════════════════════════════════════════════════════════════════════════

  async runWhatIfScenario(
    companyId: string,
    scenario: ScenarioInput
  ): Promise<ScenarioResult> {
    const callable = httpsCallable(functions, 'runCashFlowScenario');
    const result = await callable({ companyId, scenario });
    return (result.data as { result: ScenarioResult }).result;
  }

  async getScenarioHistory(companyId: string, count: number = 10): Promise<ScenarioResult[]> {
    const q = query(
      companyCol(companyId, 'scenario_results'),
      orderBy('createdAt', 'desc'),
      limit(count)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), scenarioId: d.id } as unknown as ScenarioResult));
  }
}

export const cfoBriefingService = new CFOBriefingService();
