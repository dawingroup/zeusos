import { describe, expect, it } from 'vitest';
import { deriveTitle, extractActions } from '../assistantActions';

const block = (json: string) => ['Here you go.', '```action', json, '```'].join('\n');

describe('extractActions', () => {
  it('splits prose from a well-formed proposal', () => {
    const { displayText, actions } = extractActions(block('{"agentId":"ZA-002","toolId":"write.create_task","summary":"Chase it","input":{"title":"t"}}'));
    expect(displayText).toBe('Here you go.');
    expect(actions).toEqual([{ agentId: 'ZA-002', toolId: 'write.create_task', summary: 'Chase it', input: { title: 't' } }]);
  });

  it('keeps only the known fields of a proposal', () => {
    const { actions } = extractActions(block('{"agentId":"a","toolId":"b","summary":"c","input":{},"auto":true}'));
    expect(actions[0]).toEqual({ agentId: 'a', toolId: 'b', summary: 'c', input: {} });
  });

  it.each([
    ['broken JSON', '{not json'],
    ['a missing summary', '{"agentId":"a","toolId":"b","input":{}}'],
    ['an array input', '{"agentId":"a","toolId":"b","summary":"c","input":[]}'],
    ['a null input', '{"agentId":"a","toolId":"b","summary":"c","input":null}'],
  ])('leaves %s visible instead of making it runnable', (_name, json) => {
    const { displayText, actions } = extractActions(block(json));
    expect(actions).toEqual([]);
    expect(displayText).toContain(json);
  });

  it('reads several proposals, and survives no text at all', () => {
    const one = '{"agentId":"a","toolId":"b","summary":"c","input":{}}';
    expect(extractActions(`${block(one)}\n${block(one)}`).actions).toHaveLength(2);
    expect(extractActions('')).toEqual({ displayText: '', actions: [] });
  });
});

describe('deriveTitle', () => {
  it('cuts at eight words and marks the cut', () => {
    expect(deriveTitle('one two three')).toBe('one two three');
    expect(deriveTitle('a b c d e f g h i j')).toBe('a b c d e f g h…');
  });
});
