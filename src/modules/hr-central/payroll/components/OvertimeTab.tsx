/**
 * Overtime Tab Component
 * Track and approve employee overtime
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  Sun,
  Moon,
  Calendar,
  Pencil,
  Timer,
} from 'lucide-react';
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
import { useOvertime } from '../hooks/usePayrollRecords';
import type { OvertimeType, OvertimeStatus, CreateOvertimeInput, OvertimeEntry } from '../types/payroll-records.types';

interface OvertimeTabProps {
  period: string;
  employees: Array<{ id: string; fullName: string; customFields?: Record<string, any> }>;
}

const TYPE_CONFIG: Record<OvertimeType, { label: string; multiplier: string; icon: React.ReactNode }> = {
  regular: { label: 'Regular', multiplier: '1.5x', icon: <Clock className="h-3 w-3" /> },
  weekend: { label: 'Weekend', multiplier: '2x', icon: <Calendar className="h-3 w-3" /> },
  holiday: { label: 'Holiday', multiplier: '2x', icon: <Sun className="h-3 w-3" /> },
  night: { label: 'Night Shift', multiplier: '1.25x', icon: <Moon className="h-3 w-3" /> },
  straight_time: { label: 'Straight Time', multiplier: '1x', icon: <Timer className="h-3 w-3" /> },
};

const MULTIPLIER_BY_TYPE: Record<OvertimeType, number> = {
  regular: 1.5,
  weekend: 2,
  holiday: 2,
  night: 1.25,
  straight_time: 1,
};

const STATUS_CONFIG: Record<OvertimeStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]' },
  approved: { label: 'Approved', color: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]' },
  processed: { label: 'Processed', color: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]' },
  rejected: { label: 'Rejected', color: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]' },
};

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

export function OvertimeTab({ period, employees }: OvertimeTabProps) {
  const { entries, loading, createEntry, approveEntry, updateEntry } = useOvertime({
    startDate: `${period}-01`,
    endDate: `${period}-31`,
  });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState<OvertimeEntry | null>(null);
  const [editTarget, setEditTarget] = useState<OvertimeEntry | null>(null);
  const [formData, setFormData] = useState<Partial<CreateOvertimeInput>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'regular',
    hours: 2,
  });
  const [editData, setEditData] = useState<{
    date?: string;
    type?: OvertimeType;
    hours?: number;
    hourlyRate?: number;
    startTime?: string;
    endTime?: string;
    reason?: string;
    notes?: string;
  }>({});

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const pending = entries.filter(e => e.status === 'pending');
    const approved = entries.filter(e => e.status === 'approved' || e.status === 'processed');
    
    return {
      totalEntries: entries.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      totalHours: approved.reduce((sum, e) => sum + e.hours, 0),
      totalAmount: approved.reduce((sum, e) => sum + e.amount, 0),
    };
  }, [entries]);

  // Calculate hourly rate for an employee (basic salary / 208 hours per month)
  const getHourlyRate = (employeeId: string): number => {
    const emp = employees.find(e => e.id === employeeId);
    const basicSalary = emp?.customFields?.basicSalary || 0;
    return basicSalary > 0 ? Math.round(basicSalary / 208) : 5000; // Default rate if no salary
  };

  const handleSubmit = async () => {
    if (!formData.employeeId || !formData.date || !formData.type || !formData.hours || !formData.reason) return;
    
    const employee = employees.find(e => e.id === formData.employeeId);
    if (!employee) return;

    const hourlyRate = getHourlyRate(formData.employeeId);

    try {
      await createEntry(formData as CreateOvertimeInput, employee.fullName, hourlyRate);
      setShowAddDialog(false);
      setFormData({ date: format(new Date(), 'yyyy-MM-dd'), type: 'regular', hours: 2 });
    } catch (error) {
      console.error('Failed to create overtime entry:', error);
    }
  };

  const handleApprove = async (approved: boolean) => {
    if (!showApproveDialog) return;
    try {
      await approveEntry(showApproveDialog.id, approved);
      setShowApproveDialog(null);
    } catch (error) {
      console.error('Failed to approve overtime:', error);
    }
  };

  const openEdit = (entry: OvertimeEntry) => {
    setEditData({
      date: entry.date,
      type: entry.type,
      hours: entry.hours,
      hourlyRate: entry.hourlyRate,
      startTime: entry.startTime,
      endTime: entry.endTime,
      reason: entry.reason,
      notes: entry.notes,
    });
    setEditTarget(entry);
  };

  const handleEditSubmit = async () => {
    if (!editTarget) return;
    try {
      await updateEntry(editTarget.id, editData);
      setEditTarget(null);
      setEditData({});
    } catch (error) {
      console.error('Failed to update overtime:', error);
      alert(error instanceof Error ? error.message : 'Failed to update overtime');
    }
  };

  const editPreviewAmount = (() => {
    if (!editData.hours || !editData.hourlyRate || !editData.type) return null;
    const multiplier = MULTIPLIER_BY_TYPE[editData.type];
    return editData.hours * editData.hourlyRate * multiplier;
  })();

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
                <p className="text-xs text-muted-foreground">Pending Approval</p>
                <p className="text-xl font-bold">{summaryStats.pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-[var(--rag-green-soft)]">
                <CheckCircle className="h-4 w-4 text-[var(--rag-green)]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-xl font-bold">{summaryStats.approvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-[var(--rag-blue-soft)]">
                <Clock className="h-4 w-4 text-[var(--rag-blue)]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Hours</p>
                <p className="text-xl font-bold">{summaryStats.totalHours}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-purple-100">
                <Sun className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overtime Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Overtime Records</CardTitle>
              <CardDescription>
                {format(new Date(period + '-01'), 'MMMM yyyy')} overtime tracking
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Overtime
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">No Overtime Records</p>
              <p className="text-sm text-muted-foreground mt-1">
                No overtime has been recorded for this period.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => {
                  const typeConfig = TYPE_CONFIG[entry.type];
                  const statusConfig = STATUS_CONFIG[entry.status];
                  
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.employeeName}</TableCell>
                      <TableCell>{format(new Date(entry.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {typeConfig.icon}
                          {typeConfig.label} ({typeConfig.multiplier})
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{entry.hours}h</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.hourlyRate)}/hr</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(entry.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${statusConfig.color} w-fit`}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {entry.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => setShowApproveDialog(entry)}>
                              Review
                            </Button>
                          )}
                          {entry.status !== 'processed' && (
                            <Button size="sm" variant="ghost" onClick={() => openEdit(entry)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
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

      {/* Add Overtime Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Overtime</DialogTitle>
            <DialogDescription>
              Record overtime hours for an employee.
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
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Overtime Type</label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as OvertimeType }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label} ({config.multiplier})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Hours</label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={formData.hours || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, hours: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Start Time (Optional)</label>
                <Input
                  type="time"
                  value={formData.startTime || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            {formData.employeeId && formData.hours && formData.type && (
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <p className="text-sm">
                    Estimated amount: <span className="font-bold">
                      {formatCurrency(
                        getHourlyRate(formData.employeeId) *
                        formData.hours *
                        MULTIPLIER_BY_TYPE[formData.type]
                      )}
                    </span>
                  </p>
                </CardContent>
              </Card>
            )}

            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={formData.reason || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason for overtime work"
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Add Overtime
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!showApproveDialog} onOpenChange={() => setShowApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Overtime</DialogTitle>
            <DialogDescription>
              Approve or reject this overtime entry.
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
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(showApproveDialog.date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{TYPE_CONFIG[showApproveDialog.type].label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hours</p>
                  <p className="font-medium">{showApproveDialog.hours}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatCurrency(showApproveDialog.amount)}</p>
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

      {/* Edit Overtime Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditData({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit overtime</DialogTitle>
            <DialogDescription>
              Adjust the date, hours, or rate. Hours, rate, or type changes recompute the amount.
              Re-run the affected payroll batch to apply.
            </DialogDescription>
          </DialogHeader>

          {editTarget && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Employee: </span>
                <span className="font-medium">{editTarget.employeeName}</span>
                <Badge variant="secondary" className={`ml-2 ${STATUS_CONFIG[editTarget.status].color}`}>
                  {STATUS_CONFIG[editTarget.status].label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={editData.date || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                    className="mt-1"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Backdate to move this entry into the right month.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={editData.type}
                    onValueChange={(v) => setEditData(prev => ({ ...prev, type: v as OvertimeType }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_CONFIG).map(([k, c]) => (
                        <SelectItem key={k} value={k}>
                          {c.label} ({c.multiplier})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Hours</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editData.hours ?? ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, hours: Number(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Hourly Rate</label>
                  <Input
                    type="number"
                    value={editData.hourlyRate ?? ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, hourlyRate: Number(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Start / End</label>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <Input
                      type="time"
                      value={editData.startTime || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                    <Input
                      type="time"
                      value={editData.endTime || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {editPreviewAmount !== null && (
                <p className="text-xs text-muted-foreground">
                  New amount: <span className="font-medium text-foreground">{formatCurrency(Math.round(editPreviewAmount))}</span>
                  {' '}<span className="text-muted-foreground">(was {formatCurrency(editTarget.amount)})</span>
                </p>
              )}

              <div>
                <label className="text-sm font-medium">Reason</label>
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
            <Button variant="outline" onClick={() => { setEditTarget(null); setEditData({}); }}>
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

export default OvertimeTab;
