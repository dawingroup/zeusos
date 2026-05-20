/**
 * Role Profile Management Panel
 * View and manage role profiles, task capabilities, and skills for the Intelligence Admin Dashboard
 */

import { useState, useMemo } from 'react';
import {
  Shield,
  Search,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  CheckCircle,
  Award,
  Zap,
  Building2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
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

import { STANDARD_ROLE_PROFILES } from '@/modules/intelligence/config/role-profile.constants';
import type { RoleProfile } from '@/modules/intelligence/types/role-profile.types';

// ============================================
// Types
// ============================================

type SubsidiaryFilter = 'all' | 'finishes' | 'shared';
type LevelFilter = 'all' | 'JUNIOR' | 'SENIOR' | 'LEAD' | 'MANAGER' | 'DIRECTOR';

// ============================================
// Role Profile Panel Component
// ============================================

export function RoleProfilePanel() {
  const [subsidiaryFilter, setSubsidiaryFilter] = useState<SubsidiaryFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<Partial<RoleProfile> | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Convert role profiles to array and filter
  const roles = useMemo(() => {
    let filtered = Object.entries(STANDARD_ROLE_PROFILES).map(([slug, profile]) => ({
      slug,
      ...profile,
    }));

    // Subsidiary filter
    if (subsidiaryFilter !== 'all') {
      if (subsidiaryFilter === 'finishes') {
        filtered = filtered.filter(r => r.subsidiaryId === 'finishes');
      } else {
        filtered = filtered.filter(r => !r.subsidiaryId || r.subsidiaryId !== 'finishes');
      }
    }

    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(r => r.jobLevel === levelFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title?.toLowerCase().includes(query) ||
        r.slug?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
      );
    }

    // Sort by job level hierarchy
    const levelOrder = ['DIRECTOR', 'MANAGER', 'LEAD', 'SENIOR', 'JUNIOR'];
    filtered.sort((a, b) => {
      const aLevel = levelOrder.indexOf(a.jobLevel || 'JUNIOR');
      const bLevel = levelOrder.indexOf(b.jobLevel || 'JUNIOR');
      return aLevel - bLevel;
    });

    return filtered;
  }, [subsidiaryFilter, levelFilter, searchQuery]);

  // Get level badge
  const getLevelBadge = (level?: string) => {
    switch (level) {
      case 'DIRECTOR':
        return <Badge className="bg-purple-500 hover:bg-purple-500">Director</Badge>;
      case 'MANAGER':
        return <Badge className="bg-blue-500 hover:bg-blue-500">Manager</Badge>;
      case 'LEAD':
        return <Badge className="bg-cyan-500 hover:bg-cyan-500">Lead</Badge>;
      case 'SENIOR':
        return <Badge className="bg-green-500 hover:bg-green-500">Senior</Badge>;
      case 'JUNIOR':
        return <Badge className="bg-gray-500 hover:bg-gray-500">Junior</Badge>;
      default:
        return <Badge variant="outline">{level || 'Unspecified'}</Badge>;
    }
  };

  // Get subsidiary badge
  const getSubsidiaryBadge = (subsidiaryId?: string) => {
    if (subsidiaryId === 'finishes') {
      return <Badge variant="outline" className="text-orange-600 border-orange-300">Finishes</Badge>;
    }
    return <Badge variant="outline">Shared</Badge>;
  };

  // Count stats
  const stats = {
    total: Object.keys(STANDARD_ROLE_PROFILES).length,
    finishes: Object.values(STANDARD_ROLE_PROFILES).filter(r => r.subsidiaryId === 'finishes').length,
    withCapabilities: Object.values(STANDARD_ROLE_PROFILES).filter(r => r.taskCapabilities && r.taskCapabilities.length > 0).length,
    withApprovals: Object.values(STANDARD_ROLE_PROFILES).filter(r => r.approvalAuthorities && r.approvalAuthorities.length > 0).length,
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
                  placeholder="Search roles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Subsidiary Filter */}
            <Select value={subsidiaryFilter} onValueChange={(v) => setSubsidiaryFilter(v as SubsidiaryFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Subsidiary" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subsidiaries</SelectItem>
                <SelectItem value="finishes">Dawin Finishes</SelectItem>
                <SelectItem value="shared">Shared Roles</SelectItem>
              </SelectContent>
            </Select>

            {/* Level Filter */}
            <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LevelFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="DIRECTOR">Director</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="LEAD">Lead</SelectItem>
                <SelectItem value="SENIOR">Senior</SelectItem>
                <SelectItem value="JUNIOR">Junior</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Roles</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Finishes Roles</div>
          <div className="text-2xl font-bold text-orange-600">{stats.finishes}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">With Task Capabilities</div>
          <div className="text-2xl font-bold text-green-600">{stats.withCapabilities}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">With Approvals</div>
          <div className="text-2xl font-bold text-blue-600">{stats.withApprovals}</div>
        </Card>
      </div>

      {/* Role List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-yellow-500" />
              Role Profiles
            </CardTitle>
            <Badge variant="outline">{roles.length} roles</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No roles found matching your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div
                  key={role.slug}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedRole(role);
                    setIsDetailOpen(true);
                  }}
                >
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
                    <Shield className="h-6 w-6" />
                  </div>

                  {/* Role Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{role.title}</span>
                      {getLevelBadge(role.jobLevel)}
                      {getSubsidiaryBadge(role.subsidiaryId)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                      {role.shortDescription || role.description || 'No description'}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center" title="Task Capabilities">
                      <div className="font-semibold text-blue-600">
                        {role.taskCapabilities?.length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Events</div>
                    </div>
                    <div className="text-center" title="Skills Required">
                      <div className="font-semibold text-green-600">
                        {role.skills?.length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Skills</div>
                    </div>
                    <div className="text-center" title="Approval Authorities">
                      <div className="font-semibold text-purple-600">
                        {role.approvalAuthorities?.length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Approvals</div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-500" />
              Role Profile Details
            </DialogTitle>
          </DialogHeader>
          {selectedRole && (
            <div className="space-y-6">
              {/* Role Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
                  <Shield className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedRole.title}</h3>
                  <p className="text-sm text-muted-foreground">slug: {selectedRole.slug}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getLevelBadge(selectedRole.jobLevel)}
                    {getSubsidiaryBadge(selectedRole.subsidiaryId)}
                    {selectedRole.departmentId && (
                      <Badge variant="outline" className="capitalize">
                        <Building2 className="h-3 w-3 mr-1" />
                        {selectedRole.departmentId}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedRole.description && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm">{selectedRole.description}</p>
                </div>
              )}

              {/* Reporting Structure */}
              {(selectedRole.reportsTo || selectedRole.supervises) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedRole.reportsTo && selectedRole.reportsTo.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-sm text-muted-foreground">Reports To</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedRole.reportsTo.map((role) => (
                          <Badge key={role} variant="outline">{role}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedRole.supervises && selectedRole.supervises.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-sm text-muted-foreground">Supervises</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedRole.supervises.map((role) => (
                          <Badge key={role} variant="outline">{role}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsible Sections */}
              <div className="space-y-4">
                {/* Task Capabilities */}
                {selectedRole.taskCapabilities && selectedRole.taskCapabilities.length > 0 && (
                  <CollapsibleSection
                    title={`Task Capabilities (${selectedRole.taskCapabilities.length} events)`}
                    icon={<Zap className="h-4 w-4 text-blue-500" />}
                    defaultOpen
                  >
                    <div className="space-y-3">
                      {selectedRole.taskCapabilities.map((cap, idx) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {cap.eventType}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {cap.taskTypes.map((task) => (
                              <Badge key={task} variant="outline" className="text-xs">
                                {task}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className={cap.canInitiate ? 'text-green-600' : 'text-gray-400'}>
                              {cap.canInitiate ? '✓' : '✗'} Initiate
                            </span>
                            <span className={cap.canExecute ? 'text-green-600' : 'text-gray-400'}>
                              {cap.canExecute ? '✓' : '✗'} Execute
                            </span>
                            <span className={cap.canApprove ? 'text-green-600' : 'text-gray-400'}>
                              {cap.canApprove ? '✓' : '✗'} Approve
                            </span>
                            <span className={cap.canDelegate ? 'text-green-600' : 'text-gray-400'}>
                              {cap.canDelegate ? '✓' : '✗'} Delegate
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Skills */}
                {selectedRole.skills && selectedRole.skills.length > 0 && (
                  <CollapsibleSection
                    title={`Required Skills (${selectedRole.skills.length})`}
                    icon={<Award className="h-4 w-4 text-green-500" />}
                    defaultOpen
                  >
                    <div className="space-y-2">
                      {selectedRole.skills.map((skill, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{skill.name}</span>
                              {skill.isCore && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs">Core</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground capitalize">{skill.category}</p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {skill.requiredLevel}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Approval Authorities */}
                {selectedRole.approvalAuthorities && selectedRole.approvalAuthorities.length > 0 && (
                  <CollapsibleSection
                    title={`Approval Authorities (${selectedRole.approvalAuthorities.length})`}
                    icon={<CheckCircle className="h-4 w-4 text-purple-500" />}
                  >
                    <div className="space-y-2">
                      {selectedRole.approvalAuthorities.map((auth, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 border rounded-lg">
                          <Badge variant="outline" className="capitalize">{auth.type}</Badge>
                          <span className="text-sm">
                            Can approve for: <span className="font-medium">{auth.canApproveFor}</span>
                          </span>
                          {auth.maxAmount && (
                            <Badge variant="secondary">
                              Max: {auth.maxAmount.amount.toLocaleString()} {auth.maxAmount.currency}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Workload Limits */}
                {selectedRole.typicalTaskLoad && (
                  <CollapsibleSection
                    title="Workload Limits"
                    icon={<ClipboardList className="h-4 w-4 text-cyan-500" />}
                  >
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 border rounded-lg text-center">
                        <div className="text-2xl font-bold text-cyan-600">
                          {selectedRole.typicalTaskLoad.daily}
                        </div>
                        <div className="text-xs text-muted-foreground">Daily Tasks</div>
                      </div>
                      <div className="p-3 border rounded-lg text-center">
                        <div className="text-2xl font-bold text-cyan-600">
                          {selectedRole.typicalTaskLoad.weekly}
                        </div>
                        <div className="text-xs text-muted-foreground">Weekly Tasks</div>
                      </div>
                      <div className="p-3 border rounded-lg text-center">
                        <div className="text-2xl font-bold text-cyan-600">
                          {selectedRole.typicalTaskLoad.maxConcurrent}
                        </div>
                        <div className="text-xs text-muted-foreground">Max Concurrent</div>
                      </div>
                    </div>
                  </CollapsibleSection>
                )}
              </div>

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

// ============================================
// Collapsible Section Component
// ============================================

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 font-medium text-sm">
          {icon}
          {title}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="p-3 pt-0 border-t">
          {children}
        </div>
      )}
    </div>
  );
}

export default RoleProfilePanel;
