/**
 * ComposeBar - Message input area with template button
 * Disabled when 24-hour window is closed
 */

import { useState, useCallback } from 'react';
import { Send, FileText, Loader2 } from 'lucide-react';
import { TemplatePicker } from './TemplatePicker';
import type { WindowState, TemplateFormData } from '../types';

interface Props {
  windowState: WindowState;
  onSendText: (text: string) => void;
  onSendTemplate: (data: TemplateFormData) => void;
  sending: boolean;
  disabled?: boolean;
}

export function ComposeBar({ windowState, onSendText, onSendTemplate, sending, disabled }: Props) {
  const [text, setText] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const canSendText = windowState.isOpen && !disabled;

  const handleSendText = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !canSendText) return;
    onSendText(trimmed);
    setText('');
  }, [text, canSendText, onSendText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText]
  );

  const handleSendTemplate = useCallback(
    (data: TemplateFormData) => {
      onSendTemplate(data);
      setShowTemplatePicker(false);
    },
    [onSendTemplate]
  );

  return (
    <>
      <div className="border-t bg-white px-4 py-3">
        {/* Template button - always visible */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplatePicker(true)}
            disabled={disabled || sending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 disabled:opacity-50 transition-colors"
            title="Send template message"
          >
            <FileText className="w-4 h-4" />
            Template
          </button>

          {/* Text input - only when window is open */}
          <div className="flex-1 flex items-center gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canSendText || sending}
              placeholder={
                canSendText
                  ? 'Type a message...'
                  : 'Window closed — use a template message'
              }
              rows={1}
              className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              onClick={handleSendText}
              disabled={!text.trim() || !canSendText || sending}
              className="p-2 text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <TemplatePicker
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSend={handleSendTemplate}
        sending={sending}
      />
    </>
  );
}
