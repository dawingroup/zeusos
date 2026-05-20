import * as React from 'react';
import { Icon } from './Icon';

interface InboxItemProps {
  tag: React.ReactNode;
  due?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  amount?: React.ReactNode;
  signal?: boolean;
  on?: boolean;
  onClick?: () => void;
}

export function InboxItem({ tag, due, title, sub, amount, signal, on, onClick }: InboxItemProps) {
  return (
    <div
      className={'h-inbox-i' + (signal ? ' is-signal' : '') + (on ? ' is-on' : '')}
      onClick={onClick}
    >
      <div className="h-inbox-i-h">
        <span className="h-inbox-i-tag">{tag}</span>
        {due ? <span className="h-inbox-i-due">{due}</span> : null}
      </div>
      <div className="h-inbox-i-t">{title}</div>
      {sub ? <div className="h-inbox-i-s">{sub}</div> : null}
      {amount ? (
        <div className="h-inbox-i-m">
          <span className="h-inbox-i-amt">{amount}</span>
          <Icon name="arrow-r" size={14} color="var(--ink-3)" />
        </div>
      ) : null}
    </div>
  );
}
