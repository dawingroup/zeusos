import React, { useMemo, useState } from 'react';
import { BarChart3, Check, Loader2, Search, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/core/components/ui/popover';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { useKPIs } from '../../hooks/useKPIs';
import type { KPIDefinition } from '../../types/kpi.types';

interface KpiPickerProps {
  companyId: string;
  // The currently linked KPI, if any. Pass null when nothing is linked.
  selectedKpiId: string | null | undefined;
  selectedKpiName?: string | null;
  onChange: (kpi: { id: string; name: string; unit?: string } | null) => void;
  // Optional surface label
  label?: string;
  disabled?: boolean;
}

// Searchable single-select KPI picker used in the KR add/edit dialogs.
// Loads KPIs once for the popover lifetime — KPI lists are small (tens
// to low hundreds per company) so client-side fuzzy filtering is fine.
export const KpiPicker: React.FC<KpiPickerProps> = ({
  companyId,
  selectedKpiId,
  selectedKpiName,
  onChange,
  label = 'Link to KPI',
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { kpis, loading, error } = useKPIs({ companyId, autoFetch: open });

  const filtered = useMemo(() => {
    if (!query.trim()) return kpis;
    const q = query.toLowerCase();
    return kpis.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.code.toLowerCase().includes(q) ||
        (k.description || '').toLowerCase().includes(q)
    );
  }, [kpis, query]);

  const selectedKpi = useMemo(
    () => (selectedKpiId ? kpis.find((k) => k.id === selectedKpiId) : null),
    [kpis, selectedKpiId]
  );

  const displayName = selectedKpi?.name || selectedKpiName || null;

  const handleSelect = (kpi: KPIDefinition) => {
    onChange({ id: kpi.id, name: kpi.name, unit: kpi.unit });
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="w-full inline-flex items-center justify-between gap-2 px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-md hover:border-gray-300 disabled:opacity-50 disabled:hover:border-gray-200 bg-white text-left"
        >
          <span className="inline-flex items-center gap-1.5 min-w-0 flex-1">
            <BarChart3 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className={`truncate ${displayName ? 'text-gray-900' : 'text-gray-400'}`}>
              {displayName || label}
            </span>
          </span>
          {displayName && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e as unknown as React.MouseEvent);
                }
              }}
              className="text-gray-400 hover:text-gray-600 p-0.5 -m-0.5 rounded cursor-pointer"
              aria-label="Unlink KPI"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <div className="p-2 border-b border-gray-100">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search KPIs by name or code…"
              className="pl-7 h-8 text-[12px]"
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-gray-400 text-[12px]">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              Loading KPIs…
            </div>
          ) : error ? (
            <div className="px-3 py-4 text-[12px] text-red-600">{error.message}</div>
          ) : kpis.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-gray-500">
              No KPIs defined yet.
              <p className="mt-1 text-[11px] text-gray-400">
                Create KPIs from the KPI dashboard first, then link them here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-gray-500">
              No KPIs match “{query}”.
            </div>
          ) : (
            <ul role="listbox">
              {filtered.map((kpi) => {
                const isSelected = kpi.id === selectedKpiId;
                return (
                  <li key={kpi.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(kpi)}
                      className={`w-full flex items-start gap-2 px-3 py-2 hover:bg-gray-50 text-left ${
                        isSelected ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="mt-0.5 w-4 flex-shrink-0">
                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono px-1 py-0 rounded bg-gray-100 text-gray-600">
                            {kpi.code}
                          </span>
                          <span className="text-[12.5px] font-medium text-gray-900 truncate">
                            {kpi.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 capitalize">
                          {kpi.category}
                          {kpi.unit && ` · ${kpi.unit}`}
                          {kpi.currentValue !== undefined && kpi.currentValue !== null && (
                            <span className="ml-1 text-gray-400">
                              · current {kpi.currentValue}
                              {kpi.unit ? ` ${kpi.unit}` : ''}
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {selectedKpiId && (
          <div className="border-t border-gray-100 p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full justify-start text-[11px] text-gray-500 hover:text-gray-700"
            >
              <X className="h-3 w-3" />
              Unlink KPI
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
