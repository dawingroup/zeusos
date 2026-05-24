/**
 * LeaveManagementPage.tsx
 * Leave request management with calendar view and approval workflow
 * ZeusOS v2.0 - Phase 8.6
 */

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Plus,
  Check,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, addMonths, subMonths } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { RagBadge } from '@/shared/components/data-display';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
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
import { Textarea } from '@/core/components/ui/textarea';
import { cn } from '@/shared/lib/utils';

import { useEmployee, useEmployeeList } from '@/modules/hr-central/hooks/useEmployee';

// Leave type colors
const leaveTypeColors: Record<string, string> = {
  annual: '#4CAF50',
  sick: '#FF9800',
  maternity: '#E91E63',
  paternity: '#9C27B0',
  compassionate: '#607D8B',
  study: '#00BCD4',
  unpaid: '#795548',
};

// Status tones (mapped to RagBadge)
const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  cancelled: 'na',
};

// Mock data for demonstration
const mockLeaveRequests = [
  {
    id: '1',
    employeeId: 'emp1',
    employeeName: 'John Doe',
    employeePhoto: null,
    department: 'Engineering',
    leaveType: 'annual',
    startDate: new Date(2026, 0, 10),
    endDate: new Date(2026, 0, 15),
    days: 5,
    status: 'pending',
    reason: 'Family vacation',
    submittedAt: new Date(2026, 0, 5),
  },
  {
    id: '2',
    employeeId: 'emp2',
    employeeName: 'Jane Smith',
    employeePhoto: null,
    department: 'Design',
    leaveType: 'sick',
    startDate: new Date(2026, 0, 8),
    endDate: new Date(2026, 0, 9),
    days: 2,
    status: 'approved',
    reason: 'Medical appointment',
    submittedAt: new Date(2026, 0, 7),
  },
  {
    id: '3',
    employeeId: 'emp3',
    employeeName: 'Mike Johnson',
    employeePhoto: null,
    department: 'Sales',
    leaveType: 'annual',
    startDate: new Date(2026, 0, 20),
    endDate: new Date(2026, 0, 22),
    days: 3,
    status: 'pending',
    reason: 'Personal matters',
    submittedAt: new Date(2026, 0, 6),
  },
];

interface ApprovalDialogState {
  open: boolean;
  request: typeof mockLeaveRequests[0] | null;
  action: 'approve' | 'reject' | null;
}

export function LeaveManagementPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const employeeIdFilter = searchParams.get('employee');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEmployee, _setFilterEmployee] = useState<string>(employeeIdFilter || 'all');
  const [approvalDialog, setApprovalDialog] = useState<ApprovalDialogState>({
    open: false,
    request: null,
    action: null,
  });
  const [approvalComment, setApprovalComment] = useState('');

  // Fetch employees for filter dropdown
  const { employees: _employees } = useEmployeeList({ subsidiaryIds: 'finishes' as any });
  
  // Get selected employee details if filtering by employee
  const { employee: _selectedEmployee } = useEmployee(employeeIdFilter);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return mockLeaveRequests.filter(request => {
      if (filterStatus !== 'all' && request.status !== filterStatus) return false;
      if (filterType !== 'all' && request.leaveType !== filterType) return false;
      if (filterEmployee !== 'all' && request.employeeId !== filterEmployee) return false;
      return true;
    });
  }, [filterStatus, filterType, filterEmployee]);

  // Pending requests
  const pendingRequests = useMemo(() => {
    return mockLeaveRequests.filter(r => r.status === 'pending');
  }, []);

  // Calendar days
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(selectedMonth),
      end: endOfMonth(selectedMonth),
    });
  }, [selectedMonth]);

  // Get leaves for a specific day
  const getLeavesForDay = (date: Date) => {
    return mockLeaveRequests.filter(request =>
      request.status === 'approved' &&
      isWithinInterval(date, { start: request.startDate, end: request.endDate })
    );
  };

  // Handle approval
  const handleApproval = () => {
    // In real implementation, this would call the leave service
    console.log('Processing approval:', approvalDialog.action, approvalDialog.request?.id, approvalComment);
    setApprovalDialog({ open: false, request: null, action: null });
    setApprovalComment('');
  };

  // Render pending request card
  const renderPendingRequest = (request: typeof mockLeaveRequests[0]) => (
    <div
      key={request.id}
      className="p-4 border rounded-lg"
      style={{ borderLeftWidth: 4, borderLeftColor: leaveTypeColors[request.leaveType] }}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
          {request.employeeName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">{request.employeeName}</p>
          <p className="text-sm text-muted-foreground">{request.department}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              style={{
                backgroundColor: `${leaveTypeColors[request.leaveType]}20`,
                color: leaveTypeColors[request.leaveType],
              }}
              className="capitalize"
            >
              {request.leaveType}
            </Badge>
            <span className="text-sm">
              {format(request.startDate, 'MMM dd')} - {format(request.endDate, 'MMM dd, yyyy')}
            </span>
            <span className="text-sm text-muted-foreground">
              ({request.days} day{request.days !== 1 ? 's' : ''})
            </span>
          </div>
          {request.reason && (
            <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 text-[var(--rag-green)] hover:text-[var(--rag-green)] hover:bg-[var(--rag-green-soft)]"
            onClick={() => setApprovalDialog({ open: true, request, action: 'approve' })}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 text-[var(--rag-red)] hover:text-[var(--rag-red)] hover:bg-[var(--rag-red-soft)]"
            onClick={() => setApprovalDialog({ open: true, request, action: 'reject' })}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Render calendar day
  const renderCalendarDay = (date: Date) => {
    const leaves = getLeavesForDay(date);
    const isToday = isSameDay(date, new Date());

    return (
      <div
        key={date.toISOString()}
        className={cn(
          'p-1 min-h-[80px] border',
          isToday && 'bg-primary/5'
        )}
      >
        <span
          className={cn(
            'text-xs',
            isToday ? 'font-bold text-primary' : 'text-muted-foreground'
          )}
        >
          {format(date, 'd')}
        </span>
        <div className="mt-1 space-y-0.5">
          {leaves.slice(0, 2).map(leave => (
            <div
              key={leave.id}
              className="px-1 py-0.5 rounded text-[10px] truncate"
              style={{
                backgroundColor: `${leaveTypeColors[leave.leaveType]}30`,
              }}
            >
              {leave.employeeName.split(' ')[0]}
            </div>
          ))}
          {leaves.length > 2 && (
            <span className="text-[10px] text-muted-foreground">
              +{leaves.length - 2} more
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2">
            <Calendar className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            Leave Management
          </h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Manage leave requests and approvals
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/hr/leave/new')}>
          <Plus className="h-3.5 w-3.5" /> Request Leave
        </Button>
      </div>

      {/* Pending Approvals */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-[var(--rag-amber)]" />
              Pending Approvals
              <Badge variant="secondary">{pendingRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.slice(0, 4).map(renderPendingRequest)}
            </div>
            {pendingRequests.length > 4 && (
              <Button variant="ghost" className="w-full mt-4" onClick={() => setActiveTab('requests')}>
                View all {pendingRequests.length} pending requests
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-4">
            <TabsList className="h-12">
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="requests" className="gap-2">
                <Clock className="h-4 w-4" />
                All Requests
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingRequests.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Calendar View */}
          <TabsContent value="calendar" className="p-4 m-0">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <h3 className="text-lg font-semibold">
                {format(selectedMonth, 'MMMM yyyy')}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div
                  key={day}
                  className="p-2 text-center text-xs font-semibold bg-muted/50"
                >
                  {day}
                </div>
              ))}

              {/* Empty cells for days before month start */}
              {[...Array(calendarDays[0].getDay())].map((_, i) => (
                <div key={`empty-${i}`} className="p-1 min-h-[80px] border bg-muted/30" />
              ))}

              {/* Calendar days */}
              {calendarDays.map(renderCalendarDay)}
            </div>

            {/* Legend */}
            <div className="flex gap-4 flex-wrap mt-4">
              {Object.entries(leaveTypeColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs capitalize">{type}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* All Requests View */}
          <TabsContent value="requests" className="p-4 m-0">
            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Leave Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.keys(leaveTypeColors).map(type => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Request List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredRequests.map(request => (
                  <div
                    key={request.id}
                    className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {request.employeeName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{request.employeeName}</p>
                        <Badge
                          className="capitalize text-[10px]"
                          style={{
                            backgroundColor: `${leaveTypeColors[request.leaveType]}20`,
                            color: leaveTypeColors[request.leaveType],
                          }}
                        >
                          {request.leaveType}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(request.startDate, 'MMM dd')} - {format(request.endDate, 'MMM dd, yyyy')}
                        {' • '}{request.days} day{request.days !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <RagBadge tone={STATUS_TONE[request.status] ?? 'na'}>
                      {request.status}
                    </RagBadge>
                    {request.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[var(--rag-green)]"
                          onClick={() => setApprovalDialog({ open: true, request, action: 'approve' })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[var(--rag-red)]"
                          onClick={() => setApprovalDialog({ open: true, request, action: 'reject' })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {filteredRequests.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    No leave requests found
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onOpenChange={(open: boolean) => !open && setApprovalDialog({ open: false, request: null, action: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialog.action === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
            <DialogDescription>
              {approvalDialog.request && (
                <>
                  <strong>{approvalDialog.request.employeeName}</strong> is requesting{' '}
                  <strong>{approvalDialog.request.days} day{approvalDialog.request.days !== 1 ? 's' : ''}</strong> of{' '}
                  <strong className="capitalize">{approvalDialog.request.leaveType}</strong> leave
                  from <strong>{format(approvalDialog.request.startDate, 'MMM dd')}</strong> to{' '}
                  <strong>{format(approvalDialog.request.endDate, 'MMM dd, yyyy')}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={approvalDialog.action === 'reject' ? 'Please provide a reason for rejection...' : 'Add any comments (optional)...'}
            value={approvalComment}
            onChange={(e) => setApprovalComment(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog({ open: false, request: null, action: null })}>
              Cancel
            </Button>
            <Button
              onClick={handleApproval}
              className={approvalDialog.action === 'approve' ? 'bg-[var(--rag-green)] hover:bg-[var(--rag-green)]' : 'bg-[var(--rag-red)] hover:bg-[var(--rag-red)]'}
            >
              {approvalDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LeaveManagementPage;
