/**
 * What an AI-proposed action will run with — shown on every action chip before
 * its run button, so a person confirms the real inputs rather than the model's
 * own summary of them (utils/actionInputRows.ts).
 */
import { actionInputRows } from '../../utils/actionInputRows';

export function ActionInputPreview({ input }: { input: unknown }) {
  const rows = actionInputRows(input);
  return (
    <div
      aria-label="Action inputs"
      style={{
        marginTop: 6,
        maxHeight: 160,
        overflowY: 'auto',
        borderRadius: 6,
        padding: '6px 8px',
        background: 'var(--bg-sunken, rgba(0,0,0,0.04))',
        fontSize: 11,
        lineHeight: 1.45,
      }}
    >
      <div style={{ color: 'var(--fg-tertiary)', marginBottom: 2 }}>Will run with:</div>
      {rows.length === 0 ? (
        <div style={{ color: 'var(--fg-tertiary)' }}>No inputs</div>
      ) : (
        <dl style={{ margin: 0 }}>
          {rows.map((row) => (
            <div key={row.key} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <dt style={{ color: 'var(--fg-secondary)', flexShrink: 0 }}>{row.key}:</dt>
              <dd
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--fg-primary)',
                }}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default ActionInputPreview;
