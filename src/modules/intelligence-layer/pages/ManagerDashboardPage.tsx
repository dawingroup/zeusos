/**
 * Manager Dashboard Page
 * ZeusOS v2.0 - Intelligence Layer
 *
 * Manager view for monitoring team workload and task assignments
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ClipboardList,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  TrendingUp,
  RefreshCw,
  User,
  Calendar,
  BarChart3,
  UserPlus,
  Repeat,
  ExternalLink,
  PieChart,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { useAuth } from '@/integration/store';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';

import { MODULE_COLOR } from '../constants';
import { TaskAssignmentDialog } from '../components/manager/TaskAssignmentDialog';
import { getEntityRoute, getProjectRoute } from '../utils/getEntityRoute';
import { useEmployeeDocId } from '../hooks/useEmployeeDocId';

// ============================================
// Types
// ============================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  department?: string;
  role?: string;
  taskStats: {
    pending: number;
    inProgress: number;
    completed: number;
    completedToday: number;
    blocked: number;
    overdue: number;
  };
  utilization: number;
}

interface TeamTask {
  id: string;
  title: string;
  description?: string;
  aiDescription?: string;
  aiChecklist?: { id: string; title: string; description: string; isRequired: boolean; order: number; completed: boolean }[];
  aiRelevantDocuments?: { name: string; type: string; reason: string }[];
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: string;
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: Date;
  sourceModule: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  projectId?: string;
  projectName?: string;
}

interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedToday: number;
  overdueTasks: number;
  avgUtilization: number;
}

// ============================================
// Manager Dashboard Page Component
// ============================================

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { userId: authUid, email: authEmail } = useAuth();
  const { employeeDocId, loading: resolvingEmployee } = useEmployeeDocId(authUid, authEmail);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [recentTasks, setRecentTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberTasks, setMemberTasks] = useState<TeamTask[]>([]);
  const [memberTasksLoading, setMemberTasksLoading] = useState(false);
  const [assignmentDialog, setAssignmentDialog] = useState<{
    open: boolean;
    task: any;
    mode: 'assign' | 'reassign' | 'takeup';
  } | null>(null);

  // Fetch team data
  const fetchTeamData = useCallback(async () => {
    // Wait for employee doc ID resolution before fetching
    if (resolvingEmployee) return;

    setLoading(true);
    try {
      // Fetch employees — filter by manager's team if possible
      // Include both 'active' and 'probation' statuses
      const employeesRef = collection(db, 'employees');
      const workingStatuses = ['active', 'probation'];
      const allActiveQuery = query(
        employeesRef,
        where('employmentStatus', 'in', workingStatuses),
        limit(50)
      );

      let employeeSnapshot;

      if (employeeDocId) {
        // Try to fetch direct reports first
        try {
          const teamQuery = query(
            employeesRef,
            where('employmentStatus', 'in', workingStatuses),
            where('position.reportingTo', '==', employeeDocId),
            limit(50)
          );
          employeeSnapshot = await getDocs(teamQuery);

          // If no direct reports found, fall back to all active employees
          if (employeeSnapshot.empty) {
            employeeSnapshot = await getDocs(allActiveQuery);
          }
        } catch {
          // Fallback: if position.reportingTo index missing or query fails
          employeeSnapshot = await getDocs(allActiveQuery);
        }
      } else {
        employeeSnapshot = await getDocs(allActiveQuery);
      }

      // Batch-fetch tasks for ALL employees using 'in' queries (max 30 per batch)
      // Include both employee doc IDs AND auth UIDs (systemAccess.userId) to catch
      // tasks assigned before the ID-resolution fix.
      const allQueryIds: string[] = [];
      const idToEmployeeDocId = new Map<string, string>(); // maps any ID → canonical employee doc ID

      employeeSnapshot.docs.forEach((empDoc) => {
        const empData = empDoc.data();
        const docId = empDoc.id;
        allQueryIds.push(docId);
        idToEmployeeDocId.set(docId, docId);

        // Also include the Firebase Auth UID stored on the employee record
        const authUidOnEmployee = empData.systemAccess?.userId;
        if (authUidOnEmployee && authUidOnEmployee !== docId) {
          allQueryIds.push(authUidOnEmployee);
          idToEmployeeDocId.set(authUidOnEmployee, docId);
        }
      });

      // De-duplicate IDs
      const uniqueQueryIds = [...new Set(allQueryIds)];
      const tasksByEmployee = new Map<string, any[]>();

      const tasksRef = collection(db, 'generatedTasks');
      for (let i = 0; i < uniqueQueryIds.length; i += 30) {
        const batch = uniqueQueryIds.slice(i, i + 30);
        const batchQuery = query(
          tasksRef,
          where('assignedTo', 'in', batch),
          limit(500)
        );
        const batchSnapshot = await getDocs(batchQuery);

        batchSnapshot.docs.forEach((taskDoc) => {
          const task = taskDoc.data();
          const assignee = task.assignedTo;
          // Map back to the canonical employee doc ID
          const canonicalId = idToEmployeeDocId.get(assignee) || assignee;
          if (!tasksByEmployee.has(canonicalId)) {
            tasksByEmployee.set(canonicalId, []);
          }
          tasksByEmployee.get(canonicalId)!.push(task);
        });
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Build team member objects from pre-fetched data
      const members: TeamMember[] = employeeSnapshot.docs.map((empDoc) => {
        const empData = empDoc.data();
        const empTasks = tasksByEmployee.get(empDoc.id) || [];

        let pending = 0;
        let inProgress = 0;
        let completed = 0;
        let completedToday = 0;
        let blocked = 0;
        let overdue = 0;

        empTasks.forEach((task) => {
          switch (task.status) {
            case 'pending':
              pending++;
              break;
            case 'in_progress':
              inProgress++;
              break;
            case 'completed': {
              completed++;
              const completedAt = task.completedAt?.toDate?.() || task.updatedAt?.toDate?.();
              if (completedAt && completedAt >= today) {
                completedToday++;
              }
              break;
            }
            case 'blocked':
              blocked++;
              break;
          }

          const dueDate = task.dueDate?.toDate();
          if (dueDate && dueDate < today && task.status !== 'completed') {
            overdue++;
          }
        });

        const activeTasks = pending + inProgress;
        const maxTasks = empData.workload?.maxConcurrent || 10;
        const utilization = Math.min(Math.round((activeTasks / maxTasks) * 100), 100);

        return {
          id: empDoc.id,
          name: empData.displayName || empData.firstName + ' ' + empData.lastName || 'Unknown',
          email: empData.email || '',
          department: empData.department || empData.departmentId,
          role: empData.jobTitle || empData.role,
          taskStats: { pending, inProgress, completed, completedToday, blocked, overdue },
          utilization,
        };
      });

      // Sort by active tasks (descending)
      members.sort((a, b) =>
        (b.taskStats.pending + b.taskStats.inProgress) -
        (a.taskStats.pending + a.taskStats.inProgress)
      );

      setTeamMembers(members);

      // Fetch recent team tasks
      const allTasksQuery = query(
        collection(db, 'generatedTasks'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const allTasksSnapshot = await getDocs(allTasksQuery);

      const tasks: TeamTask[] = allTasksSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          aiDescription: data.aiDescription,
          aiChecklist: data.aiChecklist,
          aiRelevantDocuments: data.aiRelevantDocuments,
          priority: data.priority,
          status: data.status,
          assignedTo: data.assignedTo,
          assignedToName: data.assignedToName,
          dueDate: data.dueDate?.toDate(),
          sourceModule: data.sourceModule,
          entityType: data.entityType,
          entityId: data.entityId,
          entityName: data.entityName,
          projectId: data.projectId,
          projectName: data.projectName,
        };
      });

      setRecentTasks(tasks);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  }, [employeeDocId, resolvingEmployee]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Drill down into a team member's tasks
  const drillDownMember = useCallback(async (member: TeamMember) => {
    setSelectedMember(member);
    setMemberTasksLoading(true);

    try {
      const tasksRef = collection(db, 'generatedTasks');

      // Find the employee's auth UID too (for dual-ID matching)
      const empDoc = await getDocs(query(
        collection(db, 'employees'),
        where('__name__', '==', member.id),
        limit(1)
      ));
      const empData = empDoc.docs[0]?.data();
      const authUidOnEmployee = empData?.systemAccess?.userId;

      const assigneeIds = authUidOnEmployee && authUidOnEmployee !== member.id
        ? [member.id, authUidOnEmployee]
        : [member.id];

      const memberQuery = query(
        tasksRef,
        where('assignedTo', 'in', assigneeIds),
        orderBy('dueDate', 'asc'),
        limit(100)
      );
      const snapshot = await getDocs(memberQuery);

      const tasks: TeamTask[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          aiDescription: data.aiDescription,
          aiChecklist: data.aiChecklist,
          aiRelevantDocuments: data.aiRelevantDocuments,
          priority: data.priority,
          status: data.status,
          assignedTo: data.assignedTo,
          assignedToName: data.assignedToName,
          dueDate: data.dueDate?.toDate(),
          sourceModule: data.sourceModule,
          entityType: data.entityType,
          entityId: data.entityId,
          entityName: data.entityName,
          projectId: data.projectId,
          projectName: data.projectName,
        };
      });

      setMemberTasks(tasks);
    } catch (err) {
      console.error('Error fetching member tasks:', err);
    } finally {
      setMemberTasksLoading(false);
    }
  }, []);

  // Calculate team stats
  const teamStats = useMemo((): TeamStats => {
    let totalTasks = 0;
    let pendingTasks = 0;
    let inProgressTasks = 0;
    let completedToday = 0;
    let overdueTasks = 0;
    let totalUtilization = 0;

    teamMembers.forEach((member) => {
      const stats = member.taskStats;
      totalTasks += stats.pending + stats.inProgress + stats.completed + stats.blocked;
      pendingTasks += stats.pending;
      inProgressTasks += stats.inProgress;
      completedToday += stats.completedToday;
      overdueTasks += stats.overdue;
      totalUtilization += member.utilization;
    });

    const activeMembers = teamMembers.filter(
      (m) => m.taskStats.pending + m.taskStats.inProgress > 0
    ).length;

    return {
      totalMembers: teamMembers.length,
      activeMembers,
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedToday,
      overdueTasks,
      avgUtilization: teamMembers.length > 0
        ? Math.round(totalUtilization / teamMembers.length)
        : 0,
    };
  }, [teamMembers]);

  // Filter members by department
  const filteredMembers = useMemo(() => {
    if (departmentFilter === 'all') return teamMembers;
    return teamMembers.filter((m) => m.department === departmentFilter);
  }, [teamMembers, departmentFilter]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set(teamMembers.map((m) => m.department).filter(Boolean));
    return Array.from(depts) as string[];
  }, [teamMembers]);

  // Priority badge helper
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'P0':
        return <Badge className="bg-[var(--rag-red)] hover:bg-[var(--rag-red)] text-white text-xs">P0</Badge>;
      case 'P1':
        return <Badge className="bg-[var(--rag-amber)] hover:bg-[var(--rag-amber)] text-white text-xs">P1</Badge>;
      case 'P2':
        return <Badge className="bg-[var(--rag-blue)] hover:bg-[var(--rag-blue)] text-white text-xs">P2</Badge>;
      case 'P3':
        return <Badge className="bg-[var(--fg-tertiary)] hover:bg-[var(--fg-tertiary)] text-white text-xs">P3</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{priority}</Badge>;
    }
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-[var(--rag-green-soft)] text-[var(--rag-green)] text-xs">Done</Badge>;
      case 'in_progress':
        return <Badge className="bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] text-xs">Active</Badge>;
      case 'pending':
        return <Badge className="bg-[var(--rag-amber-soft)] text-[var(--rag-amber)] text-xs">Pending</Badge>;
      case 'blocked':
        return <Badge className="bg-[var(--rag-red-soft)] text-[var(--rag-red)] text-xs">Blocked</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  // Utilization badge helper
  const getUtilizationBadge = (utilization: number) => {
    if (utilization >= 90) {
      return <Badge className="bg-[var(--rag-red-soft)] text-[var(--rag-red)]">Overloaded</Badge>;
    } else if (utilization >= 70) {
      return <Badge className="bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]">High</Badge>;
    } else if (utilization >= 40) {
      return <Badge className="bg-[var(--rag-green-soft)] text-[var(--rag-green)]">Balanced</Badge>;
    } else {
      return <Badge className="bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]">Available</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: `${MODULE_COLOR}15` }}
          >
            <Users className="h-8 w-8" style={{ color: MODULE_COLOR }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: MODULE_COLOR }}>
              Team Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor team workload and task progress
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={() => window.location.reload()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--rag-blue-soft)]">
              <Users className="h-5 w-5 text-[var(--rag-blue)]" />
            </div>
            <div>
              <div className="text-2xl font-bold">{teamStats.totalMembers}</div>
              <div className="text-xs text-muted-foreground">Team Members</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--rag-amber-soft)]">
              <Clock className="h-5 w-5 text-[var(--rag-amber)]" />
            </div>
            <div>
              <div className="text-2xl font-bold">{teamStats.pendingTasks}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--rag-blue-soft)]">
              <Play className="h-5 w-5 text-[var(--rag-blue)]" />
            </div>
            <div>
              <div className="text-2xl font-bold">{teamStats.inProgressTasks}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--rag-red-soft)]">
              <AlertCircle className="h-5 w-5 text-[var(--rag-red)]" />
            </div>
            <div>
              <div className="text-2xl font-bold">{teamStats.overdueTasks}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--rag-green-soft)]">
              <CheckCircle className="h-5 w-5 text-[var(--rag-green)]" />
            </div>
            <div>
              <div className="text-2xl font-bold">{teamStats.activeMembers}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--rag-blue-soft)]">
              <TrendingUp className="h-5 w-5 text-[var(--rag-blue)]" />
            </div>
            <div>
              <div className="text-2xl font-bold">{teamStats.avgUtilization}%</div>
              <div className="text-xs text-muted-foreground">Avg Utilization</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team Members
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Recent Tasks
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-2">
            <PieChart className="h-4 w-4" />
            Distribution
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Workload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: MODULE_COLOR }} />
                  Team Workload
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredMembers.slice(0, 5).map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1 -m-1"
                        onClick={() => { drillDownMember(member); setActiveTab('team'); }}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br $1-[var(--rag-blue)] $1-[var(--rag-blue)] flex items-center justify-center text-white text-xs font-medium">
                          {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{member.name}</span>
                            {getUtilizationBadge(member.utilization)}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={member.utilization} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">
                              {member.utilization}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" style={{ color: MODULE_COLOR }} />
                  Recent Team Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentTasks.slice(0, 5).map((task) => {
                      const entityRoute = getEntityRoute({ entityType: task.entityType, entityId: task.entityId, projectId: task.projectId, sourceModule: task.sourceModule });
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex gap-1">
                            {getPriorityBadge(task.priority)}
                            {getStatusBadge(task.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            {(task.aiDescription || task.description) && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{task.aiDescription || task.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{task.assignedToName || 'Unassigned'}</span>
                              {task.projectName && entityRoute && (
                                <button
                                  onClick={() => navigate(entityRoute)}
                                  className="text-[var(--rag-blue)] hover:underline flex items-center gap-0.5"
                                >
                                  {task.projectName}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Team Members Tab */}
        <TabsContent value="team" className="mt-6">
          {selectedMember ? (
            /* ---- Member Drill-Down View ---- */
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedMember(null); setMemberTasks([]); }}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br $1-[var(--rag-blue)] $1-[var(--rag-blue)] flex items-center justify-center text-white text-sm font-medium">
                    {selectedMember.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{selectedMember.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {selectedMember.role}{selectedMember.role && selectedMember.department ? ' · ' : ''}{selectedMember.department}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--rag-amber)] font-medium">{selectedMember.taskStats.pending} pending</span>
                  <span className="text-[var(--rag-blue)] font-medium">{selectedMember.taskStats.inProgress} active</span>
                  <span className="text-[var(--rag-red)] font-medium">{selectedMember.taskStats.overdue} overdue</span>
                  {getUtilizationBadge(selectedMember.utilization)}
                </div>
              </CardHeader>
              <CardContent>
                {memberTasksLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : memberTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No tasks found for {selectedMember.name}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memberTasks.map((task) => {
                      const entityRoute = getEntityRoute({ entityType: task.entityType, entityId: task.entityId, projectId: task.projectId, sourceModule: task.sourceModule });
                      const projRoute = getProjectRoute({ projectId: task.projectId, sourceModule: task.sourceModule });
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex gap-1.5">
                            {getPriorityBadge(task.priority)}
                            {getStatusBadge(task.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{task.title}</p>
                            {(task.aiDescription || task.description) && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{task.aiDescription || task.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {task.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {task.projectName && projRoute ? (
                                <button
                                  onClick={() => navigate(projRoute)}
                                  className="text-[var(--rag-blue)] hover:underline flex items-center gap-0.5"
                                >
                                  {task.projectName}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </button>
                              ) : task.projectName ? (
                                <span>{task.projectName}</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {entityRoute && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(entityRoute)}
                                title="View source item"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAssignmentDialog({ open: true, task, mode: 'reassign' })}
                            >
                              <Repeat className="h-3 w-3 mr-1" />
                              Reassign
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* ---- Team Members List ---- */
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Team Members</CardTitle>
                {departments.length > 0 && (
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No team members found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => drillDownMember(member)}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br $1-[var(--rag-blue)] $1-[var(--rag-blue)] flex items-center justify-center text-white text-sm font-medium">
                          {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{member.name}</span>
                            {getUtilizationBadge(member.utilization)}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                            {member.role && <span>{member.role}</span>}
                            {member.department && <span>{member.department}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-[var(--rag-amber)]">{member.taskStats.pending}</div>
                            <div className="text-xs text-muted-foreground">Pending</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-[var(--rag-blue)]">{member.taskStats.inProgress}</div>
                            <div className="text-xs text-muted-foreground">Active</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-[var(--rag-red)]">{member.taskStats.overdue}</div>
                            <div className="text-xs text-muted-foreground">Overdue</div>
                          </div>
                          <Progress value={member.utilization} className="w-20 h-2" />
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Team Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : recentTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No tasks found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTasks.map((task) => {
                    const entityRoute = getEntityRoute({ entityType: task.entityType, entityId: task.entityId, projectId: task.projectId, sourceModule: task.sourceModule });
                    const projRoute = getProjectRoute({ projectId: task.projectId, sourceModule: task.sourceModule });
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex gap-1.5">
                          {getPriorityBadge(task.priority)}
                          {getStatusBadge(task.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.title}</p>
                          {(task.aiDescription || task.description) && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{task.aiDescription || task.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.assignedToName || 'Unassigned'}
                            </span>
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {task.dueDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            )}
                            {task.projectName && projRoute ? (
                              <button
                                onClick={() => navigate(projRoute)}
                                className="text-[var(--rag-blue)] hover:underline flex items-center gap-0.5"
                              >
                                {task.projectName}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </button>
                            ) : (
                              <span>{task.sourceModule.replace(/_/g, ' ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {entityRoute && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(entityRoute)}
                              title="View source item"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          {!task.assignedTo ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAssignmentDialog({ open: true, task, mode: 'assign' })}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Assign
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAssignmentDialog({ open: true, task, mode: 'reassign' })}
                              >
                                <Repeat className="h-3 w-3 mr-1" />
                                Reassign
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAssignmentDialog({ open: true, task, mode: 'takeup' })}
                              >
                                <User className="h-3 w-3 mr-1" />
                                Take Up
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Distribution Tab */}
        <TabsContent value="distribution" className="mt-6">
          <div className="space-y-6">
            {/* Distribution Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4" style={{ color: MODULE_COLOR }} />
                  Task Distribution Across Team
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No team members found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Bar chart style distribution */}
                    {filteredMembers.map((member) => {
                      const maxActive = Math.max(
                        ...filteredMembers.map(m => m.taskStats.pending + m.taskStats.inProgress),
                        1
                      );
                      return (
                        <div key={member.id} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br $1-[var(--rag-blue)] $1-[var(--rag-blue)] flex items-center justify-center text-white text-xs font-medium">
                                {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <div>
                                <span className="text-sm font-medium">{member.name}</span>
                                {member.role && (
                                  <span className="text-xs text-muted-foreground ml-2">{member.role}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-[var(--rag-amber)] font-medium">{member.taskStats.pending} pending</span>
                              <span className="text-[var(--rag-blue)] font-medium">{member.taskStats.inProgress} active</span>
                              <span className="text-[var(--rag-green)]">{member.taskStats.completed} done</span>
                              {member.taskStats.overdue > 0 && (
                                <span className="text-[var(--rag-red)] font-medium">{member.taskStats.overdue} overdue</span>
                              )}
                              {member.taskStats.blocked > 0 && (
                                <span className="text-[var(--rag-red)]">{member.taskStats.blocked} blocked</span>
                              )}
                            </div>
                          </div>
                          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                            {member.taskStats.pending > 0 && (
                              <div
                                className="bg-[var(--rag-amber)] transition-all"
                                style={{ width: `${(member.taskStats.pending / maxActive) * 100}%` }}
                                title={`${member.taskStats.pending} pending`}
                              />
                            )}
                            {member.taskStats.inProgress > 0 && (
                              <div
                                className="bg-[var(--rag-blue)] transition-all"
                                style={{ width: `${(member.taskStats.inProgress / maxActive) * 100}%` }}
                                title={`${member.taskStats.inProgress} in progress`}
                              />
                            )}
                            {member.taskStats.blocked > 0 && (
                              <div
                                className="bg-[var(--rag-red)] transition-all"
                                style={{ width: `${(member.taskStats.blocked / maxActive) * 100}%` }}
                                title={`${member.taskStats.blocked} blocked`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Legend */}
                    <div className="flex items-center gap-4 pt-3 border-t text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--rag-amber)]" /> Pending</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--rag-blue)]" /> In Progress</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--rag-red)]" /> Blocked</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Assignment Dialog */}
      {assignmentDialog && (
        <TaskAssignmentDialog
          task={assignmentDialog.task}
          mode={assignmentDialog.mode}
          onClose={() => setAssignmentDialog(null)}
          onSuccess={() => {
            fetchTeamData();
            if (selectedMember) drillDownMember(selectedMember);
            setAssignmentDialog(null);
          }}
        />
      )}
    </div>
  );
}
