/**
 * Part Learning Service
 *
 * Retrieves past confirmed part identifications from Firestore
 * for use as RAG examples in future AI recognition calls.
 * Enables continuous improvement of part naming accuracy.
 */

import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { PastIdentification } from '../types/ai-recognition.types';
import type { GeometrySummary } from '../types/ai-recognition.types';

const COLLECTION = 'part_identifications';

/**
 * Retrieve past identifications similar to the given geometry summaries.
 * Uses dimension similarity (±20%) to find relevant examples.
 */
export async function retrieveSimilarParts(
  summaries: GeometrySummary[],
  maxResults = 15,
): Promise<PastIdentification[]> {
  try {
    // Fetch recent confirmed identifications (ordered by most recent)
    const q = query(
      collection(db, COLLECTION),
      orderBy('confirmedAt', 'desc'),
      limit(200), // fetch a pool to filter from
    );
    const snap = await getDocs(q);

    if (snap.empty) return [];

    const allPast: PastIdentification[] = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      confirmedAt: d.data().confirmedAt?.toDate?.() || new Date(),
    })) as PastIdentification[];

    // Score each past identification against current geometry
    const scored: { past: PastIdentification; score: number }[] = [];
    for (const past of allPast) {
      let bestScore = 0;
      for (const summary of summaries) {
        const score = computeSimilarity(summary, past);
        bestScore = Math.max(bestScore, score);
      }
      if (bestScore > 0.3) {
        scored.push({ past, score: bestScore });
      }
    }

    // Return top matches sorted by relevance
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map(s => s.past);
  } catch (err) {
    console.warn('Failed to retrieve learning examples:', err);
    return [];
  }
}

/**
 * Compute similarity between a geometry summary and a past identification.
 * Returns 0–1 score based on dimension similarity and name patterns.
 */
function computeSimilarity(
  summary: GeometrySummary,
  past: PastIdentification,
): number {
  // Dimension similarity (±20%)
  const sDims = [summary.dims.w, summary.dims.d, summary.dims.h].sort((a, b) => b - a);
  const pDims = [past.dims.w, past.dims.d, past.dims.h].sort((a, b) => b - a);

  let dimScore = 0;
  for (let i = 0; i < 3; i++) {
    if (sDims[i] === 0 && pDims[i] === 0) {
      dimScore += 1;
    } else if (sDims[i] === 0 || pDims[i] === 0) {
      dimScore += 0;
    } else {
      const ratio = Math.min(sDims[i], pDims[i]) / Math.max(sDims[i], pDims[i]);
      dimScore += ratio;
    }
  }
  dimScore /= 3;

  // Name pattern similarity (basic substring match)
  const nameScore = summary.partName.toLowerCase().includes(past.originalName.split(' ')[0].toLowerCase())
    ? 0.3 : 0;

  // Material match bonus
  const matScore = summary.material && past.material &&
    summary.material.toLowerCase() === past.material.toLowerCase()
    ? 0.2 : 0;

  return dimScore * 0.5 + nameScore + matScore;
}

/**
 * Build RAG context string from past identifications for the AI prompt.
 */
export async function buildRAGContext(
  summaries: GeometrySummary[],
): Promise<PastIdentification[]> {
  return retrieveSimilarParts(summaries, 10);
}
