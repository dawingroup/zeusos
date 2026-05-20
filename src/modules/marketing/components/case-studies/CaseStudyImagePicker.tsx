/**
 * CaseStudyImagePicker
 *
 * Two variants:
 *   <CaseStudyImagePicker mode="single"> — hero image (one URL)
 *   <CaseStudyImagePicker mode="multi">  — gallery (URL list)
 *
 * Uploads selected files to Firebase Storage via
 * `uploadCaseStudyImage`, then surfaces the public URLs to the parent
 * via the appropriate change handler.
 *
 * No reliance on Shopify here — these are dawinfinishes.com–accessible
 * URLs that the publish function later passes to Shopify's `fileCreate`
 * to bring into the Shopify Files registry.
 */

import { ChangeEvent, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { uploadCaseStudyImage } from '../../services/projectCaseStudyService';

type SingleProps = {
  mode: 'single';
  value: string;
  onChange: (url: string) => void;
  caseStudyId?: string;
  sessionId: string;
};

type MultiProps = {
  mode: 'multi';
  values: string[];
  onChange: (urls: string[]) => void;
  caseStudyId?: string;
  sessionId: string;
};

type Props = SingleProps | MultiProps;

const MAX_FILE_MB = 10;

export function CaseStudyImagePicker(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(ev: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files || []);
    ev.target.value = ''; // allow re-selecting the same file
    if (files.length === 0) return;

    // Size check before upload
    const tooBig = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} is larger than ${MAX_FILE_MB}MB. Compress before uploading.`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      if (props.mode === 'single') {
        const url = await uploadCaseStudyImage({
          file: files[0],
          kind: 'hero',
          caseStudyId: props.caseStudyId,
          sessionId: props.sessionId,
        });
        props.onChange(url);
      } else {
        const newUrls: string[] = [];
        for (const file of files) {
          const url = await uploadCaseStudyImage({
            file,
            kind: 'gallery',
            caseStudyId: props.caseStudyId,
            sessionId: props.sessionId,
          });
          newUrls.push(url);
        }
        props.onChange([...props.values, ...newUrls]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  function pick() {
    inputRef.current?.click();
  }

  function clearSingle() {
    if (props.mode === 'single') props.onChange('');
  }

  function removeAt(i: number) {
    if (props.mode === 'multi') {
      const next = [...props.values];
      next.splice(i, 1);
      props.onChange(next);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={props.mode === 'multi'}
        onChange={handleSelect}
        className="hidden"
      />

      {props.mode === 'single' && (
        <SingleHero
          value={props.value}
          uploading={uploading}
          onPick={pick}
          onClear={clearSingle}
        />
      )}

      {props.mode === 'multi' && (
        <MultiGallery
          values={props.values}
          uploading={uploading}
          onPick={pick}
          onRemoveAt={removeAt}
        />
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <p className="text-xs text-gray-500">
        JPG, PNG, or WebP. Max {MAX_FILE_MB}MB each. Stored on Firebase Storage and pushed to Shopify on publish.
      </p>
    </div>
  );
}

function SingleHero({
  value,
  uploading,
  onPick,
  onClear,
}: {
  value: string;
  uploading: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  if (value) {
    return (
      <div className="relative inline-block rounded-lg border bg-gray-50 p-1">
        <img
          src={value}
          alt="Hero"
          className="block max-h-48 max-w-full rounded object-cover"
        />
        <div className="absolute right-1 top-1 flex gap-1">
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="rounded bg-white/90 px-2 py-1 text-xs text-gray-700 shadow hover:bg-white"
          >
            {uploading ? (
              <Loader2 className="inline h-3 w-3 animate-spin" />
            ) : (
              'Replace'
            )}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={uploading}
            className="rounded bg-white/90 px-2 py-1 text-xs text-red-600 shadow hover:bg-white"
            aria-label="Remove hero image"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={uploading}
      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-gray-50 px-4 py-8 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60"
    >
      {uploading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
        </>
      ) : (
        <>
          <Upload className="h-4 w-4" /> Click to upload hero image
        </>
      )}
    </button>
  );
}

function MultiGallery({
  values,
  uploading,
  onPick,
  onRemoveAt,
}: {
  values: string[];
  uploading: boolean;
  onPick: () => void;
  onRemoveAt: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {values.map((url, i) => (
          <div key={url + i} className="relative aspect-[4/3] overflow-hidden rounded border bg-gray-50">
            <img src={url} alt={`Gallery ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemoveAt(i)}
              className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-600 shadow hover:bg-white"
              aria-label={`Remove image ${i + 1}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          className="flex aspect-[4/3] items-center justify-center gap-2 rounded border-2 border-dashed bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-4 w-4" /> Add
            </>
          )}
        </button>
      </div>
    </div>
  );
}
