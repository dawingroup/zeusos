/**
 * CategorySelect
 * Dynamic category dropdown backed by Firestore inventoryCategories.
 * Drop-in replacement for hardcoded INVENTORY_CATEGORIES selects.
 */

import React from 'react';
import { useCategories, type CategoryNode } from '../hooks/useCategories';

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Show "All Categories" option (for filters). */
  showAll?: boolean;
  allLabel?: string;
  /** Include inactive categories. */
  includeInactive?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
}

function renderOptions(nodes: CategoryNode[], depth: number): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  for (const node of nodes) {
    if (!node.isActive) continue;
    if (!node.allowItems && node.children.length === 0) continue;

    const indent = '\u00A0\u00A0'.repeat(depth);
    const prefix = node.icon ? `${node.icon} ` : '';

    if (node.allowItems) {
      items.push(
        <option key={node.slug} value={node.slug}>
          {indent}{prefix}{node.name}
        </option>,
      );
    }

    if (node.children.length > 0) {
      items.push(...renderOptions(node.children, depth + 1));
    }
  }
  return items;
}

export default function CategorySelect({
  value,
  onChange,
  showAll = false,
  allLabel = 'All Categories',
  className = '',
  disabled = false,
  id,
}: CategorySelectProps) {
  const { tree, loading } = useCategories();

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled || loading}
    >
      {showAll && <option value="">{allLabel}</option>}
      {loading ? (
        <option value="">Loading…</option>
      ) : (
        renderOptions(tree, 0)
      )}
    </select>
  );
}
