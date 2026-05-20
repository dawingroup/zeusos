/**
 * ListPageTemplate Component
 * Template for list/collection pages with search, filter, and view modes
 */

import { useState } from 'react';
import { Plus, Grid, List, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { PageTemplate } from './PageTemplate';

interface ListPageTemplateProps<T> {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  items: T[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  filterComponent?: React.ReactNode;
  createPath?: string;
  createLabel?: string;
  onExport?: () => void;
  defaultView?: 'grid' | 'list';
  gridComponent: React.ComponentType<{ items: T[] }>;
  listComponent: React.ComponentType<{ items: T[] }>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export function ListPageTemplate<T>({
  title,
  description,
  breadcrumbs,
  items,
  isLoading,
  searchPlaceholder = 'Search...',
  onSearch,
  filterComponent,
  createPath,
  createLabel = 'Create New',
  onExport,
  defaultView = 'grid',
  gridComponent: GridComponent,
  listComponent: ListComponent,
  emptyTitle = 'No items found',
  emptyDescription = 'Get started by creating your first item.',
  emptyAction,
}: ListPageTemplateProps<T>) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(defaultView);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const actions = (
    <div className="flex items-center gap-2">
      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      )}
      {createPath && (
        <Button asChild size="sm">
          <Link to={createPath}>
            <Plus className="h-4 w-4 mr-2" />
            {createLabel}
          </Link>
        </Button>
      )}
    </div>
  );

  return (
    <PageTemplate
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      actions={actions}
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={handleSearch}
            className="max-w-md"
          />
        </div>

        <div className="flex items-center gap-2">
          {filterComponent}

          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-lg font-medium">{emptyTitle}</h3>
          <p className="text-muted-foreground mt-1 mb-4">{emptyDescription}</p>
          {emptyAction}
        </div>
      ) : viewMode === 'grid' ? (
        <GridComponent items={items} />
      ) : (
        <ListComponent items={items} />
      )}
    </PageTemplate>
  );
}
