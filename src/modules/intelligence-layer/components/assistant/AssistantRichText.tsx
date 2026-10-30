/**
 * AssistantRichText
 *
 * Lightweight markdown-ish renderer shared by the rail and the full-page
 * assistant. Ported from the portal design handoff
 * (reference-src/ai-assistant-format.jsx) to TSX. Converts a markdown-ish
 * string into safe HTML: headings, bold/italic/inline code, ordered +
 * unordered lists, blockquotes, links and pipe tables.
 *
 * Everything is HTML-escaped before inline spans are applied, so model output
 * is rendered as text — no raw HTML injection from the response.
 */

// Quotes too: a link's URL lands inside href="…", and model output can carry
// prompt-injected text. Without &quot; a URL like `https://x"onmouseover="…`
// closed the attribute and added a script handler
// (docs/PROMPT_INJECTION_AUDIT_2026_10.md #2).
function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Inline spans — order matters: code first (protect its contents), then bold,
// then italic, then links.
function inline(s: string): string {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, '<code class="ai-rich-code">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Only allow http(s)/mailto/relative hrefs — blocks javascript:/data: URIs
  // that could slip in via prompt-injected model output. esc() has already
  // escaped quotes and angle brackets, so the URL cannot leave the attribute.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => {
    const safe = /^(https?:|mailto:|\/|#)/i.test(url) ? url : '#';
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  return out;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

const isSep = (l: string | undefined): boolean =>
  !!l && /-/.test(l) && /^\s*\|?[\s:|-]+\|?\s*$/.test(l);

export function renderRich(md: string | undefined | null): string {
  if (!md) return '';
  const lines = String(md).replace(/\r/g, '').split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // Table (header row + separator row + body rows)
    if (line.includes('|') && isSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      html +=
        '<table class="ai-rich-table"><thead><tr>' +
        head.map((h) => `<th>${inline(h)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rows
          .map(
            (r) =>
              '<tr>' +
              head.map((_, ci) => `<td>${inline(r[ci] || '')}</td>`).join('') +
              '</tr>',
          )
          .join('') +
        '</tbody></table>';
      continue;
    }

    // Heading (#, ##, ###)
    const hm = line.match(/^(#{1,3})\s+(.*)$/);
    if (hm) {
      const lvl = hm[1].length === 3 ? 5 : 4;
      html += `<h${lvl} class="ai-rich-h">${inline(hm[2])}</h${lvl}>`;
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html += `<blockquote class="ai-rich-quote">${inline(buf.join(' '))}</blockquote>`;
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      html +=
        '<ol class="ai-rich-ol">' +
        buf.map((b) => `<li>${inline(b)}</li>`).join('') +
        '</ol>';
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      html +=
        '<ul class="ai-rich-ul">' +
        buf.map((b) => `<li>${inline(b)}</li>`).join('') +
        '</ul>';
      continue;
    }

    // Paragraph — gather until a blank line or a block starter
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|>\s?|\d+\.\s|[-*]\s)/.test(lines[i]) &&
      !(lines[i].includes('|') && isSep(lines[i + 1]))
    ) {
      buf.push(lines[i]);
      i++;
    }
    html += `<p>${buf.map(inline).join('<br>')}</p>`;
  }
  return html;
}

interface AssistantRichTextProps {
  text: string;
  className?: string;
}

export function AssistantRichText({ text, className }: AssistantRichTextProps) {
  return (
    <div
      className={'ai-rich' + (className ? ' ' + className : '')}
      // Content is HTML-escaped in renderRich before any markup is applied.
      dangerouslySetInnerHTML={{ __html: renderRich(text) }}
    />
  );
}

export default AssistantRichText;
