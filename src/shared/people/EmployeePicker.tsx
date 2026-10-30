import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { rankSearchResults } from '@/shared/search';
import { listPeople, personKey, type PersonEntry } from './peopleDirectoryStore';
import { usePeopleDirectory } from './usePeopleDirectory';

/** What a picker hands back: the key to STORE plus the name to stamp beside it. */
export interface PickedPerson {
  /** employee doc id, else auth uid, else email — the writer contract's `<field>` value. */
  id: string;
  /** the writer contract's `<field>Name` value. */
  name: string;
  email?: string;
  employeeId?: string;
  uid?: string;
}

export interface EmployeePickerProps {
  /** The stored key (employee id / uid / email) of the current pick, if any. */
  value: string | null | undefined;
  onChange: (person: PickedPerson | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Inline, borderless — for key/value rows and toolbars. */
  compact?: boolean;
  align?: 'left' | 'right';
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
}

function toPicked(entry: PersonEntry): PickedPerson {
  return { id: personKey(entry), name: entry.name, email: entry.email, employeeId: entry.employeeId, uid: entry.uid };
}

/**
 * Pick a person from the shared people directory.
 *
 * Replaces free-text "Assigned to" / "Approver email" / "Owner" inputs, which
 * store whatever was typed so nothing downstream can resolve, notify or
 * filter by the person. The pick hands back BOTH the key to store and the
 * name to stamp beside it (writer contract in src/shared/types/actor.ts).
 * No Firestore reads of its own — it lists the directory every staff surface
 * already subscribes to.
 */
export function EmployeePicker({
  value,
  onChange,
  label,
  placeholder = 'Search people…',
  disabled = false,
  compact = false,
  align = 'left',
  className,
  style,
  autoFocus,
}: EmployeePickerProps) {
  const { loading, lookup } = usePeopleDirectory();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = value ? lookup(value) : undefined;
  // A legacy value the directory cannot resolve (free text from before the
  // picker) is still shown, so the row is not silently blanked.
  const shownWhenClosed = selected?.name ?? (value && !loading ? value : '');

  // `loading` flips exactly when the directory delivers; listing is cheap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const people = useMemo(() => listPeople(), [loading, lookup]);
  // Token-ranked: "okello jane" finds "Jane Okello"; a name that starts with
  // the query outranks one that merely contains it; email and employee id count.
  const matches = useMemo(
    () => rankSearchResults(people, query, { primary: (p) => p.name, fields: (p) => [p.email, p.employeeId], limit: 30 }),
    [people, query],
  );
  useEffect(() => setCursor(0), [query, open]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [cursor, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (entry: PersonEntry) => {
    onChange(toPicked(entry));
    setOpen(false);
    setQuery('');
  };
  const clear = () => {
    onChange(null);
    setQuery('');
    inputRef.current?.focus();
  };

  const inputClass = compact
    ? 'w-full bg-transparent border-0 outline-none text-[inherit] disabled:cursor-not-allowed'
    : 'w-full pl-9 pr-16 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed';

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`} style={style} data-employee-picker="">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative flex items-center">
        {!compact && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          value={open ? query : shownWhenClosed}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
              e.preventDefault();
              setOpen(true);
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, Math.max(0, matches.length - 1)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (matches[cursor]) pick(matches[cursor]);
            } else if (e.key === 'Escape' && open) {
              // Close only the list — keep any surrounding dialog open.
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setQuery('');
            } else if (e.key === 'Tab') {
              setOpen(false);
              setQuery('');
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={inputClass}
          style={{ textAlign: align, fontSize: compact ? 'inherit' : undefined }}
          title={selected?.email ?? (value ?? undefined)}
        />
        {!compact && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
            {value && !disabled && (
              <button type="button" onClick={clear} className="p-1 hover:bg-gray-100 rounded" aria-label="Clear person">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
            <button type="button" onClick={() => !disabled && setOpen((o) => !o)} disabled={disabled} className="p-1 hover:bg-gray-100 rounded" aria-label="Toggle people list">
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
        {compact && value && !disabled && (
          <button type="button" onClick={clear} className="ml-1 opacity-50 hover:opacity-100" aria-label="Clear person">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 min-w-[220px] w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto text-sm"
          style={align === 'right' ? { right: 0 } : { left: 0 }}
        >
          {loading && people.length === 0 ? (
            <li className="p-3 text-center text-gray-500">Loading people…</li>
          ) : matches.length === 0 ? (
            <li className="p-3 text-center text-gray-500">No one matches "{query}"</li>
          ) : (
            matches.map((p, i) => {
              const key = personKey(p);
              const isSelected = !!value && (key === value || p.uid === value || p.email === value);
              return (
                <li
                  key={key}
                  role="option"
                  aria-selected={isSelected}
                  data-index={i}
                  onMouseEnter={() => setCursor(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p);
                  }}
                  className={`px-3 py-2 cursor-pointer ${i === cursor ? 'bg-gray-100' : 'hover:bg-gray-50'} ${isSelected ? 'font-medium' : ''}`}
                >
                  <div className="text-gray-900 text-left">{p.name}</div>
                  {p.email && <div className="text-xs text-gray-500 text-left">{p.email}</div>}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default EmployeePicker;
