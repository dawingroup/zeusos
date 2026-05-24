/**
 * CommandPalette Component
 * Global search + quick navigation with multi-shortcut support.
 *
 * Shortcuts (all respect text-input focus except Ctrl/Cmd combos):
 *   Cmd/Ctrl+K          — toggle palette
 *   Cmd/Ctrl+/          — toggle palette (alternate)
 *   Cmd/Ctrl+P          — open palette (pages mode)
 *   Cmd/Ctrl+Shift+F    — open palette (deep-find across all subsidiaries)
 *   /                   — open palette (only when no input focused)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Star,
  Clock,
  ArrowRight,
  Command,
  CornerDownLeft,
  Database,
  Globe,
} from 'lucide-react';
import { getIconByName } from '@/shared/utils/iconMap';
import { cn } from '@/shared/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/core/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Input } from '@/core/components/ui/input';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { globalSearch, type SearchScope } from '@/core/services/searchService';
import type { SearchResult } from '@/integration/types';
import { Badge } from '@/core/components/ui/badge';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useSearchIndex } from '@/core/hooks/useSearchIndex';
import { searchIndex, type SearchHit } from '@/core/services/search/searchIndex';
import { SearchCard } from './SearchCard';
import { useGlobalState } from '@/integration/store';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  path: string;
  icon?: string;
  category: 'navigation' | 'action' | 'recent' | 'favorite';
  keywords?: string[];
  /** Optional keyboard shortcut hint (e.g. "G S"). */
  shortcut?: string;
}

interface CommandPaletteProps {
  items: CommandItem[];
  recentItems?: string[];
  favoriteItems?: string[];
  onAddFavorite?: (id: string) => void;
  onRemoveFavorite?: (id: string) => void;
  onSelect?: () => void;
  /** Organization scope for Firestore content search. */
  organizationId?: string;
  /** Active subsidiary — limits which collections are queried. */
  subsidiaryId?: string;
}

type PaletteMode = 'default' | 'pages' | 'deep-find';

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
};

export function CommandPalette({
  items,
  recentItems = [],
  favoriteItems = [],
  onAddFavorite,
  onRemoveFavorite,
  onSelect,
  organizationId,
  subsidiaryId,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>('default');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dataResults, setDataResults] = useState<SearchResult[]>([]);
  const [isSearchingData, setIsSearchingData] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // ----- V2 (indexed search) plumbing -----
  const v2Enabled = useFeatureFlag('GLOBAL_SEARCH_V2');
  const { search: indexSearch, ready: indexReady } = useSearchIndex();
  const { state: globalState } = useGlobalState();

  // V2 hits — synchronous from in-memory index. `default` mode uses the
  // index; `deep-find` falls through to the legacy Firestore globalSearch
  // path below so cross-subsidiary search still works.
  const v2Hits: SearchHit[] = useMemo(() => {
    if (!v2Enabled) return [];
    if (mode !== 'default') return [];
    const text = query.trim();
    if (!text) return [];
    return indexSearch(text, { limit: 15 });
  }, [v2Enabled, mode, query, indexSearch]);

  // V2 empty-state — recently-opened records (resolved via the index).
  const v2RecentHits: SearchHit[] = useMemo(() => {
    if (!v2Enabled || query.trim() || mode !== 'default') return [];
    const out: SearchHit[] = [];
    for (const item of globalState.preferences.recentItems.slice(0, 8)) {
      const rec = searchIndex.getRecordById(item.type, item.id);
      if (rec) out.push({ record: rec, score: 0 });
    }
    return out;
  }, [v2Enabled, query, mode, globalState.preferences.recentItems]);

  // Global keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+Shift+F — deep find (ignores subsidiary scope)
      if (mod && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setMode('deep-find');
        setOpen(true);
        return;
      }

      // Cmd/Ctrl+P — pages navigator (nav only)
      if (mod && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setMode('pages');
        setOpen(true);
        return;
      }

      // Cmd/Ctrl+K or Cmd/Ctrl+/ — default
      if (mod && (e.key === 'k' || e.key === 'K' || e.key === '/')) {
        e.preventDefault();
        setMode('default');
        setOpen((prev) => !prev);
        return;
      }

      // Bare "/" — only when not typing in an input
      if (e.key === '/' && !mod && !e.altKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        setMode('default');
        setOpen(true);
        return;
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Reset when palette opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setDataResults([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Firestore content search (debounced) — skipped in "pages" mode and
  // when V2 is on for the default mode (in-memory index handles it).
  // Deep-find still falls back to Firestore so cross-subsidiary search works.
  useEffect(() => {
    if (!open || mode === 'pages') {
      setDataResults([]);
      return;
    }
    if (v2Enabled && mode === 'default') {
      // V2 default mode uses the in-memory index synchronously.
      setDataResults([]);
      setIsSearchingData(false);
      return;
    }
    const text = query.trim();
    if (!text || !organizationId) {
      setDataResults([]);
      return;
    }

    setIsSearchingData(true);
    const handle = window.setTimeout(async () => {
      try {
        const scope: SearchScope = { organizationId, subsidiaryId };
        const response = await globalSearch(scope, {
          text,
          limit: 15,
          includeAllSubsidiaries: mode === 'deep-find',
        });
        setDataResults(response.results);
      } catch (err) {
        console.error('[CommandPalette] data search failed', err);
        setDataResults([]);
      } finally {
        setIsSearchingData(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(handle);
      setIsSearchingData(false);
    };
  }, [open, mode, query, organizationId, subsidiaryId, v2Enabled]);

  const getIcon = (iconName?: string) => {
    if (!iconName) return null;
    const Icon = getIconByName(iconName);
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  // Filter navigation items
  const filteredItems = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
      const favorites = items.filter((i) => favoriteItems.includes(i.id));
      const recent = items.filter((i) => recentItems.includes(i.id) && !favoriteItems.includes(i.id));
      const others = items.filter((i) => !favoriteItems.includes(i.id) && !recentItems.includes(i.id));

      return [
        ...favorites.map((i) => ({ ...i, category: 'favorite' as const })),
        ...recent.map((i) => ({ ...i, category: 'recent' as const })),
        ...others.slice(0, 10),
      ];
    }

    return items
      .filter((item) => {
        const searchText = [item.label, item.description, ...(item.keywords || [])]
          .join(' ')
          .toLowerCase();
        return searchText.includes(lowerQuery);
      })
      .slice(0, 15);
  }, [items, query, recentItems, favoriteItems]);

  // Flat list for keyboard navigation: nav items first, then data results
  // (legacy, flag-OFF or deep-find), then v2 hits / recents (flag-ON).
  const combined = useMemo(() => {
    const nav = filteredItems.map((item) => ({ kind: 'nav' as const, item }));
    const legacyData =
      mode === 'pages'
        ? []
        : dataResults.map((r) => ({ kind: 'data' as const, result: r }));
    const v2 = (v2Hits.length > 0 ? v2Hits : v2RecentHits).map((hit) => ({
      kind: 'v2' as const,
      hit,
    }));
    return [...nav, ...legacyData, ...v2];
  }, [filteredItems, dataResults, mode, v2Hits, v2RecentHits]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, combined.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter': {
          e.preventDefault();
          const entry = combined[selectedIndex];
          if (!entry) return;
          const path =
            entry.kind === 'nav' ? entry.item.path
            : entry.kind === 'data' ? entry.result.path
            : entry.hit.record.path;
          navigate(path);
          setOpen(false);
          onSelect?.();
          break;
        }
        case 'Escape':
          setOpen(false);
          break;
      }
    },
    [combined, selectedIndex, navigate, onSelect]
  );

  const handleSelectNav = (item: CommandItem) => {
    navigate(item.path);
    setOpen(false);
    onSelect?.();
  };

  const handleSelectData = (result: SearchResult) => {
    navigate(result.path);
    setOpen(false);
    onSelect?.();
  };

  const handleSelectHit = (hit: SearchHit) => {
    navigate(hit.record.path);
    setOpen(false);
    onSelect?.();
  };

  const toggleFavorite = (e: React.MouseEvent, item: CommandItem) => {
    e.stopPropagation();
    if (favoriteItems.includes(item.id)) {
      onRemoveFavorite?.(item.id);
    } else {
      onAddFavorite?.(item.id);
    }
  };

  // Group nav items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      favorite: [],
      recent: [],
      navigation: [],
      action: [],
    };
    filteredItems.forEach((item) => {
      groups[item.category]?.push(item);
    });
    return groups;
  }, [filteredItems]);

  const placeholder =
    mode === 'deep-find'
      ? 'Deep find across all subsidiaries...'
      : mode === 'pages'
        ? 'Jump to page...'
        : 'Search pages, records, actions...';

  const modeBadge =
    mode === 'deep-find' ? (
      <Badge variant="secondary" className="text-[10px] gap-1">
        <Globe className="h-3 w-3" /> Deep find
      </Badge>
    ) : mode === 'pages' ? (
      <Badge variant="secondary" className="text-[10px]">Pages</Badge>
    ) : null;

  const navOffset = 0;
  const dataOffset = filteredItems.length;

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => {
          setMode('default');
          setOpen(true);
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg border border-border/50 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-background rounded border">
          <Command className="h-3 w-3" />
          <span>K</span>
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden" aria-describedby={undefined}>
          <VisuallyHidden.Root>
            <DialogTitle>Command Palette</DialogTitle>
          </VisuallyHidden.Root>

          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="border-0 p-0 h-auto text-base focus-visible:ring-0 shadow-none"
            />
            {modeBadge}
          </div>

          {/* Results */}
          <ScrollArea className="max-h-[480px]">
            <div className="p-2">
              {combined.length === 0 && !isSearchingData ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No results found</p>
                </div>
              ) : (
                <>
                  {/* Favorites */}
                  {groupedItems.favorite.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3" /> Favorites
                      </div>
                      {groupedItems.favorite.map((item, index) => (
                        <CommandItemRow
                          key={item.id}
                          item={item}
                          selected={navOffset + index === selectedIndex}
                          isFavorite={favoriteItems.includes(item.id)}
                          onSelect={() => handleSelectNav(item)}
                          onToggleFavorite={(e) => toggleFavorite(e, item)}
                          getIcon={getIcon}
                        />
                      ))}
                    </div>
                  )}

                  {/* Recent */}
                  {groupedItems.recent.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Recent
                      </div>
                      {groupedItems.recent.map((item, index) => {
                        const actualIndex = navOffset + groupedItems.favorite.length + index;
                        return (
                          <CommandItemRow
                            key={item.id}
                            item={item}
                            selected={actualIndex === selectedIndex}
                            isFavorite={favoriteItems.includes(item.id)}
                            onSelect={() => handleSelectNav(item)}
                            onToggleFavorite={(e) => toggleFavorite(e, item)}
                            getIcon={getIcon}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Navigation */}
                  {groupedItems.navigation.length > 0 && (
                    <div className="mb-2">
                      {(groupedItems.favorite.length > 0 || groupedItems.recent.length > 0) && (
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Pages
                        </div>
                      )}
                      {groupedItems.navigation.map((item, index) => {
                        const actualIndex =
                          navOffset +
                          groupedItems.favorite.length +
                          groupedItems.recent.length +
                          index;
                        return (
                          <CommandItemRow
                            key={item.id}
                            item={item}
                            selected={actualIndex === selectedIndex}
                            isFavorite={favoriteItems.includes(item.id)}
                            onSelect={() => handleSelectNav(item)}
                            onToggleFavorite={(e) => toggleFavorite(e, item)}
                            getIcon={getIcon}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Legacy Data Results — flag-OFF default mode + deep-find always */}
                  {mode !== 'pages' && (dataResults.length > 0 || isSearchingData) && (
                    <div>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        {mode === 'deep-find' ? 'All subsidiaries' : 'Records'}
                        {isSearchingData && (
                          <span className="ml-1 text-[10px] opacity-70">searching…</span>
                        )}
                      </div>
                      {dataResults.map((r, index) => {
                        const actualIndex = dataOffset + index;
                        return (
                          <DataResultRow
                            key={`${r.type}:${r.id}`}
                            result={r}
                            selected={actualIndex === selectedIndex}
                            onSelect={() => handleSelectData(r)}
                            getIcon={getIcon}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* V2 Indexed Results (flag ON, default mode). Empty-query
                      shows recently-opened records as the empty state. */}
                  {v2Enabled && mode === 'default' && (v2Hits.length > 0 || v2RecentHits.length > 0) && (
                    <div>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        {v2Hits.length > 0 ? 'Records' : 'Recent records'}
                        {!indexReady && (
                          <span className="ml-1 text-[10px] opacity-70">indexing…</span>
                        )}
                      </div>
                      {(v2Hits.length > 0 ? v2Hits : v2RecentHits).map((hit, index) => {
                        const actualIndex = dataOffset + dataResults.length + index;
                        return (
                          <SearchCard
                            key={`${hit.record.type}:${hit.record.id}`}
                            hit={hit}
                            selected={actualIndex === selectedIndex}
                            onSelect={() => handleSelectHit(hit)}
                            query={query}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-background rounded border text-[10px]">↑</kbd>
                <kbd className="px-1 py-0.5 bg-background rounded border text-[10px]">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> select
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-background rounded border text-[10px]">⌘</kbd>
                <kbd className="px-1 py-0.5 bg-background rounded border text-[10px]">⇧F</kbd>
                deep find
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-background rounded border text-[10px]">esc</kbd>
              close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface CommandItemRowProps {
  item: CommandItem;
  selected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  getIcon: (name?: string) => React.ReactNode;
}

function CommandItemRow({
  item,
  selected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  getIcon,
}: CommandItemRowProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group',
        selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
      )}
    >
      <span className="text-muted-foreground shrink-0">{getIcon(item.icon)}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.label}</div>
        {item.description && (
          <div className="text-xs text-muted-foreground truncate">{item.description}</div>
        )}
      </div>
      {item.shortcut && (
        <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center rounded text-[10.5px] font-mono font-medium bg-[var(--bg-sunken)] text-[var(--fg-secondary)] mr-1">
          {item.shortcut}
        </kbd>
      )}
      <button
        onClick={onToggleFavorite}
        className={cn(
          'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
          isFavorite ? 'text-[var(--rag-amber)] opacity-100' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-current')} />
      </button>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

interface DataResultRowProps {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
  getIcon: (name?: string) => React.ReactNode;
}

function DataResultRow({ result, selected, onSelect, getIcon }: DataResultRowProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
        selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
      )}
    >
      <span className="text-muted-foreground shrink-0">{getIcon(result.icon)}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{result.title}</div>
        {result.subtitle && (
          <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
        )}
      </div>
      <Badge variant="outline" className="text-[10px] capitalize shrink-0">
        {result.type.replace(/_/g, ' ')}
      </Badge>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

export default CommandPalette;
