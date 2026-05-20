/**
 * Markdown formatter for WriteEnvelope responses.
 *
 * All inventory write tools return the same envelope shape; this module turns
 * that envelope into a compact human-readable block so a reader can decide
 * whether to proceed from dry-run to commit without squinting at raw JSON.
 */
// ─── Value rendering ─────────────────────────────────────────────────────────
function renderValue(v) {
    if (v === undefined)
        return '∅';
    if (v === null)
        return 'null';
    if (typeof v === 'string') {
        if (v.length === 0)
            return '""';
        if (v.length > 80)
            return `${JSON.stringify(v.slice(0, 77))}…`;
        return JSON.stringify(v);
    }
    if (typeof v === 'number' || typeof v === 'boolean')
        return String(v);
    try {
        const json = JSON.stringify(v);
        return json.length > 120 ? `${json.slice(0, 117)}…` : json;
    }
    catch {
        return '(unserializable)';
    }
}
function renderFieldDiff(d) {
    return `    • ${d.path}: ${renderValue(d.before)} → ${renderValue(d.after)}`;
}
function renderItemDiff(d) {
    const header = `  - **${d.sku || '(no sku)'}** — ${d.name || '(no name)'} \`(${d.itemId})\``;
    if (d.changes.length === 0)
        return `${header}\n    _no field changes_`;
    return [header, ...d.changes.map(renderFieldDiff)].join('\n');
}
function renderWarning(w) {
    const prefix = w.kind === 'collision'
        ? '❌'
        : w.kind === 'missing'
            ? '⚠️'
            : w.kind === 'cross_reference'
                ? '🔗'
                : w.kind === 'noop'
                    ? '∅'
                    : 'ℹ️';
    const target = w.itemId ? ` [${w.itemId}]` : '';
    return `  - ${prefix} ${w.kind}${target}: ${w.message}`;
}
// ─── Main formatter ──────────────────────────────────────────────────────────
/**
 * Render a WriteEnvelope as markdown. The output always includes:
 *   - Mode (dry_run / commit)
 *   - Counts (planned / committed)
 *   - Up to DIFF_CAP item diffs (truncated with "…and N more" footer)
 *   - Warnings (ALL shown — they're the thing the caller needs to read)
 *   - Errors (ALL shown)
 *
 * If `toolName` is provided, it's used in the header so the reader knows which
 * tool produced the output.
 */
export function formatEnvelope(env, toolName) {
    const DIFF_CAP = 25;
    const lines = [];
    const title = toolName ? `${toolName} — ${env.mode.toUpperCase()}` : env.mode.toUpperCase();
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(`**Planned:** ${env.itemsPlanned}  |  **Committed:** ${env.itemsCommitted}`);
    lines.push('');
    if (env.errors.length > 0) {
        lines.push(`### Errors (${env.errors.length})`);
        for (const e of env.errors)
            lines.push(`  - ❌ ${e}`);
        lines.push('');
    }
    if (env.warnings.length > 0) {
        lines.push(`### Warnings (${env.warnings.length})`);
        for (const w of env.warnings)
            lines.push(renderWarning(w));
        lines.push('');
    }
    if (env.diffs.length === 0) {
        lines.push(`_No diffs._`);
    }
    else {
        lines.push(`### Diffs (${env.diffs.length})`);
        const shown = env.diffs.slice(0, DIFF_CAP);
        for (const d of shown)
            lines.push(renderItemDiff(d));
        if (env.diffs.length > DIFF_CAP) {
            lines.push(`  _…and ${env.diffs.length - DIFF_CAP} more (not shown)_`);
        }
        lines.push('');
    }
    if (env.mode === 'dry_run' && env.itemsPlanned > 0 && env.errors.length === 0) {
        lines.push('');
        lines.push('> 🟡 Dry-run — no writes performed. Re-run with `dry_run: false` to commit.');
    }
    else if (env.mode === 'commit' && env.itemsCommitted > 0) {
        lines.push('');
        lines.push(`> ✓ Committed ${env.itemsCommitted} item(s).`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=format-envelope.js.map