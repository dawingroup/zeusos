/**
 * ProjectItemsDrawer Component
 * Slide-out drawer showing all design items in the current project
 * Allows quick switching between deliverables
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Search, 
  Package, 
  ChevronRight,
  Layers,
  Check,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useDesignItems } from '../../hooks/useDesignItems';
import { StageBadge } from './StageBadge';
import { CATEGORY_LABELS, STAGE_LABELS } from '../../utils/formatting';
import type { DesignItem, DesignCategory, DesignStage } from '../../types';

interface ProjectItemsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  currentItemId?: string;
}

const CATEGORY_CONFIG: Record<DesignCategory, { icon: string; color: string; bgColor: string }> = {
  casework: { icon: '🗄️', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  furniture: { icon: '🪑', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  millwork: { icon: '🪵', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  fixtures: { icon: '💡', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  doors: { icon: '🚪', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  specialty: { icon: '✨', color: 'text-pink-600', bgColor: 'bg-pink-50' },
  architectural: { icon: '🏛️', color: 'text-slate-600', bgColor: 'bg-slate-50' },
};

const getReadinessColor = (value: number) => {
  if (value >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (value >= 50) return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
  return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' };
};

export function ProjectItemsDrawer({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentItemId,
}: ProjectItemsDrawerProps) {
  const navigate = useNavigate();
  const { items, loading } = useDesignItems(projectId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DesignCategory | 'all'>('all');
  const [selectedStage, setSelectedStage] = useState<DesignStage | 'all'>('all');

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          item.name.toLowerCase().includes(query) ||
          item.itemCode.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      
      // Stage filter
      if (selectedStage !== 'all' && item.currentStage !== selectedStage) {
        return false;
      }
      
      return true;
    });
  }, [items, searchQuery, selectedCategory, selectedStage]);

  // Get unique categories and stages from items
  const availableCategories = useMemo(() => {
    const cats = new Set(items.map(i => i.category));
    return Array.from(cats);
  }, [items]);

  const availableStages = useMemo(() => {
    const stages = new Set(items.map(i => i.currentStage));
    return Array.from(stages);
  }, [items]);

  const handleItemClick = (item: DesignItem) => {
    navigate(`/design/project/${projectId}/item/${item.id}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer - slides from left */}
      <div
        className={cn(
          'relative w-full max-w-md h-screen bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1d1d1f] via-[#2a2a2d] to-[#1d1d1f]">
          <div className="relative flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Project Items</h3>
                <p className="text-sm text-white/60">
                  {projectName || 'All deliverables'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 bg-white/10 rounded-full">
                <span className="text-xs font-medium text-white/80">{items.length} items</span>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="p-4 bg-white border-b border-gray-100 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 focus:bg-white transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2">
            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as DesignCategory | 'all')}
              className={cn(
                'flex-1 text-xs px-3 py-2 rounded-lg bg-gray-50 border-0 focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 transition-all cursor-pointer',
                selectedCategory !== 'all' ? 'bg-[#1d1d1f] text-white' : 'text-gray-600'
              )}
            >
              <option value="all">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>

            {/* Stage filter */}
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value as DesignStage | 'all')}
              className={cn(
                'flex-1 text-xs px-3 py-2 rounded-lg bg-gray-50 border-0 focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 transition-all cursor-pointer',
                selectedStage !== 'all' ? 'bg-[#1d1d1f] text-white' : 'text-gray-600'
              )}
            >
              <option value="all">All Stages</option>
              {availableStages.map(stage => (
                <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-[#1d1d1f]"></div>
                <span className="text-sm text-gray-500">Loading items...</span>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">No items found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {filteredItems.map((item) => {
                const isActive = item.id === currentItemId;
                const categoryConfig = CATEGORY_CONFIG[item.category] || { icon: '📦', color: 'text-gray-600', bgColor: 'bg-gray-50' };
                const readinessColors = getReadinessColor(item.overallReadiness);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      'w-full text-left rounded-xl transition-all duration-200 group relative overflow-hidden',
                      isActive
                        ? 'bg-gradient-to-r from-[#1d1d1f] to-[#2d2d2f] text-white shadow-lg shadow-black/10 ring-1 ring-white/10'
                        : 'bg-white hover:bg-white hover:shadow-md border border-gray-100 hover:border-gray-200'
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-purple-500" />
                    )}
                    
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Category Icon */}
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0',
                          isActive ? 'bg-white/10' : categoryConfig.bgColor
                        )}>
                          {categoryConfig.icon}
                        </div>

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'font-semibold truncate',
                              isActive ? 'text-white' : 'text-gray-900'
                            )}>
                              {item.name}
                            </span>
                            {isActive && (
                              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              'text-xs font-mono px-1.5 py-0.5 rounded',
                              isActive ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-600'
                            )}>
                              {item.itemCode}
                            </span>
                            <span className={cn(
                              'text-xs',
                              isActive ? 'text-white/60' : 'text-gray-400'
                            )}>
                              {CATEGORY_LABELS[item.category]}
                            </span>
                          </div>

                          {/* Stage & Readiness Row */}
                          <div className="flex items-center justify-between mt-3">
                            <StageBadge 
                              stage={item.currentStage} 
                              size="xs"
                            />
                            
                            {/* Readiness indicator */}
                            <div className={cn(
                              'flex items-center gap-2 px-2 py-1 rounded-full',
                              isActive ? 'bg-white/10' : readinessColors.bg
                            )}>
                              <div className={cn(
                                'w-12 h-1.5 rounded-full overflow-hidden',
                                isActive ? 'bg-white/20' : 'bg-gray-200'
                              )}>
                                <div 
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    isActive ? 'bg-white/80' : readinessColors.bar
                                  )}
                                  style={{ width: `${item.overallReadiness}%` }}
                                />
                              </div>
                              <span className={cn(
                                'text-xs font-medium tabular-nums',
                                isActive ? 'text-white/80' : readinessColors.text
                              )}>
                                {item.overallReadiness}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                          isActive 
                            ? 'bg-white/10' 
                            : 'bg-gray-50 group-hover:bg-gray-100'
                        )}>
                          <ChevronRight className={cn(
                            'w-4 h-4 transition-transform group-hover:translate-x-0.5',
                            isActive ? 'text-white/60' : 'text-gray-400'
                          )} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="px-4 py-3 border-t border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {filteredItems.length === items.length 
                ? `${items.length} items total`
                : `${filteredItems.length} of ${items.length} items`
              }
            </span>
            <div className="flex items-center gap-1">
              {/* Ready count */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-medium text-emerald-700">
                  {items.filter(i => i.overallReadiness >= 80).length}
                </span>
              </div>
              {/* In progress count */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span className="text-xs font-medium text-amber-700">
                  {items.filter(i => i.overallReadiness >= 50 && i.overallReadiness < 80).length}
                </span>
              </div>
              {/* Needs attention count */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span className="text-xs font-medium text-red-700">
                  {items.filter(i => i.overallReadiness < 50).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectItemsDrawer;
