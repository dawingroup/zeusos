import { describe, expect, it } from 'vitest';
import {
  getMOProjectSalesOrderGroupKey,
  groupManufacturingOrdersByProjectSalesOrder,
} from '../moGrouping';

describe('moGrouping utilities', () => {
  it('builds a stable key from design project and sales order', () => {
    const key = getMOProjectSalesOrderGroupKey({
      projectId: 'DP-100',
      salesOrderId: 'SO-100',
    });

    expect(key).toBe('DP-100|SO-100');
  });

  it('falls back to unlinked/no-so keys when links are missing', () => {
    const key = getMOProjectSalesOrderGroupKey({
      projectId: undefined,
      salesOrderId: undefined,
    });

    expect(key).toBe('unlinked|no-so');
  });

  it('groups orders by project + sales order combination', () => {
    const grouped = groupManufacturingOrdersByProjectSalesOrder([
      { id: '1', projectId: 'DP-1', projectCode: 'DF-1', salesOrderId: 'SO-1' },
      { id: '2', projectId: 'DP-1', projectCode: 'DF-1', salesOrderId: 'SO-1' },
      { id: '3', projectId: 'DP-1', projectCode: 'DF-1', salesOrderId: 'SO-2' },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].key).toBe('DP-1|SO-1');
    expect(grouped[0].orders).toHaveLength(2);
    expect(grouped[1].key).toBe('DP-1|SO-2');
    expect(grouped[1].orders).toHaveLength(1);
  });
});
