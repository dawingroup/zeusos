/**
 * Mobile BOQ List Component
 * Touch-friendly BOQ item list with search and filtering
 */

import { useState, useMemo } from 'react';
import { Input } from '@/core/components/ui/input';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Card, CardContent } from '@/core/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/components/ui/sheet';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import {
  Search,
  Filter,
  Package,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/core/components/ui/skeleton';

// BOQ Item type for this component
interface BOQItem {
  id: string;
  itemCode?: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  procuredQuantity: number;
  stage?: string;
}

interface MobileBOQListProps {
  projectId: string;
  items?: BOQItem[];
  isLoading?: boolean;
  onItemSelect?: (item: BOQItem) => void;
}

type FilterStatus = 'all' | 'pending' | 'partial' | 'complete';

export function MobileBOQList({
  projectId: _projectId,
  items = [],
  isLoading = false,
  onItemSelect,
}: MobileBOQListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedItem, setSelectedItem] = useState<BOQItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Group items by stage
  const groupedItems = useMemo(() => {
    let filtered = items;

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.description.toLowerCase().includes(query) ||
          item.itemCode?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((item) => {
        const progress = item.procuredQuantity / item.quantity;
        switch (filterStatus) {
          case 'pending':
            return progress === 0;
          case 'partial':
            return progress > 0 && progress < 1;
          case 'complete':
            return progress >= 1;
          default:
            return true;
        }
      });
    }

    // Group by stage
    const groups: Record<string, BOQItem[]> = {};
    filtered.forEach((item) => {
      const stage = item.stage || 'Unassigned';
      if (!groups[stage]) groups[stage] = [];
      groups[stage].push(item);
    });

    return groups;
  }, [items, searchQuery, filterStatus]);

  const getItemStatus = (item: BOQItem) => {
    const progress = item.procuredQuantity / item.quantity;
    if (progress >= 1)
      return { status: 'complete', color: 'text-green-600', bg: 'bg-green-100' };
    if (progress > 0)
      return { status: 'partial', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { status: 'pending', color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  const handleItemClick = (item: BOQItem) => {
    setSelectedItem(item);
    onItemSelect?.(item);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Search and Filter Bar */}
      <div className="sticky top-14 z-30 bg-background border-b p-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(true)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3">
          {(['all', 'pending', 'partial', 'complete'] as FilterStatus[]).map(
            (status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className="shrink-0"
              >
                {status === 'all' && 'All'}
                {status === 'pending' && (
                  <>
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </>
                )}
                {status === 'partial' && (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Partial
                  </>
                )}
                {status === 'complete' && (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </>
                )}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Item List */}
      <ScrollArea className="flex-1">
        <div className="p-4 pb-24 space-y-6">
          {Object.entries(groupedItems).map(([stage, stageItems]) => (
            <div key={stage}>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {stage} ({stageItems.length})
              </h3>
              <div className="space-y-2">
                {stageItems.map((item) => {
                  const { color, bg } = getItemStatus(item);
                  const progress = (item.procuredQuantity / item.quantity) * 100;

                  return (
                    <Card
                      key={item.id}
                      className="cursor-pointer active:scale-[0.98] transition-transform"
                      onClick={() => handleItemClick(item)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {item.itemCode && (
                                <Badge variant="outline" className="shrink-0">
                                  {item.itemCode}
                                </Badge>
                              )}
                              <Badge className={cn('shrink-0', bg, color)}>
                                {Math.round(progress)}%
                              </Badge>
                            </div>
                            <p className="font-medium mt-1 line-clamp-2">
                              {item.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                              <span>
                                {item.quantity.toLocaleString()} {item.unit}
                              </span>
                              <span>•</span>
                              <span>UGX {item.amount.toLocaleString()}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {Object.keys(groupedItems).length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No items found</p>
              {searchQuery && (
                <p className="text-sm">Try a different search term</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Item Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          {selectedItem && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{selectedItem.description}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Quantity
                    </span>
                    <p className="font-semibold">
                      {selectedItem.quantity.toLocaleString()} {selectedItem.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Procured
                    </span>
                    <p className="font-semibold">
                      {selectedItem.procuredQuantity?.toLocaleString() || 0}{' '}
                      {selectedItem.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Rate</span>
                    <p className="font-semibold">
                      UGX {selectedItem.rate.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <p className="font-semibold">
                      UGX {selectedItem.amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Procurement Progress</span>
                    <span>
                      {Math.round(
                        (selectedItem.procuredQuantity / selectedItem.quantity) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (selectedItem.procuredQuantity / selectedItem.quantity) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button className="flex-1">Log Delivery</Button>
                  <Button variant="outline" className="flex-1">
                    View Details
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Filter Sheet */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="bottom" className="h-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filter Options</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-8">
            <div>
              <label className="text-sm font-medium">Status</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(['all', 'pending', 'partial', 'complete'] as FilterStatus[]).map(
                  (status) => (
                    <Button
                      key={status}
                      variant={filterStatus === status ? 'default' : 'outline'}
                      onClick={() => {
                        setFilterStatus(status);
                        setShowFilters(false);
                      }}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  )
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setFilterStatus('all');
                setSearchQuery('');
                setShowFilters(false);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default MobileBOQList;
