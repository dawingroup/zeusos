/**
 * renderRich turns MODEL output into HTML for dangerouslySetInnerHTML, and model
 * output can carry prompt-injected text (a planted memory, a WhatsApp message
 * read back by a tool). Until 2026-10-29 esc() left `"` alone, so a link URL
 * could close its href and add an event handler
 * (a DawinOS audit finding, 2026-10). Parsed with the DOM, not
 * string-matched, so the test sees the attributes a browser would.
 */
import { describe, expect, it } from 'vitest';
import { renderRich } from '../AssistantRichText';

function parse(md: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderRich(md);
  return host;
}

function attributeNames(host: HTMLElement): string[] {
  return [...host.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.name));
}

describe('renderRich — model output cannot add markup', () => {
  it('a quote in a link URL stays inside href', () => {
    const host = parse(
      `[Open PO](https://x"onmouseover="location='javascript:alert%28document.domain%29')`,
    );
    const links = host.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(attributeNames(host).sort()).toEqual(['href', 'rel', 'target']);
    expect(links[0].getAttribute('href')).toContain('"onmouseover=');
  });

  it('a single quote in a link URL stays inside href', () => {
    const host = parse(`[x](https://x'onfocus='alert)`);
    expect(attributeNames(host).sort()).toEqual(['href', 'rel', 'target']);
  });

  it('quotes in table cells, code and plain text are text, not attributes', () => {
    const host = parse(
      [
        '| a | b |',
        '|---|---|',
        '| "x" onclick="y" | `\'z\'` |',
        '',
        'He said "hi" & <b>bye</b>',
      ].join('\n'),
    );
    expect(host.querySelector('b')).toBeNull();
    expect(attributeNames(host).every((n) => n === 'class')).toBe(true);
    expect(host.textContent).toContain('"x" onclick="y"');
    expect(host.textContent).toContain('He said "hi" & <b>bye</b>');
  });

  it('a javascript: link still becomes #', () => {
    const host = parse('[x](javascript:alert(1))');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('#');
  });
});
