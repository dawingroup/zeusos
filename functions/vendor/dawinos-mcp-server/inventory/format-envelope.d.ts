/**
 * Markdown formatter for WriteEnvelope responses.
 *
 * All inventory write tools return the same envelope shape; this module turns
 * that envelope into a compact human-readable block so a reader can decide
 * whether to proceed from dry-run to commit without squinting at raw JSON.
 */
import type { WriteEnvelope } from './write-helpers.js';
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
export declare function formatEnvelope(env: WriteEnvelope, toolName?: string): string;
//# sourceMappingURL=format-envelope.d.ts.map