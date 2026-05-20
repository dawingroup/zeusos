/**
 * Chat Input Component
 * Text input with image upload support
 */

import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Image, X, Loader2, Library } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string, imageData?: string) => Promise<void>;
  onToggleClipBrowser?: () => void;
  clipBrowserOpen?: boolean;
  isSending: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onToggleClipBrowser, clipBrowserOpen, isSending, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if ((!message.trim() && !imagePreview) || isSending || disabled) return;

    const currentMessage = message;
    const currentImage = imagePreview;
    
    setMessage('');
    setImagePreview(null);
    
    await onSend(currentMessage, currentImage || undefined);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-t border-gray-200 p-3">
      {/* Image Preview */}
      {imagePreview && (
        <div className="mb-2 relative inline-block">
          <img 
            src={imagePreview} 
            alt="Preview" 
            className="h-20 rounded-lg object-cover"
          />
          <button
            onClick={removeImage}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        {/* Image Upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending || disabled}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Upload image"
        >
          <Image className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Browse Clips */}
        {onToggleClipBrowser && (
          <button
            onClick={onToggleClipBrowser}
            disabled={isSending || disabled}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
              clipBrowserOpen
                ? 'text-purple-600 bg-purple-50 hover:bg-purple-100'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Browse clip library"
          >
            <Library className="w-5 h-5" />
          </button>
        )}

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about design, materials..."
            disabled={isSending || disabled}
            rows={1}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm"
            style={{ maxHeight: '120px', minHeight: '42px' }}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={(!message.trim() && !imagePreview) || isSending || disabled}
          className="p-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-400 mt-2 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
