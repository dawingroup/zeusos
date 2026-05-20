/**
 * Short labels for nesting / linear cut diagrams and Shop Traveler.
 * Design item code + part number, not the full procurement description.
 */
export function abbreviateForCutPattern(s: string, maxLen = 12): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function designItemTag(designItemCode: string | undefined, designItemName: string): string {
  const code = (designItemCode ?? '').trim();
  if (code && code.length <= 20) return code;
  // Prefer token like DF-2026-584 in a long name
  const m = designItemName.match(/\b([A-Z]{2,3}-\d{4}-\d{3,4})\b/);
  if (m) return m[1];
  return abbreviateForCutPattern(designItemName, 11);
}

export function formatOptimizationPanelLabel(part: {
  partNumber: string;
  name: string;
  designItemName: string;
  designItemCode?: string;
}): string {
  const num = (part.partNumber || '').trim();
  const item = designItemTag(part.designItemCode, part.designItemName);
  // Prefer stable part number; keep whole label ≤ ~28 chars for small nest cells.
  if (num && num.length <= 26 && !/\s/.test(num)) {
    return item ? `${item}·${num}` : num;
  }
  const nameShort = abbreviateForCutPattern((part.name || 'Part').split(' — ')[0]!.trim(), 20);
  return item ? `${item}·${nameShort}` : nameShort;
}
