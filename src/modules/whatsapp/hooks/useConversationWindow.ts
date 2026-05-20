/**
 * Hook: Track the 24-hour WhatsApp messaging window
 * Reactively updates when the window state changes
 */

import { useState, useEffect } from 'react';
import type { WhatsAppConversation, WindowState } from '../types';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const UPDATE_INTERVAL_MS = 30_000; // Update every 30 seconds

export function useConversationWindow(conversation: WhatsAppConversation | null): WindowState {
  const [windowState, setWindowState] = useState<WindowState>({
    isOpen: false,
    expiresAt: null,
    timeRemainingMs: 0,
    isExpiringSoon: false,
  });

  useEffect(() => {
    if (!conversation?.windowExpiresAt) {
      setWindowState({
        isOpen: false,
        expiresAt: null,
        timeRemainingMs: 0,
        isExpiringSoon: false,
      });
      return;
    }

    function computeState(): WindowState {
      const expiresAt = typeof conversation!.windowExpiresAt!.toDate === 'function'
        ? conversation!.windowExpiresAt!.toDate()
        : new Date(conversation!.windowExpiresAt as unknown as string);

      const now = new Date();
      const timeRemainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
      const isOpen = timeRemainingMs > 0;
      const isExpiringSoon = isOpen && timeRemainingMs < TWO_HOURS_MS;

      return { isOpen, expiresAt, timeRemainingMs, isExpiringSoon };
    }

    // Initial computation
    setWindowState(computeState());

    // Periodic update
    const interval = setInterval(() => {
      const state = computeState();
      setWindowState(state);

      // Stop interval if window has closed
      if (!state.isOpen) {
        clearInterval(interval);
      }
    }, UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [conversation?.windowExpiresAt]);

  return windowState;
}
