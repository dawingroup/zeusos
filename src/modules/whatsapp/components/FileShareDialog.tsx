/**
 * FileShareDialog - Share a file (PDF, image, document) via WhatsApp
 */

import { useState } from 'react';
import { X, File, Send, Loader2 } from 'lucide-react';
import { sendWhatsAppMessage } from '../services/whatsappApiService';
import { logWhatsAppActivity } from '../services/crmIntegrationService';

interface Props {
  open: boolean;
  onClose: () => void;
  phoneNumber: string;
  conversationId?: string;
  dealId?: string;
}

export function FileShareDialog({ open, onClose, phoneNumber, conversationId, dealId }: Props) {
  const [fileUrl, setFileUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!fileUrl.trim()) return;
    setSending(true);
    setError(null);

    try {
      await sendWhatsAppMessage({
        conversationId,
        phoneNumber,
        messageType: 'image',
        imageUrl: fileUrl.trim(),
        imageCaption: caption || undefined,
      });

      if (dealId) {
        await logWhatsAppActivity(dealId, 'file_shared', {
          phoneNumber,
          fileUrl: fileUrl.trim(),
          caption,
        });
      }

      onClose();
      setFileUrl('');
      setCaption('');
    } catch (err: any) {
      setError(err.message || 'Failed to send file');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <File className="w-5 h-5 text-green-600" />
            Share File via WhatsApp
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-500">
            Send a file to <span className="font-medium">{phoneNumber}</span>
          </p>

          <div>
            <label className="block text-xs text-gray-500 mb-1">File URL *</label>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="https://storage.googleapis.com/..."
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder="Optional caption..."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !fileUrl.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send File
          </button>
        </div>
      </div>
    </div>
  );
}
