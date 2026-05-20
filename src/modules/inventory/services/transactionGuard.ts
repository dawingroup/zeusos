/**
 * Transaction Guard
 * Prevents transactions (POs, BOMs, stock adjustments, sales orders)
 * from being executed against family/parent records.
 */

import { getInventoryItem } from './inventoryService';
import type { InventoryItem } from '../types';

export type TransactionGuardError =
  | 'PARENT_ITEM_NOT_TRANSACTABLE'
  | 'ITEM_NOT_ORDERABLE'
  | 'ITEM_NOT_BOM_SELECTABLE'
  | 'ITEM_NOT_ACTIVE'
  | 'ITEM_NOT_FOUND';

export type TransactionContext = 'po' | 'bom' | 'stock-adjustment' | 'sales-order';

export class InventoryTransactionError extends Error {
  public readonly code: TransactionGuardError;

  constructor(code: TransactionGuardError, message: string) {
    super(message);
    this.code = code;
    this.name = 'InventoryTransactionError';
  }
}

/**
 * Validate that an inventory item can be used in a transaction.
 * Throws InventoryTransactionError if the item is not transactable.
 *
 * @param itemId - The inventory item ID to validate
 * @param context - The transaction context (po, bom, stock-adjustment, sales-order)
 * @returns The validated InventoryItem
 */
export async function validateTransactableItem(
  itemId: string,
  context?: TransactionContext,
): Promise<InventoryItem> {
  const item = await getInventoryItem(itemId);

  if (!item) {
    throw new InventoryTransactionError(
      'ITEM_NOT_FOUND',
      `Inventory item not found: ${itemId}`,
    );
  }

  if (item.isFamily) {
    throw new InventoryTransactionError(
      'PARENT_ITEM_NOT_TRANSACTABLE',
      `Cannot transact against family record '${item.name}'. Select a specific variant.`,
    );
  }

  if (item.isOrderable === false) {
    throw new InventoryTransactionError(
      'ITEM_NOT_ORDERABLE',
      `Item '${item.name}' is not orderable. It cannot be used in purchase orders or sales orders.`,
    );
  }

  if (context === 'bom' && item.isBomSelectable === false) {
    throw new InventoryTransactionError(
      'ITEM_NOT_BOM_SELECTABLE',
      `Item '${item.name}' is not BOM-selectable. It cannot be used in bills of materials.`,
    );
  }

  if (item.status !== 'active') {
    throw new InventoryTransactionError(
      'ITEM_NOT_ACTIVE',
      `Item '${item.name}' has status '${item.status}' and cannot be used in transactions.`,
    );
  }

  return item;
}

/**
 * Check if an item is transactable without throwing.
 * Returns the validation result with error details if invalid.
 */
export async function checkTransactable(
  itemId: string,
  context?: TransactionContext,
): Promise<{ valid: true; item: InventoryItem } | { valid: false; error: InventoryTransactionError }> {
  try {
    const item = await validateTransactableItem(itemId, context);
    return { valid: true, item };
  } catch (error) {
    if (error instanceof InventoryTransactionError) {
      return { valid: false, error };
    }
    throw error;
  }
}
