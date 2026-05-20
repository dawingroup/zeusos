import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

const TYPE_LABEL: Record<string, string> = {
  'zeus-the-agency': 'Manufacturing',
  'zeus-digital': 'Services',
  'labyrinth': 'Investment',
  'odd-gorilla': 'Technology',
};

const CODE: Record<string, string> = {
  'zeus-the-agency': 'DF',
  'zeus-digital': 'DA',
  'labyrinth': 'DC',
  'odd-gorilla': 'DT',
};

/**
 * Subsidiary picker pill — placed top-right of the top bar, before the
 * notification + avatar cluster. Matches the prototype's TopBar reference.
 */
export function SubsidiaryPicker({ className }: { className?: string }) {
  const { subsidiaries, currentSubsidiary, setCurrentSubsidiary } = useSubsidiary();
  const navigate = useNavigate();

  if (!currentSubsidiary) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-2 h-8 pl-2 pr-2.5 rounded-full',
          'border border-[var(--border-default)] bg-[var(--bg-surface)]',
          'text-[12.5px] font-medium text-[var(--fg-primary)]',
          'hover:bg-[var(--bg-sunken)] transition-colors focus:outline-none',
          'focus:ring-2 focus:ring-[var(--accent-soft)]',
          className
        )}
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: currentSubsidiary.color }}
          aria-hidden="true"
        />
        <span className="hidden md:inline">{currentSubsidiary.shortName}</span>
        <span className="md:hidden font-mono text-[11px]">
          {CODE[currentSubsidiary.id] ?? currentSubsidiary.shortName.slice(0, 2).toUpperCase()}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--fg-tertiary)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider text-[var(--fg-tertiary)] font-medium">
          Subsidiaries
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {subsidiaries.map((sub) => {
          const isActive = sub.id === currentSubsidiary.id;
          const disabled = sub.status !== 'active';
          return (
            <DropdownMenuItem
              key={sub.id}
              disabled={disabled}
              onSelect={() => {
                if (disabled) return;
                setCurrentSubsidiary(sub);
                // After switching, route to the default path (root).
                // Subsidiary nav re-renders from context.
                navigate('/');
              }}
              className="gap-3 py-2"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: sub.color }}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[13px] font-medium text-[var(--fg-primary)] truncate">
                  {sub.name}
                </span>
                <span className="text-[11px] text-[var(--fg-tertiary)] truncate">
                  {TYPE_LABEL[sub.id] ?? sub.shortName}
                  {disabled ? ' · Coming soon' : ''}
                </span>
              </div>
              <span className="font-mono text-[10.5px] text-[var(--fg-tertiary)] shrink-0">
                {CODE[sub.id] ?? sub.shortName.slice(0, 2).toUpperCase()}
              </span>
              {isActive ? (
                <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
