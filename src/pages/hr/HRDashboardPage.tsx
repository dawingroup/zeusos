/**
 * HRDashboardPage.tsx
 * HR Central module dashboard with key metrics and quick actions
 * DawinOS v2.0 - Phase 8.6
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

import { useEmployeeStats, useExpiringProbations } from '@/modules/hr-central/hooks/useEmployee';


interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
}

function MetricCard({ title, value, subtitle, icon, trend, onClick }: MetricCardProps) {
  return (
    <Card 
      className={cn('cursor-pointer hover:shadow-md transition-shadow', onClick && 'hover:border-primary/50')}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={cn('text-sm', trend.isPositive ? 'text-green-500' : 'text-red-500')}>
                  {Math.abs(trend.value)}%
                </span>
              </div>
            )}
          </div>
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HRDashboardPage() {
  const navigate = useNavigate();
  const { stats, loading: statsLoading, error: statsError } = useEmployeeStats();
  const { employees: expiringProbations, loading: probationsLoading } = useExpiringProbations(30);

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16 mt-2" />
                <Skeleton className="h-4 w-20 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-lg font-medium">Failed to load dashboard</p>
        <p className="text-muted-foreground">{statsError.message}</p>
      </div>
    );
  }

  const onLeaveCount = stats?.byStatus?.on_leave || 0;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2">
            <Users className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            HR Central
          </h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Human Resources Management
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/hr/employees/new')}>
          <UserPlus className="h-3.5 w-3.5" /> Add Employee
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Employees"
          value={stats?.totalEmployees || 0}
          subtitle={`${stats?.byStatus?.active || 0} active`}
          icon={<Users className="h-6 w-6" />}
          onClick={() => navigate('/hr/employees')}
        />
        <MetricCard
          title="New Hires"
          value={stats?.newHiresCount || 0}
          subtitle="Last 30 days"
          icon={<UserPlus className="h-6 w-6" />}
          onClick={() => navigate('/hr/employees?filter=new')}
        />
        <MetricCard
          title="On Leave"
          value={onLeaveCount}
          subtitle="Currently away"
          icon={<Calendar className="h-6 w-6" />}
          onClick={() => navigate('/hr/leave')}
        />
        <MetricCard
          title="Payroll Status"
          value={(stats as any)?.payrollProcessed ? 'Processed' : 'Pending'}
          subtitle={(stats as any)?.nextPayrollDate ? `Next: ${format((stats as any).nextPayrollDate, 'MMM dd')}` : undefined}
          icon={<DollarSign className="h-6 w-6" />}
          onClick={() => navigate('/hr/payroll')}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Probations Ending Soon */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Probations Ending Soon
            </CardTitle>
            <Badge variant="secondary">{expiringProbations.length}</Badge>
          </CardHeader>
          <CardContent>
            {probationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : expiringProbations.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-muted-foreground">No probations ending soon</p>
              </div>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="space-y-2">
                  {expiringProbations.map(employee => {
                    const daysLeft = employee.employmentDates?.probationEndDate
                      ? Math.ceil((employee.employmentDates.probationEndDate.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;

                    return (
                      <div
                        key={employee.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => navigate(`/hr/employees/${employee.id}`)}
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {employee.firstName?.[0]}{employee.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {employee.position?.title}
                          </p>
                        </div>
                        <Badge variant={daysLeft !== null && daysLeft <= 7 ? 'destructive' : 'secondary'}>
                          {daysLeft !== null
                            ? daysLeft <= 0 ? 'Overdue' : `${daysLeft}d left`
                            : 'Unknown'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
            {expiringProbations.length > 5 && (
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => navigate('/hr/employees?status=probation')}
              >
                View all {expiringProbations.length}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate('/hr/employees/new')}
              >
                <UserPlus className="h-5 w-5" />
                <span className="text-sm">Add Employee</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate('/hr/leave')}
              >
                <Calendar className="h-5 w-5" />
                <span className="text-sm">Leave Requests</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate('/hr/payroll')}
              >
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">Run Payroll</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate('/hr/departments')}
              >
                <Users className="h-5 w-5" />
                <span className="text-sm">Departments</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Department Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Department Headcount</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/hr/departments')}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(Array.isArray(stats?.byDepartment) ? stats.byDepartment : []).slice(0, 5).map((dept: { id: string; name: string; count: number }) => (
                <div key={dept.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{dept.name}</span>
                    <span className="font-medium">{dept.count}</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--bg-sunken)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(dept.count / (stats?.totalEmployees || 1)) * 100}%`,
                        backgroundColor: 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              ))}
              {(!stats?.byDepartment || !Array.isArray(stats.byDepartment) || stats.byDepartment.length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  No department data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default HRDashboardPage;
