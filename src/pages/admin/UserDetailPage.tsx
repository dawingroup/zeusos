/**
 * UserDetailPage
 * View and edit a user's profile, access, and activity
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Save, Briefcase, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';
import { useUser, useUserMutations, useAuditLog } from '@/core/settings';
import { GLOBAL_ROLE_DEFINITIONS } from '@/core/settings/types';
import type { GlobalRole, SubsidiaryAccess } from '@/core/settings/types';
import { SubsidiaryAccessEditor } from './components/SubsidiaryAccessEditor';
import { useEmployeeByUserId } from '@/modules/hr-central/hooks/useEmployee';
import { grantAllModulesToUser } from '@/core/settings/migrateUserAccess';

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  probation: 'Probation',
  suspended: 'Suspended',
  notice_period: 'Notice Period',
  on_leave: 'On Leave',
  terminated: 'Terminated',
  resigned: 'Resigned',
  retired: 'Retired',
};

const TYPE_LABELS: Record<string, string> = {
  permanent: 'Permanent',
  contract: 'Contract',
  probation: 'Probationary',
  part_time: 'Part-Time',
  casual: 'Casual',
  intern: 'Intern',
  consultant: 'Consultant',
};

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { dawinUser, isLoading, error } = useUser(userId);
  const { updateUserRole, updateUserAccess, deactivateUser, reactivateUser, isSubmitting } =
    useUserMutations();
  const { entries: auditEntries, isLoading: auditLoading } = useAuditLog(50);
  const { employee, loading: employeeLoading } = useEmployeeByUserId(dawinUser?.uid ?? null);

  const [editedRole, setEditedRole] = useState<GlobalRole | null>(null);
  const [editedAccess, setEditedAccess] = useState<SubsidiaryAccess[] | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !dawinUser) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">User not found</p>
        </div>
      </div>
    );
  }

  const currentRole = editedRole ?? dawinUser.globalRole;
  const currentAccess = editedAccess ?? dawinUser.subsidiaryAccess ?? [];
  const hasRoleChange = editedRole !== null && editedRole !== dawinUser.globalRole;
  const hasAccessChange = editedAccess !== null;
  // hasChanges is available via hasRoleChange || hasAccessChange

  async function handleSaveRole() {
    if (!userId || !editedRole) return;
    setSaveError(null);
    try {
      await updateUserRole(userId, editedRole);
      setEditedRole(null);
      setSaveSuccess('Role updated successfully');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update role';
      setSaveError(msg);
      console.error('Failed to update role:', err);
    }
  }

  async function handleSaveAccess() {
    if (!userId || !editedAccess) return;
    setSaveError(null);
    try {
      // Clean access data — remove undefined values that Firestore rejects
      const cleanedAccess = editedAccess.map(a => ({
        subsidiaryId: a.subsidiaryId,
        hasAccess: a.hasAccess,
        modules: a.modules.map(m => {
          const clean: Record<string, unknown> = {
            moduleId: m.moduleId,
            hasAccess: m.hasAccess,
          };
          if (m.role) clean.role = m.role;
          if (m.customPermissions && m.customPermissions.length > 0) {
            clean.customPermissions = m.customPermissions;
          }
          return clean;
        }),
      }));
      await updateUserAccess(userId, cleanedAccess as unknown as SubsidiaryAccess[]);
      setEditedAccess(null);
      setSaveSuccess('Access updated successfully');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update access';
      setSaveError(msg);
      console.error('Failed to update access:', err);
    }
  }

  async function handleToggleActive() {
    if (!userId) return;
    setSaveError(null);
    try {
      if (dawinUser?.isActive) {
        await deactivateUser(userId);
      } else {
        await reactivateUser(userId);
      }
      setSaveSuccess(dawinUser?.isActive ? 'User deactivated' : 'User reactivated');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle user status';
      setSaveError(msg);
      console.error('Failed to toggle user status:', err);
    }
  }

  // Filter audit entries for this user
  const userAuditEntries = auditEntries.filter(
    e => e.userId === dawinUser.uid || e.targetId === userId
  );

  return (
    <>
      <Helmet>
        <title>{dawinUser.displayName} | User Management</title>
      </Helmet>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              {dawinUser.photoUrl ? (
                <img
                  src={dawinUser.photoUrl}
                  alt=""
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-medium">
                  {dawinUser.displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">{dawinUser.displayName}</h1>
                <p className="text-sm text-muted-foreground">{dawinUser.email}</p>
                {employee && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {employee.position.title} &middot; {employee.id}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-sm text-green-600">{saveSuccess}</span>
            )}
            {saveError && (
              <span className="text-sm text-red-600">{saveError}</span>
            )}
            <Badge
              variant={dawinUser.isActive ? 'secondary' : 'destructive'}
              className={dawinUser.isActive ? 'bg-green-50 text-green-700 border-green-200' : ''}
            >
              {dawinUser.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleActive}
              disabled={isSubmitting}
            >
              {dawinUser.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">User Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Display Name</Label>
                    <p className="text-sm font-medium">{dawinUser.displayName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p className="text-sm font-medium">{dawinUser.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Phone</Label>
                    <p className="text-sm font-medium">{dawinUser.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Job Title</Label>
                    <p className="text-sm font-medium">{dawinUser.jobTitle || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Department</Label>
                    <p className="text-sm font-medium">{dawinUser.department || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Last Login</Label>
                    <p className="text-sm font-medium">
                      {dawinUser.lastLoginAt
                        ? new Date(dawinUser.lastLoginAt).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employee Record */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Employee Record</CardTitle>
                  </div>
                  {employee && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/hr/employees/${employee.id}`)}
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      View in HR
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {employeeLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  </div>
                ) : !employee ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No employee record linked to this user account.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Employee ID</Label>
                        <p className="text-sm font-medium">{employee.id}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Employee Number</Label>
                        <p className="text-sm font-medium">{employee.employeeNumber || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Position Title</Label>
                        <p className="text-sm font-medium">{employee.position.title}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Department</Label>
                        <p className="text-sm font-medium">{employee.position.departmentId}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Grade Level</Label>
                        <p className="text-sm font-medium">{employee.position.gradeLevel || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Location</Label>
                        <p className="text-sm font-medium">{employee.position.location || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Employment Status</Label>
                        <Badge
                          variant={employee.employmentStatus === 'active' ? 'secondary' : 'outline'}
                          className={employee.employmentStatus === 'active' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                        >
                          {STATUS_LABELS[employee.employmentStatus] || employee.employmentStatus}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Employment Type</Label>
                        <p className="text-sm font-medium">
                          {TYPE_LABELS[employee.employmentType] || employee.employmentType}
                        </p>
                      </div>
                    </div>
                    {employee.position.isManagement && (
                      <div className="pt-2 border-t">
                        <Badge variant="default" className="text-xs">
                          Management
                        </Badge>
                        {employee.position.directReports != null && employee.position.directReports > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {employee.position.directReports} direct report{employee.position.directReports !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Global Role</CardTitle>
                  {hasRoleChange && (
                    <Button size="sm" onClick={handleSaveRole} disabled={isSubmitting}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Role
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={currentRole}
                  onValueChange={v => setEditedRole(v as GlobalRole)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GLOBAL_ROLE_DEFINITIONS.map(r => (
                      <SelectItem key={r.role} value={r.role}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {GLOBAL_ROLE_DEFINITIONS.find(r => r.role === currentRole)?.description}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Tab */}
          <TabsContent value="access" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Subsidiary & Module Access</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const fullAccess = grantAllModulesToUser(dawinUser);
                        setEditedAccess(fullAccess);
                      }}
                      disabled={isSubmitting}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Grant All Modules
                    </Button>
                    {hasAccessChange && (
                      <Button size="sm" onClick={handleSaveAccess} disabled={isSubmitting}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Access
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <SubsidiaryAccessEditor
                  access={currentAccess}
                  onChange={setEditedAccess}
                  disabled={isSubmitting}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {auditLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : userAuditEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No activity recorded for this user
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userAuditEntries.map(entry => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium text-sm">
                            {entry.action}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details) || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleString()
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
