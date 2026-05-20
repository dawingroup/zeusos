/**
 * DetailDrawer Component
 * Slide-out drawer for displaying read-only/auto-populated content
 * Used to decongest main views while keeping details accessible
 */

import { useEffect, useRef } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

const widthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function DetailDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'md',
}: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          backgroundColor: 'rgba(20, 20, 22, 0.4)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          'relative w-full h-screen flex flex-col transform transition-transform duration-300 ease-out',
          widthClasses[width],
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--fg-primary)',
          boxShadow: '-8px 0 32px rgba(20,20,22,0.16)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 pt-[18px] pb-3.5 border-b"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div>
            <h3
              className="text-[17px] font-semibold leading-tight m-0"
              style={{ color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                className="text-[12.5px] mt-0.5 m-0"
                style={{ color: 'var(--fg-secondary)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--fg-tertiary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fg-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-sunken)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-tertiary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

// Trigger button component for consistency
interface DrawerTriggerProps {
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'card' | 'compact';
  badge?: string | number;
}

export function DrawerTrigger({
  label,
  sublabel,
  icon,
  onClick,
  variant = 'default',
  badge,
}: DrawerTriggerProps) {
  if (variant === 'card') {
    return (
      <button
        onClick={onClick}
        className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all text-left group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <span className="text-gray-400 group-hover:text-gray-600">{icon}</span>}
            <div>
              <p className="font-medium text-gray-900">{label}</p>
              {sublabel && <p className="text-sm text-gray-500">{sublabel}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {badge !== undefined && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                {badge}
              </span>
            )}
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
          </div>
        </div>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 text-sm text-[#0A7C8E] hover:text-[#0A7C8E]/80 font-medium"
      >
        {label}
        <ChevronRight className="w-4 h-4" />
      </button>
    );
  }

  // Default variant
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded">
          {badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}

export default DetailDrawer;
