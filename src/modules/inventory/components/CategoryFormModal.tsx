/**
 * CategoryFormModal
 * Create / Edit category form in a modal dialog.
 */

import React, { useState } from 'react';
import {
  createCategory,
  updateCategory,
  type CategoryDoc,
} from '../services/categoryService';

interface CategoryFormModalProps {
  category?: CategoryDoc;
  categories: CategoryDoc[];
  onClose: () => void;
}

export default function CategoryFormModal({
  category,
  categories,
  onClose,
}: CategoryFormModalProps) {
  const isEdit = !!category;

  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [color, setColor] = useState(category?.color ?? '');
  const [parentSlug, setParentSlug] = useState(category?.parentSlug ?? '');
  const [allowItems, setAllowItems] = useState(category?.allowItems ?? true);
  const [expenseOnIssue, setExpenseOnIssue] = useState(category?.expenseOnIssue ?? false);
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Potential parents: exclude self and own descendants
  const potentialParents = categories.filter((c) => {
    if (!isEdit) return c.isActive;
    if (c.slug === category.slug) return false;
    if (c.path.includes(category.slug)) return false;
    return c.isActive;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const parent = parentSlug
        ? categories.find((c) => c.slug === parentSlug)
        : null;

      const depth = parent ? parent.depth + 1 : 0;
      if (depth > 2) {
        setError('Maximum nesting depth is 3 levels');
        setSaving(false);
        return;
      }

      const path = parent ? [...parent.path, name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')] : [name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')];

      if (isEdit) {
        await updateCategory(category.slug, {
          name: name.trim(),
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
          color: color.trim() || undefined,
          parentSlug: parentSlug || null,
          allowItems,
          expenseOnIssue,
          sortOrder,
          depth,
          path: parentSlug !== category.parentSlug ? path : undefined,
        });
      } else {
        await createCategory({
          name: name.trim(),
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
          color: color.trim() || undefined,
          parentSlug: parentSlug || null,
          depth,
          path,
          sortOrder,
          isSystem: false,
          isActive: true,
          allowItems,
          expenseOnIssue,
          defaultClassification: undefined,
        });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {isEdit ? 'Edit Category' : 'New Category'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. Consumables"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Optional description"
              />
            </div>

            {/* Icon + Color row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Icon (emoji)
                </label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. &#x1F4E6;"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. indigo"
                />
              </div>
            </div>

            {/* Parent Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Category
              </label>
              <select
                value={parentSlug}
                onChange={(e) => setParentSlug(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Top level —</option>
                {potentialParents
                  .filter((c) => c.depth < 2)
                  .map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {'\u00A0\u00A0'.repeat(c.depth)}
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allowItems}
                  onChange={(e) => setAllowItems(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  Allow items (can assign inventory items to this category)
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={expenseOnIssue}
                  onChange={(e) => setExpenseOnIssue(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  Expense on issue (journal entry when stock is issued)
                </span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
