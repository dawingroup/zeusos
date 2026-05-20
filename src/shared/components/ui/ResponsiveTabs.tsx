/**
 * Responsive Tabs Component
 * - Desktop: Horizontal tab bar
 * - Mobile: Scrollable tabs with dropdown option
 * Standardized across DawinOS
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

interface ResponsiveTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export function ResponsiveTabs({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
  className,
}: ResponsiveTabsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTabData = tabs.find(t => t.id === activeTab);

  const getTabStyles = (isActive: boolean) => {
    const base = 'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap';
    
    switch (variant) {
      case 'pills':
        return cn(
          base,
          'rounded-lg',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        );
      case 'underline':
        return cn(
          base,
          'border-b-2 -mb-px',
          isActive
            ? 'border-foreground text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
        );
      default:
        return cn(
          base,
          isActive
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        );
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Mobile: Dropdown selector (shown on small screens) */}
      <div className="sm:hidden" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 border border-border rounded-lg text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            {activeTabData?.icon && (
              <activeTabData.icon className="w-4 h-4" />
            )}
            {activeTabData?.label}
            {activeTabData?.badge !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {activeTabData.badge}
              </span>
            )}
          </span>
          <ChevronDown className={cn(
            'w-4 h-4 transition-transform',
            showDropdown && 'rotate-180'
          )} />
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    onTabChange(tab.id);
                    setShowDropdown(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {Icon && <Icon className="w-4 h-4" />}
                    {tab.label}
                    {tab.badge !== undefined && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </span>
                  {isActive && <Check className="w-4 h-4" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop/Tablet: Scrollable horizontal tabs */}
      <div 
        ref={scrollContainerRef}
        className={cn(
          'hidden sm:flex overflow-x-auto scrollbar-hide',
          variant === 'underline' && 'border-b border-border'
        )}
      >
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={getTabStyles(isActive)}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={cn(
                    'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ResponsiveTabs;
