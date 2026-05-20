/**
 * SocialPostForm Component
 * Form for creating and editing social media posts
 */

import { useMemo, useState, useEffect } from 'react';
import { X, Save, Loader2, Image, Clock, Sparkles, AlertTriangle } from 'lucide-react';
import type { SocialMediaPost, SocialPostFormData, SocialPlatform, MediaType } from '../../types';
import { SOCIAL_PLATFORMS, POST_CONTENT_MAX_LENGTH, POST_TITLE_MAX_LENGTH } from '../../constants';
import { useCampaigns, useGenerateSocialCopy } from '../../hooks';
import type { SocialCopyVariant } from '../../hooks/useGenerateSocialCopy';
import { useAuth } from '@/contexts/AuthContext';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { validatePostAcrossPlatforms } from '../../utils/postValidation';

interface SocialPostFormProps {
  post?: SocialMediaPost;
  initialDate?: Date;
  onSubmit: (data: SocialPostFormData) => Promise<void>;
  onClose: () => void;
}

const INITIAL_FORM: SocialPostFormData = {
  title: '',
  content: '',
  platforms: [],
  mediaUrls: [],
  mediaType: 'image',
  tags: [],
};

export function SocialPostForm({ post, initialDate, onSubmit, onClose }: SocialPostFormProps) {
  const { user } = useAuth();
  const { currentSubsidiary } = useSubsidiary();
  const { campaigns } = useCampaigns(user?.companyId, { status: 'active' });
  const {
    variants: aiVariants,
    loading: aiLoading,
    error: aiError,
    generate: aiGenerate,
    reset: aiReset,
  } = useGenerateSocialCopy();

  const [form, setForm] = useState<SocialPostFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [aiTone, setAiTone] = useState('');

  const isEditing = !!post;

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title,
        content: post.content,
        platforms: post.platforms,
        mediaUrls: post.mediaUrls || [],
        mediaType: post.mediaType || 'image',
        scheduledFor: post.scheduledFor?.toDate(),
        campaignId: post.campaignId,
        tags: post.tags || [],
        category: post.category,
      });
    } else if (initialDate) {
      setForm((prev) => ({ ...prev, scheduledFor: initialDate }));
    }
  }, [post, initialDate]);

  const togglePlatform = (platform: SocialPlatform) => {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const validationByPlatform = useMemo(
    () =>
      form.platforms.length > 0
        ? validatePostAcrossPlatforms(
            {
              content: form.content,
              mediaUrls: form.mediaUrls,
              mediaType: form.mediaType,
            },
            form.platforms
          )
        : ({} as ReturnType<typeof validatePostAcrossPlatforms>),
    [form.content, form.mediaUrls, form.mediaType, form.platforms]
  );

  const handleAiGenerate = async () => {
    if (!currentSubsidiary || form.platforms.length === 0 || aiBrief.trim().length < 5) {
      return;
    }
    try {
      await aiGenerate({
        brief: aiBrief,
        subsidiaryId: currentSubsidiary.id,
        subsidiaryName: currentSubsidiary.name,
        platforms: form.platforms,
        tone: aiTone || undefined,
        mediaUrls: form.mediaUrls,
      });
    } catch {
      // surfaced via aiError
    }
  };

  const applyAiVariant = (v: SocialCopyVariant) => {
    const tagPrefix = v.hashtags.length > 0 ? '\n\n' + v.hashtags.join(' ') : '';
    const cta = v.cta ? '\n\n' + v.cta : '';
    setForm((prev) => ({ ...prev, content: `${v.caption}${cta}${tagPrefix}` }));
    setAiOpen(false);
    aiReset();
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (!form.content.trim()) newErrors.content = 'Content is required';
    if (form.content.length > POST_CONTENT_MAX_LENGTH)
      newErrors.content = `Content exceeds ${POST_CONTENT_MAX_LENGTH} characters`;
    if (form.platforms.length === 0) newErrors.platforms = 'Select at least one platform';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to save post' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Edit Post' : 'Create New Post'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={POST_TITLE_MAX_LENGTH}
              placeholder="Post title..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Content *</label>
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                disabled={form.platforms.length === 0 || !currentSubsidiary}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                title={
                  form.platforms.length === 0
                    ? 'Pick at least one platform first'
                    : 'AI suggest captions'
                }
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI suggest
              </button>
            </div>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={5}
              maxLength={POST_CONTENT_MAX_LENGTH}
              placeholder="Write your post content..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
            <div className="flex justify-between mt-1">
              {errors.content && <p className="text-xs text-red-600">{errors.content}</p>}
              <p className="text-xs text-gray-400 ml-auto">
                {form.content.length}/{POST_CONTENT_MAX_LENGTH}
              </p>
            </div>

            {aiOpen && (
              <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-purple-50/40">
                <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  AI caption assist (Gemini)
                </p>
                <textarea
                  rows={2}
                  value={aiBrief}
                  onChange={(e) => setAiBrief(e.target.value)}
                  placeholder="One-line brief, e.g. 'Launching the walnut credenza, hand-finished, available end of June'"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm resize-none"
                />
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    placeholder="Tone (optional) — confident / playful / warm…"
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={
                      aiLoading || aiBrief.trim().length < 5 || form.platforms.length === 0
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {aiLoading ? 'Thinking…' : 'Generate'}
                  </button>
                </div>
                {aiError && (
                  <p className="text-xs text-red-700 mt-2">
                    {aiError.message || 'Generation failed'}
                  </p>
                )}
                {aiVariants.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {aiVariants.map((v) => (
                      <li
                        key={v.platform}
                        className="border border-gray-200 rounded p-2 bg-white"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
                            style={{
                              backgroundColor: SOCIAL_PLATFORMS[v.platform]?.color,
                            }}
                          >
                            {SOCIAL_PLATFORMS[v.platform]?.label || v.platform}
                          </span>
                          <button
                            type="button"
                            onClick={() => applyAiVariant(v)}
                            className="text-xs text-primary font-medium hover:underline"
                          >
                            Use this
                          </button>
                        </div>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">
                          {v.caption}
                        </p>
                        {v.hashtags.length > 0 && (
                          <p className="text-[11px] text-gray-500 mt-1">
                            {v.hashtags.join(' ')}
                          </p>
                        )}
                        {v.cta && (
                          <p className="text-[11px] text-gray-600 italic mt-1">
                            CTA: {v.cta}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Platforms *</label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(SOCIAL_PLATFORMS) as [SocialPlatform, { label: string; color: string }][]).map(
                ([key, { label, color }]) => {
                  const isSelected = form.platforms.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePlatform(key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        isSelected
                          ? 'text-white border-transparent'
                          : 'text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                      style={isSelected ? { backgroundColor: color } : undefined}
                    >
                      {label}
                    </button>
                  );
                }
              )}
            </div>
            {errors.platforms && <p className="text-xs text-red-600 mt-1">{errors.platforms}</p>}

            {form.platforms.length > 0 && (
              <div className="mt-2 space-y-1">
                {form.platforms.map((platform) => {
                  const warnings = validationByPlatform[platform]?.warnings || [];
                  if (warnings.length === 0) return null;
                  return (
                    <div
                      key={platform}
                      className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">
                          {SOCIAL_PLATFORMS[platform]?.label || platform}:
                        </span>{' '}
                        {warnings.join(' · ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Media Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Media Type</label>
            <select
              value={form.mediaType}
              onChange={(e) => setForm({ ...form, mediaType: e.target.value as MediaType })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="carousel">Carousel</option>
              <option value="story">Story</option>
              <option value="reel">Reel</option>
            </select>
          </div>

          {/* Media URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1">
                <Image className="h-4 w-4" /> Media URLs
              </span>
            </label>
            <input
              type="text"
              value={form.mediaUrls.join(', ')}
              onChange={(e) =>
                setForm({
                  ...form,
                  mediaUrls: e.target.value
                    .split(',')
                    .map((u) => u.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Comma-separated image/video URLs..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter URLs separated by commas. Media upload will be available in a future release.
            </p>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> Schedule For
              </span>
            </label>
            <input
              type="datetime-local"
              value={
                form.scheduledFor
                  ? new Date(form.scheduledFor.getTime() - form.scheduledFor.getTimezoneOffset() * 60000)
                      .toISOString()
                      .slice(0, 16)
                  : ''
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  scheduledFor: e.target.value ? new Date(e.target.value) : undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave empty to save as draft
            </p>
          </div>

          {/* Campaign Link */}
          {campaigns.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link to Campaign (optional)
              </label>
              <select
                value={form.campaignId || ''}
                onChange={(e) => setForm({ ...form, campaignId: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">No campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
              >
                Add
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full"
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {errors.submit}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEditing ? 'Update Post' : form.scheduledFor ? 'Schedule Post' : 'Save Draft'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SocialPostForm;
