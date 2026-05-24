/**
 * Deductions Tab
 *
 * Manage non-statutory, non-advance employee deductions:
 *   - Recurring (food contribution, SACCO/union dues, savings)
 *   - Installments (spread a damaged-property recovery over N months)
 *   - One-time (single-month fines, overpayment claw-back)
 *
 * Each record's schedule drives whether the calculator picks it up
 * for a given batch period — see getOtherDeductionsForPeriod in the
 * payroll calculator service.
 */

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Pencil, Ban, Receipt, Repeat, Calendar, Coins, Search, Users, CheckCircle2, Trash2 } from 'lucide-react';
import { useUserModules } from '@/hooks/useUserModules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Checkbox } from '@/core/components/ui/checkbox';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';
import { useOtherDeductions } from '../hooks/usePayrollRecords';
import type {
  CreateEmployeeDeductionInput,
  EmployeeDeduction,
  OtherDeductionType,
  DeductionScheduleKind,
  UpdateEmployeeDeductionInput,
} from '../types/payroll-records.types';

interface Props {
  employees: Array<{ id: string; fullName: string }>;
}

const TYPE_LABELS: Record<OtherDeductionType, string> = {
  food_contribution: 'Food Contribution',
  savings: 'Savings',
  insurance: 'Insurance',
  union: 'Union Dues',
  sacco: 'SACCO',
  pension: 'Pension',
  property_damage: 'Property Damage',
  lost_property: 'Lost Property',
  overpayment: 'Overpayment Claw-back',
  fine: 'Fine / Penalty',
  other: 'Other',
};

const SCHEDULE_LABELS: Record<DeductionScheduleKind, { label: string; icon: React.ReactNode }> = {
  one_time: { label: 'One-time', icon: <Calendar className="h-3 w-3" /> },
  recurring: { label: 'Recurring', icon: <Repeat className="h-3 w-3" /> },
  installments: { label: 'Installments', icon: <Coins className="h-3 w-3" /> },
};

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

const TODAY = format(new Date(), 'yyyy-MM-dd');
const THIS_MONTH = format(new Date(), 'yyyy-MM');

const EMPTY_FORM: Partial<CreateEmployeeDeductionInput> = {
  schedule: 'recurring',
  type: 'food_contribution',
  installmentAmount: 0,
  startMonth: THIS_MONTH,
};

export function DeductionsTab({ employees }: Props) {
  const { deductions, loading, createBulkDeductions, updateDeduction, cancelDeduction, activateDeduction, deleteDeduction } = useOtherDeductions();
  const { isAdmin } = useUserModules();

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeDeduction | null>(null);

  const [addForm, setAddForm] = useState<Partial<CreateEmployeeDeductionInput>>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<UpdateEmployeeDeductionInput>({});
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e => e.fullName.toLowerCase().includes(q));
  }, [employees, employeeSearch]);

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const selectAllFiltered = () => {
    setSelectedEmployeeIds(prev => {
      const ids = new Set(prev);
      for (const e of filteredEmployees) ids.add(e.id);
      return Array.from(ids);
    });
  };

  const clearSelection = () => setSelectedEmployeeIds([]);

  const resetAddForm = () => {
    setAddForm(EMPTY_FORM);
    setSelectedEmployeeIds([]);
    setEmployeeSearch('');
  };

  const employeeMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of employees) m[e.id] = e.fullName;
    return m;
  }, [employees]);

  const summary = useMemo(() => {
    const active = deductions.filter(d => d.status === 'active');
    return {
      activeCount: active.length,
      monthlyImpact: active
        .filter(d => d.schedule !== 'one_time')
        .reduce((sum, d) => sum + (d.installmentAmount || 0), 0),
      outstandingInstallments: active
        .filter(d => d.schedule === 'installments')
        .reduce((sum, d) => sum + (d.balanceRemaining || 0), 0),
      oneTimeThisMonth: active
        .filter(d => d.schedule === 'one_time' && d.effectivePeriod === THIS_MONTH)
        .reduce((sum, d) => sum + (d.installmentAmount || 0), 0),
    };
  }, [deductions]);

  const handleCreate = async () => {
    if (selectedEmployeeIds.length === 0 || !addForm.description || !addForm.installmentAmount) return;
    const selected = employees.filter(e => selectedEmployeeIds.includes(e.id));
    if (selected.length === 0) return;
    try {
      // employeeId is per-record — bulk service derives it from each employee.
      const { employeeId: _drop, ...bulkInput } = addForm as CreateEmployeeDeductionInput;
      void _drop;
      await createBulkDeductions(bulkInput, selected);
      setShowAdd(false);
      resetAddForm();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create deduction');
    }
  };

  const openEdit = (d: EmployeeDeduction) => {
    setEditForm({
      type: d.type,
      description: d.description,
      schedule: d.schedule,
      effectivePeriod: d.effectivePeriod,
      startMonth: d.startMonth,
      endMonth: d.endMonth,
      installmentAmount: d.installmentAmount,
      totalAmount: d.totalAmount,
      reason: d.reason,
      status: d.status,
    });
    setEditTarget(d);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    try {
      await updateDeduction(editTarget.id, editForm);
      setEditTarget(null);
      setEditForm({});
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const renderEmployeePicker = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          Apply to employees
          <Badge variant="secondary" className="ml-1">{selectedEmployeeIds.length} selected</Badge>
        </label>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={selectAllFiltered}
            disabled={filteredEmployees.length === 0}
          >
            Select all{employeeSearch ? ' visible' : ''}
          </button>
          {selectedEmployeeIds.length > 0 && (
            <button type="button" className="text-muted-foreground hover:underline" onClick={clearSelection}>
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={employeeSearch}
          onChange={(e) => setEmployeeSearch(e.target.value)}
          placeholder="Search employees…"
          className="pl-8 h-9"
        />
      </div>
      <ScrollArea className="h-48 rounded-md border">
        {filteredEmployees.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">No employees match.</div>
        ) : (
          <div className="p-1">
            {filteredEmployees.map(emp => {
              const checked = selectedEmployeeIds.includes(emp.id);
              return (
                <label
                  key={emp.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/60 cursor-pointer"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleEmployee(emp.id)} />
                  <span className="text-sm">{emp.fullName}</span>
                </label>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderForm = (
    form: Partial<CreateEmployeeDeductionInput>,
    setForm: (patch: Partial<CreateEmployeeDeductionInput>) => void,
  ) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Type</label>
          <Select value={form.type} onValueChange={(v) => setForm({ type: v as OtherDeductionType })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Schedule</label>
          <Select value={form.schedule} onValueChange={(v) => setForm({ schedule: v as DeductionScheduleKind })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recurring">Recurring (monthly)</SelectItem>
              <SelectItem value="installments">Installments (until paid off)</SelectItem>
              <SelectItem value="one_time">One-time (single month)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <Input
          value={form.description || ''}
          onChange={(e) => setForm({ description: e.target.value })}
          placeholder="e.g. Monthly food contribution / Damaged forklift recovery"
          className="mt-1"
        />
      </div>

      {form.schedule === 'one_time' && (
        <div>
          <label className="text-sm font-medium">Apply In Month</label>
          <Input
            type="month"
            value={form.effectivePeriod || THIS_MONTH}
            onChange={(e) => setForm({ effectivePeriod: e.target.value })}
            className="mt-1"
          />
        </div>
      )}

      {(form.schedule === 'recurring' || form.schedule === 'installments') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Starts</label>
            <Input
              type="month"
              value={form.startMonth || THIS_MONTH}
              onChange={(e) => setForm({ startMonth: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Ends <span className="text-xs text-muted-foreground font-normal">(optional — set later)</span>
            </label>
            <Input
              type="month"
              value={form.endMonth || ''}
              onChange={(e) => setForm({ endMonth: e.target.value || undefined })}
              className="mt-1"
              placeholder="Leave blank if open-ended"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">
            {form.schedule === 'one_time' ? 'Amount' : 'Monthly Amount'}
          </label>
          <Input
            type="number"
            value={form.installmentAmount ?? ''}
            onChange={(e) => setForm({ installmentAmount: Number(e.target.value) || 0 })}
            placeholder="UGX"
            className="mt-1"
          />
        </div>
        {form.schedule === 'installments' && (
          <div>
            <label className="text-sm font-medium">Total Owed</label>
            <Input
              type="number"
              value={form.totalAmount ?? ''}
              onChange={(e) => setForm({ totalAmount: Number(e.target.value) || 0 })}
              placeholder="UGX"
              className="mt-1"
            />
          </div>
        )}
      </div>

      {form.schedule === 'installments' && form.totalAmount && form.installmentAmount && form.installmentAmount > 0 && (
        <p className="text-xs text-muted-foreground">
          ≈ {Math.ceil(form.totalAmount / form.installmentAmount)} installments to fully recover
        </p>
      )}

      <div>
        <label className="text-sm font-medium">Reason / Notes</label>
        <Textarea
          value={form.reason || ''}
          onChange={(e) => setForm({ reason: e.target.value })}
          rows={2}
          className="mt-1"
          placeholder="Justification, incident reference, approval note…"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <div className="p-2 rounded-full bg-purple-100"><Receipt className="h-4 w-4 text-purple-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Active deductions</p>
              <p className="text-xl font-bold">{summary.activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <div className="p-2 rounded-full bg-[var(--rag-amber-soft)]"><Repeat className="h-4 w-4 text-[var(--rag-amber)]" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly impact</p>
              <p className="text-lg font-bold text-[var(--rag-amber)]">{formatCurrency(summary.monthlyImpact)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <div className="p-2 rounded-full bg-[var(--rag-amber-soft)]"><Coins className="h-4 w-4 text-[var(--rag-amber)]" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Installment balance</p>
              <p className="text-lg font-bold text-[var(--rag-amber)]">{formatCurrency(summary.outstandingInstallments)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <div className="p-2 rounded-full bg-[var(--rag-blue-soft)]"><Calendar className="h-4 w-4 text-[var(--rag-blue)]" /></div>
            <div>
              <p className="text-xs text-muted-foreground">One-time this month</p>
              <p className="text-lg font-bold text-[var(--rag-blue)]">{formatCurrency(summary.oneTimeThisMonth)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg">Other Deductions</CardTitle>
            <CardDescription>
              Food contributions, SACCO/union dues, property damage recoveries, and one-time disciplinary deductions.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add deduction
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : deductions.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">No deductions configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add a recurring contribution, installment recovery, or one-time deduction to start.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductions.map((d) => {
                  const sched = SCHEDULE_LABELS[d.schedule];
                  const periodLabel = d.schedule === 'one_time'
                    ? d.effectivePeriod || '—'
                    : d.endMonth
                      ? `${d.startMonth || '—'} → ${d.endMonth}`
                      : `${d.startMonth || '—'} → open`;
                  return (
                    <TableRow key={d.id} className={d.status !== 'active' ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{employeeMap[d.employeeId] || d.employeeName}</TableCell>
                      <TableCell>{TYPE_LABELS[d.type]}</TableCell>
                      <TableCell className="text-sm">{d.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          {sched.icon}{sched.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{periodLabel}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(d.installmentAmount)}
                        {d.schedule === 'installments' && d.balanceRemaining !== undefined && (
                          <div className="text-[11px] text-muted-foreground">
                            bal {formatCurrency(d.balanceRemaining)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.status === 'active' ? 'default' : 'outline'} className="capitalize">
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {d.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activateDeduction(d.id)}
                              title="Activate — payroll will pick this up on the next run"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-[var(--rag-green)]" />
                              Activate
                            </Button>
                          )}
                          {(d.status === 'pending' || d.status === 'active') && (
                            <Button size="sm" variant="ghost" onClick={() => openEdit(d)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {d.status === 'active' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Cancel "${d.description}"?`)) cancelDeduction(d.id);
                              }}
                              title="Cancel"
                            >
                              <Ban className="h-3.5 w-3.5 text-[var(--rag-red)]" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Permanently delete "${d.description}"? This cannot be undone.`)) {
                                  deleteDeduction(d.id).catch(e =>
                                    alert(e instanceof Error ? e.message : 'Failed to delete'),
                                  );
                                }
                              }}
                              title="Delete permanently (admin only)"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-[var(--rag-red)]" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) resetAddForm(); setShowAdd(o); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add deduction</DialogTitle>
            <DialogDescription>
              Apply a recurring contribution, installment recovery, or one-time deduction
              to one or more employees. Each employee gets an independent record that can be
              edited or cancelled individually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {renderEmployeePicker()}
            {renderForm(addForm, (patch) => setAddForm({ ...addForm, ...patch }))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetAddForm(); }}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={selectedEmployeeIds.length === 0 || !addForm.description || !addForm.installmentAmount}
            >
              {selectedEmployeeIds.length <= 1
                ? 'Add deduction'
                : `Apply to ${selectedEmployeeIds.length} employees`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditForm({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit deduction</DialogTitle>
            <DialogDescription>
              Changes apply to future payroll runs. Re-run any affected batch to see them.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="text-sm pb-2">
              <span className="text-muted-foreground">Employee: </span>
              <span className="font-medium">{employeeMap[editTarget.employeeId] || editTarget.employeeName}</span>
            </div>
          )}
          {renderForm(editForm as Partial<CreateEmployeeDeductionInput>, (patch) => setEditForm({ ...editForm, ...patch }))}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTarget(null); setEditForm({}); }}>Cancel</Button>
            <Button onClick={handleEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden — silences unused-variable warning if someone strips out
          the today reference in future revisions. */}
      <span className="hidden">{TODAY}</span>
    </div>
  );
}

export default DeductionsTab;
