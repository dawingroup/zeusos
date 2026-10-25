/**
 * What a linked record RENDERS: its name, a skeleton, or the type's noun —
 * never the id as text — and where it links to.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/shared/services/firebase/firestore', () => ({ db: {} }));

import { RecordRef } from '../RecordRef';
import { primeRecordLabel, resetRecordLabelCache } from '../recordLabels';
import { resolveRecordTarget } from '../recordRoutes';

const ID = 'Xk93mQz1AbCdEfGhIjKl';

describe('<RecordRef>', () => {
  beforeEach(() => resetRecordLabelCache());

  it('links the master job code, never the id, once resolved', async () => {
    primeRecordLabel('masterJob', ID, { primary: 'MJ-2026-0142', secondary: 'Safaricom Q4 brand' });
    render(
      <MemoryRouter>
        <RecordRef type="masterJob" id={ID} withSecondary />
      </MemoryRouter>,
    );
    const link = await screen.findByRole('link', { name: /MJ-2026-0142/ });
    expect(link).toHaveAttribute('href', `/master-jobs/${ID}`);
    expect(screen.getByText(/Safaricom Q4 brand/)).toBeInTheDocument();
    expect(screen.queryByText(ID)).toBeNull();
  });

  it('shows the noun with the id in the tooltip when nothing resolves', async () => {
    primeRecordLabel('intercompanyInvoice', ID, null);
    const { container } = render(<RecordRef type="intercompanyInvoice" id={ID} />);
    expect(await screen.findByText('Inter-company invoice')).toHaveAttribute('title', ID);
    expect(container.querySelector('[data-record-unresolved]')).not.toBeNull();
    expect(screen.queryByText(ID)).toBeNull();
  });

  it('renders plain text when the type has no routed page or link is off', async () => {
    primeRecordLabel('quote', ID, { primary: 'Q-2026-0007' });
    render(
      <MemoryRouter>
        <RecordRef type="quote" id={ID} link={false} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Q-2026-0007')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders a dash for no id', () => {
    render(<RecordRef type="client" id={undefined} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('resolveRecordTarget', () => {
  it('nests contract records under their client and refuses to build a route without the parent ids', () => {
    expect(resolveRecordTarget('sow', { id: 's1', clientId: 'c1', msaId: 'm1' }).path).toBe('/clients/c1/msas/m1/sows/s1');
    expect(resolveRecordTarget('sow', { id: 's1' }).path).toBeNull();
    expect(resolveRecordTarget('changeOrder', { id: 'co1', clientId: 'c1', msaId: 'm1', sowId: 's1' }).path)
      .toBe('/clients/c1/msas/m1/sows/s1/change-orders/co1');
    expect(resolveRecordTarget('iwo', { id: 'w 1' })).toEqual({ path: '/delivery/iwo/w%201', guard: 'delivery' });
    expect(resolveRecordTarget('intercompanyInvoice', { id: 'x' }).path).toBeNull();
  });
});
