/**
 * Employee Workload Panel
 * Shows per-employee task assignments, workload, and capacity for the Intelligence Admin Dashboard
 */

import { useState, useEffect } from 'react';
import {
  Users,
  User,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  ChevronRight,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { DEPARTMENTS, WORKLOAD_DEFAULTS } from '@/modules/intelligence-layer/constants/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import { Progress } from '@/core/components/ui/progress';
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
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';

// ============================================
// Types
// ============================================

interface EmployeeWorkload {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  initials: string;
  avatarUrl?: string;
  status: 'active' | 'probation' | 'on_leave' | 'inactive';
  tasks: {
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
  };
  utilization: number;
  maxCapacity: number;
  skills: string[];
  recentTasks: TaskSummary[];
}

interface TaskSummary {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate?: string;
}

type DepartmentFilter = 'all' | 'design' | 'production' | 'operations' | 'procurement';
type CapacityFilter = 'all' | 'available' | 'at_capacity' | 'overloaded';

// ============================================
// Employee Workload Panel Component
// ============================================

export function EmployeeWorkloadPanel() {
  const [employees, setEmployees] = useState<EmployeeWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>('all');
  const [capacityFilter, setCapacityFilter] = useState<CapacityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWorkload | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Departments for filtering (from shared constants)
  const departments = [
    { value: 'all', label: 'All Departments' },
    ...DEPARTMENTS,
  ];

  // Fetch employees and their task counts
  useEffect(() => {
    const fetchEmployeesWithTasks = async () => {
      setLoading(true);

      try {
        // Fetch employees
        const employeesRef = collection(db, 'employees');
        let employeeQuery = query(
          employeesRef,
          where('employmentStatus', 'in', ['active', 'probation']),
          limit(100)
        );

        const employeeSnapshot = await getDocs(employeeQuery);

        // For each employee, get their task counts
        const employeesWithTasks: EmployeeWorkload[] = await Promise.all(
          employeeSnapshot.docs.map(async (empDoc) => {
            const empData = empDoc.data();
            const firstName = empData.firstName || '';
            const lastName = empData.lastName || '';

            // Get task counts for this employee
            const tasksRef = collection(db, 'generatedTasks');
            const taskQuery = query(
              tasksRef,
              where('assignedTo', '==', empDoc.id),
              limit(100)
            );
            const taskSnapshot = await getDocs(taskQuery);

            let pending = 0, inProgress = 0, completed = 0, blocked = 0;
            const recentTasks: TaskSummary[] = [];

            taskSnapshot.docs.forEach((taskDoc) => {
              const task = taskDoc.data();
              switch (task.status) {
                case 'pending': pending++; break;
                case 'in_progress': inProgress++; break;
                case 'completed': completed++; break;
                case 'blocked': blocked++; break;
              }

              // Keep first 5 non-completed tasks for recent
              if (task.status !== 'completed' && recentTasks.length < 5) {
                recentTasks.push({
                  id: taskDoc.id,
                  title: task.title,
                  priority: task.priority,
                  status: task.status,
                  dueDate: task.dueDate?.toDate()?.toLocaleDateString(),
                });
              }
            });

            const activeTasks = pending + inProgress;
            const maxCapacity = empData.workload?.maxConcurrent || WORKLOAD_DEFAULTS.DEFAULT_MAX_CAPACITY;
            const utilization = Math.round((activeTasks / maxCapacity) * 100);

            return {
              id: empDoc.id,
              name: `${firstName} ${lastName}`.trim() || 'Unknown',
              email: empData.email || '',
              role: empData.position?.title || 'Team Member',
              department: empData.position?.departmentId || 'unknown',
              initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?',
              avatarUrl: empData.photoUrl,
              status: empData.employmentStatus || 'active',
              tasks: { pending, inProgress, completed, blocked },
              utilization,
              maxCapacity,
              skills: empData.skills?.map((s: any) => s.name) || [],
              recentTasks,
            };
          })
        );

        // Apply filters
        let filtered = employeesWithTasks;

        // Department filter
        if (departmentFilter !== 'all') {
          filtered = filtered.filter(e => e.department === departmentFilter);
        }

        // Capacity filter
        if (capacityFilter !== 'all') {
          filtered = filtered.filter(e => {
            if (capacityFilter === 'available') return e.utilization < 60;
            if (capacityFilter === 'at_capacity') return e.utilization >= 60 && e.utilization < 90;
            if (capacityFilter === 'overloaded') return e.utilization >= 90;
            return true;
          });
        }

        // Search filter
        if (searchQuery) {
          filtered = filtered.filter(e =>
            e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.email.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        // Sort by utilization (highest first)
        filtered.sort((a, b) => b.utilization - a.utilization);

        setEmployees(filtered);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeesWithTasks();
  }, [departmentFilter, capacityFilter, searchQuery]);

  // Get capacity badge
  const getCapacityBadge = (utilization: number) => {
    if (utilization >= 90) {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Overloaded
        </Badge>
      );
    }
    if (utilization >= 60) {
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          <Clock className="h-3 w-3 mr-1" />
          At Capacity
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
        <CheckCircle className="h-3 w-3 mr-1" />
        Available
      </Badge>
    );
  };

  // Get utilization color
  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return 'text-red-600';
    if (utilization >= 60) return 'text-amber-600';
    return 'text-green-600';
  };

  // Summary stats
  const stats = {
    total: employees.length,
    available: employees.filter(e => e.utilization < 60).length,
    atCapacity: employees.filter(e => e.utilization >= 60 && e.utilization < 90).length,
    overloaded: employees.filter(e => e.utilization >= 90).length,
    totalActiveTasks: employees.reduce((sum, e) => sum + e.tasks.pending + e.tasks.inProgress, 0),
    avgUtilization: employees.length > 0
      ? Math.round(employees.reduce((sum, e) => sum + e.utilization, 0) / employees.length)
      : 0,
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Department Filter */}
            <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as DepartmentFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Capacity Filter */}
            <Select value={capacityFilter} onValueChange={(v) => setCapacityFilter(v as CapacityFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Capacity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Capacity</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="at_capacity">At Capacity</SelectItem>
                <SelectItem value="overloaded">Overloaded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Team Size</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Available</div>
          <div className="text-2xl font-bold text-green-600">{stats.available}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">At Capacity</div>
          <div className="text-2xl font-bold text-amber-600">{stats.atCapacity}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Overloaded</div>
          <div className="text-2xl font-bold text-red-600">{stats.overloaded}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Active Tasks</div>
          <div className="text-2xl font-bold text-blue-600">{stats.totalActiveTasks}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Avg. Utilization</div>
          <div className={`text-2xl font-bold ${getUtilizationColor(stats.avgUtilization)}`}>
            {stats.avgUtilization}%
          </div>
        </Card>
      </div>

      {/* Employee List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Team Workload
            </CardTitle>
            <Badge variant="outline">{employees.length} employees</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No employees found matching your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedEmployee(employee);
                    setIsDetailOpen(true);
                  }}
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                    {employee.initials}
                  </div>

                  {/* Employee Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{employee.name}</span>
                      {getCapacityBadge(employee.utilization)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {employee.role} • {employee.department}
                    </p>
                  </div>

                  {/* Task Counts */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-amber-600">{employee.tasks.pending}</div>
                      <div className="text-xs text-muted-foreground">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">{employee.tasks.inProgress}</div>
                      <div className="text-xs text-muted-foreground">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">{employee.tasks.completed}</div>
                      <div className="text-xs text-muted-foreground">Done</div>
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="w-32">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className={`font-medium ${getUtilizationColor(employee.utilization)}`}>
                        {employee.utilization}%
                      </span>
                    </div>
                    <Progress
                      value={employee.utilization}
                      className={`h-2 ${
                        employee.utilization >= 90 ? '[&>div]:bg-red-500' :
                        employee.utilization >= 60 ? '[&>div]:bg-amber-500' :
                        '[&>div]:bg-green-500'
                      }`}
                    />
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-500" />
              Employee Workload Details
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              {/* Employee Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-medium">
                  {selectedEmployee.initials}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedEmployee.name}</h3>
                  <p className="text-muted-foreground">{selectedEmployee.role}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getCapacityBadge(selectedEmployee.utilization)}
                    <Badge variant="outline" className="capitalize">
                      {selectedEmployee.department}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Utilization Overview */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Workload Utilization</span>
                  <span className={`text-lg font-bold ${getUtilizationColor(selectedEmployee.utilization)}`}>
                    {selectedEmployee.utilization}%
                  </span>
                </div>
                <Progress
                  value={selectedEmployee.utilization}
                  className={`h-3 ${
                    selectedEmployee.utilization >= 90 ? '[&>div]:bg-red-500' :
                    selectedEmployee.utilization >= 60 ? '[&>div]:bg-amber-500' :
                    '[&>div]:bg-green-500'
                  }`}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{selectedEmployee.tasks.pending + selectedEmployee.tasks.inProgress} active tasks</span>
                  <span>Max capacity: {selectedEmployee.maxCapacity}</span>
                </div>
              </div>

              {/* Task Breakdown */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Task Breakdown
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      {selectedEmployee.tasks.pending}
                    </div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedEmployee.tasks.inProgress}
                    </div>
                    <div className="text-xs text-muted-foreground">In Progress</div>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedEmployee.tasks.completed}
                    </div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {selectedEmployee.tasks.blocked}
                    </div>
                    <div className="text-xs text-muted-foreground">Blocked</div>
                  </div>
                </div>
              </div>

              {/* Recent Tasks */}
              {selectedEmployee.recentTasks.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Active Tasks</h4>
                  <div className="space-y-2">
                    {selectedEmployee.recentTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <Badge
                          className={
                            task.priority === 'P0' ? 'bg-red-500' :
                            task.priority === 'P1' ? 'bg-orange-500' :
                            task.priority === 'P2' ? 'bg-blue-500' :
                            'bg-gray-500'
                          }
                        >
                          {task.priority}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground">Due: {task.dueDate}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {selectedEmployee.skills.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedEmployee.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Close */}
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmployeeWorkloadPanel;
