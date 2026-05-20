/**
 * PayrollPage.tsx
 * Payroll management with Uganda-specific tax calculations (PAYE, NSSF, LST)
 * DawinOS v2.0 - Professional Layout
 */

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useAuth, useCurrentUserId } from '@/contexts/AuthContext';
import {
  createPayrollBatch,
  calculateBatch,
  getBatchForPeriod,
} from '@/modules/hr-central/payroll/services/payroll-batch.service';
import {
  BATCH_STATUS_LABELS,
  BATCH_STATUS_COLORS,
  type PayrollBatch,
} from '@/modules/hr-central/payroll/types/payroll-batch.types';
import { History as HistoryIcon } from 'lucide-react';
import {
  DollarSign,
  Play,
  Users,
  Download,
  FileText,
  Wallet,
  MoreVertical,
  Eye,
  Printer,
  ChevronRight,
  CheckCircle,
  Clock,
  Calendar,
  CreditCard,
  Receipt,
} from 'lucide-react';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';
import { Progress } from '@/core/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { RagBadge, KPICard, KPIGrid } from '@/shared/components/data-display';

import { useEmployee, useEmployeeList } from '@/modules/hr-central/hooks/useEmployee';
import AttendanceTab from '@/modules/hr-central/payroll/components/AttendanceTab';
import AdvancesTab from '@/modules/hr-central/payroll/components/AdvancesTab';
import OvertimeTab from '@/modules/hr-central/payroll/components/OvertimeTab';
import DeductionsTab from '@/modules/hr-central/payroll/components/DeductionsTab';
import { useAdvances, useOvertime } from '@/modules/hr-central/payroll/hooks/usePayrollRecords';
import { 
  calculatePAYE, 
  calculateNSSF, 
  calculateLST 
} from '@/modules/hr-central/payroll/utils/tax-calculator';
import {
  payrollPdfService,
  type PayslipData,
  type PayrollReportData,
  DEFAULT_COMPANY_INFO
} from '@/modules/hr-central/payroll/services/payroll-pdf-generator';
import { useSubsidiaries } from '@/modules/hr-central/payroll/hooks/useSubsidiaries';

const HR_COLOR = '#2196F3';

// Map legacy batch-status colors to RagBadge tones.
const BATCH_STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  gray: 'na',
  blue: 'blue',
  indigo: 'blue',
  yellow: 'amber',
  orange: 'amber',
  cyan: 'blue',
  teal: 'blue',
  purple: 'blue',
  green: 'green',
  red: 'red',
};

interface RunPayrollDialogState {
  open: boolean;
  month: string;
  processing: boolean;
}


// Format currency in UGX
function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

export function PayrollPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const employeeIdFilter = searchParams.get('employee');
  const { currentSubsidiary } = useSubsidiary();
  const { user } = useAuth();
  const userId = useCurrentUserId();
  const userName = user?.displayName || user?.email || 'Unknown';

  // Get selected employee details if filtering by employee
  const { employee: _selectedEmployee } = useEmployee(employeeIdFilter);

  // Fetch all employees
  const { employees, loading: employeesLoading } = useEmployeeList();

  // Selected period — defaults to the current month, but users can step
  // back to view past months and (if no batch exists yet) generate one.
  // Honor a ?period=YYYY-MM query so other pages (e.g. the Regenerate
  // dialog on a batch) can deep-link straight to the right month.
  const periodFromQuery = searchParams.get('period');
  const [currentPeriod, setCurrentPeriod] = useState<string>(
    periodFromQuery && /^\d{4}-\d{2}$/.test(periodFromQuery)
      ? periodFromQuery
      : format(new Date(), 'yyyy-MM')
  );

  const [runDialog, setRunDialog] = useState<RunPayrollDialogState>({
    open: searchParams.get('action') === 'run',
    month: currentPeriod,
    processing: false,
  });

  // ?tab=attendance|advances|overtime|payroll deep-link from other pages.
  const tabFromQuery = searchParams.get('tab');
  const validTabs = ['payroll', 'attendance', 'overtime', 'advances', 'deductions'];
  const [activeTab, setActiveTab] = useState(
    tabFromQuery && validTabs.includes(tabFromQuery) ? tabFromQuery : 'payroll'
  );

  // Discover whether a payroll batch already exists for the selected
  // period, so we can show a status banner instead of "Run Payroll" if
  // one is already in flight or paid.
  const [existingBatch, setExistingBatch] = useState<PayrollBatch | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!currentSubsidiary?.id) {
      setExistingBatch(null);
      return;
    }
    const [yStr, mStr] = currentPeriod.split('-');
    getBatchForPeriod(currentSubsidiary.id, Number(yStr), Number(mStr))
      .then(b => { if (!cancelled) setExistingBatch(b); })
      .catch(() => { if (!cancelled) setExistingBatch(null); });
    return () => { cancelled = true; };
  }, [currentSubsidiary?.id, currentPeriod]);

  // Fetch advances and overtime data for payroll integration
  const { advances } = useAdvances();
  const { nameMap: subsidiaryNames } = useSubsidiaries();
  const { entries: overtimeEntries } = useOvertime({
    startDate: `${currentPeriod}-01`,
    endDate: `${currentPeriod}-31`,
    status: 'approved',
  });

  // Build maps for quick lookup
  const advancesByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    advances
      .filter(a => a.status === 'disbursed' || a.status === 'partially_recovered')
      .forEach(a => {
        map[a.employeeId] = (map[a.employeeId] || 0) + a.monthlyDeduction;
      });
    return map;
  }, [advances]);

  const overtimeByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    overtimeEntries
      .filter(o => o.status === 'approved')
      .forEach(o => {
        map[o.employeeId] = (map[o.employeeId] || 0) + o.amount;
      });
    return map;
  }, [overtimeEntries]);

  // Calculate payroll for each employee
  const calculatedPayrollItems = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    
    return employees
      .filter(emp => emp.employmentStatus === 'active' || emp.employmentStatus === 'probation')
      .map(emp => {
        // Get salary from customFields or use defaults
        const customFields = emp.customFields || {};
        const basicSalary = customFields.basicSalary || 0;
        const housingAllowance = customFields.housingAllowance || 0;
        const transportAllowance = customFields.transportAllowance || 0;
        const lunchAllowance = customFields.lunchAllowance || 0;
        const otherAllowances = customFields.otherAllowances || 0;
        
        // Get overtime and advances for this employee
        const overtimePay = overtimeByEmployee[emp.id] || 0;
        const advanceDeduction = advancesByEmployee[emp.id] || 0;
        
        const totalAllowances = housingAllowance + transportAllowance + lunchAllowance + otherAllowances;
        const grossPay = basicSalary + totalAllowances + overtimePay;
        
        // Calculate tax deductions
        const payeBreakdown = calculatePAYE(grossPay);
        const nssfBreakdown = calculateNSSF(grossPay);
        const lstBreakdown = calculateLST(grossPay);
        
        const paye = payeBreakdown.netPAYE;
        const nssf = nssfBreakdown.employeeContribution;
        const lst = lstBreakdown.monthlyLST;
        
        // Net pay includes overtime but deducts advances
        const netPay = grossPay - paye - nssf - lst - advanceDeduction;
        
        return {
          employeeId: emp.id,
          employeeName: emp.fullName,
          basicSalary,
          allowances: totalAllowances,
          overtime: overtimePay,
          grossPay,
          paye,
          nssf,
          lst,
          advanceDeduction,
          netPay,
        };
      })
      .filter(item => item.grossPay > 0); // Only include employees with salary data
  }, [employees, overtimeByEmployee, advancesByEmployee]);

  // Filter payroll items by employee if specified
  const filteredPayrollItems = useMemo(() => {
    if (!employeeIdFilter) return calculatedPayrollItems;
    return calculatedPayrollItems.filter(item => item.employeeId === employeeIdFilter);
  }, [employeeIdFilter, calculatedPayrollItems]);

  // Current month totals from real data
  const currentMonthTotals = useMemo(() => {
    const items = filteredPayrollItems;
    return {
      employeeCount: items.length,
      totalGross: items.reduce((sum, item) => sum + item.grossPay, 0),
      totalPAYE: items.reduce((sum, item) => sum + item.paye, 0),
      totalNSSF: items.reduce((sum, item) => sum + item.nssf, 0),
      totalLST: items.reduce((sum, item) => sum + item.lst, 0),
      totalNet: items.reduce((sum, item) => sum + item.netPay, 0),
    };
  }, [filteredPayrollItems]);

  const [runError, setRunError] = useState<string | null>(null);

  // Create a payroll batch for the chosen month, kick off the
  // calculation, then drop the user into the batch detail page so they
  // can review payslips and route the batch through the approval flow.
  const handleRunPayroll = async () => {
    setRunError(null);
    if (!currentSubsidiary?.id || !userId) {
      setRunError('No active subsidiary or user — please re-login and select a subsidiary.');
      return;
    }
    setRunDialog(prev => ({ ...prev, processing: true }));
    try {
      const [yStr, mStr] = runDialog.month.split('-');
      const year = Number(yStr);
      const month = Number(mStr);

      // Default payment date = last working day of the month.
      const lastDay = new Date(year, month, 0);
      const batch = await createPayrollBatch(
        {
          subsidiaryId: currentSubsidiary.id,
          year,
          month,
          paymentDate: lastDay,
          includeAllActive: true,
        },
        userId,
        userName,
      );
      // Calculate immediately so the user lands on a populated batch.
      await calculateBatch(batch.id, userId, userName).catch((err) => {
        console.error('Batch calculation failed:', err);
        // Even if calculation hits per-employee errors, the batch exists
        // and the user can retry from the detail page — so we still
        // navigate.
      });
      setRunDialog({ open: false, month: format(new Date(), 'yyyy-MM'), processing: false });
      navigate(`/hr/payroll/batches/${batch.id}`);
    } catch (err) {
      console.error('Run payroll failed:', err);
      setRunError(err instanceof Error ? err.message : 'Run payroll failed');
      setRunDialog(prev => ({ ...prev, processing: false }));
    }
  };

  // PDF generation state
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Build payslip data for an employee
  const buildPayslipData = (item: typeof calculatedPayrollItems[0]): PayslipData => {
    const emp = employees?.find(e => e.id === item.employeeId);
    const customFields = emp?.customFields || {};
    
    return {
      employee: {
        id: item.employeeId,
        name: item.employeeName,
        employeeNumber: emp?.employeeNumber,
        department: emp?.departmentName || emp?.departmentId,
        position: emp?.title,
        bankName: customFields.bankName,
        bankAccountNumber: customFields.bankAccountNumber,
        tinNumber: customFields.tinNumber,
        nssfNumber: customFields.nssfNumber,
      },
      period: format(new Date(), 'yyyy-MM'),
      earnings: {
        basicSalary: item.basicSalary,
        housingAllowance: customFields.housingAllowance || 0,
        transportAllowance: customFields.transportAllowance || 0,
        lunchAllowance: customFields.lunchAllowance || 0,
        otherAllowances: customFields.otherAllowances || 0,
      },
      deductions: {
        paye: item.paye,
        nssf: item.nssf,
        lst: item.lst,
      },
      grossPay: item.grossPay,
      totalDeductions: item.paye + item.nssf + item.lst,
      netPay: item.netPay,
      employerNssf: item.nssf * 2, // Employer contributes 10% vs employee 5%
      // Cost-allocation footnote — only renders for split employees.
      // Sourced from the live employee record because the live-view
      // PDF runs before a payroll record / snapshot exists. Names
      // resolved via the subsidiaries collection; fall back to ID if
      // a name isn't loaded yet.
      subsidiaryAllocations: Array.isArray(emp?.subsidiaryAllocations) && emp!.subsidiaryAllocations!.length > 0
        ? emp!.subsidiaryAllocations!.map(a => ({
            subsidiaryName: subsidiaryNames[a.subsidiaryId] || a.subsidiaryId,
            allocationPercent: a.allocationPercent,
            isHost: a.subsidiaryId === emp!.subsidiaryId,
          }))
        : undefined,
    };
  };

  // Download individual payslip
  const handleDownloadPayslip = async (item: typeof calculatedPayrollItems[0]) => {
    setGeneratingPdf(true);
    try {
      const payslipData = buildPayslipData(item);
      await payrollPdfService.downloadPayslip(payslipData);
    } catch (error) {
      console.error('Failed to generate payslip:', error);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Download full payroll report
  const handleDownloadReport = async () => {
    setGeneratingPdf(true);
    try {
      const reportData: PayrollReportData = {
        period: format(new Date(), 'yyyy-MM'),
        generatedAt: new Date(),
        employees: filteredPayrollItems.map(buildPayslipData),
        totals: {
          grossPay: currentMonthTotals.totalGross,
          totalPaye: currentMonthTotals.totalPAYE,
          totalNssf: currentMonthTotals.totalNSSF,
          totalLst: currentMonthTotals.totalLST,
          totalDeductions: currentMonthTotals.totalPAYE + currentMonthTotals.totalNSSF + currentMonthTotals.totalLST,
          netPay: currentMonthTotals.totalNet,
          employerNssf: currentMonthTotals.totalNSSF * 2,
        },
        companyInfo: DEFAULT_COMPANY_INFO,
      };
      await payrollPdfService.downloadReport(reportData);
    } catch (error) {
      console.error('Failed to generate payroll report:', error);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Download all payslips (batch)
  const handleDownloadAllPayslips = async () => {
    setGeneratingPdf(true);
    try {
      for (const item of filteredPayrollItems) {
        const payslipData = buildPayslipData(item);
        await payrollPdfService.downloadPayslip(payslipData);
        // Small delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('Failed to generate payslips:', error);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Generate month options
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return options;
  }, []);

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--accent-soft)' }}
          >
            <Wallet className="h-5 w-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1>Payroll Management</h1>
            <p
              className="mt-1 text-[12.5px]"
              style={{ color: 'var(--fg-secondary)' }}
            >
              {format(new Date(currentPeriod + '-01'), 'MMMM yyyy')} · Uganda Tax Compliance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={currentPeriod} onValueChange={(v) => { setCurrentPeriod(v); setRunDialog(prev => ({ ...prev, month: v })); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate('/hr/payroll/batches')}>
            <HistoryIcon className="h-4 w-4 mr-2" />
            All batches
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={generatingPdf || filteredPayrollItems.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                {generatingPdf ? 'Generating...' : 'Export'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadReport}>
                <FileText className="h-4 w-4 mr-2" />
                Export Payroll Report (PDF)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDownloadAllPayslips}>
                <Printer className="h-4 w-4 mr-2" />
                Download All Payslips
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {existingBatch ? (
            <Button variant="primary" size="sm" onClick={() => navigate(`/hr/payroll/batches/${existingBatch.id}`)}>
              <Eye className="h-3.5 w-3.5" /> Open batch
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setRunDialog({ ...runDialog, open: true, month: currentPeriod })}>
              <Play className="h-3.5 w-3.5" /> Run Payroll
            </Button>
          )}
        </div>
      </div>

      {existingBatch && (
        <div
          className="rounded-[10px] border px-4 py-3 flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--rag-blue-soft)',
            borderColor: 'var(--rag-blue)',
          }}
        >
          <div className="text-[13px]">
            <span className="font-semibold" style={{ color: 'var(--rag-blue)' }}>
              {existingBatch.batchNumber}
            </span>
            <span style={{ color: 'var(--fg-secondary)' }}>
              {' '}
              · {format(new Date(currentPeriod + '-01'), 'MMMM yyyy')} payroll already exists.
            </span>
            <span className="ml-2 inline-flex">
              <RagBadge tone={BATCH_STATUS_TONE[BATCH_STATUS_COLORS[existingBatch.status] || 'gray']}>
                {BATCH_STATUS_LABELS[existingBatch.status]}
              </RagBadge>
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/hr/payroll/batches/${existingBatch.id}`)}>
            View batch <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Payroll</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="overtime" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Overtime</span>
          </TabsTrigger>
          <TabsTrigger value="advances" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Advances</span>
          </TabsTrigger>
          <TabsTrigger value="deductions" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Deductions</span>
          </TabsTrigger>
        </TabsList>

        {/* Payroll Tab Content */}
        <TabsContent value="payroll" className="space-y-6 mt-6">
          {/* Summary KPIs */}
          <KPIGrid>
            <KPICard
              label="Gross Payroll"
              value={formatCurrency(currentMonthTotals.totalGross)}
              delta={`${currentMonthTotals.employeeCount} employees`}
              sparkColor="var(--rag-blue)"
            />
            <KPICard
              label="Total Deductions"
              value={`-${formatCurrency(currentMonthTotals.totalPAYE + currentMonthTotals.totalNSSF + currentMonthTotals.totalLST)}`}
              delta="PAYE + NSSF + LST"
              trend="down"
              sparkColor="var(--rag-red)"
            />
            <KPICard
              label="Net Payroll"
              value={formatCurrency(currentMonthTotals.totalNet)}
              delta="Take-home amount"
              trend="up"
              sparkColor="var(--rag-green)"
            />
            <KPICard
              label="Employer NSSF (10%)"
              value={formatCurrency(currentMonthTotals.totalNSSF * 2)}
              delta="Statutory contribution"
              sparkColor="var(--boysenberry)"
            />
          </KPIGrid>

      {/* Tax Breakdown Mini Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'PAYE', value: currentMonthTotals.totalPAYE, badge: '0-40%', tone: 'amber' as const, stripe: 'var(--rag-amber)' },
          { label: 'NSSF (Employee)', value: currentMonthTotals.totalNSSF, badge: '5%', tone: 'blue' as const, stripe: 'var(--seafoam)' },
          { label: 'LST', value: currentMonthTotals.totalLST, badge: 'Annual', tone: 'na' as const, stripe: 'var(--boysenberry)' },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-[10px] border bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] flex items-center justify-between p-4"
            style={{
              borderColor: 'var(--border-subtle)',
              borderLeftWidth: 3,
              borderLeftColor: tile.stripe,
            }}
          >
            <div>
              <p
                className="text-[10.5px] font-medium uppercase tracking-wider m-0"
                style={{ color: 'var(--fg-tertiary)' }}
              >
                {tile.label}
              </p>
              <p
                className="text-[18px] font-semibold tabular-nums mt-0.5 m-0"
                style={{ color: 'var(--fg-primary)' }}
              >
                {formatCurrency(tile.value)}
              </p>
            </div>
            <RagBadge tone={tile.tone}>{tile.badge}</RagBadge>
          </div>
        ))}
      </div>

      {/* Employee Payroll Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Employee Payroll Breakdown</CardTitle>
              <CardDescription>
                Detailed salary and deduction information for {format(new Date(), 'MMMM yyyy')}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Draft
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {employeesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm text-muted-foreground mt-3">Loading payroll data...</p>
              </div>
            </div>
          ) : filteredPayrollItems.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                <Users className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium">No Salary Data Found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Add salary information to employees in their profile to see payroll calculations.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/hr/employees')}
              >
                Go to Employees
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">Employee</TableHead>
                  <TableHead className="text-right font-semibold">Basic</TableHead>
                  <TableHead className="text-right font-semibold">Allowances</TableHead>
                  <TableHead className="text-right font-semibold text-blue-600">Overtime</TableHead>
                  <TableHead className="text-right font-semibold">Gross</TableHead>
                  <TableHead className="text-right font-semibold text-orange-600">PAYE</TableHead>
                  <TableHead className="text-right font-semibold text-cyan-600">NSSF</TableHead>
                  <TableHead className="text-right font-semibold text-violet-600">LST</TableHead>
                  <TableHead className="text-right font-semibold text-amber-600">Advances</TableHead>
                  <TableHead className="text-right font-semibold text-green-600">Net Pay</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayrollItems.map(item => (
                  <TableRow key={item.employeeId} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {item.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-medium">{item.employeeName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(item.basicSalary)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(item.allowances)}</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-600">
                      {item.overtime > 0 ? `+${formatCurrency(item.overtime)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(item.grossPay)}</TableCell>
                    <TableCell className="text-right tabular-nums text-orange-600">-{formatCurrency(item.paye)}</TableCell>
                    <TableCell className="text-right tabular-nums text-cyan-600">-{formatCurrency(item.nssf)}</TableCell>
                    <TableCell className="text-right tabular-nums text-violet-600">-{formatCurrency(item.lst)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">
                      {item.advanceDeduction > 0 ? `-${formatCurrency(item.advanceDeduction)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-green-600">{formatCurrency(item.netPay)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/hr/employees/${item.employeeId}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPayslip(item)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Download Payslip
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {/* Footer Totals */}
              <tfoot>
                <TableRow className="bg-muted/70 font-semibold border-t-2">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Total ({filteredPayrollItems.length} employees)
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(filteredPayrollItems.reduce((s, i) => s + i.basicSalary, 0))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(filteredPayrollItems.reduce((s, i) => s + i.allowances, 0))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-blue-600">
                    +{formatCurrency(filteredPayrollItems.reduce((s, i) => s + i.overtime, 0))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(currentMonthTotals.totalGross)}</TableCell>
                  <TableCell className="text-right tabular-nums text-orange-600">-{formatCurrency(currentMonthTotals.totalPAYE)}</TableCell>
                  <TableCell className="text-right tabular-nums text-cyan-600">-{formatCurrency(currentMonthTotals.totalNSSF)}</TableCell>
                  <TableCell className="text-right tabular-nums text-violet-600">-{formatCurrency(currentMonthTotals.totalLST)}</TableCell>
                  <TableCell className="text-right tabular-nums text-amber-600">
                    -{formatCurrency(filteredPayrollItems.reduce((s, i) => s + i.advanceDeduction, 0))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-green-600 font-bold">{formatCurrency(currentMonthTotals.totalNet)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </tfoot>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* Attendance Tab Content */}
        <TabsContent value="attendance" className="mt-6">
          <AttendanceTab 
            period={currentPeriod} 
            employees={(employees || []).filter(e => e.employmentStatus === 'active' || e.employmentStatus === 'probation')} 
          />
        </TabsContent>

        {/* Overtime Tab Content */}
        <TabsContent value="overtime" className="mt-6">
          <OvertimeTab 
            period={currentPeriod} 
            employees={(employees || []).filter(e => e.employmentStatus === 'active' || e.employmentStatus === 'probation')} 
          />
        </TabsContent>

        {/* Advances Tab Content */}
        <TabsContent value="advances" className="mt-6">
          <AdvancesTab
            employees={(employees || []).filter(e => e.employmentStatus === 'active' || e.employmentStatus === 'probation')}
          />
        </TabsContent>

        {/* Deductions Tab Content */}
        <TabsContent value="deductions" className="mt-6">
          <DeductionsTab
            employees={(employees || []).filter(e => e.employmentStatus === 'active' || e.employmentStatus === 'probation')}
          />
        </TabsContent>
      </Tabs>

      {/* Run Payroll Dialog */}
      <Dialog open={runDialog.open} onOpenChange={(open: boolean) => !runDialog.processing && setRunDialog({ ...runDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Payroll</DialogTitle>
            <DialogDescription>
              Calculate payroll for all active employees for the selected period.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Payroll Period</label>
              <Select
                value={runDialog.month}
                onValueChange={(value) => setRunDialog(prev => ({ ...prev, month: value }))}
                disabled={runDialog.processing}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <p className="text-sm text-blue-900 font-medium mb-2">Deductions Applied:</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• PAYE (Pay As You Earn) - Progressive rate 0-40%</li>
                  <li>• NSSF - 5% employee contribution</li>
                  <li>• LST (Local Service Tax) - Annual amount pro-rated monthly</li>
                </ul>
              </CardContent>
            </Card>

            {runDialog.processing && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Creating batch and calculating payslips…</p>
                <Progress value={66} />
              </div>
            )}

            {runError && !runDialog.processing && (
              <div className="rounded border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-xs">
                {runError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRunDialog({ ...runDialog, open: false })}
              disabled={runDialog.processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRunPayroll}
              disabled={runDialog.processing}
              style={{ backgroundColor: HR_COLOR }}
            >
              {runDialog.processing ? 'Processing...' : 'Run Payroll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default PayrollPage;
