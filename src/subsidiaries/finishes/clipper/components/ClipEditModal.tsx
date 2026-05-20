/**
 * ClipEditModal Component
 * Modal for editing clip details
 */

import React, { useState } from 'react';
import { X, Save, Loader2, Lightbulb, Image, Puzzle, ShoppingCart, Palette, Wrench, Rocket } from 'lucide-react';
import type { DesignClip, ClipType } from '../types';

const CLIP_TYPES: { value: ClipType; label: string; icon: React.ElementType }[] = [
  { value: 'inspiration', label: 'Inspiration', icon: Lightbulb },
  { value: 'reference', label: 'Reference', icon: Image },
  { value: 'parts-source', label: 'Parts Source', icon: Puzzle },
  { value: 'procurement', label: 'Procurement', icon: ShoppingCart },
  { value: 'material', label: 'Material', icon: Palette },
  { value: 'asset', label: 'Asset', icon: Wrench },
  { value: 'product-idea', label: 'Product Idea', icon: Rocket },
];

interface ClipEditModalProps {
  clip: DesignClip;
  onClose: () => void;
  onSave: (updates: Partial<DesignClip>) => Promise<void>;
}

export function ClipEditModal({ clip, onClose, onSave }: ClipEditModalProps) {
  const [title, setTitle] = useState(clip.title);
  const [description, setDescription] = useState(clip.description || '');
  const [clipType, setClipType] = useState<ClipType>(clip.clipType || 'inspiration');
  const [tags, setTags] = useState(clip.tags.join(', '));
  const [notes, setNotes] = useState(clip.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await onSave({
        title,
        description: description || undefined,
        clipType,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        notes: notes || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Edit Clip</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Preview */}
          <div className="flex gap-4">
            <img
              src={clip.thumbnailUrl || clip.imageUrl}
              alt={clip.title}
              className="w-24 h-24 object-cover rounded-lg"
            />
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>

          {/* Clip Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Clip Type</label>
            <div className="grid grid-cols-2 gap-2">
              {CLIP_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setClipType(value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                    clipType === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Brief description..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Comma-separated tags..."
            />
            <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Additional notes..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
