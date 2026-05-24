/**
 * SubsidiaryAllocationsCard
 *
 * Per-employee UI for splitting one person across multiple subsidiaries
 * (e.g. an architect 60% Finishes / 40% Advisory). The split drives:
 *   - which subsidiary-scoped payroll batches include this employee
 *   - the share of their gross / deductions attributed to each batch
 *
 * The employee still receives ONE payslip and ONE payment for the
 * full amount — the allocation is purely how cost is reported to each
 * subsidiary.
 *
 * Validation: percentages must sum to 100. The largest allocation is
 * promoted to the employee's primary `subsidiaryId` on save so single-
 * tenant code paths keep working.
 */

import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useCurrentUserId } from '@/contexts/AuthContext';
import { setEmployeeSubsidiaryAllocations } from '@/modules/hr-central/services/employee.service';
import type { Employee, SubsidiaryAllocation } from '@/modules/hr-central/types/employee.types';

interface Props {
  employee: Employee;
  onSaved?: () => void;
}

interface Row {
  subsidiaryId: string;
  allocationPercent: number;
}

export function SubsidiaryAllocationsCard({ employee, onSaved }: Props) {
  const { subsidiaries } = useSubsidiary();
  const userId = useCurrentUserId();

  // Initial rows: existing allocations, or a single 100% row on the
  // primary subsidiary as a sensible starting point.
  const initial: Row[] = useMemo(() => {
    if (employee.subsidiaryAllocations && employee.subsidiaryAllocations.length > 0) {
      return employee.subsidiaryAllocations.map((a: SubsidiaryAllocation) => ({
        subsidiaryId: a.subsidiaryId,
        allocationPercent: a.allocationPercent,
      }));
    }
    return [{ subsidiaryId: employee.subsidiaryId, allocationPercent: 100 }];
  }, [employee.subsidiaryAllocations, employee.subsidiaryId]);

  const [rows, setRows] = useState<Row[]>(initial);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  const subsidiaryNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of subsidiaries) m[s.id] = s.name;
    return m;
  }, [subsidiaries]);

  const total = rows.reduce((s, r) => s + (Number(r.allocationPercent) || 0), 0);
  const sumValid = Math.abs(total - 100) <= 0.5;
  const hasDuplicates = new Set(rows.map(r => r.subsidiaryId)).size !== rows.length;
  const hasBlanks = rows.some(r => !r.subsidiaryId);

  const addRow = () => {
    // Default to the first subsidiary not yet picked.
    const used = new Set(rows.map(r => r.subsidiaryId));
    const remaining = (Number(rows[0]?.allocationPercent ?? 0) > 100 ? 0 : Math.max(0, 100 - total));
    const next = subsidiaries.find(s => !used.has(s.id))?.id || '';
    setRows([...rows, { subsidiaryId: next, allocationPercent: remaining }]);
  };

  const removeRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const splitEvenly = () => {
    if (rows.length === 0) return;
    const each = Math.floor(100 / rows.length);
    const remainder = 100 - each * rows.length;
    setRows(rows.map((r, i) => ({
      ...r,
      allocationPercent: i === 0 ? each + remainder : each,
    })));
  };

  const handleCancel = () => {
    setRows(initial);
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!userId) {
      setError('Not authenticated');
      return;
    }
    if (!sumValid || hasDuplicates || hasBlanks) {
      setError(
        hasBlanks ? 'Pick a subsidiary for every row.'
          : hasDuplicates ? 'Each subsidiary can only appear once.'
          : `Allocations must sum to 100% (got ${total.toFixed(1)}%).`
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Single-row 100% on the existing primary = "no real split" — clear
      // the array so the record stays simple.
      const payload = rows.length === 1 && rows[0].allocationPercent === 100
        ? []
        : rows;
      await setEmployeeSubsidiaryAllocations(employee.id, payload, userId);
      setIsEditing(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save allocations');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[var(--rag-blue)]" /> Subsidiary Allocations
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            How this employee's pay is attributed across companies for cost reporting and payroll batches.
          </p>
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!isEditing ? (
          // Read-only summary
          rows.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No allocation set.</p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{subsidiaryNameById[r.subsidiaryId] || r.subsidiaryId}</span>
                  <Badge variant="outline" className="font-mono">{r.allocationPercent}%</Badge>
                </div>
              ))}
              {rows.length === 1 && rows[0].allocationPercent === 100 && (
                <p className="text-xs text-[var(--fg-tertiary)] mt-2">
                  Single-subsidiary employee — full pay goes to {subsidiaryNameById[rows[0].subsidiaryId] || rows[0].subsidiaryId}.
                </p>
              )}
            </div>
          )
        ) : (
          // Edit mode
          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={row.subsidiaryId || ''}
                  onValueChange={(v) => updateRow(idx, { subsidiaryId: v })}
                >
                  <SelectTrigger className="flex-1 h-9">
                    <SelectValue placeholder="Pick subsidiary" />
                  </SelectTrigger>
                  <SelectContent>
                    {subsidiaries.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative w-24">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={row.allocationPercent}
                    onChange={(e) => updateRow(idx, { allocationPercent: parseFloat(e.target.value) || 0 })}
                    className="h-9 pr-7 text-right font-mono"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--fg-tertiary)]">%</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={() => removeRow(idx)}
                  disabled={rows.length <= 1}
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addRow} disabled={rows.length >= subsidiaries.length}>
                  <Plus className="h-3 w-3 mr-1" /> Add subsidiary
                </Button>
                {rows.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={splitEvenly}>
                    Split evenly
                  </Button>
                )}
              </div>
              <span className={`font-mono font-medium ${sumValid ? 'text-[var(--rag-green)]' : 'text-[var(--rag-amber)]'}`}>
                Total: {total.toFixed(1)}%
              </span>
            </div>

            {error && (
              <div className="flex items-start gap-1.5 text-xs text-[var(--rag-red)]">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !sumValid || hasDuplicates || hasBlanks}>
                {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                Save allocations
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SubsidiaryAllocationsCard;
