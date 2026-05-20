import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import { BREADCRUMB_CONFIGS } from '@/integration/constants/navigation.constants';
import { cn } from '@/shared/lib/utils';

export function BreadcrumbNav() {
  const location = useLocation();

  const matched = BREADCRUMB_CONFIGS.find((c) => c.pattern.test(location.pathname));
  
  const match = matched ? location.pathname.match(matched.pattern) : null;

  const crumbs = match && matched
    ? matched.crumbs.map((c) => ({
        label: typeof c.label === 'function' ? c.label(match) : c.label,
        path: typeof c.path === 'function' ? c.path(match) : c.path,
      }))
    : [];

  return (
    <nav className="text-sm" aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5">
        <li>
          <Link 
            to="/dashboard" 
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {crumbs.length > 0 && (
          <li className="text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
          </li>
        )}
        {crumbs.map((c, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-1.5">
              <Link 
                to={c.path} 
                className={cn(
                  'transition-colors',
                  isLast 
                    ? 'text-foreground font-medium' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {c.label}
              </Link>
              {!isLast && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
