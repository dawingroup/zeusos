/**
 * design-system/no-inline-style-literals
 *
 * Flag inline color and font-size literals inside JSX style={{ … }} props.
 *
 * Why: ZeusOS styling tech spec §18 anti-patterns 1 + 2 ban hardcoded colors
 * (e.g. style={{ color: '#1976d2' }}) and inline px font-sizes
 * (e.g. style={{ fontSize: 14 }}) — they bypass the token system, break dark
 * mode, and skip the accent rebrand.
 *
 * What's flagged:
 *   - style={{ color: '#abc' | '#abcdef' | '#abcdef00' }}   (any hex literal)
 *   - style={{ background[Color] | border…Color | fill | stroke | outlineColor: '#…' }}
 *   - style={{ fontSize: <number> | '14px' | '0.875rem'? }} (px/numeric only; rem allowed for now)
 *
 * What's NOT flagged:
 *   - style={{ color: someVar }}                            (dynamic — can't statically check)
 *   - style={{ color: 'var(--accent)' }}                    (already a token ref)
 *   - style={{ color: 'red' | 'currentColor' | 'inherit' }} (named keywords)
 *   - className-based styling                               (other rule handles palette utils)
 */

const COLOR_KEYS = new Set([
  'color',
  'background',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'fill',
  'stroke',
  'outlineColor',
  'caretColor',
  'columnRuleColor',
]);

const SIZE_KEYS = new Set(['fontSize']);

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const NUMERIC_PX_RE = /^\d+(\.\d+)?(px)?$/;

function isHex(v) {
  return typeof v === 'string' && HEX_RE.test(v.trim());
}

function isPxOrUnitlessNumber(v) {
  if (typeof v === 'number') return true;
  if (typeof v === 'string' && NUMERIC_PX_RE.test(v.trim())) return true;
  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded hex colors and px font-size literals in JSX style={{}} props — use CSS variables or token classes instead.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== 'style') return;
        if (!node.value || node.value.type !== 'JSXExpressionContainer') return;
        const expr = node.value.expression;
        if (expr.type !== 'ObjectExpression') return;

        expr.properties.forEach((p) => {
          if (p.type !== 'Property' || !p.key) return;
          if (p.value.type !== 'Literal') return;
          const key = p.key.name || p.key.value;
          if (!key) return;

          if (COLOR_KEYS.has(key) && isHex(p.value.value)) {
            context.report({
              node: p,
              message: `Inline hex color "${p.value.value}" in style.${key} — use a CSS var (e.g. var(--accent)) or token class instead (see docs/STYLING.md §18).`,
            });
          }
          if (SIZE_KEYS.has(key) && isPxOrUnitlessNumber(p.value.value)) {
            context.report({
              node: p,
              message: `Inline font-size literal in style.${key} — use the type scale (text-h1..tiny) or var(--text-*) instead (see docs/STYLING.md §2.2).`,
            });
          }
        });
      },
    };
  },
};
