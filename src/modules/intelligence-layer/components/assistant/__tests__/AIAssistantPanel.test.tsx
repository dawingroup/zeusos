/**
 * The assistant panel. What must hold:
 *  - the backend is the sole writer of messages;
 *  - a proposed action runs only from a click on Confirm, with its real inputs on
 *    screen first;
 *  - a chip from a past thread is shown and cannot run;
 *  - a failed turn says why, and its words never go back to the model as history;
 *  - cross-module mode is the default, and the mode picks the callable.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

const h = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; payload: Record<string, unknown> }>,
  responses: {} as Record<string, unknown>,
  conv: { current: {} as Record<string, unknown> },
  addMessage: vi.fn(),
  title: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_f: unknown, name: string) => async (payload: Record<string, unknown>) => {
    h.calls.push({ name, payload });
    const r = h.responses[name];
    if (r instanceof Error) throw r;
    return { data: r };
  },
}));
vi.mock('@/core/services/firebase/config', () => ({ app: {} }));
vi.mock('@/shared/services/firebase', () => ({ functions: {} }));
vi.mock('@/shared/hooks', () => ({ useAuth: () => ({ user: { uid: 'me' } }) }));
vi.mock('@/shared/hooks/useAIMemory', () => ({ useAIConversation: () => h.conv.current }));
vi.mock('@/shared/services/ai/aiMemory.service', () => ({ updateConversationTitle: h.title }));

import { AIAssistantPanel } from '../AIAssistantPanel';

const ACTION = '```action\n{"agentId":"ZA-002","toolId":"write.create_task","summary":"Chase the invoice","input":{"title":"Chase INV-9","priority":"P1"}}\n```';

const setConv = (over: Record<string, unknown> = {}) => {
  h.conv.current = {
    messages: [],
    isLoading: false,
    startNew: vi.fn().mockResolvedValue(undefined),
    conversationId: 'c1',
    recentConversations: [],
    loadConversation: vi.fn(),
    refreshRecent: vi.fn().mockResolvedValue(undefined),
    addMessage: h.addMessage,
    ...over,
  };
};

const ask = (text: string) => {
  const box = screen.getByRole('textbox', { name: 'Message the assistant' });
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: 'Enter' });
};

const panel = () => render(<AIAssistantPanel open onClose={() => {}} />);

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.responses = {
    crossModuleIntelligence: { response: 'From the data.', conversationId: 'c1' },
    assistantChat: { response: 'From the chat.', conversationId: 'c1' },
    agentExecuteTool: { ok: true, summary: 'Drafted task' },
  };
  setConv();
});

describe('a turn', () => {
  it('goes to cross-module by default, and the backend alone writes the messages', async () => {
    panel();
    ask('How is the pipeline?');
    expect(await screen.findByText('From the data.')).toBeInTheDocument();
    expect(h.calls[0].name).toBe('crossModuleIntelligence');
    expect(h.calls[0].payload).toMatchObject({ message: 'How is the pipeline?', conversationId: 'c1', companyId: 'zeus-group' });
    expect(h.addMessage).not.toHaveBeenCalled();
  });

  it('routes by mode', async () => {
    panel();
    fireEvent.change(screen.getByRole('combobox', { name: 'Assistant mode' }), { target: { value: 'general' } });
    ask('Hi');
    expect(await screen.findByText('From the chat.')).toBeInTheDocument();
    expect(h.calls[0].name).toBe('assistantChat');
  });

  it('names the thread after its first message only', async () => {
    panel();
    ask('How is the pipeline?');
    await screen.findByText('From the data.');
    expect(h.title).toHaveBeenCalledWith('c1', 'How is the pipeline?');
    ask('And deals?');
    await waitFor(() => expect(h.calls).toHaveLength(2));
    expect(h.title).toHaveBeenCalledTimes(1);
  });

  it('says why a turn failed, and never sends that back as history', async () => {
    h.responses.crossModuleIntelligence = Object.assign(new Error('nope'), { code: 'functions/permission-denied' });
    panel();
    ask('First');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBeTruthy();
    h.responses.crossModuleIntelligence = { response: 'Fine now.', conversationId: 'c1' };
    ask('Second');
    await screen.findByText('Fine now.');
    const history = h.calls[1].payload.conversationHistory as Array<{ role: string }>;
    expect(history.map((m) => m.role)).toEqual(['user']);
  });
});

describe('a proposed action', () => {
  it('shows its real inputs and runs only on Confirm', async () => {
    h.responses.crossModuleIntelligence = { response: `Here.\n${ACTION}`, conversationId: 'c1' };
    panel();
    ask('Make a task');
    const inputs = await screen.findByLabelText('Action inputs');
    expect(within(inputs).getByText('Chase INV-9')).toBeInTheDocument();
    expect(h.calls.map((c) => c.name)).toEqual(['crossModuleIntelligence']);

    fireEvent.click(screen.getByRole('button', { name: /Confirm & run/ }));
    await screen.findByText('Drafted task');
    expect(h.calls[1]).toEqual({
      name: 'agentExecuteTool',
      payload: { agentId: 'ZA-002', toolId: 'write.create_task', input: { title: 'Chase INV-9', priority: 'P1' } },
    });
  });

  it('a failed run says why and offers a retry', async () => {
    h.responses.crossModuleIntelligence = { response: ACTION, conversationId: 'c1' };
    h.responses.agentExecuteTool = Object.assign(new Error('x'), { code: 'functions/permission-denied' });
    panel();
    ask('Make a task');
    fireEvent.click(await screen.findByRole('button', { name: /Confirm & run/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });

  it('from a past thread is shown and cannot run', async () => {
    setConv({ messages: [{ id: 'm1', role: 'assistant', content: `Earlier.\n${ACTION}` }] });
    panel();
    expect(await screen.findByText('Proposed earlier')).toBeInTheDocument();
    expect(screen.getByText('Chase INV-9')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm/ })).toBeNull();
  });
});

describe('threads', () => {
  it('lists past conversations and opens one', () => {
    const c = h.conv.current;
    setConv({ recentConversations: [{ id: 'c2', title: 'Pipeline review' }], loadConversation: vi.fn() });
    void c;
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Past conversations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pipeline review' }));
    expect((h.conv.current.loadConversation as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('c2');
  });

  it('a live update during a turn does not clobber the screen', async () => {
    setConv({ messages: [{ id: 'm1', role: 'user', content: 'Old question' }] });
    const { rerender } = panel();
    expect(screen.getByText('Old question')).toBeInTheDocument();
    h.conv.current = { ...h.conv.current, messages: [{ id: 'm1', role: 'user', content: 'Rewritten' }] };
    rerender(<AIAssistantPanel open onClose={() => {}} />);
    expect(screen.getByText('Old question')).toBeInTheDocument();
  });
});
