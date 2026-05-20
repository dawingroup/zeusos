import * as React from 'react';

interface BrowserFrameProps {
  url?: string;
  children: React.ReactNode;
  label?: string;
  w?: number;
  h?: number;
}

export function BrowserFrame({
  url = 'portal.dawinos.com',
  children,
  label,
  w = 1320,
  h = 860,
}: BrowserFrameProps) {
  return (
    <div className="h-browser" style={{ width: w, height: h }}>
      <div className="h-chrome">
        <div className="h-chrome-dots"><i /><i /><i /></div>
        <div className="h-chrome-url">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M3 5V3.5a2.5 2.5 0 015 0V5M2 5h7v5H2V5z" stroke="currentColor" strokeWidth="1" />
          </svg>
          <span>{url}</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ width: 60, height: 22, borderRadius: 5, background: 'rgba(20,18,14,0.04)' }} />
      </div>
      {children}
      {label ? <div className="h-screen-label">{label}</div> : null}
    </div>
  );
}
