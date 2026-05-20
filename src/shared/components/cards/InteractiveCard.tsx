/**
 * InteractiveCard Component
 * Clickable card with hover effects following Finishes patterns
 */

import { cn } from '@/shared/lib/utils';
import { Link } from 'react-router-dom';

interface InteractiveCardBaseProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverBorderColor?: string;
}

interface InteractiveCardLinkProps extends InteractiveCardBaseProps {
  to: string;
  onClick?: never;
}

interface InteractiveCardButtonProps extends InteractiveCardBaseProps {
  onClick: () => void;
  to?: never;
}

type InteractiveCardProps = InteractiveCardLinkProps | InteractiveCardButtonProps;

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function InteractiveCard({
  children,
  className,
  padding = 'md',
  hoverBorderColor = 'hover:border-gray-300',
  ...props
}: InteractiveCardProps) {
  const baseClasses = cn(
    "bg-white rounded-lg shadow-sm border border-gray-200",
    "hover:shadow-md transition-all cursor-pointer",
    hoverBorderColor,
    paddingClasses[padding],
    className
  );

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={cn(baseClasses, "block")}>
        {children}
      </Link>
    );
  }

  if ('onClick' in props && props.onClick) {
    return (
      <button
        onClick={props.onClick}
        className={cn(baseClasses, "w-full text-left")}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={baseClasses}>
      {children}
    </div>
  );
}
