/**
 * Role Assignment Section Component
 * Allows assigning role profiles to employees for task routing
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { Plus, X, Search, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import { STANDARD_ROLE_PROFILES } from '@/modules/intelligence/config/role-profile.constants';
import type { RoleProfile } from '@/modules/intelligence/types/role-profile.types';
import type { Employee, EmployeeId } from '@/modules/hr-central/types/employee.types';

interface RoleAssignmentSectionProps {
  employee: Employee;
  onUpdate: (employeeId: EmployeeId, accessRoles: string[]) => Promise<void>;
  isEditable?: boolean;
}

type RoleProfilePartial = Partial<RoleProfile>;

export function RoleAssignmentSection({ employee, onUpdate, isEditable = true }: RoleAssignmentSectionProps) {
  const [assignedRoles, setAssignedRoles] = useState<string[]>(
    employee.systemAccess?.accessRoles || []
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubsidiary, setFilterSubsidiary] = useState<string>('all');
  const [filterJobLevel, setFilterJobLevel] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  // Get available role profiles
  const availableRoles = Object.entries(STANDARD_ROLE_PROFILES)
    .map(([slug, profile]) => ({
      slug,
      ...(profile as RoleProfilePartial),
    }))
    .filter(role => {
      // Filter by subsidiary
      if (filterSubsidiary !== 'all' && role.subsidiaryId !== filterSubsidiary && role.subsidiaryId !== 'all') {
        return false;
      }

      // Filter by job level
      if (filterJobLevel !== 'all' && role.jobLevel !== filterJobLevel) {
        return false;
      }

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          role.title?.toLowerCase().includes(searchLower) ||
          role.description?.toLowerCase().includes(searchLower) ||
          role.slug?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });

  const assignedRoleProfiles = assignedRoles
    .map(slug => ({
      slug,
      ...(STANDARD_ROLE_PROFILES[slug] as RoleProfilePartial),
    }))
    .filter(role => role.title); // Ensure valid profile

  const handleAddRole = (roleSlug: string) => {
    if (!assignedRoles.includes(roleSlug)) {
      const updatedRoles = [...assignedRoles, roleSlug];
      setAssignedRoles(updatedRoles);
    }
  };

  const handleRemoveRole = (roleSlug: string) => {
    const updatedRoles = assignedRoles.filter(slug => slug !== roleSlug);
    setAssignedRoles(updatedRoles);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onUpdate(employee.id, assignedRoles);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to update role assignments:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getJobLevelBadgeColor = (level?: string) => {
    switch (level) {
      case 'EXECUTIVE': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'MANAGER': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'SENIOR': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'LEAD': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      case 'JUNIOR': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  // FIXME: this list still uses DawinOS-era subsidiary keys (finishes,
  // advisory, technology) that no longer match ZeusOS's sub-brand IDs
  // (zeus-the-agency, zeus-digital, labyrinth, odd-gorilla,
  // house-of-zeus). Tracked as a follow-up; Capital removed here per
  // plan §4.1 decision.
  const subsidiaries = [
    { value: 'all', label: 'All Subsidiaries' },
    { value: 'finishes', label: 'Zeus Group' },
    { value: 'advisory', label: 'Zeus Group' },
    { value: 'technology', label: 'Zeus Technology' },
  ];

  const jobLevels = [
    { value: 'all', label: 'All Levels' },
    { value: 'EXECUTIVE', label: 'Executive' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'SENIOR', label: 'Senior' },
    { value: 'LEAD', label: 'Lead' },
    { value: 'JUNIOR', label: 'Junior' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Task Assignment Roles</CardTitle>
            <CardDescription>
              Assign role profiles to enable automatic task routing from the Intelligence Layer
            </CardDescription>
          </div>
          {isEditable && (
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Assign Role
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {assignedRoleProfiles.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No roles assigned. Assign roles to enable automatic task routing based on business events.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {assignedRoleProfiles.map((role) => (
              <div
                key={role.slug}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{role.title}</h4>
                    <Badge className={getJobLevelBadgeColor(role.jobLevel)}>
                      {role.jobLevel}
                    </Badge>
                    {role.subsidiaryId && role.subsidiaryId !== 'all' && (
                      <Badge variant="outline">{role.subsidiaryId}</Badge>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  )}
                  {role.skills && role.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-muted-foreground mr-1">Core Skills:</span>
                      {role.skills
                        .filter(s => s.isCore)
                        .slice(0, 3)
                        .map((skill, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {skill.name}
                          </Badge>
                        ))}
                      {role.skills.filter(s => s.isCore).length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{role.skills.filter(s => s.isCore).length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {isEditable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRole(role.slug)}
                    className="ml-4"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Assign Role Profiles</DialogTitle>
            <DialogDescription>
              Select role profiles to assign to {employee.firstName} {employee.lastName}. Assigned roles will enable automatic task routing from business events.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="browse" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="browse">Browse Roles</TabsTrigger>
              <TabsTrigger value="assigned">Assigned ({assignedRoles.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="space-y-4">
              {/* Filters */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search roles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={filterSubsidiary} onValueChange={setFilterSubsidiary}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subsidiaries.map((sub) => (
                      <SelectItem key={sub.value} value={sub.value}>
                        {sub.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterJobLevel} onValueChange={setFilterJobLevel}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {jobLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Role List */}
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {availableRoles.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No roles found matching your filters.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    availableRoles.map((role) => {
                      const isAssigned = assignedRoles.includes(role.slug);
                      return (
                        <div
                          key={role.slug}
                          className={`flex items-start justify-between p-3 border rounded-lg transition-colors ${
                            isAssigned ? 'bg-primary/5 border-primary/50' : 'hover:bg-accent/50'
                          }`}
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium">{role.title}</h5>
                              <Badge className={getJobLevelBadgeColor(role.jobLevel)} {...({ size: "sm" } as any)}>
                                {role.jobLevel}
                              </Badge>
                              {role.subsidiaryId && role.subsidiaryId !== 'all' && (
                                <Badge variant="outline" {...({ size: "sm" } as any)}>
                                  {role.subsidiaryId}
                                </Badge>
                              )}
                              {isAssigned && (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            {role.shortDescription && (
                              <p className="text-sm text-muted-foreground">
                                {role.shortDescription}
                              </p>
                            )}
                          </div>
                          <Button
                            variant={isAssigned ? 'outline' : 'default'}
                            size="sm"
                            onClick={() =>
                              isAssigned ? handleRemoveRole(role.slug) : handleAddRole(role.slug)
                            }
                            className="ml-4"
                          >
                            {isAssigned ? 'Remove' : 'Add'}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="assigned" className="space-y-4">
              <ScrollArea className="h-[450px] pr-4">
                {assignedRoles.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No roles assigned yet. Browse roles in the "Browse Roles" tab.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {assignedRoleProfiles.map((role) => (
                      <div
                        key={role.slug}
                        className="flex items-start justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium">{role.title}</h5>
                            <Badge className={getJobLevelBadgeColor(role.jobLevel)}>
                              {role.jobLevel}
                            </Badge>
                            {role.subsidiaryId && role.subsidiaryId !== 'all' && (
                              <Badge variant="outline">{role.subsidiaryId}</Badge>
                            )}
                          </div>
                          {role.description && (
                            <p className="text-sm text-muted-foreground">{role.description}</p>
                          )}
                          {role.taskCapabilities && role.taskCapabilities.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Can handle {role.taskCapabilities.length} event type
                              {role.taskCapabilities.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRole(role.slug)}
                          className="ml-4"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
