/**
 * Design Brief Section
 * Free-form narrative textarea for capturing the design document brief.
 * Auto-saves to Firestore via debounce, with option to send to AI Scoping.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Send, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface DesignBriefSectionProps {
  brief: string;
  onUpdate: (brief: string) => void;
  onSendToScoping?: (brief: string) => void;
}

export function DesignBriefSection({ brief, onUpdate, onSendToScoping }: DesignBriefSectionProps) {
  const [localBrief, setLocalBrief] = useState(brief || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExpanded, setIsExpanded] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUserEdited = useRef(false);

  // Sync from parent when brief changes externally (e.g. Firestore snapshot)
  useEffect(() => {
    if (!hasUserEdited.current) {
      setLocalBrief(brief || '');
    }
  }, [brief]);

  const debouncedSave = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setSaveStatus('saving');
    debounceRef.current = setTimeout(() => {
      onUpdate(value);
      setSaveStatus('saved');
      hasUserEdited.current = false;
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  }, [onUpdate]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChange = (value: string) => {
    hasUserEdited.current = true;
    setLocalBrief(value);
    debouncedSave(value);
  };

  const wordCount = localBrief.trim() ? localBrief.trim().split(/\s+/).length : 0;

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-500" />
          <h3 className="text-base font-semibold text-gray-900">Design Document Brief</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-gray-500">
            Capture the client's design brief narrative. This can be sent directly to AI Scoping for deliverable extraction.
          </p>

          <textarea
            value={localBrief}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Paste or type the client's design brief here... e.g., scope of work, vision, materials, spatial requirements, references, and any constraints."
            className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{wordCount} words</span>
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
            </div>

            {onSendToScoping && (
              <button
                onClick={() => onSendToScoping(localBrief)}
                disabled={!localBrief.trim() || localBrief.trim().length < 20}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Send to AI Scoping
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
