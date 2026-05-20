/**
 * ClipDetail - Detailed view of a single clip
 */

import { useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Tag,
  Trash2,
  Edit2,
  Save,
  X,
  Ruler,
  DollarSign,
  Palette,
  Box,
  Sparkles,
  Loader2,
  RefreshCw,
  Hammer,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { PopupClipRecord } from '../types';
import { SyncBadge } from './SyncBadge';

interface ClipDetailProps {
  clip: PopupClipRecord;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<PopupClipRecord>) => void;
  onDelete: (id: string) => void;
  onAnalyze?: (id: string) => void;
}

export function ClipDetail({ clip, onBack, onUpdate, onDelete, onAnalyze }: ClipDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedClip, setEditedClip] = useState(clip);
  const [newTag, setNewTag] = useState('');

  const handleSave = () => {
    onUpdate(clip.id, {
      title: editedClip.title,
      description: editedClip.description,
      notes: editedClip.notes,
      tags: editedClip.tags,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedClip(clip);
    setIsEditing(false);
  };

  const addTag = () => {
    if (newTag.trim() && !editedClip.tags.includes(newTag.trim())) {
      setEditedClip({
        ...editedClip,
        tags: [...editedClip.tags, newTag.trim()],
      });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setEditedClip({
      ...editedClip,
      tags: editedClip.tags.filter((t) => t !== tag),
    });
  };

  const imageUrl = clip.thumbnailDataUrl || clip.imageUrl;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <SyncBadge status={clip.syncStatus} />
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleSave}
                className="p-1.5 text-primary hover:bg-primary/10 rounded"
              >
                <Save className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(clip.id)}
                className="p-1.5 text-error hover:bg-error/10 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Image */}
        <div className="relative bg-gray-100">
          <img
            src={imageUrl}
            alt={clip.title}
            className="w-full h-48 object-contain"
          />
          <a
            href={clip.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow hover:bg-white"
          >
            <ExternalLink className="w-4 h-4 text-gray-600" />
          </a>
        </div>

        {/* Details */}
        <div className="p-4 space-y-4">
          {/* Title */}
          {isEditing ? (
            <input
              type="text"
              value={editedClip.title}
              onChange={(e) => setEditedClip({ ...editedClip, title: e.target.value })}
              className="w-full text-lg font-semibold border-b border-gray-200 pb-1 focus:outline-none focus:border-primary"
            />
          ) : (
            <h2 className="text-lg font-semibold">{clip.title || 'Untitled'}</h2>
          )}

          {/* Brand */}
          {clip.brand && (
            <p className="text-sm text-gray-500">{clip.brand}</p>
          )}

          {/* Price & Dimensions */}
          <div className="flex flex-wrap gap-3">
            {clip.price && (
              <div className="flex items-center gap-1.5 text-sm">
                <DollarSign className="w-4 h-4 text-success" />
                <span className="font-medium">{clip.price.formatted}</span>
              </div>
            )}
            {clip.dimensions && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Ruler className="w-4 h-4" />
                <span>
                  {clip.dimensions.width}" × {clip.dimensions.height}"
                  {clip.dimensions.depth && ` × ${clip.dimensions.depth}"`}
                </span>
              </div>
            )}
          </div>

          {/* Materials */}
          {clip.materials && clip.materials.length > 0 && (
            <div className="flex items-start gap-2">
              <Box className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex flex-wrap gap-1">
                {clip.materials.map((material) => (
                  <span
                    key={material}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {material}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Colors */}
          {clip.colors && clip.colors.length > 0 && (
            <div className="flex items-start gap-2">
              <Palette className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex flex-wrap gap-1">
                {clip.colors.map((color) => (
                  <span
                    key={color}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">Tags</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(isEditing ? editedClip.tags : clip.tags).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                >
                  {tag}
                  {isEditing && (
                    <button onClick={() => removeTag(tag)} className="hover:text-error">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {isEditing && (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add tag..."
                    className="w-20 px-2 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {(clip.description || isEditing) && (
            <div className="space-y-1">
              <span className="text-sm font-medium">Description</span>
              {isEditing ? (
                <textarea
                  value={editedClip.description || ''}
                  onChange={(e) => setEditedClip({ ...editedClip, description: e.target.value })}
                  className="w-full text-sm text-gray-600 border border-gray-200 rounded p-2 focus:outline-none focus:border-primary"
                  rows={3}
                />
              ) : (
                <p className="text-sm text-gray-600">{clip.description}</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <span className="text-sm font-medium">Notes</span>
            {isEditing ? (
              <textarea
                value={editedClip.notes || ''}
                onChange={(e) => setEditedClip({ ...editedClip, notes: e.target.value })}
                placeholder="Add your notes..."
                className="w-full text-sm border border-gray-200 rounded p-2 focus:outline-none focus:border-primary"
                rows={3}
              />
            ) : (
              <p className="text-sm text-gray-600">{clip.notes || 'No notes yet'}</p>
            )}
          </div>

          {/* AI Analysis */}
          {clip.analysisStatus === 'pending' || clip.analysisStatus === 'analyzing' ? (
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                <span className="text-sm font-medium text-purple-700">
                  {clip.analysisStatus === 'pending' ? 'Waiting for analysis...' : 'Analyzing with AI...'}
                </span>
              </div>
              <p className="text-xs text-purple-400 mt-1">Results will appear here automatically</p>
            </div>
          ) : clip.analysisStatus === 'failed' ? (
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700">Analysis failed</span>
                </div>
                {onAnalyze && (
                  <button
                    onClick={() => onAnalyze(clip.id)}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          ) : clip.aiAnalysis ? (
            <div className="p-3 bg-purple-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-purple-700">AI Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  {clip.aiAnalysis.confidence != null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      clip.aiAnalysis.confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                      clip.aiAnalysis.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {Math.round(clip.aiAnalysis.confidence * 100)}% conf
                    </span>
                  )}
                  {onAnalyze && (
                    <button
                      onClick={() => onAnalyze(clip.id)}
                      className="p-1 text-purple-400 hover:text-purple-600 rounded"
                      title="Re-analyze"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Product Type & Style */}
              <div className="flex flex-wrap gap-2">
                {clip.aiAnalysis.productType && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                    {clip.aiAnalysis.productType}
                  </span>
                )}
                {clip.aiAnalysis.style && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                    {clip.aiAnalysis.style}
                  </span>
                )}
              </div>

              {/* Millwork Assessment */}
              {clip.aiAnalysis.millworkAssessment && (
                <div className="p-2 bg-white/60 rounded border border-purple-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Hammer className="w-3 h-3 text-purple-500" />
                    <span className="text-xs font-medium text-purple-700">Millwork Assessment</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {clip.aiAnalysis.millworkAssessment.isCustomCandidate ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" /> Custom candidate
                      </span>
                    ) : (
                      <span className="text-gray-500">Not a custom candidate</span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      clip.aiAnalysis.millworkAssessment.complexity === 'simple' ? 'bg-green-100 text-green-700' :
                      clip.aiAnalysis.millworkAssessment.complexity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                      clip.aiAnalysis.millworkAssessment.complexity === 'complex' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {clip.aiAnalysis.millworkAssessment.complexity}
                    </span>
                  </div>
                  {clip.aiAnalysis.millworkAssessment.keyFeatures && clip.aiAnalysis.millworkAssessment.keyFeatures.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {clip.aiAnalysis.millworkAssessment.keyFeatures.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Suggested Tags */}
              {clip.aiAnalysis.suggestedTags && clip.aiAnalysis.suggestedTags.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-purple-500 uppercase tracking-wider">Suggested Tags</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {clip.aiAnalysis.suggestedTags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-purple-100/60 text-purple-600 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI-detected Materials & Colors */}
              {clip.aiAnalysis.primaryMaterials && clip.aiAnalysis.primaryMaterials.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-purple-500 uppercase tracking-wider">Detected Materials</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {clip.aiAnalysis.primaryMaterials.map((m) => (
                      <span key={m} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-xs rounded">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {clip.aiAnalysis.colors && clip.aiAnalysis.colors.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-purple-500 uppercase tracking-wider">Detected Colors</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {clip.aiAnalysis.colors.map((c) => (
                      <span
                        key={c}
                        className="w-5 h-5 rounded-full border border-gray-200"
                        style={{ backgroundColor: c.startsWith('#') ? c : undefined }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : onAnalyze && (
            <button
              onClick={() => onAnalyze(clip.id)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">Analyze with AI</span>
            </button>
          )}

          {/* Metadata */}
          <div className="pt-3 border-t border-gray-100 text-xs text-gray-400 space-y-1">
            <p>Clipped: {new Date(clip.createdAt).toLocaleString()}</p>
            {clip.sku && <p>SKU: {clip.sku}</p>}
            <p className="truncate">Source: {clip.sourceUrl}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
