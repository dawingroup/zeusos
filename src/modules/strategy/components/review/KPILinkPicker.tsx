// ============================================================================
// KPILinkPicker — drawer that lets the user pick a tracked KPI from the
// library and bind it to a strategy doc's scoreboard tile.
//
// The drawer fetches every active KPI for the company, lets the user filter
// by category + search, and emits the chosen KPI id back. The caller is
// responsible for writing the binding into the tile's `linkedKpiId`.
// ============================================================================

import * as React from 'react';
import { X, Search, Sparkles, AlertTriangle } from 'lucide-react';
import { useKPIs } from '../../hooks/useKPIs';
import {
  KPI_CATEGORY_LABELS,
  KPI_PERFORMANCE,
  type KPICategory,
} from '../../constants/kpi.constants';
import type { KPIDefinition } from '../../types/kpi.types';

export interface KPILinkPickerProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  /** Already-bound KPI ids — flagged in the list so the user can see what's
   *  already on the scoreboard. */
  alreadyBoundIds?: string[];
  /** Called when the user picks a KPI. */
  onPick: (kpi: KPIDefinition) => void;
}

export const KPILinkPicker: React.FC<KPILinkPickerProps> = ({
  open,
  onClose,
  companyId,
  alreadyBoundIds = [],
  onPick,
}) => {
  const { kpis, loading, error } = useKPIs({ companyId, activeOnly: true, autoFetch: open });
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState<KPICategory | 'all'>('all');

  React.useEffect(() => {
    if (open) {
      setSearch('');
      setCategory('all');
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return kpis.filter((k) => {
      if (category !== 'all' && k.category !== category) return false;
      if (!q) return true;
      return (
        k.name.toLowerCase().includes(q) ||
        (k.code ?? '').toLowerCase().includes(q) ||
        (k.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [kpis, search, category]);

  const categoryOptions = React.useMemo(() => {
    const set = new Set<KPICategory>();
    for (const k of kpis) set.add(k.category);
    return Array.from(set);
  }, [kpis]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(20, 20, 22, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 90,
        }}
      />
      <div
        role="dialog"
        aria-label="Link to tracked KPI"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 520,
          maxWidth: '92vw',
          background: 'var(--bg-surface)',
          boxShadow: '-8px 0 32px rgba(20, 20, 22, 0.16)',
          zIndex: 95,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Head */}
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Link to a tracked KPI</h3>
              <div className="text-tertiary" style={{ fontSize: 12.5, marginTop: 2 }}>
                Mount a live KPI from the library on this scoreboard. Its current value, target, and status will sync automatically.
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                marginLeft: 'auto',
                padding: 6,
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                color: 'var(--fg-tertiary)',
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Search */}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              background: 'var(--bg-surface)',
            }}
          >
            <Search className="h-3.5 w-3.5" style={{ color: 'var(--fg-tertiary)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, or description"
              style={{
                flex: 1,
                border: 0,
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                color: 'var(--fg-primary)',
              }}
            />
          </div>
          {/* Category chips */}
          {categoryOptions.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <CategoryChip
                label="All"
                active={category === 'all'}
                onClick={() => setCategory('all')}
                count={kpis.length}
              />
              {categoryOptions.map((c) => (
                <CategoryChip
                  key={c}
                  label={KPI_CATEGORY_LABELS[c] ?? c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                  count={kpis.filter((k) => k.category === c).length}
                />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {loading ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--fg-tertiary)',
              }}
            >
              Loading tracked KPIs…
            </div>
          ) : error ? (
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background: 'var(--rag-red-soft)',
                color: 'var(--rag-red)',
                border: '1px solid var(--rag-red)',
                fontSize: 12.5,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle className="h-4 w-4" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600 }}>Couldn't load KPIs</div>
                <div style={{ marginTop: 2 }}>{error.message}</div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--fg-tertiary)',
              }}
            >
              <Sparkles className="h-6 w-6" style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              {kpis.length === 0
                ? 'No tracked KPIs yet — set them up in /strategy/kpis first.'
                : 'No KPIs match this filter.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map((k) => (
                <KPIPickerRow
                  key={k.id}
                  kpi={k}
                  alreadyBound={alreadyBoundIds.includes(k.id)}
                  onPick={() => {
                    onPick(k);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ── Subcomponents ─────────────────────────────────────────────────────

const CategoryChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}> = ({ label, active, onClick, count }) => (
  <button
    onClick={onClick}
    style={{
      padding: '3px 10px',
      borderRadius: 100,
      border: `1px solid ${active ? 'var(--fg-primary)' : 'var(--border-default)'}`,
      background: active ? 'var(--fg-primary)' : 'var(--bg-surface)',
      color: active ? '#fff' : 'var(--fg-secondary)',
      fontSize: 11,
      fontWeight: 500,
      cursor: 'pointer',
    }}
  >
    {label} <span style={{ opacity: 0.7 }}>·</span> {count}
  </button>
);

const KPIPickerRow: React.FC<{
  kpi: KPIDefinition;
  alreadyBound: boolean;
  onPick: () => void;
}> = ({ kpi, alreadyBound, onPick }) => {
  const perf = kpi.currentPerformance ?? KPI_PERFORMANCE.NO_DATA;
  const tone =
    perf === KPI_PERFORMANCE.EXCEEDING || perf === KPI_PERFORMANCE.ON_TARGET
      ? 'green'
      : perf === KPI_PERFORMANCE.BELOW_TARGET
      ? 'amber'
      : perf === KPI_PERFORMANCE.CRITICAL
      ? 'red'
      : 'na';
  return (
    <button
      onClick={onPick}
      disabled={alreadyBound}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 70px',
        gap: 10,
        padding: '10px 12px',
        textAlign: 'left',
        borderRadius: 8,
        border: '1px solid var(--border-default)',
        background: alreadyBound ? 'var(--bg-sunken)' : 'var(--bg-surface)',
        cursor: alreadyBound ? 'not-allowed' : 'pointer',
        opacity: alreadyBound ? 0.55 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="text-mono"
            style={{ fontSize: 10, color: 'var(--fg-tertiary)', fontWeight: 600 }}
          >
            {kpi.code ?? kpi.id.slice(0, 8)}
          </span>
          <span className="pill" style={{ fontSize: 10 }}>
            {KPI_CATEGORY_LABELS[kpi.category] ?? kpi.category}
          </span>
          {alreadyBound && (
            <span
              className="pill"
              style={{ fontSize: 9.5, background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              ALREADY LINKED
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{kpi.name}</div>
        {kpi.description && (
          <div
            className="text-tertiary"
            style={{ fontSize: 11, marginTop: 2, lineHeight: 1.4 }}
          >
            {kpi.description.length > 110 ? kpi.description.slice(0, 108) + '…' : kpi.description}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div
          className="text-tertiary"
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}
        >
          Current
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {kpi.currentValue ?? '—'}
          {kpi.unit ? <span style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginLeft: 2 }}>{kpi.unit}</span> : null}
        </div>
        {kpi.target?.value !== undefined && (
          <div
            className="text-tertiary"
            style={{
              fontSize: 10,
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            target {kpi.target.value}
            {kpi.unit ?? ''}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', alignSelf: 'center' }}>
        <span className={`rag ${tone}`} style={{ fontSize: 10 }}>
          <span className="dot" />
          {tone === 'green'
            ? 'On'
            : tone === 'amber'
            ? 'Risk'
            : tone === 'red'
            ? 'Off'
            : 'N/A'}
        </span>
      </div>
    </button>
  );
};

export default KPILinkPicker;
