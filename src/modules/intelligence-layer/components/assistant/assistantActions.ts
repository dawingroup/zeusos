/**
 * Splitting a model answer into prose + proposed actions. Pure.
 *
 * The answer is model output and can carry prompt-injected text, so a block that
 * does not parse into the exact shape stays visible as text rather than becoming
 * something a person could run.
 */
export interface ProposedAction {
  agentId: string;
  toolId: string;
  summary: string;
  input: Record<string, unknown>;
}

const ACTION_BLOCK_RE = /```action\s*\n([\s\S]*?)\n?```/g;

export function extractActions(raw: string): { displayText: string; actions: ProposedAction[] } {
  const actions: ProposedAction[] = [];
  const displayText = (raw || '').replace(ACTION_BLOCK_RE, (match, json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (
        parsed &&
        typeof parsed.agentId === 'string' &&
        typeof parsed.toolId === 'string' &&
        typeof parsed.summary === 'string' &&
        typeof parsed.input === 'object' &&
        parsed.input !== null &&
        !Array.isArray(parsed.input)
      ) {
        actions.push({ agentId: parsed.agentId, toolId: parsed.toolId, summary: parsed.summary, input: parsed.input });
        return '';
      }
      return match;
    } catch {
      return match;
    }
  });
  return { displayText: displayText.replace(/\n{3,}/g, '\n\n').trim(), actions };
}

/** A thread's title, from its first message. */
export function deriveTitle(text: string): string {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  const words = t.split(' ').slice(0, 8).join(' ');
  return words.length < t.length ? `${words}…` : words;
}
