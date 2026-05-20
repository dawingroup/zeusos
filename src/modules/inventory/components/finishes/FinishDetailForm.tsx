/**
 * FinishDetailForm Component
 * Create/edit form for a finish document.
 * Uses React Hook Form + Zod validation.
 */

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Save, Loader2 } from 'lucide-react';
import { finishDocumentSchema, type FinishDocumentFormData } from '../../schemas/finishSchema';
import {
  FINISH_CATEGORIES,
  FINISH_AVAILABILITY_OPTIONS,
  FINISH_PATTERN_OPTIONS,
  getSubtypesForCategory,
} from '../../types/finishLibrary';
import type { FinishDocument, FinishCategory } from '../../types';
import { FinishColorPicker } from './FinishColorPicker';

interface FinishDetailFormProps {
  finish?: FinishDocument | null;
  onSave: (data: FinishDocumentFormData) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

export function FinishDetailForm({
  finish,
  onSave,
  onClose,
  saving = false,
}: FinishDetailFormProps) {
  const isEditing = !!finish;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FinishDocumentFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(finishDocumentSchema) as any,
    defaultValues: {
      name: finish?.name || '',
      code: finish?.code || '',
      category: finish?.category || 'board',
      subtype: finish?.subtype || '',
      hexColor: finish?.hexColor || '',
      secondaryColor: finish?.secondaryColor || '',
      patternType: finish?.patternType,
      costModifier: finish?.costModifier,
      costModifierType: finish?.costModifierType,
      costModifierUnit: finish?.costModifierUnit || '',
      availability: finish?.availability || 'in_stock',
      tags: finish?.tags || [],
      isActive: finish?.isActive ?? true,
      notes: finish?.notes || '',
    },
  });

  const selectedCategory = watch('category');
  const costModifierType = watch('costModifierType');
  const subtypeOptions = getSubtypesForCategory(selectedCategory as FinishCategory);

  // Reset subtype when category changes
  useEffect(() => {
    if (!finish) {
      setValue('subtype', subtypeOptions[0]?.value || '');
    }
  }, [selectedCategory]);

  const onSubmit = handleSubmit(async (data) => {
    await onSave(data as FinishDocumentFormData);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Finish' : 'New Finish'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="px-6 py-4 space-y-5">
          {/* Name & Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                {...register('name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Antique White"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                {...register('code')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500"
                placeholder="MEL-AW-001"
              />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
          </div>

          {/* Category & Subtype */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                {...register('category')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {FINISH_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtype *</label>
              {subtypeOptions.length > 0 ? (
                <select
                  {...register('subtype')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {subtypeOptions.map(st => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  {...register('subtype')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter subtype"
                />
              )}
              {errors.subtype && <p className="text-xs text-red-500 mt-1">{errors.subtype.message}</p>}
            </div>
          </div>

          {/* Color */}
          <Controller
            name="hexColor"
            control={control}
            render={({ field }) => (
              <FinishColorPicker
                label="Primary Color"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          {/* Pattern Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
            <select
              {...register('patternType')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {FINISH_PATTERN_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Cost Modifier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cost Modifier</label>
            <div className="flex items-center gap-3">
              <input
                {...register('costModifier', { valueAsNumber: true })}
                type="number"
                step="any"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <select
                {...register('costModifierType')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                <option value="percentage">Percentage (%)</option>
                <option value="absolute">Absolute</option>
              </select>
              {costModifierType === 'absolute' && (
                <input
                  {...register('costModifierUnit')}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="per sheet"
                />
              )}
            </div>
            {errors.costModifierUnit && (
              <p className="text-xs text-red-500 mt-1">{errors.costModifierUnit.message}</p>
            )}
          </div>

          {/* Availability */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Availability *</label>
            <select
              {...register('availability')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {FINISH_AVAILABILITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <Controller
              name="tags"
              control={control}
              render={({ field }) => (
                <input
                  type="text"
                  value={(field.value || []).join(', ')}
                  onChange={(e) => {
                    const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                    field.onChange(tags);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tags separated by commas"
                />
              )}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Additional notes..."
            />
            {errors.notes && <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEditing ? 'Save Changes' : 'Create Finish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
