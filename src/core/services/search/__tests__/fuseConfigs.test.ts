import { describe, it, expect } from 'vitest';
import Fuse from 'fuse.js';
import { FUSE_CONFIGS, configForType } from '../fuseConfigs';
import type { IndexedRecord } from '../types';

function rec(partial: Partial<IndexedRecord>): IndexedRecord {
  return {
    id: 'x',
    type: 'customer',
    module: 'crm',
    subsidiaryId: 'sub',
    path: '/x',
    icon: 'Users',
    cardKind: 'customer',
    title: '',
    data: {},
    ...partial,
  };
}

describe('FUSE_CONFIGS — customer', () => {
  const customers: IndexedRecord[] = [
    rec({ id: 'c1', title: 'Acme Co', data: { code: 'ACME-001', email: 'hi@acme.com', phone: '+256700000001' } }),
    rec({ id: 'c2', title: 'Beta Builders', data: { code: 'BETA-002', email: 'info@beta.com', phone: '+256700000002' } }),
    rec({ id: 'c3', title: 'Acme Manufacturing', data: { code: 'ACME-003', email: 'sales@acme-mfg.com', phone: '+256700000003' } }),
  ];

  it('finds Acme Co by name prefix', () => {
    const fuse = new Fuse(customers, FUSE_CONFIGS.customer);
    const results = fuse.search('acm');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.item.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c3');
  });

  it('tolerates a small typo within the customer threshold', () => {
    const fuse = new Fuse(customers, FUSE_CONFIGS.customer);
    const results = fuse.search('acne'); // typo for "acme"
    expect(results.length).toBeGreaterThan(0);
  });

  it('finds by code exactly', () => {
    const fuse = new Fuse(customers, FUSE_CONFIGS.customer);
    const results = fuse.search('BETA-002');
    expect(results[0]?.item.id).toBe('c2');
  });
});

describe('FUSE_CONFIGS — sales_order', () => {
  const orders: IndexedRecord[] = [
    rec({ id: 'o1', type: 'sales_order', cardKind: 'sales_order', title: 'SO-1042', subtitle: 'Acme Co',  data: { title: 'Kitchen renovation', status: 'in_production' } }),
    rec({ id: 'o2', type: 'sales_order', cardKind: 'sales_order', title: 'SO-1043', subtitle: 'Beta Builders', data: { title: 'Office fit-out', status: 'awaiting_deposit' } }),
  ];

  it('finds an order by orderNumber exactly', () => {
    const fuse = new Fuse(orders, FUSE_CONFIGS.sales_order);
    const results = fuse.search('SO-1042');
    expect(results[0]?.item.id).toBe('o1');
  });

  it('finds an order by customer name', () => {
    const fuse = new Fuse(orders, FUSE_CONFIGS.sales_order);
    const results = fuse.search('Acme');
    expect(results[0]?.item.id).toBe('o1');
  });
});

describe('configForType fallback', () => {
  it('builds a usable Fuse config for an arbitrary SearchConfig', () => {
    const cfg = {
      module: 'custom',
      type: 'thing',
      label: 'Things',
      collection: 'things',
      searchFields: ['name', 'tag'],
      displayField: 'name',
      icon: 'Box',
      urlTemplate: '/things/{id}',
    };
    const fuseOpts = configForType(cfg as any);
    expect(fuseOpts.threshold).toBe(0.4);
    const fuse = new Fuse(
      [
        rec({ id: 't1', title: 'Widget', data: { tag: 'gadget' } }),
        rec({ id: 't2', title: 'Sprocket', data: { tag: 'tool' } }),
      ],
      fuseOpts,
    );
    expect(fuse.search('widget')[0]?.item.id).toBe('t1');
  });
});
