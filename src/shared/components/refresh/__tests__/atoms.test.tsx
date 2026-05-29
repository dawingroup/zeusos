/**
 * UI Refresh shared atoms — render tests.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pill, KPI, BurnMeter, Sparkline, SectionH, PageHero, MetaRow } from '../atoms';

describe('refresh atoms', () => {
  it('Pill renders children and applies the tone class', () => {
    const { container } = render(<Pill tone="green">Active</Pill>);
    expect(screen.getByText('Active')).toBeTruthy();
    expect(container.querySelector('.pill.green')).toBeTruthy();
    expect(container.querySelector('.dot')).toBeTruthy();
  });

  it('Pill omits the dot when dot={false}', () => {
    const { container } = render(<Pill dot={false}>X</Pill>);
    expect(container.querySelector('.dot')).toBeNull();
  });

  it('KPI renders label, value and unit', () => {
    render(<KPI label="Active Master Jobs" value="42" unit="(of 50)" delta="+6 wk/wk" deltaDir="up" />);
    expect(screen.getByText('Active Master Jobs')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('(of 50)')).toBeTruthy();
    expect(screen.getByText('+6 wk/wk')).toBeTruthy();
  });

  it('BurnMeter clamps the fill and flags the over-budget tone', () => {
    const { container } = render(<BurnMeter value={1.07} label="Burn" />);
    expect(container.querySelector('.burn.over')).toBeTruthy();
    expect(screen.getByText('107%')).toBeTruthy();
    const fill = container.querySelector('.burn > span') as HTMLElement;
    // 1.07 clamps to 1.2 scale → min(107/120*... , 100) capped at 100%
    expect(fill.style.width).toBe('89.16666666666667%');
  });

  it('BurnMeter uses the warn tone in the 80–100% band', () => {
    const { container } = render(<BurnMeter value={0.85} />);
    expect(container.querySelector('.burn.warn')).toBeTruthy();
  });

  it('Sparkline renders an SVG path for a series', () => {
    const { container } = render(<Sparkline points={[1, 4, 2, 8, 5]} />);
    const path = container.querySelector('svg path') as SVGPathElement;
    expect(path).toBeTruthy();
    expect(path.getAttribute('d')?.startsWith('M0')).toBe(true);
  });

  it('Sparkline degrades gracefully on an empty series', () => {
    const { container } = render(<Sparkline points={[]} />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('svg path')).toBeNull();
  });

  it('SectionH renders eyebrow + title + action', () => {
    render(<SectionH eyebrow="Roll-up" title="Brand portfolio" action={<button>Open</button>} />);
    expect(screen.getByText('Roll-up')).toBeTruthy();
    expect(screen.getByText('Brand portfolio')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
  });

  it('PageHero underlines a plain title but not a "·"-separated one', () => {
    const { container, rerender } = render(<PageHero title="At a glance" />);
    expect(container.querySelector('.zeus-underline')).toBeTruthy();
    rerender(<PageHero title="Zeus Group · Dashboard" />);
    expect(container.querySelector('.zeus-underline')).toBeNull();
  });

  it('MetaRow renders a label/value pair', () => {
    render(<MetaRow label="Tier" value="T1" />);
    expect(screen.getByText('Tier')).toBeTruthy();
    expect(screen.getByText('T1')).toBeTruthy();
  });
});
