/**
 * UserManagementPage
 * Admin interface for managing system users, roles, and invitations
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Plus,
  Users,
  Search,
  MoreHorizontal,
  UserCheck,
  UserX,
  Eye,
  Mail,
  Clock,
  XCircle,
  RefreshCw,
  Link2,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { useUsers, useUserMutations, useInvites } from '@/core/settings';
import { buildInviteLink } from '@/core/settings/settingsService';
import { GLOBAL_ROLE_DEFINITIONS } from '@/core/settings/types';
import type { GlobalRole, DawinUser } from '@/core/settings/types';
import { DEFAULT_SUBSIDIARIES } from '@/types/subsidiary';
import { InviteUserDialog } from './components/InviteUserDialog';
import { migrateGrantAllModules } from '@/core/settings/migrateUserAccess';

// Canonical Zeus brand display names, keyed by SubsidiaryId. Lives here so
// the users table shows the real brand label, not a legacy DawinOS placeholder.
const SUBSIDIARY_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_SUBSIDIARIES.map(s => [s.id, s.name])
);

const ROLE_BADGE_VARIANT: Record<GlobalRole, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  owner: 'default',
  admin: 'default',
  manager: 'secondary',
  member: 'outline',
  viewer: 'outline',
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

function getSubsidiaryNames(user: DawinUser): string {
  const active = user.subsidiaryAccess
    ?.filter(s => s.hasAccess)
    .map(s => SUBSIDIARY_LABELS[s.subsidiaryId] || s.subsidiaryId);
  return active?.length ? active.join(', ') : '-';
}

export default function UserManagementPage() {
  const navigate = useNavigate();
  const { users, isLoading } = useUsers();
  const { invites, isLoading: invitesLoading, revokeInvite, resendInvite } = useInvites();
  const { deactivateUser, reactivateUser } = useUserMutations();
  const [resendBanner, setResendBanner] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<GlobalRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function handleSyncModules() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const count = await migrateGrantAllModules('default');
      setSyncResult(`Synced modules for ${count} user${count !== 1 ? 's' : ''}`);
      setTimeout(() => setSyncResult(null), 4000);
    } catch (err) {
      console.error('Failed to sync modules:', err);
      setSyncResult('Failed to sync modules');
      setTimeout(() => setSyncResult(null), 4000);
    } finally {
      setSyncing(false);
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        !search ||
        u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.globalRole === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? u.isActive : !u.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    pendingInvites: invites.length,
  }), [users, invites]);

  async function handleDeactivate(userId: string) {
    try {
      await deactivateUser(userId);
    } catch (err) {
      console.error('Failed to deactivate user:', err);
    }
  }

  async function handleReactivate(userId: string) {
    try {
      await reactivateUser(userId);
    } catch (err) {
      console.error('Failed to reactivate user:', err);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      await revokeInvite(inviteId);
    } catch (err) {
      console.error('Failed to revoke invite:', err);
    }
  }

  async function handleCopyInviteLink(inviteId: string) {
    const link = buildInviteLink(inviteId);
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied', {
        description: 'Paste it into Slack, WhatsApp, or email.',
      });
    } catch (err) {
      console.error('Failed to copy invite link:', err);
      toast.error('Could not copy invite link', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  }

  async function handleResendInvite(inviteId: string, email: string) {
    try {
      await resendInvite(inviteId);
      setResendBanner(`Invite to ${email} refreshed — new 7-day link ready to share.`);
      window.setTimeout(() => setResendBanner(null), 4000);
    } catch (err) {
      console.error('Failed to resend invite:', err);
    }
  }

  return (
    <>
      <Helmet>
        <title>User Management | ZeusOS</title>
      </Helmet>

      <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>System · Admin</div>
            <h1 className="display">User management</h1>
            <p className="text-muted-foreground mt-1">
              Manage system users, roles, and permissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {syncResult && (
              <span className="text-sm text-muted-foreground">{syncResult}</span>
            )}
            <Button variant="outline" onClick={handleSyncModules} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync New Modules
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[var(--rag-green)]">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inactive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[var(--fg-tertiary)]">{stats.inactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Invites
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[var(--rag-amber)]">{stats.pendingInvites}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Users ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="invites">
              <Mail className="mr-2 h-4 w-4" />
              Pending Invites ({stats.pendingInvites})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={v => setRoleFilter(v as GlobalRole | 'all')}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {GLOBAL_ROLE_DEFINITIONS.map(r => (
                    <SelectItem key={r.role} value={r.role}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={v => setStatusFilter(v as 'all' | 'active' | 'inactive')}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Users Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No users found</p>
                <p className="text-sm">
                  {search || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Invite your first team member to get started'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Subsidiaries</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(u => (
                      <TableRow
                        key={u.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {u.photoUrl ? (
                              <img
                                src={u.photoUrl}
                                alt=""
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm">{u.displayName}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ROLE_BADGE_VARIANT[u.globalRole] || 'outline'}>
                            {GLOBAL_ROLE_DEFINITIONS.find(r => r.role === u.globalRole)?.name || u.globalRole}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {getSubsidiaryNames(u)}
                        </TableCell>
                        <TableCell>
                          {u.isActive ? (
                            <Badge variant="secondary" className="bg-[var(--rag-green-soft)] text-[var(--rag-green)] border-[var(--rag-green)]">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-[var(--bg-sunken)] text-muted-foreground border-[var(--border-subtle)]">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(u.lastLoginAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => navigate(`/admin/users/${u.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {u.isActive ? (
                                <DropdownMenuItem
                                  onClick={() => handleDeactivate(u.id)}
                                  className="text-destructive"
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleReactivate(u.id)}>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="invites" className="space-y-4">
            {resendBanner && (
              <div className="rounded-md border border-[var(--rag-green)]/40 bg-[var(--rag-green-soft)] p-3 text-sm text-[var(--rag-green)]">
                {resendBanner}
              </div>
            )}
            {invitesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : invites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No pending invitations</p>
                <p className="text-sm">
                  Invite team members to get started
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="w-[220px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map(inv => {
                      const isExpired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {GLOBAL_ROLE_DEFINITIONS.find(r => r.role === inv.globalRole)?.name || inv.globalRole}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.invitedByName}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className={`flex items-center gap-1 ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                              <Clock className="h-3 w-3" />
                              {isExpired ? `Expired ${formatDate(inv.expiresAt)}` : formatDate(inv.expiresAt)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 px-2 text-xs"
                                onClick={() => handleCopyInviteLink(inv.id)}
                                title="Copy a shareable invite link"
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                Copy link
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 px-2 text-xs"
                                onClick={() => handleResendInvite(inv.id, inv.email)}
                                title="Reset expiry and status to pending"
                              >
                                <Send className="h-3.5 w-3.5" />
                                Resend
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive"
                                onClick={() => handleRevokeInvite(inv.id)}
                                title="Revoke invite"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}
