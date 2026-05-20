/**
 * CategoriesPage
 * Route: /inventory/categories
 * Tree view of inventory categories with inline management.
 */

import { useState } from 'react';
import { useCategories, type CategoryNode } from '../hooks/useCategories';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  hasChildCategories,
} from '../services/categoryService';
import CategoryFormModal from '../components/CategoryFormModal';
import type { CategoryDoc } from '../services/categoryService';
import { Plus } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { RagBadge, Banner } from '@/shared/components/data-display';

const DEFAULT_CATEGORIES = [
  { name: 'Sheet Goods', icon: '\u{1F4E6}', sortOrder: 10, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Solid Wood', icon: '\u{1FAB5}', sortOrder: 20, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Hardware', icon: '\u{1F529}', sortOrder: 30, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Edge Banding', icon: '\u{1F4CF}', sortOrder: 40, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Finishing', icon: '\u{1F3A8}', sortOrder: 50, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Adhesives', icon: '\u{1F9F4}', sortOrder: 60, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Fasteners', icon: '\u{1F527}', sortOrder: 70, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Upholstery', icon: '\u{1F6CB}\uFE0F', sortOrder: 80, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Abrasives', icon: '\u{1FAA8}', sortOrder: 90, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Services', icon: '\u{1F6E0}\uFE0F', sortOrder: 100, isSystem: true, expenseOnIssue: false, defaultClassification: 'service' },
  { name: 'Products', icon: '\u{1F3F7}\uFE0F', sortOrder: 110, isSystem: true, expenseOnIssue: false, defaultClassification: 'finished-good' },
  { name: 'Other', icon: '\u{1F4CB}', sortOrder: 120, isSystem: true, expenseOnIssue: false, defaultClassification: 'raw-material' },
  { name: 'Consumables', icon: '\u{1F9F9}', sortOrder: 130, isSystem: false, expenseOnIssue: true, defaultClassification: 'consumable' },
  { name: 'Spare Parts', icon: '\u2699\uFE0F', sortOrder: 140, isSystem: false, expenseOnIssue: true, defaultClassification: 'consumable' },
];

function CategoryRow({
  node,
  depth,
  onEdit,
  onRefresh,
}: {
  node: CategoryNode;
  depth: number;
  onEdit: (cat: CategoryDoc) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const hasChildren = node.children.length > 0;
  const indent = depth * 24;

  async function handleToggleActive() {
    await updateCategory(node.slug, { isActive: !node.isActive });
  }

  async function handleDelete() {
    if (node.isSystem) return;
    if (node.itemCount > 0) {
      alert(`Cannot delete "${node.name}" — it has ${node.itemCount} items assigned.`);
      return;
    }
    const hasKids = await hasChildCategories(node.slug);
    if (hasKids) {
      alert(`Cannot delete "${node.name}" — it has child categories.`);
      return;
    }
    if (!confirm(`Delete category "${node.name}"?`)) return;
    setDeleting(true);
    try {
      await deleteCategory(node.slug);
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr className={`border-b border-gray-100 ${!node.isActive ? 'opacity-50' : ''}`}>
        <td className="py-2 px-3" style={{ paddingLeft: `${indent + 12}px` }}>
          <span className="inline-flex items-center gap-2">
            {hasChildren && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-gray-400 hover:text-gray-600 text-sm w-5"
              >
                {expanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="w-5 inline-block" />}
            <span className="text-lg">{node.icon || '📁'}</span>
            <span className="font-medium text-gray-800">{node.name}</span>
            {node.isSystem && <RagBadge tone="blue" hideDot>system</RagBadge>}
          </span>
        </td>
        <td className="py-2 px-3 text-sm text-gray-500 font-mono">{node.slug}</td>
        <td className="py-2 px-3 text-sm text-right tabular-nums">{node.itemCount}</td>
        <td className="py-2 px-3 text-sm text-center">
          {node.expenseOnIssue ? (
            <span className="text-amber-600 font-medium">Expense</span>
          ) : (
            <span className="text-gray-400">Asset</span>
          )}
        </td>
        <td className="py-2 px-3 text-sm text-center">
          <button onClick={handleToggleActive} type="button">
            <RagBadge tone={node.isActive ? 'green' : 'na'}>
              {node.isActive ? 'Active' : 'Inactive'}
            </RagBadge>
          </button>
        </td>
        <td className="py-2 px-3 text-sm text-right">
          <button
            onClick={() => onEdit(node)}
            className="text-indigo-600 hover:text-indigo-800 mr-3"
          >
            Edit
          </button>
          {!node.isSystem && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </td>
      </tr>
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <CategoryRow
            key={child.slug}
            node={child}
            depth={depth + 1}
            onEdit={onEdit}
            onRefresh={onRefresh}
          />
        ))}
    </>
  );
}

export default function CategoriesPage() {
  const { tree, categories, loading, error } = useCategories();
  const [editingCategory, setEditingCategory] = useState<CategoryDoc | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function handleSeedDefaults() {
    setSeeding(true);
    try {
      for (const cat of DEFAULT_CATEGORIES) {
        const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        await createCategory({
          name: cat.name,
          icon: cat.icon,
          sortOrder: cat.sortOrder,
          parentSlug: null,
          depth: 0,
          path: [slug],
          isSystem: cat.isSystem,
          isActive: true,
          allowItems: true,
          expenseOnIssue: cat.expenseOnIssue,
          defaultClassification: cat.defaultClassification,
        });
      }
    } catch (err) {
      alert(`Seed failed: ${(err as Error).message}`);
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        Loading categories…
      </div>
    );
  }

  if (error) {
    return <Banner tone="danger" title="Failed to load categories" message={error.message} />;
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Inventory Categories</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            {categories.length} categories
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> New Category
        </Button>
      </div>

      {/* Tree Table */}
      <div
        className="overflow-x-auto rounded-[10px] border shadow-[var(--shadow-sm)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="border-b"
              style={{
                backgroundColor: 'var(--bg-sunken)',
                borderColor: 'var(--border-default)',
              }}
            >
              {(
                [
                  ['Category', 'left'],
                  ['Slug', 'left'],
                  ['Items', 'right'],
                  ['Accounting', 'center'],
                  ['Status', 'center'],
                  ['Actions', 'right'],
                ] as const
              ).map(([label, align]) => (
                <th
                  key={label}
                  className={`py-2.5 px-3 text-[10.5px] font-medium uppercase tracking-wider ${
                    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                  }`}
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tree.map((node) => (
              <CategoryRow
                key={node.slug}
                node={node}
                depth={0}
                onEdit={setEditingCategory}
                onRefresh={() => {}}
              />
            ))}
          </tbody>
        </table>
        {tree.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <p className="text-gray-400">No categories found.</p>
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {seeding ? 'Seeding...' : 'Seed Default Categories'}
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CategoryFormModal
          categories={categories}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit Modal */}
      {editingCategory && (
        <CategoryFormModal
          category={editingCategory}
          categories={categories}
          onClose={() => setEditingCategory(null)}
        />
      )}
    </div>
  );
}
