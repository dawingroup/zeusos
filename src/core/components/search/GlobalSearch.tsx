import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/core/components/ui/sheet';
import { Input } from '@/core/components/ui/input';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { cn } from '@/shared/lib/utils';
import { useGlobalSearch } from '@/core/hooks/useSearch';

export interface GlobalSearchProps {
  organizationId: string;
  subsidiaryId?: string;
}

export function GlobalSearch({ organizationId, subsidiaryId }: GlobalSearchProps) {
  const navigate = useNavigate();
  const {
    isOpen,
    query,
    results,
    isLoading,
    openSearch,
    closeSearch,
    setQuery,
    commitSearch,
    getRecentSearches,
  } = useGlobalSearch({ organizationId, subsidiaryId });

  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) setRecent(getRecentSearches());
  }, [getRecentSearches, isOpen]);

  const hasQuery = query.trim().length > 0;

  const emptyState = useMemo(() => {
    if (isLoading) return 'Searching...';
    if (hasQuery && results.length === 0) return 'No results';
    if (!hasQuery && recent.length === 0) return 'Search across modules';
    return '';
  }, [hasQuery, isLoading, recent.length, results.length]);

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? openSearch() : closeSearch())}>
      <SheetContent side="top" className="p-0 border-b" aria-describedby={undefined}>
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Global Search</SheetTitle>
            <Button variant="outline" size="sm" onClick={() => closeSearch()}>
              Close
            </Button>
          </div>
        </SheetHeader>

        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees, OKRs, budgets, investors..."
                className="pl-9"
                autoFocus
              />
            </div>
            <Button
              onClick={() => {
                commitSearch();
              }}
              disabled={!hasQuery}
            >
              Search
            </Button>
          </div>

          <div className="mt-4">
            {emptyState ? (
              <div className="py-6 text-sm text-muted-foreground text-center">{emptyState}</div>
            ) : (
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-2">
                  {(hasQuery ? results : []).map((r) => (
                    <button
                      key={`${r.type}:${r.id}`}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors'
                      )}
                      onClick={() => {
                        commitSearch();
                        closeSearch();
                        navigate(r.path);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.title}</div>
                          {r.subtitle && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {r.subtitle}
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {r.module}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {r.type}
                            </Badge>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  ))}

                  {!hasQuery && recent.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground px-1">
                        Recent
                      </div>
                      {recent.map((r) => (
                        <button
                          key={r}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm"
                          onClick={() => setQuery(r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
