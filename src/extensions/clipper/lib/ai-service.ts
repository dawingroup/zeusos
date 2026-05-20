/**
 * AI Analysis Service
 *
 * Delegates analysis to the Cloud Function via service worker.
 * The actual Gemini-powered analysis runs server-side (analyzeNewClip trigger
 * for new clips, analyzeClip onCall for re-analysis). Results are polled
 * by the service worker and synced back to chrome.storage.local.
 */

class AIService {
  /**
   * Trigger AI analysis for a clip via the service worker.
   * The service worker will call the Cloud Function and poll for results.
   */
  async analyzeClip(clipId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'TRIGGER_ANALYSIS',
        clipId,
      });
      return result || { success: false, error: 'No response from service worker' };
    } catch (error) {
      console.error('AI analysis request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch analyze multiple clips
   */
  async analyzeMultiple(clipIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    for (const clipId of clipIds) {
      const result = await this.analyzeClip(clipId);
      results.set(clipId, result.success);
    }
    return results;
  }
}

export const aiService = new AIService();
