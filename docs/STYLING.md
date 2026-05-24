# ZeusOS — Styling, Tokens & Layout

**Status:** Source of truth for the ZeusOS portal design system.
**Owner:** Platform / Design Systems
**Stack:** Vite + React 18 + TypeScript + Tailwind CSS 3 + shadcn/ui (`new-york` style) + Radix UI + Lucide icons
**Last refreshed:** 2026-05-24 (Phase U.1 — UI alignment guard rails)

This doc is the Zeus-scoped mirror of the portal styling tech spec inherited
from DawinOS. The token system, primitives, and layout shells are the same;
the brand palette is Zeus.

> **For reviewers:** When commenting on a PR, cite this file by section
> number (e.g. "§18 anti-pattern 1 — use `text-muted-foreground`").

---

## TL;DR — what to use when

| Scenario | Use | File |
|---|---|---|
| Background of the app canvas | `bg-background` (= `--bg-app`) | n/a |
| Card / popover / dialog surface | `bg-card` (= `--bg-surface`) | n/a |
| Toolbar / hover surface | `bg-[var(--bg-sunken)]` | n/a |
| Body text | `text-foreground` | n/a |
| Subhead text | `text-muted-foreground` | n/a |
| Caption / meta text | `text-[var(--fg-tertiary)]` | n/a |
| Primary action | `<Button>` (default variant) | [src/shared/components/ui/button.tsx](../src/shared/components/ui/button.tsx) |
| Secondary action | `<Button variant="outline">` or `"secondary"` | same |
| Status: on-track / warning / off-track / info / n-a | `.rag` (`.green`, `.amber`, `.red`, `.blue`, `.na`) | [src/index.css](../src/index.css) |
| Neutral grouping tag | `.pill` | same |
| Dashboard KPI tile | `.kpi` inside `.grid-kpis` | same |
| Browsable KPI library card | `<KpiCard>` | [src/modules/strategy/components/kpi/KpiCard.tsx](../src/modules/strategy/components/kpi/KpiCard.tsx) |
| Generic data list with filters (mobile-aware) | `<ResponsiveTable>` | [src/shared/components/ui/ResponsiveTable.tsx](../src/shared/components/ui/ResponsiveTable.tsx) |
| Dashboard card (density-aware) | `.card` + `.card-head` + `.card-body` | [src/index.css](../src/index.css) |
| Grouped content (form panel, settings) | shadcn `<Card>` | [src/shared/components/ui/card.tsx](../src/shared/components/ui/card.tsx) |
| Section break inside a long page | `.section-h` | [src/index.css](../src/index.css) |
| Activity / decisions / todos list | `.list-row` inside `.card .card-body.tight` | same |
| Progress / utilisation bar | `.dawin-bar` (+ `.ok` / `.warn` / `.over`) | same |
| Numbers in a column | `.tabular` / `.font-mono` | same |
| Page chrome inside a module | `<ModuleTabNav>` + `<ModuleContentWrapper>` | [src/core/components/navigation/ModuleTabNav.tsx](../src/core/components/navigation/ModuleTabNav.tsx) |

---

## 1. Tokens are the source of truth

Every visible color, radius, shadow, space step, and font size resolves to a
CSS variable on `:root` in [src/index.css](../src/index.css). Tailwind
utilities (`bg-card`, `text-foreground`, `rounded-lg`, `shadow-card`) are thin
aliases — the bridge lives in [tailwind.config.js](../tailwind.config.js).

**Never hardcode in component code:**
- hex colors (`#1976d2`)
- px font sizes (`fontSize: 14`)
- Tailwind palette utilities (`text-gray-700`, `bg-blue-50`, `border-rose-200`)

The first two are caught by `design-system/no-inline-style-literals`; the
third by `design-system/no-raw-palette` (see §18). If you genuinely need a
new shade, propose it as a token here first, then add to `:root`.

### 1.1 Color tokens

| Group | Token | Purpose |
|---|---|---|
| Background | `--bg-app` | App canvas behind cards (warm neutral) |
| | `--bg-surface` | Cards, popovers, dialogs, table rows |
| | `--bg-sunken` | Toolbars, header strips, hover surfaces, disabled |
| | `--bg-sidebar` (`-hover`, `-active`) | Dark sidebar canvas (Zeus navy) |
| Foreground | `--fg-primary` | Body text, headings (Zeus navy on light) |
| | `--fg-secondary` | Subhead, label text |
| | `--fg-tertiary` | Captions, table micro-headers, meta |
| | `--fg-quaternary` | Separators in inline meta lists |
| | `--fg-on-dark` (`-muted`) | Text on `--bg-sidebar*` |
| Borders | `--border-subtle` / `-default` / `-strong` | Card edges, field outlines, hover outlines |
| Brand (Zeus) | `--zeus-navy` (+ `-light` / `-dark` / `-50` / `-100`) | Primary brand |
| | `--zeus-red` (+ `-light` / `-dark` / `-50`) | Signature accent — `#TheZeusWay` underline |
| | `--zeus-the-agency` / `-digital` / `--labyrinth` / `--odd-gorilla` / `--house-of-zeus` | Sub-brand accents (chrome/chips) |
| Accent (themable) | `--accent` (default `--zeus-navy`) | Active link, focus ring, primary tint |
| | `--accent-soft` | Selected pill background, focus halo |
| | `--accent-fg` | Text/icon on solid accent fill |
| RAG (semantic) | `--rag-red` / `-amber` / `-green` / `-blue` / `-na` | Off-track / at-risk / on-track / info / N/A |
| | `--rag-{color}-soft` | Pill backgrounds (AA contrast against soft) |
| Cash-flow | `--cf-pos` / `--cf-neg` | Waterfall positive / negative bars |
| Chart | `--chart-1` … `--chart-5` (HSL triplets) | Recharts series palette |

**Legacy DawinOS tokens** (`--boysenberry`, `--golden-bell`, `--cashmere`,
`--pesto`, `--seafoam`, `--teal`) are kept as aliases pointing at the Zeus
palette so unmigrated consumers still render in brand. They'll be retired in
Phase 1.B once consumers move to the explicit `--zeus-*` names.

### 1.2 Typography tokens

```
--font-sans  : 'Outfit', system fallbacks
--font-mono  : 'JetBrains Mono', system fallbacks

--text-h1    : 26px   /* Page hero */
--text-h2    : 19px   /* Module title row */
--text-h3    : 13px   /* SECTION HEADER (uppercase, tracked) */
--text-body  : 14px   /* Default */
--text-small : 12.5px /* Subtitles, tab labels */
--text-tiny  : 11px   /* Caption, badge, table meta */
```

Base rules (auto-applied by `@layer base`):
- `html` 14px, `body` line-height 1.45, letter-spacing -0.005em
- `h1` 26 / 600 / 1.15
- `h2` 19 / 600 / 1.2
- `h3` 13 / 500 / **uppercase** / `0.08em` tracking / `--fg-tertiary`
- `h4` 14 / 600 / 1.4
- `label` 11.5 / 500 / `--fg-secondary`
- `button` Outfit 13 / 500
- `input / select / textarea` 13 / 1.45
- `.tabular` and `.font-mono` switch to JetBrains Mono with
  `font-variant-numeric: tabular-nums` — **mandatory for any column of
  numbers** so digits align.

Tailwind exposes the scale as `text-h1`, `text-h2`, `text-h3`, `text-body`,
`text-small`, `text-tiny`.

### 1.3 Spacing — 8px grid

`--space-1` (4px), `-2` (8), `-3` (12), `-4` (16), `-5` (20), `-6` (24), `-8` (32).

Use named tokens for layout-critical rhythm (card padding, section gaps) so
density variants take effect. Tailwind's native `1`–`8` scale is still
available for incidental spacing.

### 1.4 Density (runtime swap)

`[data-density="dense | balanced | airy"]` on `<html>` rewrites:

| | `--row-h` | `--pad-card` | `--pad-tight` |
|---|---|---|---|
| `dense` | 32 | 14 | 8 |
| `balanced` *(default)* | 40 | 20 | 12 |
| `airy` | 52 | 28 | 16 |

Any new vertical-rhythm-sensitive component must consume `--pad-card` /
`--row-h` rather than hard-coded values.

### 1.5 Radius, shadow, motion

```
--radius-sm : 6px    /* badges, input chips */
--radius    : 10px   /* cards, popovers, dialogs */
--radius-lg : 14px   /* modal envelopes, hero blocks */

--shadow-sm | -md | -lg

--transition-fast   : 150ms ease
--transition-normal : 200ms ease
--transition-slow   : 300ms ease
```

### 1.6 Themable accents (runtime swap)

`[data-accent="…"]` on `<html>` rewrites `--accent` and `--accent-soft`.

Canonical Zeus values: `zeus-navy` *(default)*, `zeus-red`, `zeus-the-agency`,
`zeus-digital`, `labyrinth`, `odd-gorilla`, `house-of-zeus`.

Legacy aliases (kept for back-compat): `boysenberry → zeus-navy`, `goldenbell
→ zeus-red`, `seafoam → zeus-digital`, `pesto → muted olive`.

### 1.7 Dark mode

Toggle `class="dark"` (existing `uiStore`) **or** `data-theme="dark"` on
`<html>`. The block under `.dark, [data-theme="dark"]` in
[src/index.css](../src/index.css) overrides backgrounds, foregrounds, border
alphas, and soft RAG tints; component code does **not** need dark variants for
tokenised properties.

---

## 2. Layout shells

- **`AppShell`** ([src/shared/components/layout/AppShell.tsx](../src/shared/components/layout/AppShell.tsx))
  — primary chrome: fixed dark sidebar (`var(--bg-sidebar)`), top-right user
  dropdown / preferences / AI assistant FAB. `<main>` is the scroll container.
- **`AppLayout`** ([src/core/components/layout/AppLayout.tsx](../src/core/components/layout/AppLayout.tsx))
  — slim header-only chrome for narrower flows.

Module-level: every feature module renders a `<ModuleTabNav>` then a
`<ModuleContentWrapper>` inside its module-specific layout. The tab nav is
sticky (`top-0 z-30`) and bridges to the AppShell scroll ancestor for the
shadow-on-stuck affordance.

---

## 3. Page-level grid (responsive)

Use the named grid utilities for dashboards — they collapse correctly on
mobile and respect `--space-4` (16px) gap consistently:

```
.grid-kpis      4-col → 2-col @ <900px → 1-col @ <560px
.grid-kpis-3    3-col → 2-col @ <900px → 1-col @ <560px
.grid-cols-2    2-col →           1-col @ <900px
.grid-cols-3    3-col → 2-col @ <900px → 1-col @ <560px
```

> **Heads-up**: `.grid-cols-2` / `.grid-cols-3` shadow Tailwind's same-named
> utilities. A bare `grid grid-cols-2` (no breakpoint prefix) now also
> auto-collapses below 900px. If a page genuinely needs 2-col always, use
> explicit breakpoint variants (`grid-cols-2 md:grid-cols-2`).

---

## 4. Composition reference

See the **TL;DR table** at top. The same content is in the upstream tech
spec §17 if you want the full prose.

---

## 5. Status pills — RAG semantics

Use `.rag {green|amber|red|blue|na}` with optional `.dot` for any
status indicator. **Don't roll your own colored spans.**

```jsx
<span className="rag green"><span className="dot" />On track</span>
<span className="rag amber"><span className="dot" />At risk</span>
<span className="rag red">Off track</span>
<span className="rag blue">In progress</span>
<span className="rag na">No data</span>
```

**Workflow states** (draft / active / paused / deprecated / archived) are
different from RAG — they're lifecycle states, not health signals. The KPI
library uses its own `STATUS_BADGE_CLASS` map for that. Don't conflate.

---

## 6. Buttons

Use shadcn `<Button>` for all new code
([src/shared/components/ui/button.tsx](../src/shared/components/ui/button.tsx)):
- variants: `default` (primary near-black), `destructive`, `outline`,
  `secondary` (soft fill), `ghost`, `link`
- sizes: `default`, `sm`, `lg`, `icon`
- use `asChild` for `<NavLink>` / `<a>` so link semantics carry through
- focus ring is **always** visible — do not override
- min mobile touch target: 44×44 via `.touch-target`

The legacy `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-destructive`
classes exist for back-compat. **Don't introduce them in new code** — migrate
to `<Button>` when you touch a file.

---

## 7. Forms & inputs

Prefer shadcn `<Input>` and the form primitives in
`src/shared/components/forms/`. They inherit:
- 13px font, `h-10` (or `h-9` dense), `px-3 py-2`
- border `--border-default`, hover `--border-strong`, focus `--accent` + 3px
  `--accent-soft` halo (no outline)
- error: `border-color: var(--rag-red)`, helper text
  `text-[var(--rag-red)] text-tiny`

Switches: off `--switch-background`, on `--accent`. Checkboxes when checked:
fill `--accent`, tick `--accent-fg`.

---

## 8. Tables

Default to `<ResponsiveTable>`
([src/shared/components/ui/ResponsiveTable.tsx](../src/shared/components/ui/ResponsiveTable.tsx))
— declarative `Column<T>[]`, automatic mobile card-stack collapse below 640px,
sticky first column by default.

For bespoke needs (frozen totals row, expanding sub-rows, YoY columns), build
a `<table>` directly using:
- `w-full text-sm`
- `<thead>`: `bg-[var(--bg-sunken)]`, `text-[11px] font-medium uppercase tracking-[0.08em]`
- `<tbody> <tr>`: `h-[var(--row-h)]`, hover `hover:bg-[var(--bg-sunken)]`
- numeric cells: `text-right tabular-nums font-mono`
- borders: `border-b border-[var(--border-subtle)]` per row,
  `border-[var(--border-default)]` for section breaks
- sticky first column: `.table-sticky-first-col` (or `-two-col` with checkbox)
- when in a card body: wrap with `<div class="card-body tight">`

---

## 9. Bars, charts

- `.dawin-bar` (+ `.ok` / `.warn` / `.over`) for progress / utilisation
- Recharts: series colors `hsl(var(--chart-N))`, grid `var(--border-subtle)`,
  axis text 11px `var(--fg-tertiary)`, tooltip white surface
  `--shadow-md` 10px radius
- Cash-flow waterfall: `--cf-pos` for inflows, `--cf-neg` for outflows,
  `--fg-primary` for net bars

---

## 10. Z-index conventions

| Layer | z | Use |
|---|---|---|
| Sticky module header | `z-30` | `<ModuleTabNav>` |
| Sticky table column | `z-10` | `.table-sticky-first-col` |
| Popovers / dropdowns | `z-50` (Radix) | shadcn primitives |
| Modals / dialogs | `z-50` + portal (Radix) | |
| FAB / AI assistant | `z-40` | Below modals, above tab nav |

Keep ad-hoc `z-…` out of components. If a new layer is genuinely needed, add
it to this table first.

---

## 18. Anti-patterns — don't do

These are checked by ESLint and surfaced via `npm run lint:design`:

1. **Hardcoded colors in TSX** — `text-gray-700`, `bg-blue-50`,
   `style={{ color: '#872e5c' }}`. Use token classes or `var(--…)` refs.
   See §1.1 for the full token list.
2. **Px font-sizes inline** — `style={{ fontSize: 14 }}`. Use the type scale
   (`text-body`, `text-small`, `text-tiny`) or the `--text-*` vars.
3. **Hover-only state** — state must be discernible at rest. Hover layers a
   refinement.
4. **Custom z-index** — `z-[999]`. Stay within the §10 table.
5. **Mixing `.kpi` and `<KpiCard>`** on one page — pick one model.
6. **`<Button>` inside an anchor** without `asChild`. Use
   `<Button asChild><NavLink to="…">…</NavLink></Button>`.
7. **Replicating `.btn-*` markup in new code** — use shadcn `<Button>`.
8. **Forgotten `font-variant-numeric: tabular-nums`** in number columns.
   Apply `.tabular` / `.font-mono`.
9. **Defining a new shade of grey ad-hoc.** Propose a token in §1.1 first.

---

## 19. Extending the system

When you need to add a new design primitive:

1. **Pitch the token.** Add the CSS variable to §1.1 and to
   [src/index.css](../src/index.css). For colored tokens, include the AA
   contrast check against the surface it sits on.
2. **Expose to Tailwind** by extending [tailwind.config.js](../tailwind.config.js).
3. **Build the primitive** in `src/shared/components/ui/`, using `cva` for
   variant matrices.
4. **Add a row to the TL;DR table.** New primitives without a "use when"
   entry rot quickly.
5. **Dark mode + accent variants.** Verify the primitive in both themes and at
   least two accents before merging.

---

## Tooling — `npm run lint:design`

A focused ESLint config ([eslint.config.design.js](../eslint.config.design.js))
runs only the two `design-system/*` rules. Use it to triage a file or module
before opening a PR:

```bash
npm run lint:design
# or scope to a single file:
npx eslint --config eslint.config.design.js src/modules/finance/pages/ForecastPage.tsx
```

Currently warn-only (exit 0 with violations). Phase U.6 will promote both
rules to `error` once Phase U.2 (module token sweep) and Phase U.3 (hex
eradication) land.

The same rules are wired into the main `npm run lint` config — they just
live alongside the broader lint backlog there.

---

## Cross-references

- Token source: [src/index.css](../src/index.css)
- Tailwind bridge: [tailwind.config.js](../tailwind.config.js)
- shadcn config: [components.json](../components.json)
- `cn()` helper: [src/shared/lib/utils.ts](../src/shared/lib/utils.ts)
- ESLint rules: [.eslint/no-raw-palette.js](../.eslint/no-raw-palette.js),
  [.eslint/no-inline-style-literals.js](../.eslint/no-inline-style-literals.js)
- Primary shell: [src/shared/components/layout/AppShell.tsx](../src/shared/components/layout/AppShell.tsx)
- Module header: [src/core/components/navigation/ModuleTabNav.tsx](../src/core/components/navigation/ModuleTabNav.tsx)
- Module body wrapper: [src/shared/components/layout/ModuleContentWrapper.tsx](../src/shared/components/layout/ModuleContentWrapper.tsx)
- Button primitive: [src/shared/components/ui/button.tsx](../src/shared/components/ui/button.tsx)
- Card primitive: [src/shared/components/ui/card.tsx](../src/shared/components/ui/card.tsx)
- Table primitive: [src/shared/components/ui/ResponsiveTable.tsx](../src/shared/components/ui/ResponsiveTable.tsx)
- KPI library card: [src/modules/strategy/components/kpi/KpiCard.tsx](../src/modules/strategy/components/kpi/KpiCard.tsx)
- Reference dashboards: [src/modules/strategy/pages/ExecutiveDashboard.tsx](../src/modules/strategy/pages/ExecutiveDashboard.tsx),
  [src/modules/finance/pages/CashFlowPage.tsx](../src/modules/finance/pages/CashFlowPage.tsx)
- Branding guide: [docs/BRANDING.md](BRANDING.md)
