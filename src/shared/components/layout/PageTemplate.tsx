/**
 * PageTemplate Component
 * Base page template with meta tags and animations
 */

import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { PageHeader } from './PageHeader';
import { cn } from '@/shared/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageTemplateProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
  noPadding?: boolean;
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export function PageTemplate({
  children,
  title,
  description,
  metaTitle,
  metaDescription,
  breadcrumbs,
  actions,
  className,
  fullWidth = false,
  noPadding = false,
}: PageTemplateProps) {
  return (
    <>
      <Helmet>
        <title>{metaTitle || title} | Dawin Advisory Platform</title>
        {metaDescription && <meta name="description" content={metaDescription} />}
      </Helmet>

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2 }}
        className={cn(
          'flex flex-col min-h-full',
          !noPadding && 'p-6',
          className
        )}
      >
        <PageHeader
          title={title}
          description={description}
          breadcrumbs={breadcrumbs}
          actions={actions}
        />

        <div
          className={cn(
            'flex-1 mt-6',
            !fullWidth && 'max-w-7xl mx-auto w-full'
          )}
        >
          {children}
        </div>
      </motion.div>
    </>
  );
}
