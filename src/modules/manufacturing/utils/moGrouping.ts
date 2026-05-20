import type { ManufacturingOrder } from '../types';

type GroupableOrder = Pick<
  ManufacturingOrder,
  'projectId' | 'designProjectId' | 'projectCode' | 'salesOrderId'
> & {
  projectName?: unknown;
  customerName?: unknown;
};

export interface MOProjectSalesOrderGroup<T extends GroupableOrder> {
  key: string;
  projectId: string | null;
  salesOrderId: string | null;
  projectCode: string;
  projectName: string;
  customerName: string;
  label: string;
  orders: T[];
}

export function getMOProjectId(order: GroupableOrder): string {
  return order.designProjectId ?? order.projectId ?? 'unlinked';
}

export function getMOSalesOrderId(order: GroupableOrder): string {
  return order.salesOrderId ?? 'no-so';
}

export function getMOProjectSalesOrderGroupKey(order: GroupableOrder): string {
  return `${getMOProjectId(order)}|${getMOSalesOrderId(order)}`;
}

export function getMOProjectSalesOrderLabel(order: GroupableOrder): string {
  const projectCode = typeof order.projectCode === 'string' && order.projectCode.trim()
    ? order.projectCode
    : 'Unlinked Project';
  const salesOrderId = order.salesOrderId ?? 'No SO';
  return `${projectCode} / ${salesOrderId}`;
}

export function groupManufacturingOrdersByProjectSalesOrder<T extends GroupableOrder>(
  orders: T[],
): Array<MOProjectSalesOrderGroup<T>> {
  const groups = new Map<string, MOProjectSalesOrderGroup<T>>();

  for (const order of orders) {
    const key = getMOProjectSalesOrderGroupKey(order);
    const projectId = order.designProjectId ?? order.projectId ?? null;
    const salesOrderId = order.salesOrderId ?? null;
    const projectCode = typeof order.projectCode === 'string' ? order.projectCode : '';
    const projectName = typeof order.projectName === 'string' && order.projectName.trim()
      ? order.projectName
      : (projectCode || 'Unlinked Orders');
    const customerName = typeof order.customerName === 'string' ? order.customerName : '';

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        projectId,
        salesOrderId,
        projectCode,
        projectName,
        customerName,
        label: getMOProjectSalesOrderLabel(order),
        orders: [],
      });
    }

    groups.get(key)!.orders.push(order);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (b.orders.length !== a.orders.length) return b.orders.length - a.orders.length;
    return a.label.localeCompare(b.label);
  });
}
