import * as React from 'react';

interface GanttRow {
  t: React.ReactNode;
  s?: React.ReactNode;
  start: number;
  end: number;
  pct?: number;
  signal?: boolean;
  label?: React.ReactNode;
}

interface GanttProps {
  cols: React.ReactNode[];
  rows: GanttRow[];
  todayPct?: number;
}

export function Gantt({ cols, rows, todayPct }: GanttProps) {
  return (
    <div className="h-gantt">
      <div className="h-gantt-h">
        <div className="h-gantt-h-l">Phase / Task</div>
        <div className="h-gantt-h-r">
          {cols.map((c, i) => <div key={i}>{c}</div>)}
        </div>
      </div>
      {rows.map((r, ri) => (
        <div key={ri} className="h-gantt-row">
          <div className="h-gantt-row-l">
            <div className="h-gantt-row-t">{r.t}</div>
            {r.s ? <div className="h-gantt-row-s">{r.s}</div> : null}
          </div>
          <div className="h-gantt-row-r">
            {todayPct != null ? <div className="h-gantt-today" style={{ left: todayPct + '%' }} /> : null}
            <div
              className={'h-gantt-bar' + (r.signal ? ' is-signal' : '')}
              style={{ left: r.start + '%', width: (r.end - r.start) + '%' }}
            >
              {r.pct != null ? <i style={{ width: r.pct + '%' }} /> : null}
              {r.label ? <span className="h-gantt-bar-l">{r.label}</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
