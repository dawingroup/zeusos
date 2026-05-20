/**
 * Attendance Tab
 *
 * Matrix view (rows = employees, columns = days of the period) is the
 * primary entry path. An "Import" button opens the spreadsheet upload
 * dialog for bulk loads.
 */

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Percent,
  Upload,
} from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { useAttendance } from '../hooks/usePayrollRecords';
import { AttendanceMatrix } from './AttendanceMatrix';
import { AttendanceImportDialog } from './AttendanceImportDialog';

interface AttendanceTabProps {
  period: string;
  employees: Array<{ id: string; fullName: string; employeeNumber?: string }>;
}

export function AttendanceTab({ period, employees }: AttendanceTabProps) {
  const { records, loading, upsertMatrix } = useAttendance(undefined, period);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);

  const employeeMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of employees) m[e.id] = e.fullName;
    return m;
  }, [employees]);

  const summaryStats = useMemo(() => {
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const leave = records.filter(r => r.status === 'leave' || r.status === 'sick').length;
    const total = records.length;
    return {
      present,
      absent,
      late,
      leave,
      attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
    };
  }, [records]);

  const handleSave = async (changes: Array<{ employeeId: string; date: string; status: import('../types/payroll-records.types').AttendanceStatus }>) => {
    setSaving(true);
    try {
      await upsertMatrix(changes, employeeMap);
    } finally {
      setSaving(false);
    }
  };

  const handleImportConfirm = async (cells: Array<{ employeeId: string; date: string; status: import('../types/payroll-records.types').AttendanceStatus; notes?: string; hoursWorked?: number }>) => {
    setSaving(true);
    try {
      await upsertMatrix(cells, employeeMap);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-green-100">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-xl font-bold">{summaryStats.present}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-red-100">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-xl font-bold">{summaryStats.absent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-yellow-100">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Late</p>
                <p className="text-xl font-bold">{summaryStats.late}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-blue-100">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">On Leave</p>
                <p className="text-xl font-bold">{summaryStats.leave}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-emerald-100">
                <Percent className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Attendance Rate</p>
                <p className="text-xl font-bold">{summaryStats.attendanceRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Attendance Matrix</h2>
              <p className="text-xs text-gray-500">
                {format(new Date(period + '-01'), 'MMMM yyyy')} — click a cell to set its status,
                click a date or employee header to bulk-set.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4 mr-2" /> Import from spreadsheet
            </Button>
          </div>

          <AttendanceMatrix
            period={period}
            employees={employees}
            records={records}
            loading={loading}
            saving={saving}
            onSave={handleSave}
          />
        </CardContent>
      </Card>

      <AttendanceImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        period={period}
        employees={employees}
        onConfirm={handleImportConfirm}
      />
    </div>
  );
}

export default AttendanceTab;
