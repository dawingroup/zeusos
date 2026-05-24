/**
 * Advances Tab Component
 * Track salary advances and recoveries
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Banknote,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownCircle,
  Wallet,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useUserModules } from '@/hooks/useUserModules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
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
import { Progress } from '@/core/components/ui/progress';
import { useAdvances } from '../hooks/usePayrollRecords';
import type {
  AdvanceStatus,
  CreateAdvanceInput,
  SalaryAdvance,
  UpdateAdvanceInput,
} from '../types/payroll-records.types';

interface AdvancesTabProps {
  employees: Array<{ id: string; fullName: string }>;
}

const STATUS_CONFIG: Record<AdvanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'Approved', color: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]', icon: <CheckCircle className="h-3 w-3" /> },
  disbursed: { label: 'Disbursed', color: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]', icon: <ArrowDownCircle className="h-3 w-3" /> },
  partially_recovered: { label: 'Recovering', color: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]', icon: <Wallet className="h-3 w-3" /> },
  fully_recovered: { label: 'Recovered', color: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]', icon: <CheckCircle className="h-3 w-3" /> },
  rejected: { label: 'Rejected', color: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]', icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-[var(--bg-sunken)] text-muted-foreground', icon: <XCircle className="h-3 w-3" /> },
};

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

function toDateInput(value: Date | { toDate: () => Date } | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : value.toDate?.();
  if (!d || isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
}

function toMonthInput(value: string | null | undefined): string {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : '';
}

export function AdvancesTab({ employees }: AdvancesTabProps) {
  const { advances, loading, createAdvance, approveAdvance, disburseAdvance, updateAdvance, deleteAdvance, refetch: _refetch } = useAdvances();
  const { isAdmin } = useUserModules();
  const today = format(new Date(), 'yyyy-MM-dd');
  const thisMonth = format(new Date(), 'yyyy-MM');

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState<SalaryAdvance | null>(null);
  const [showDisburseDialog, setShowDisburseDialog] = useState<SalaryAdvance | null>(null);
  const [showEditDialog, setShowEditDialog] = useState<SalaryAdvance | null>(null);

  const [formData, setFormData] = useState<Partial<CreateAdvanceInput>>({
    repaymentMonths: 3,
    requestDate: today,
  });
  const [disburseData, setDisburseData] = useState({
    method: 'bank_transfer' as SalaryAdvance['disbursementMethod'],
    reference: '',
    disbursedAt: today,
    recoveryStartMonth: thisMonth,
  });
  const [editData, setEditData] = useState<UpdateAdvanceInput>({});

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const pending = advances.filter(a => a.status === 'pending');
    const active = advances.filter(a => a.status === 'disbursed' || a.status === 'partially_recovered');
    const totalOutstanding = active.reduce((sum, a) => sum + a.balanceRemaining, 0);
    const monthlyRecovery = active.reduce((sum, a) => sum + a.monthlyDeduction, 0);
    
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, a) => sum + a.amount, 0),
      activeCount: active.length,
      totalOutstanding,
      monthlyRecovery,
    };
  }, [advances]);

  const handleSubmit = async () => {
    if (!formData.employeeId || !formData.amount || !formData.reason || !formData.repaymentMonths) return;
    
    const employee = employees.find(e => e.id === formData.employeeId);
    if (!employee) return;

    try {
      await createAdvance(formData as CreateAdvanceInput, employee.fullName);
      setShowAddDialog(false);
      setFormData({ repaymentMonths: 3, requestDate: today });
    } catch (error) {
      console.error('Failed to create advance:', error);
    }
  };

  const openEditDialog = (advance: SalaryAdvance) => {
    setEditData({
      amount: advance.amount,
      reason: advance.reason,
      repaymentMonths: advance.repaymentMonths,
      notes: advance.notes,
      requestDate: toDateInput(advance.requestDate),
      disbursedAt: toDateInput(advance.disbursedAt),
      disbursementMethod: advance.disbursementMethod,
      disbursementReference: advance.disbursementReference,
      recoveryStartMonth: toMonthInput(advance.recoveryStartMonth),
    });
    setShowEditDialog(advance);
  };

  const handleEditSubmit = async () => {
    if (!showEditDialog) return;
    try {
      await updateAdvance(showEditDialog.id, editData);
      setShowEditDialog(null);
      setEditData({});
    } catch (error) {
      console.error('Failed to update advance:', error);
      alert(error instanceof Error ? error.message : 'Failed to update advance');
    }
  };

  const handleApprove = async (approved: boolean) => {
    if (!showApproveDialog) return;
    try {
      await approveAdvance(showApproveDialog.id, approved);
      setShowApproveDialog(null);
    } catch (error) {
      console.error('Failed to approve advance:', error);
    }
  };

  const handleDisburse = async () => {
    if (!showDisburseDialog) return;
    try {
      await disburseAdvance(
        showDisburseDialog.id,
        disburseData.method,
        disburseData.reference,
        disburseData.recoveryStartMonth,
        disburseData.disbursedAt,
      );
      setShowDisburseDialog(null);
      setDisburseData({ method: 'bank_transfer', reference: '', disbursedAt: today, recoveryStartMonth: thisMonth });
    } catch (error) {
      console.error('Failed to disburse advance:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-[var(--rag-amber-soft)]">
                <Clock className="h-4 w-4 text-[var(--rag-amber)]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Requests</p>
                <p className="text-xl font-bold">{summaryStats.pendingCount}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(summaryStats.pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-[var(--rag-blue-soft)]">
                <Wallet className="h-4 w-4 text-[var(--rag-blue)]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Advances</p>
                <p className="text-xl font-bold">{summaryStats.activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-[var(--rag-red-soft)]">
                <Banknote className="h-4 w-4 text-[var(--rag-red)]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Outstanding</p>
                <p className="text-lg font-bold text-[var(--rag-red)]">{formatCurrency(summaryStats.totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-[var(--rag-green-soft)]">
                <ArrowDownCircle className="h-4 w-4 text-[var(--rag-green)]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Recovery</p>
                <p className="text-lg font-bold text-[var(--rag-green)]">{formatCurrency(summaryStats.monthlyRecovery)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advances Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Salary Advances</CardTitle>
              <CardDescription>
                Track employee advance requests and recoveries
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : advances.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Banknote className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">No Advances</p>
              <p className="text-sm text-muted-foreground mt-1">
                No salary advance requests have been made.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Employee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Monthly Deduction</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map(advance => {
                  const config = STATUS_CONFIG[advance.status];
                  const recoveryProgress = advance.amount > 0 
                    ? Math.round((advance.totalRecovered / advance.amount) * 100) 
                    : 0;
                  
                  return (
                    <TableRow key={advance.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{advance.employeeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(advance.requestDate instanceof Date ? advance.requestDate : advance.requestDate.toDate(), 'dd MMM yyyy')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(advance.amount)}</TableCell>
                      <TableCell>{formatCurrency(advance.monthlyDeduction)}</TableCell>
                      <TableCell className="text-[var(--rag-red)]">{formatCurrency(advance.balanceRemaining)}</TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={recoveryProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">{recoveryProgress}% recovered</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${config.color} flex items-center gap-1 w-fit`}>
                          {config.icon}
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {advance.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => setShowApproveDialog(advance)}>
                              Review
                            </Button>
                          )}
                          {advance.status === 'approved' && (
                            <Button size="sm" variant="outline" onClick={() => setShowDisburseDialog(advance)}>
                              Disburse
                            </Button>
                          )}
                          {advance.status !== 'fully_recovered' && advance.status !== 'rejected' && advance.status !== 'cancelled' && (
                            <Button size="sm" variant="ghost" onClick={() => openEditDialog(advance)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Permanently delete advance for ${advance.employeeName}? This cannot be undone.`)) {
                                  deleteAdvance(advance.id).catch(e =>
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

      {/* Add Request Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Advance Request</DialogTitle>
            <DialogDescription>
              Submit a salary advance request for an employee.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Employee</label>
              <Select
                value={formData.employeeId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, employeeId: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Amount (UGX)</label>
              <Input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                placeholder="Enter amount"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Repayment Period (months)</label>
              <Select
                value={String(formData.repaymentMonths)}
                onValueChange={(value) => setFormData(prev => ({ ...prev, repaymentMonths: Number(value) }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 9, 12].map(m => (
                    <SelectItem key={m} value={String(m)}>
                      {m} month{m > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.amount && formData.repaymentMonths && (
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <p className="text-sm">
                    Monthly deduction: <span className="font-bold">{formatCurrency(Math.ceil(formData.amount / formData.repaymentMonths))}</span>
                  </p>
                </CardContent>
              </Card>
            )}

            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={formData.reason || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason for advance request"
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Request Date</label>
              <Input
                type="date"
                value={formData.requestDate || today}
                onChange={(e) => setFormData(prev => ({ ...prev, requestDate: e.target.value }))}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Backdate this if you're recording a historical advance (e.g. one given in cash months ago).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!showApproveDialog} onOpenChange={() => setShowApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Advance Request</DialogTitle>
            <DialogDescription>
              Approve or reject this salary advance request.
            </DialogDescription>
          </DialogHeader>
          
          {showApproveDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Employee</p>
                  <p className="font-medium">{showApproveDialog.employeeName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatCurrency(showApproveDialog.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Deduction</p>
                  <p className="font-medium">{formatCurrency(showApproveDialog.monthlyDeduction)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Repayment Period</p>
                  <p className="font-medium">{showApproveDialog.repaymentMonths} months</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="font-medium">{showApproveDialog.reason}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="destructive" onClick={() => handleApprove(false)}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button onClick={() => handleApprove(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disburse Dialog */}
      <Dialog open={!!showDisburseDialog} onOpenChange={() => setShowDisburseDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disburse Advance</DialogTitle>
            <DialogDescription>
              Record the disbursement of this approved advance.
            </DialogDescription>
          </DialogHeader>
          
          {showDisburseDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Employee</p>
                  <p className="font-medium">{showDisburseDialog.employeeName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatCurrency(showDisburseDialog.amount)}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Disbursement Method</label>
                <Select
                  value={disburseData.method}
                  onValueChange={(value) => setDisburseData(prev => ({ ...prev, method: value as any }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Reference Number (Optional)</label>
                <Input
                  value={disburseData.reference}
                  onChange={(e) => setDisburseData(prev => ({ ...prev, reference: e.target.value }))}
                  placeholder="Transaction reference"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Disbursement Date</label>
                  <Input
                    type="date"
                    value={disburseData.disbursedAt}
                    onChange={(e) => setDisburseData(prev => ({ ...prev, disbursedAt: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Recovery Starts</label>
                  <Input
                    type="month"
                    value={disburseData.recoveryStartMonth}
                    onChange={(e) => setDisburseData(prev => ({ ...prev, recoveryStartMonth: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Set "Recovery Starts" to the month the first deduction should appear on payroll. Backdate for historical advances.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisburseDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleDisburse}>
              Confirm Disbursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!showEditDialog} onOpenChange={(o) => { if (!o) { setShowEditDialog(null); setEditData({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit advance</DialogTitle>
            <DialogDescription>
              Update amounts, dates, or recovery month. Useful for back-entries
              and corrections — recovery deductions on past payroll batches will
              follow the new dates after you regenerate those batches.
            </DialogDescription>
          </DialogHeader>

          {showEditDialog && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Employee:</span>{' '}
                <span className="font-medium">{showEditDialog.employeeName}</span>
                <Badge variant="secondary" className={`ml-2 ${STATUS_CONFIG[showEditDialog.status].color}`}>
                  {STATUS_CONFIG[showEditDialog.status].label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Amount (UGX)</label>
                  <Input
                    type="number"
                    value={editData.amount ?? ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Repayment Months</label>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    value={editData.repaymentMonths ?? ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, repaymentMonths: Number(e.target.value) || 1 }))}
                    className="mt-1"
                  />
                </div>
              </div>

              {editData.amount !== undefined && editData.repaymentMonths !== undefined && editData.repaymentMonths > 0 && (
                <p className="text-xs text-muted-foreground">
                  New monthly deduction: <span className="font-medium text-foreground">
                    {formatCurrency(Math.ceil((editData.amount || 0) / (editData.repaymentMonths || 1)))}
                  </span>
                  {' · '}Already recovered: {formatCurrency(showEditDialog.totalRecovered)}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Request Date</label>
                  <Input
                    type="date"
                    value={editData.requestDate || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, requestDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Disbursement Date</label>
                  <Input
                    type="date"
                    value={editData.disbursedAt || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, disbursedAt: e.target.value }))}
                    className="mt-1"
                    disabled={!['disbursed', 'partially_recovered'].includes(showEditDialog.status)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Recovery Starts</label>
                <Input
                  type="month"
                  value={editData.recoveryStartMonth || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, recoveryStartMonth: e.target.value }))}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Deductions only appear on batches for this month and after. Re-run any affected batch to apply.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Disbursement Method</label>
                  <Select
                    value={editData.disbursementMethod || ''}
                    onValueChange={(v) => setEditData(prev => ({ ...prev, disbursementMethod: v as SalaryAdvance['disbursementMethod'] }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Reference</label>
                  <Input
                    value={editData.disbursementReference || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, disbursementReference: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Reason / Notes</label>
                <Textarea
                  value={editData.reason || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, reason: e.target.value }))}
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(null); setEditData({}); }}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdvancesTab;
