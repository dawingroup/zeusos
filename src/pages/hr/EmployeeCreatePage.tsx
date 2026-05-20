/**
 * EmployeeCreatePage.tsx
 * Page for creating new employees using the EmployeeForm component
 * DawinOS v2.0 - Phase 8.6
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';

import { EmployeeForm } from '@/modules/hr-central/components/employees/EmployeeForm';

export function EmployeeCreatePage() {
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate('/hr/employees');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Employees
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Add New Employee</h1>
            <p className="text-muted-foreground">
              Fill in the employee information below
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Employee Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}

export default EmployeeCreatePage;
