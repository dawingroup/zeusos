/**
 * design-system/no-raw-palette
 *
 * Flag raw Tailwind palette utilities (text-gray-700, bg-blue-50, border-rose-200, …)
 * in className strings and in calls to cn() / clsx() / classNames() / twMerge().
 *
 * Why: ZeusOS styling tech spec §18 ("Anti-Patterns") bans hardcoded palette
 * utilities because they break dark mode, accent swap, and the rebrand. Use
 * token classes instead (text-foreground, text-muted-foreground, bg-card,
 * bg-background, border-input, …) — see docs/STYLING.md.
 *
 * Scope: bare palette utilities of the form
 *   {prefix}-{palette}-{shade}[/opacity]
 * where prefix ∈ {text, bg, border, ring, divide, from, to, via, placeholder,
 *                  caret, fill, stroke, outline, decoration, shadow, accent}
 *       palette ∈ {gray, slate, zinc, neutral, stone, red, orange, amber,
 *                  yellow, lime, green, emerald, teal, cyan, sky, blue,
 *                  indigo, violet, purple, fuchsia, pink, rose}
 *       shade   ∈ 2- or 3-digit number
 *
 * Variant prefixes (hover:, md:, dark:, !) are tolerated — the match floats.
 * Token classes (bg-card, text-foreground, border-input, bg-primary/90) are
 * NOT matched because they have no numeric shade.
 */

const PALETTE_RE = /(?:^|[\s:!])((?:text|bg|border|ring|divide|from|to|via|placeholder|caret|fill|stroke|outline|decoration|shadow|accent)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?)\b/;

function suggestionFor(util) {
  // util like "text-gray-700" or "hover:bg-blue-50"
  const bare = util.replace(/^[\w-]+:/, '');
  const [prefix, palette] = bare.split('-');
  const tips = {
    text: { gray: 'text-foreground / text-muted-foreground / text-[var(--fg-tertiary)]' },
    bg: {
      gray: 'bg-card / bg-background / bg-[var(--bg-sunken)]',
      white: 'bg-card',
      blue: '.rag.blue or bg-[var(--accent-soft)]',
      red: '.rag.red or bg-destructive/10',
      green: '.rag.green',
      amber: '.rag.amber',
    },
    border: { gray: 'border-input / border-[var(--border-subtle)]' },
  };
  return (tips[prefix] && tips[prefix][palette]) || 'a token class — see docs/STYLING.md';
}

function checkString(value, node, context) {
  if (typeof value !== 'string') return;
  let m;
  const seen = new Set();
  // Iterate all matches (className can carry several palette utils)
  const re = new RegExp(PALETTE_RE.source, 'g');
  while ((m = re.exec(value)) !== null) {
    const util = m[1];
    if (seen.has(util)) continue;
    seen.add(util);
    context.report({
      node,
      message: `Raw palette utility "${util}" — replace with ${suggestionFor(util)} (see docs/STYLING.md §18).`,
    });
  }
}

const CN_LIKE = new Set(['cn', 'clsx', 'classNames', 'twMerge', 'tw', 'cva']);

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw Tailwind palette utilities (text-gray-*, bg-blue-*, etc.) — use design tokens instead.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== 'className') return;
        if (!node.value) return;
        if (node.value.type === 'Literal') {
          checkString(node.value.value, node, context);
          return;
        }
        if (node.value.type === 'JSXExpressionContainer') {
          const expr = node.value.expression;
          if (expr.type === 'Literal') {
            checkString(expr.value, node, context);
          } else if (expr.type === 'TemplateLiteral') {
            expr.quasis.forEach((q) => checkString(q.value.cooked, node, context));
          }
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        const name =
          callee.type === 'Identifier'
            ? callee.name
            : callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
              ? callee.property.name
              : null;
        if (!name || !CN_LIKE.has(name)) return;
        node.arguments.forEach((arg) => {
          if (arg.type === 'Literal') checkString(arg.value, arg, context);
          if (arg.type === 'TemplateLiteral') {
            arg.quasis.forEach((q) => checkString(q.value.cooked, arg, context));
          }
        });
      },
    };
  },
};
