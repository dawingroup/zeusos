/**
 * DealLinkerDialog - Link a WhatsApp conversation to a CRM deal
 */

import { useState, useCallback } from 'react';
import { X, Search, Link2, Loader2, Unlink } from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import {
  linkConversationToDeal,
  unlinkConversationFromDeal,
  searchDeals,
} from '../services/crmIntegrationService';

interface Props {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  currentDealId?: string | null;
  currentDealTitle?: string | null;
}

export function DealLinkerDialog({
  open,
  onClose,
  conversationId,
  currentDealId,
  currentDealTitle,
}: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{
    id: string;
    title: string;
    dealNumber?: string;
    customerName?: string;
    stage?: string;
  }>>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const deals = await searchDeals(search.trim());
      setResults(deals);
    } catch (err) {
      console.error('Deal search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [search]);

  const handleLink = async (dealId: string, dealTitle: string) => {
    if (!user) return;
    setLinking(true);
    try {
      await linkConversationToDeal(conversationId, dealId, dealTitle, user.uid);
      onClose();
    } catch (err) {
      console.error('Failed to link deal:', err);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!currentDealId) return;
    setLinking(true);
    try {
      await unlinkConversationFromDeal(conversationId, currentDealId);
      onClose();
    } catch (err) {
      console.error('Failed to unlink deal:', err);
    } finally {
      setLinking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-green-600" />
            Link to CRM Deal
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Current link */}
          {currentDealId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Currently linked to</p>
                <p className="text-sm font-medium text-gray-900">{currentDealTitle}</p>
              </div>
              <button
                onClick={handleUnlink}
                disabled={linking}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200"
              >
                <Unlink className="w-3 h-3" />
                Unlink
              </button>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search deals by title, number, or customer..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !search.trim()}
              className="px-3 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => handleLink(deal.id, deal.title)}
                  disabled={linking || deal.id === currentDealId}
                  className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <p className="font-medium text-sm">{deal.title}</p>
                  <div className="flex gap-2 mt-1 text-xs text-gray-500">
                    {deal.dealNumber && <span>{deal.dealNumber}</span>}
                    {deal.customerName && <span>{deal.customerName}</span>}
                    {deal.stage && (
                      <span className="bg-gray-100 rounded px-1.5 py-0.5">{deal.stage}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && search && !searching && (
            <p className="text-sm text-gray-500 text-center py-4">No deals found</p>
          )}
        </div>
      </div>
    </div>
  );
}
