/**
 * Card resolver — maps a hit's `cardKind` (defaults to its type) to a
 * concrete card component. Falls back to GenericCard for any unknown kind
 * so the system stays forward-compatible with new SearchConfig entries.
 */

import { GenericCard } from './GenericCard';
import { CustomerCard } from './CustomerCard';
import { SalesOrderCard } from './SalesOrderCard';
import { InventoryItemCard } from './InventoryItemCard';
import { DealCard } from './DealCard';
import { EmployeeCard } from './EmployeeCard';
import { ManufacturingOrderCard } from './ManufacturingOrderCard';
import { PurchaseOrderCard } from './PurchaseOrderCard';
import type { SearchCardComponent } from './types';

const REGISTRY: Record<string, SearchCardComponent> = {
  customer: CustomerCard,
  customer_contact: CustomerCard,
  sales_order: SalesOrderCard,
  inventory_item: InventoryItemCard,
  finish_library: InventoryItemCard,
  crm_deal: DealCard,
  employee: EmployeeCard,
  manufacturing_order: ManufacturingOrderCard,
  purchase_order: PurchaseOrderCard,
};

export function resolveCard(cardKind: string): SearchCardComponent {
  return REGISTRY[cardKind] ?? GenericCard;
}

export { GenericCard, CustomerCard, SalesOrderCard, InventoryItemCard, DealCard, EmployeeCard, ManufacturingOrderCard, PurchaseOrderCard };
export type { SearchCardProps, SearchCardComponent } from './types';
