/**
 * Tax Compliance Dashboard
 * EFRIS invoice validation overview and management
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Progress } from '@/core/components/ui/progress';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  Building2,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { useEFRISValidation, useFilteredValidations, useTaxComplianceSummary } from '../../hooks/useEFRIS';
import { EFRISValidationBadge } from './EFRISValidationBadge';
import { InvoiceValidationCard } from './InvoiceValidationCard';
import { InvoiceValidationRecord, EFRISInvoiceStatus } from '../../types/efris';
import { cn } from '@/shared/lib/utils';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface TaxComplianceDashboardProps {
  projectId: string;
  className?: string;
}

// Helper functions
function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'PP');
  } catch {
    return dateString;
  }
}

export function TaxComplianceDashboard({
  projectId,
  className,
}: TaxComplianceDashboardProps) {
  const [dateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  
  const {
    validations,
    stats,
    isLoading,
    batchValidate,
    isBatchValidating,
    revalidateInvoice,
    isRevalidating,
  } = useEFRISValidation(projectId);
  
  const {
    filtered,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
  } = useFilteredValidations(validations);
  
  const { summary } = useTaxComplianceSummary(
    projectId,
    dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
    dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''
  );
  
  const [selectedValidation, setSelectedValidation] = useState<string | null>(null);
  
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Tax Compliance</h2>
          <p className="text-muted-foreground">EFRIS invoice validation and VAT tracking</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => batchValidate(10)}
            disabled={isBatchValidating || stats.pending === 0}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isBatchValidating && 'animate-spin')} />
            Validate Pending ({stats.pending})
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Compliance Rate"
          value={summary?.complianceRate ? `${summary.complianceRate.toFixed(1)}%` : '--'}
          icon={TrendingUp}
          description={`${stats.valid} of ${stats.total} invoices valid`}
          trend={summary?.complianceRate && summary.complianceRate >= 80 ? 'up' : 'down'}
        />
        <SummaryCard
          title="VAT Recoverable"
          value={formatCurrency(summary?.amounts.vatRecoverable || 0)}
          icon={Receipt}
          description="From valid invoices"
        />
        <SummaryCard
          title="At Risk"
          value={formatCurrency(summary?.amounts.withInvalidInvoices || 0)}
          icon={AlertTriangle}
          description="Invalid/missing invoices"
          trend="down"
        />
        <SummaryCard
          title="VAT Suppliers"
          value={`${summary?.suppliers.vatRegistered || 0}/${summary?.suppliers.total || 0}`}
          icon={Building2}
          description="VAT registered suppliers"
        />
      </div>
      
      {/* Compliance Progress */}
      {summary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invoice Validation Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overall Compliance</span>
                <span className="font-medium">{summary.complianceRate.toFixed(1)}%</span>
              </div>
              <Progress value={summary.complianceRate} className="h-3" />
              <div className="grid grid-cols-4 gap-4 text-center text-sm">
                <div>
                  <div className="flex items-center justify-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">{summary.invoices.validated}</span>
                  </div>
                  <p className="text-muted-foreground">Valid</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">{summary.invoices.invalid}</span>
                  </div>
                  <p className="text-muted-foreground">Invalid</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-yellow-600">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">{summary.invoices.pending}</span>
                  </div>
                  <p className="text-muted-foreground">Pending</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Receipt className="h-4 w-4" />
                    <span className="font-medium">{summary.invoices.total}</span>
                  </div>
                  <p className="text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Invoice List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle>Invoice Validations</CardTitle>
              <CardDescription>All EFRIS validated invoices for this project</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search FDN or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select 
                value={statusFilter} 
                onValueChange={(v) => setStatusFilter(v as EFRISInvoiceStatus | 'all')}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="invalid">Invalid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No invoice validations found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium">FDN</th>
                    <th className="text-left p-3 text-sm font-medium">Supplier</th>
                    <th className="text-left p-3 text-sm font-medium">Date</th>
                    <th className="text-right p-3 text-sm font-medium">Amount</th>
                    <th className="text-right p-3 text-sm font-medium">VAT</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="w-[50px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((validation: InvoiceValidationRecord) => (
                    <tr
                      key={validation.id}
                      className="border-b cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelectedValidation(
                        selectedValidation === validation.id ? null : validation.id
                      )}
                    >
                      <td className="p-3 font-mono text-sm">
                        {validation.fdn}
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{validation.supplierName}</p>
                          {validation.supplierTin && (
                            <p className="text-xs text-muted-foreground">
                              TIN: {validation.supplierTin}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {validation.invoiceDate 
                          ? formatDate(validation.invoiceDate) 
                          : '--'
                        }
                      </td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(validation.totalAmount, validation.currency)}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {formatCurrency(validation.vatAmount, validation.currency)}
                      </td>
                      <td className="p-3">
                        <EFRISValidationBadge
                          status={validation.validationStatus}
                          size="sm"
                        />
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            revalidateInvoice(validation.id);
                          }}
                          disabled={isRevalidating}
                        >
                          <RefreshCw className={cn(
                            'h-4 w-4',
                            isRevalidating && 'animate-spin'
                          )} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Expanded Detail */}
          {selectedValidation && (
            <div className="mt-4">
              <InvoiceValidationCard
                validation={filtered.find((v: InvoiceValidationRecord) => v.id === selectedValidation)!}
                onRevalidate={() => revalidateInvoice(selectedValidation)}
                isRevalidating={isRevalidating}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  trend?: 'up' | 'down';
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn(
              'text-2xl font-bold',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600'
            )}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={cn(
            'p-3 rounded-full',
            trend === 'up' && 'bg-green-100',
            trend === 'down' && 'bg-red-100',
            !trend && 'bg-muted'
          )}>
            <Icon className={cn(
              'h-5 w-5',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
              !trend && 'text-muted-foreground'
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TaxComplianceDashboard;
