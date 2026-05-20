import * as React from 'react';

interface TblCol {
  l: React.ReactNode;
  w?: string;
  a?: 'left' | 'right';
}

interface TblRow {
  cells: React.ReactNode[];
  signal?: boolean;
  dim?: boolean;
}

interface TblProps {
  cols: TblCol[];
  rows: TblRow[];
}

export function Tbl({ cols, rows }: TblProps) {
  const tmpl = cols.map((c) => c.w || '1fr').join(' ');
  return (
    <div className="h-tbl">
      <div className="h-tbl-h" style={{ gridTemplateColumns: tmpl }}>
        {cols.map((c, i) => (
          <div key={i} className={c.a === 'right' ? 'text-right' : ''}>{c.l}</div>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div
          key={ri}
          className={'h-tbl-r' + (r.signal ? ' is-signal' : '') + (r.dim ? ' is-dim' : '')}
          style={{ gridTemplateColumns: tmpl }}
        >
          {r.cells.map((c, ci) => (
            <div key={ci} className={cols[ci]?.a === 'right' ? 'text-right' : ''}>{c}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Cell({ t, s }: { t: React.ReactNode; s?: React.ReactNode }) {
  return (
    <div>
      <div className="h-cell-t">{t}</div>
      {s ? <div className="h-cell-s">{s}</div> : null}
    </div>
  );
}

export function CellNum({ children }: { children?: React.ReactNode }) {
  return <span className="h-cell-num">{children}</span>;
}

// ── TABS (page tabs) ────────────────────────────────────
interface TabItem {
  l: React.ReactNode;
  c?: number;
  on?: boolean;
  signal?: boolean;
}

export function Tabs({ items, onSelect }: { items: TabItem[]; onSelect?: (i: number) => void }) {
  return (
    <div className="h-tabs">
      {items.map((it, i) => (
        <div
          key={i}
          className={'h-tab-x' + (it.on ? ' is-on' : '') + (it.signal ? ' is-signal' : '')}
          onClick={() => onSelect?.(i)}
        >
          {it.l}
          {it.c != null ? <span className="h-badge">{it.c}</span> : null}
        </div>
      ))}
    </div>
  );
}
