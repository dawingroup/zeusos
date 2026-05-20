/**
 * FinancialReportsPage.tsx
 * Comprehensive financial reporting with Uganda tax compliance
 * DawinOS v2.0 - Phase 8.8
 */

import { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  Landmark,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

const FINANCE_COLOR = '#4CAF50';

// Format currency in UGX
function formatCurrencyUGX(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

// Mock report data
const mockReport = {
  totalIncome: 1250000000,
  totalExpenses: 850000000,
  netIncome: 400000000,
  taxLiability: 125000000,
  incomeByCategory: [
    { category: 'Product Sales', amount: 850000000, percentage: 68 },
    { category: 'Service Revenue', amount: 280000000, percentage: 22 },
    { category: 'Other Income', amount: 120000000, percentage: 10 },
  ],
  expensesByCategory: [
    { category: 'Salaries & Wages', amount: 350000000, percentage: 41, change: 5 },
    { category: 'Rent & Utilities', amount: 180000000, percentage: 21, change: 2 },
    { category: 'Materials & Supplies', amount: 150000000, percentage: 18, change: -3 },
    { category: 'Marketing', amount: 85000000, percentage: 10, change: 12 },
    { category: 'Transport', amount: 55000000, percentage: 6, change: -5 },
    { category: 'Other', amount: 30000000, percentage: 4, change: 0 },
  ],
  budgetComparison: [
    { budgetId: '1', budgetName: 'Operations Q1', allocated: 60000000, actual: 45000000, variance: 15000000, utilization: 75 },
    { budgetId: '2', budgetName: 'Marketing Campaign', allocated: 25000000, actual: 28000000, variance: -3000000, utilization: 112 },
    { budgetId: '3', budgetName: 'IT Infrastructure', allocated: 50000000, actual: 35000000, variance: 15000000, utilization: 70 },
    { budgetId: '4', budgetName: 'HR Training', allocated: 15000000, actual: 8000000, variance: 7000000, utilization: 53 },
  ],
  // Uganda Tax Summary
  vatOutput: 225000000,
  vatInput: 153000000,
  vatPayable: 72000000,
  whtServices: 18000000,
  whtRent: 10800000,
  totalWht: 28800000,
  payeTotal: 52500000,
  nssfEmployee: 17500000,
  nssfEmployer: 35000000,
  lstTotal: 4200000,
  totalPayrollTax: 109200000,
};

export function FinancialReportsPage() {
  const [period, setPeriod] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading] = useState(false);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" style={{ color: FINANCE_COLOR }} />
            Financial Reports
          </h1>
          <p className="text-muted-foreground">Comprehensive financial analysis and Uganda tax compliance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Period Selection */}
      <div className="flex gap-4">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="quarter">Quarterly</SelectItem>
            <SelectItem value="year">Annual</SelectItem>
          </SelectContent>
        </Select>
        {period === 'month' && (
          <Input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-[180px]"
          />
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="text-center p-4">
          <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-green-600">{formatCurrencyUGX(mockReport.totalIncome)}</p>
          <p className="text-sm text-muted-foreground">Total Income</p>
        </Card>
        <Card className="text-center p-4">
          <TrendingDown className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-red-600">{formatCurrencyUGX(mockReport.totalExpenses)}</p>
          <p className="text-sm text-muted-foreground">Total Expenses</p>
        </Card>
        <Card className="text-center p-4">
          <Landmark className="h-8 w-8 text-blue-500 mx-auto mb-2" />
          <p className={cn("text-xl font-bold", mockReport.netIncome >= 0 ? "text-green-600" : "text-red-600")}>
            {formatCurrencyUGX(mockReport.netIncome)}
          </p>
          <p className="text-sm text-muted-foreground">Net Income</p>
        </Card>
        <Card className="text-center p-4">
          <CreditCard className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-amber-600">{formatCurrencyUGX(mockReport.taxLiability)}</p>
          <p className="text-sm text-muted-foreground">Tax Liability</p>
        </Card>
      </div>

      {/* Report Tabs */}
      <Card>
        <Tabs defaultValue="income" className="w-full">
          <div className="border-b px-4">
            <TabsList className="h-12">
              <TabsTrigger value="income">Income Statement</TabsTrigger>
              <TabsTrigger value="expenses">Expense Analysis</TabsTrigger>
              <TabsTrigger value="budget">Budget vs Actual</TabsTrigger>
              <TabsTrigger value="tax">Tax Summary (Uganda)</TabsTrigger>
            </TabsList>
          </div>

          {/* Income Statement Tab */}
          <TabsContent value="income" className="p-6">
            <h3 className="text-lg font-semibold mb-4">Income Statement</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 font-medium">Category</th>
                    <th className="text-right py-2 font-medium">Amount (UGX)</th>
                    <th className="text-right py-2 font-medium">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-green-50">
                    <td colSpan={3} className="py-2 font-semibold">Revenue</td>
                  </tr>
                  {mockReport.incomeByCategory.map(item => (
                    <tr key={item.category} className="border-b">
                      <td className="py-2 pl-4">{item.category}</td>
                      <td className="py-2 text-right">{formatCurrencyUGX(item.amount)}</td>
                      <td className="py-2 text-right">{item.percentage}%</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2">Total Revenue</td>
                    <td className="py-2 text-right">{formatCurrencyUGX(mockReport.totalIncome)}</td>
                    <td className="py-2 text-right">100%</td>
                  </tr>

                  <tr className="bg-red-50">
                    <td colSpan={3} className="py-2 font-semibold">Expenses</td>
                  </tr>
                  {mockReport.expensesByCategory.map(item => (
                    <tr key={item.category} className="border-b">
                      <td className="py-2 pl-4">{item.category}</td>
                      <td className="py-2 text-right">{formatCurrencyUGX(item.amount)}</td>
                      <td className="py-2 text-right">{item.percentage}%</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2">Total Expenses</td>
                    <td className="py-2 text-right">{formatCurrencyUGX(mockReport.totalExpenses)}</td>
                    <td className="py-2 text-right">100%</td>
                  </tr>

                  <tr className="bg-blue-50 font-bold">
                    <td className="py-3">Net Income</td>
                    <td className={cn("py-3 text-right", mockReport.netIncome >= 0 ? "text-green-600" : "text-red-600")}>
                      {formatCurrencyUGX(mockReport.netIncome)}
                    </td>
                    <td className="py-3 text-right">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Expense Analysis Tab */}
          <TabsContent value="expenses" className="p-6">
            <h3 className="text-lg font-semibold mb-4">Expense Analysis by Category</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 font-medium">Category</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                    <th className="text-right py-2 font-medium">% of Total</th>
                    <th className="text-right py-2 font-medium">vs. Last Period</th>
                  </tr>
                </thead>
                <tbody>
                  {mockReport.expensesByCategory.map(item => (
                    <tr key={item.category} className="border-b">
                      <td className="py-2">{item.category}</td>
                      <td className="py-2 text-right">{formatCurrencyUGX(item.amount)}</td>
                      <td className="py-2 text-right">{item.percentage}%</td>
                      <td className="py-2 text-right">
                        <Badge className={cn(
                          "text-xs",
                          item.change <= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        )}>
                          {item.change >= 0 ? '+' : ''}{item.change}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Budget vs Actual Tab */}
          <TabsContent value="budget" className="p-6">
            <h3 className="text-lg font-semibold mb-4">Budget vs Actual Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 font-medium">Budget</th>
                    <th className="text-right py-2 font-medium">Allocated</th>
                    <th className="text-right py-2 font-medium">Actual</th>
                    <th className="text-right py-2 font-medium">Variance</th>
                    <th className="text-right py-2 font-medium">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {mockReport.budgetComparison.map(item => (
                    <tr key={item.budgetId} className="border-b">
                      <td className="py-2">{item.budgetName}</td>
                      <td className="py-2 text-right">{formatCurrencyUGX(item.allocated)}</td>
                      <td className="py-2 text-right">{formatCurrencyUGX(item.actual)}</td>
                      <td className={cn("py-2 text-right", item.variance >= 0 ? "text-green-600" : "text-red-600")}>
                        {formatCurrencyUGX(item.variance)}
                      </td>
                      <td className="py-2 text-right">
                        <Badge className={cn(
                          "text-xs",
                          item.utilization >= 100 ? "bg-red-100 text-red-800" :
                          item.utilization >= 90 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                        )}>
                          {item.utilization}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Uganda Tax Summary Tab */}
          <TabsContent value="tax" className="p-6">
            <h3 className="text-lg font-semibold mb-4">Uganda Tax Compliance Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* VAT Summary */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">VAT Summary (18%)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Output VAT (Sales)</span>
                    <span className="font-medium">{formatCurrencyUGX(mockReport.vatOutput)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Input VAT (Purchases)</span>
                    <span className="font-medium">{formatCurrencyUGX(mockReport.vatInput)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Net VAT Payable</span>
                    <span className={mockReport.vatPayable >= 0 ? "text-red-600" : "text-green-600"}>
                      {formatCurrencyUGX(Math.abs(mockReport.vatPayable))}
                      {mockReport.vatPayable < 0 && ' (Refund)'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* WHT Summary */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Withholding Tax (6%)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>WHT on Services</span>
                    <span className="font-medium">{formatCurrencyUGX(mockReport.whtServices)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>WHT on Rent</span>
                    <span className="font-medium">{formatCurrencyUGX(mockReport.whtRent)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total WHT</span>
                    <span className="text-amber-600">{formatCurrencyUGX(mockReport.totalWht)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Payroll Taxes */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Payroll Taxes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>PAYE (Pay As You Earn)</span>
                    <span className="font-medium">{formatCurrencyUGX(mockReport.payeTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>NSSF Employee (5%)</span>
                    <span className="font-medium">{formatCurrencyUGX(mockReport.nssfEmployee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>NSSF Employer (10%)</span>
                    <span className="font-medium">{formatCurrencyUGX(mockReport.nssfEmployer)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Local Service Tax (LST)</span>
                    <span className="font-medium">{formatCurrencyUGX(mockReport.lstTotal)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total Payroll Taxes</span>
                    <span className="text-red-600">{formatCurrencyUGX(mockReport.totalPayrollTax)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* URA Filing Deadlines */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">URA Filing Deadlines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>VAT Return</span>
                    <Badge variant="outline">15th of following month</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>WHT Return</span>
                    <Badge variant="outline">15th of following month</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>PAYE Return</span>
                    <Badge variant="outline">15th of following month</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>NSSF Contribution</span>
                    <Badge variant="outline">15th of following month</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Annual Return</span>
                    <Badge className="bg-amber-100 text-amber-800">June 30th</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Total Tax Liability */}
            <Card className="mt-6 border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">Total Tax Liability This Period</h4>
                    <p className="text-sm text-muted-foreground">
                      Combined VAT, WHT, PAYE, NSSF, and LST obligations
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-red-600">
                    {formatCurrencyUGX(mockReport.taxLiability)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

export default FinancialReportsPage;
