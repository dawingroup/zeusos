/**
 * DetailPageTemplate Component
 * Template for detail/view pages with tabs and actions
 */

import { ArrowLeft, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { PageTemplate } from './PageTemplate';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  badge?: string | number;
}

interface DetailPageTemplateProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  status?: React.ReactNode;
  tabs?: Tab[];
  defaultTab?: string;
  editPath?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  customActions?: React.ReactNode;
  children?: React.ReactNode;
  headerContent?: React.ReactNode;
}

export function DetailPageTemplate({
  title,
  subtitle,
  breadcrumbs,
  status,
  tabs,
  defaultTab,
  editPath,
  onDelete,
  deleteLabel = 'Delete',
  customActions,
  children,
  headerContent,
}: DetailPageTemplateProps) {
  const navigate = useNavigate();

  const actions = (
    <div className="flex items-center gap-2">
      {customActions}

      {editPath && (
        <Button variant="outline" size="sm" asChild>
          <Link to={editPath}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      )}

      {onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <PageTemplate
      title={title}
      description={subtitle}
      breadcrumbs={breadcrumbs}
      actions={actions}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-4 -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {status && <div className="mb-4">{status}</div>}

      {headerContent && <div className="mb-6">{headerContent}</div>}

      {tabs && tabs.length > 0 ? (
        <Tabs defaultValue={defaultTab || tabs[0].id} className="w-full">
          <TabsList className="mb-6">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                {tab.label}
                {tab.badge !== undefined && (
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        children
      )}
    </PageTemplate>
  );
}
