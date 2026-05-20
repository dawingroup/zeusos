import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { MODULE_DEFINITIONS, type ModuleId } from '@/integration/constants';

export interface ModuleSwitcherProps {
  value?: ModuleId;
}

export function ModuleSwitcher({ value }: ModuleSwitcherProps) {
  const navigate = useNavigate();

  const modules = useMemo(
    () => [...MODULE_DEFINITIONS].sort((a, b) => a.order - b.order),
    []
  );

  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => {
        const selected = modules.find((m) => m.id === v);
        if (selected?.basePath) navigate(selected.basePath);
      }}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Switch module" />
      </SelectTrigger>
      <SelectContent>
        {modules.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.shortName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
