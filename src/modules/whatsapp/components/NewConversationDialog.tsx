/**
 * NewConversationDialog - Start a new WhatsApp conversation with a customer
 */

import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { isValidPhoneNumber } from '../utils/phoneUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  onStart: (phoneNumber: string, customerName: string) => void;
  /** Pre-fill with customer data if opening from customer detail */
  defaultPhone?: string;
  defaultName?: string;
}

export function NewConversationDialog({ open, onClose, onStart, defaultPhone, defaultName }: Props) {
  const [phone, setPhone] = useState(defaultPhone || '');
  const [name, setName] = useState(defaultName || '');

  if (!open) return null;

  const isValid = isValidPhoneNumber(phone) && name.trim();

  const handleStart = () => {
    if (!isValid) return;
    onStart(phone, name.trim());
    setPhone('');
    setName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">New WhatsApp Conversation</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter customer name"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +256 XXX XXX XXX"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Include country code. A template message will be sent first.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!isValid}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            Start Conversation
          </button>
        </div>
      </div>
    </div>
  );
}
