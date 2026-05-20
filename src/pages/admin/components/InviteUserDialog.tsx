/**
 * InviteUserDialog
 * Dialog for inviting new users to the platform
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { SubsidiaryAccessEditor } from './SubsidiaryAccessEditor';
import { useInvites } from '@/core/settings';
import { useAuth } from '@/shared/hooks';
import { GLOBAL_ROLE_DEFINITIONS } from '@/core/settings/types';
import type { GlobalRole, SubsidiaryAccess } from '@/core/settings/types';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const { user } = useAuth();
  const { createInvite } = useInvites();
  const [email, setEmail] = useState('');
  const [globalRole, setGlobalRole] = useState<GlobalRole>('member');
  const [subsidiaryAccess, setSubsidiaryAccess] = useState<SubsidiaryAccess[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEmail('');
    setGlobalRole('member');
    setSubsidiaryAccess([]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!user) return;

    setIsSubmitting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await createInvite({
        email: email.trim().toLowerCase(),
        globalRole,
        subsidiaryAccess,
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email || '',
        expiresAt: expiresAt.toISOString(),
      });

      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation to a new team member. They will gain access when
            they sign in with Google.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@dawin.group"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label>Global Role</Label>
            <Select
              value={globalRole}
              onValueChange={v => setGlobalRole(v as GlobalRole)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_ROLE_DEFINITIONS.map(role => (
                  <SelectItem key={role.role} value={role.role}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {GLOBAL_ROLE_DEFINITIONS.find(r => r.role === globalRole)?.description}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Subsidiary & Module Access</Label>
            <SubsidiaryAccessEditor
              access={subsidiaryAccess}
              onChange={setSubsidiaryAccess}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
