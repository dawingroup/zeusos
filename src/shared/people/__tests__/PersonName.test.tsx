/**
 * What a person reference RENDERS: the id itself must never reach the screen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/shared/services/firebase/firestore', () => ({ db: {} }));

import { PersonName } from '../PersonName';
import { primePeopleDirectory, resetPeopleDirectory } from '../peopleDirectoryStore';

const UID = 'Xk93mQz1AbCdEfGhIjKlMnOpQrSt';

describe('<PersonName>', () => {
  beforeEach(() => resetPeopleDirectory());

  it('renders the name, never the id, when resolved', () => {
    primePeopleDirectory([{ name: 'Jane Okello', uid: UID, email: 'jane@zeustheagency.com', source: 'employee' }]);
    render(<PersonName id={UID} />);
    expect(screen.getByText('Jane Okello')).toBeInTheDocument();
    expect(screen.queryByText(UID)).toBeNull();
    expect(screen.getByText('Jane Okello')).toHaveAttribute('title', 'jane@zeustheagency.com');
  });

  it('shows a skeleton, not "Unknown user", while the directory is loading', () => {
    const { container } = render(<PersonName id={UID} />);
    expect(container.querySelector('[data-person-loading]')).not.toBeNull();
    expect(screen.queryByText('Unknown user')).toBeNull();
    expect(screen.queryByText(UID)).toBeNull();
  });

  it('shows the placeholder with the id in the tooltip when nobody matches', () => {
    primePeopleDirectory([]);
    render(<PersonName id={UID} />);
    const el = screen.getByText('Unknown user');
    expect(el).toHaveAttribute('title', UID);
    expect(screen.queryByText(UID)).toBeNull();
  });

  it('accepts a custom fallback and renders a dash for no id', () => {
    primePeopleDirectory([]);
    render(
      <>
        <PersonName id={UID} fallback="Zeus team" />
        <PersonName id={undefined} />
      </>,
    );
    expect(screen.getByText('Zeus team')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('names a system actor', () => {
    primePeopleDirectory([]);
    render(<PersonName id="agent:ZA-002" />);
    expect(screen.getByText('ZeusOS agent')).toBeInTheDocument();
  });
});
