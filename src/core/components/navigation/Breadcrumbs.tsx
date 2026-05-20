/**
 * Breadcrumbs Component
 * Unified breadcrumb navigation system
 * Auto-generates breadcrumbs from route hierarchy
 */

import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface BreadcrumbSegment {
  label: string;
  path: string;
  isActive: boolean;
}

interface BreadcrumbsProps {
  projectName?: string;
  className?: string;
  showHome?: boolean;
}

export function Breadcrumbs({ projectName, className, showHome = true }: BreadcrumbsProps) {
  const location = useLocation();
  const params = useParams();

  const generateBreadcrumbs = (): BreadcrumbSegment[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbSegment[] = [];

    // Add home/root
    if (showHome) {
      breadcrumbs.push({
        label: 'Home',
        path: '/',
        isActive: false,
      });
    }

    // Build breadcrumbs from path segments
    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      // Skip dynamic segments (IDs) - they'll be replaced with meaningful names
      if (segment.match(/^[a-f0-9-]{20,}$/)) {
        return; // Skip raw IDs
      }

      let label = segment;
      let path = currentPath;

      // Map segments to readable labels
      switch (segment) {
        case 'advisory':
          label = 'Advisory';
          break;
        case 'delivery':
          label = 'Infrastructure Delivery';
          break;
        case 'investment':
          label = 'Investment';
          break;
        case 'projects':
          label = 'Projects';
          break;
        case 'programs':
          label = 'Programs';
          break;
        case 'requisitions':
          label = 'Requisitions';
          break;
        case 'accountabilities':
          label = 'Accountabilities';
          break;
        case 'boq':
          label = 'Control BOQ';
          break;
        case 'summary':
          label = 'Summary';
          break;
        case 'details':
          label = 'Details';
          break;
        case 'materials':
          label = 'Materials';
          break;
        case 'import':
          label = 'Import';
          break;
        case 'payments':
          label = 'Payments';
          break;
        case 'visits':
          label = 'Site Visits';
          break;
        case 'procurement':
          label = 'Procurement';
          break;
        case 'formulas':
          label = 'Formulas';
          break;
        case 'suppliers':
          label = 'Suppliers';
          break;
        case 'reports':
          label = 'Reports';
          break;
        case 'scope':
          label = 'Scope';
          break;
        case 'budget':
          label = 'Budget';
          break;
        case 'progress':
          label = 'Progress';
          break;
        case 'timeline':
          label = 'Timeline';
          break;
        case 'team':
          label = 'Team';
          break;
        case 'documents':
          label = 'Documents';
          break;
        case 'new':
          label = 'New';
          break;
        case 'edit':
          label = 'Edit';
          break;
        default:
          // Capitalize and format segment
          label = segment
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
      }

      // Use project name if provided and this is the project ID segment
      if (params.projectId && currentPath.includes(`/projects/${params.projectId}`)) {
        const previousSegment = pathSegments[index - 1];
        if (previousSegment === 'projects' && projectName) {
          label = projectName;
        }
      }

      breadcrumbs.push({
        label,
        path,
        isActive: isLast,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs if only home or single level
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center space-x-1 text-sm', className)}>
      <ol className="flex items-center space-x-1">
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-gray-400 mx-1" aria-hidden="true" />
            )}
            {crumb.isActive ? (
              <span className="font-medium text-gray-900">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
              >
                {index === 0 && crumb.label === 'Home' && (
                  <Home className="h-4 w-4" />
                )}
                <span>{crumb.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
