/**
 * RoleManagementPage
 * Role and permission management
 */

import { Helmet } from 'react-helmet-async';
import { Plus, Shield } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { EmptyState } from '@/shared/components/feedback/EmptyState';

export default function RoleManagementPage() {
  return (
    <>
      <Helmet>
        <title>Role Management | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Role Management</h1>
            <p className="text-muted-foreground">Manage roles and permissions</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        </div>

        <EmptyState
          icon={Shield}
          title="No custom roles"
          description="Create custom roles for fine-grained access control"
          action={{ label: 'Create Role', onClick: () => {} }}
        />
      </div>
    </>
  );
}
