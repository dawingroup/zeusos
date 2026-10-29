/**
 * Plain prose → render blocks, shared by the screen body and the PDF so the
 * two cannot drift. Authors write in a textarea. Paragraphs split on blank
 * lines; a run of lines starting with `- `, `* ` or `1. ` becomes a list; a
 * line starting with `## ` becomes a sub-heading. Nothing else is interpreted
 * — no HTML, no markdown emphasis — because @react-pdf cannot render HTML and
 * a memo is a formal document.
 */

import type { MemoSection } from '../types/memo';

export type ProseBlock =
  | { kind: 'para'; text: string }
  | { kind: 'sub'; text: string }
  | { kind: 'list'; items: string[]; ordered: boolean };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const SUBHEAD = /^\s*#{1,3}\s+(.*)$/;

export function proseToBlocks(text: string | undefined | null): ProseBlock[] {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: ProseBlock[] = [];
  let para: string[] = [];
  let list: { items: string[]; ordered: boolean } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: 'para', text: para.join(' ').replace(/\s+/g, ' ').trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ kind: 'list', ...list });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    const sub = line.match(SUBHEAD);
    if (sub) { flushPara(); flushList(); blocks.push({ kind: 'sub', text: sub[1].trim() }); continue; }
    const bullet = line.match(BULLET);
    const numbered = bullet ? null : line.match(NUMBERED);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      const item = (bullet ?? numbered)![1].trim();
      if (!list || list.ordered !== ordered) { flushList(); list = { items: [], ordered }; }
      list.items.push(item);
      continue;
    }
    if (list && /^\s{2,}/.test(raw)) { list.items[list.items.length - 1] += ` ${line.trim()}`; continue; }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

/** The memo body as plain text, for search and AI context. */
export function sectionsToPlainText(sections: MemoSection[]): string {
  return sections
    .filter((s) => s.enabled && s.content.trim())
    .map((s) => `${s.heading.toUpperCase()}\n${s.content.trim()}`)
    .join('\n\n');
}

/** Rough word count of the enabled sections, for the editor's length hint. */
export function memoWordCount(sections: MemoSection[]): number {
  return sectionsToPlainText(sections).split(/\s+/).filter(Boolean).length;
}
