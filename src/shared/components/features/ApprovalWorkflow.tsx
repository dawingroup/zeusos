/**
 * ApprovalWorkflow Component
 * Display and manage approval workflow steps
 */

import { Check, Clock, X } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { cn } from '@/shared/lib/utils';

interface ApprovalStep {
  id: string;
  title: string;
  assignee: string;
  status: 'pending' | 'approved' | 'rejected' | 'current';
  completedAt?: string;
  comment?: string;
}

interface ApprovalWorkflowProps {
  steps: ApprovalStep[];
  currentUserId?: string;
  onApprove?: (stepId: string, comment?: string) => void;
  onReject?: (stepId: string, comment: string) => void;
  className?: string;
}

export function ApprovalWorkflow({
  steps,
  currentUserId: _currentUserId,
  onApprove,
  onReject,
  className,
}: ApprovalWorkflowProps) {
  const getStepIcon = (status: ApprovalStep['status']) => {
    switch (status) {
      case 'approved':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <X className="h-4 w-4 text-red-600" />;
      case 'current':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStepStyles = (status: ApprovalStep['status']) => {
    switch (status) {
      case 'approved':
        return 'border-green-200 bg-green-50';
      case 'rejected':
        return 'border-red-200 bg-red-50';
      case 'current':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Approval Workflow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="relative">
              {index < steps.length - 1 && (
                <div className="absolute left-5 top-12 h-full w-px bg-border" />
              )}
              
              <div
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border',
                  getStepStyles(step.status)
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background border">
                  {getStepIcon(step.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{step.title}</h4>
                    <span className="text-xs text-muted-foreground capitalize">
                      {step.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Assigned to: {step.assignee}
                  </p>
                  
                  {step.completedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(step.completedAt).toLocaleString()}
                    </p>
                  )}
                  
                  {step.comment && (
                    <p className="text-sm mt-2 p-2 bg-background rounded border">
                      "{step.comment}"
                    </p>
                  )}
                  
                  {step.status === 'current' && onApprove && onReject && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => onApprove(step.id)}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(step.id, 'Rejected')}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
