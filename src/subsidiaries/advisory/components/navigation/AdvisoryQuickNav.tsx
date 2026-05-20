/**
 * AdvisoryQuickNav Component
 * Quick navigation for power users with keyboard shortcut (Cmd/Ctrl+K)
 * Allows fast switching between modules and recent items
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Briefcase,
  Building2,
  FolderOpen,
  FileText,
  ChevronRight,
  Command,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface QuickNavItem {
  id: string;
  name: string;
  type: 'module' | 'project' | 'deal' | 'program' | 'action';
  module: 'investment' | 'delivery';
  path: string;
  description?: string;
}

// Static navigation items (MatFlow consolidated into Delivery)
const staticItems: QuickNavItem[] = [
  // Modules
  { id: 'investment', name: 'Investment', type: 'module', module: 'investment', path: '/advisory/investment', description: 'Deal pipeline & portfolio' },
  { id: 'delivery', name: 'Infrastructure Delivery', type: 'module', module: 'delivery', path: '/advisory/delivery', description: 'Projects, BOQ & Procurement' },
  // Quick actions - Investment
  { id: 'new-deal', name: 'New Deal', type: 'action', module: 'investment', path: '/advisory/investment/deals/new', description: 'Create investment deal' },
  { id: 'pipeline', name: 'Deal Pipeline', type: 'action', module: 'investment', path: '/advisory/investment/pipeline', description: 'View kanban pipeline' },
  // Quick actions - Delivery
  { id: 'new-project', name: 'New Project', type: 'action', module: 'delivery', path: '/advisory/delivery/projects/new', description: 'Create delivery project' },
  { id: 'programs', name: 'Programs', type: 'action', module: 'delivery', path: '/advisory/delivery/programs', description: 'Program management' },
  // Material Management (from MatFlow)
  { id: 'boq', name: 'BOQ Management', type: 'action', module: 'delivery', path: '/advisory/delivery/boq', description: 'Bills of quantities' },
  { id: 'materials', name: 'Materials', type: 'action', module: 'delivery', path: '/advisory/delivery/materials', description: 'Material library' },
  { id: 'procurement', name: 'Procurement', type: 'action', module: 'delivery', path: '/advisory/delivery/procurement', description: 'Purchase orders & suppliers' },
  // Other Delivery
  { id: 'accountability', name: 'Accountability', type: 'action', module: 'delivery', path: '/advisory/delivery/accountability', description: 'Track accountability' },
  { id: 'reports', name: 'Reports', type: 'action', module: 'delivery', path: '/advisory/delivery/reports', description: 'Analytics & reporting' },
];

const moduleIcons = {
  investment: Briefcase,
  delivery: Building2,
};

const moduleColors = {
  investment: 'text-emerald-500 bg-emerald-100',
  delivery: 'text-blue-500 bg-blue-100',
};

interface AdvisoryQuickNavProps {
  recentItems?: QuickNavItem[];
}

export function AdvisoryQuickNav({ recentItems = [] }: AdvisoryQuickNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Combine recent items with static items
  const allItems = [...recentItems, ...staticItems];

  // Filter items based on search query
  const filteredItems = searchQuery
    ? allItems.filter(
        item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.module.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allItems;

  // Handle keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle navigation within list
  const handleKeyNavigation = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[selectedIndex]);
      }
    },
    [filteredItems, selectedIndex]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (item: QuickNavItem) => {
    navigate(item.path);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        title="Quick Navigation (Cmd+K)"
      >
        <Search className="w-4 h-4" />
        <span>Quick Nav</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-white rounded border border-gray-200">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl z-50">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search modules, projects, actions..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyNavigation}
              className="flex-1 text-lg outline-none placeholder:text-gray-400"
            />
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-96 overflow-y-auto p-2">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No results found</p>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const ModuleIcon = moduleIcons[item.module];
                const TypeIcon = item.type === 'project' ? FolderOpen : item.type === 'action' ? FileText : ModuleIcon;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                      index === selectedIndex
                        ? 'bg-gray-100'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', moduleColors[item.module])}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-gray-500 truncate">{item.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="text-xs uppercase">{item.module}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border">Enter</kbd> Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border">Esc</kbd> Close
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
