/**
 * useAgents — subscribe to the `agents` registry with a seed fallback.
 *
 * Before the collection is populated, the admin surface shows the seeded
 * ZeusOS agents (read-only preview) so the UI is never empty. The first
 * admin save materialises the agent to Firestore.
 */
import { useEffect, useState } from 'react';
import { subscribeAgents } from '../services/agentService';
import { DEFAULT_AGENTS } from '../data/defaultAgents';
import type { Agent } from '../types/agent';

export interface UseAgentsResult {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  /** True when the list is the seeded fallback (collection still empty). */
  isSeedFallback: boolean;
}

export function useAgents(): UseAgentsResult {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeedFallback, setIsSeedFallback] = useState(false);

  useEffect(() => {
    const unsub = subscribeAgents(
      (live) => {
        setLoading(false);
        if (live.length === 0) {
          setAgents(DEFAULT_AGENTS);
          setIsSeedFallback(true);
        } else {
          setAgents(live);
          setIsSeedFallback(false);
        }
      },
      (e) => {
        setLoading(false);
        setError(e.message);
        // On a read error, still show the seed list so the surface renders.
        setAgents(DEFAULT_AGENTS);
        setIsSeedFallback(true);
      },
    );
    return unsub;
  }, []);

  return { agents, loading, error, isSeedFallback };
}
