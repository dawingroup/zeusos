import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarginBadge } from '../MarginBadge';

describe('MarginBadge', () => {
  it('renders green when margin is comfortably above the floor', () => {
    render(<MarginBadge marginPct={35} floorPct={25} />);
    const badge = screen.getByTestId('margin-badge');
    expect(badge.dataset.band).toBe('green');
    expect(badge.textContent).toContain('35.0%');
  });

  it('renders amber when margin is within the 5pp band above the floor', () => {
    render(<MarginBadge marginPct={26} floorPct={25} />);
    expect(screen.getByTestId('margin-badge').dataset.band).toBe('amber');
  });

  it('renders red when margin is below the floor', () => {
    render(<MarginBadge marginPct={20} floorPct={25} />);
    expect(screen.getByTestId('margin-badge').dataset.band).toBe('red');
  });

  it('respects a non-default amberBandPp', () => {
    render(<MarginBadge marginPct={29} floorPct={25} amberBandPp={10} />);
    expect(screen.getByTestId('margin-badge').dataset.band).toBe('amber');
  });
});
