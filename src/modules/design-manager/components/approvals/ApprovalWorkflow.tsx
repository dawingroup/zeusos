/**
 * Approval Workflow Component
 * Manages approval requests, assignments, and sign-offs
 */

import { useState } from 'react';
import { Check, X, Clock, User, MessageSquare, Plus, Send } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { Approval, ApprovalType, DesignItem } from '../../types';

export interface ApprovalWorkflowProps {
  designItem: DesignItem;
  projectId: string;
  approvals: Approval[];
  onRequestApproval: (approval: Omit<Approval, 'id' | 'requestedAt' | 'status'>) => Promise<void>;
  onRespondToApproval: (approvalId: string, status: 'approved' | 'rejected', notes?: string) => Promise<void>;
  className?: string;
}

const APPROVAL_TYPES: { value: ApprovalType; label: string; description: string }[] = [
  { value: 'design-review', label: 'Design Review', description: 'Internal design team sign-off' },
  { value: 'manufacturing-review', label: 'Manufacturing Review', description: 'Production team validates manufacturability' },
  { value: 'client-approval', label: 'Client Approval', description: 'Customer approval of design' },
  { value: 'prototype-approval', label: 'Prototype Approval', description: 'Prototype validation sign-off' },
  { value: 'production-release', label: 'Production Release', description: 'Final release to manufacturing' },
  { value: 'construction-signoff', label: 'Construction Sign-off', description: 'Final on-site handover sign-off' },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: typeof Clock; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'Pending' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', icon: Check, label: 'Approved' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: X, label: 'Rejected' },
  'revision-requested': { bg: 'bg-orange-100', text: 'text-orange-800', icon: MessageSquare, label: 'Revision Requested' },
};

export function ApprovalWorkflow({
  designItem: _designItem,
  projectId: _projectId,
  approvals,
  onRequestApproval,
  onRespondToApproval,
  className,
}: ApprovalWorkflowProps) {
  const { user } = useAuth();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequest, setNewRequest] = useState<{
    type: ApprovalType;
    assignedTo: string;
    decision: string;
  }>({
    type: 'design-review',
    assignedTo: '',
    decision: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState('');

  const handleSubmitRequest = async () => {
    if (!newRequest.assignedTo.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onRequestApproval({
        type: newRequest.type,
        requestedBy: user?.email || 'unknown',
        assignedTo: newRequest.assignedTo,
        decidedAt: null,
        decision: newRequest.decision || null,
        attachments: [],
      });
      setShowNewRequest(false);
      setNewRequest({ type: 'design-review', assignedTo: '', decision: '' });
    } catch (error) {
      console.error('Failed to request approval:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespond = async (approvalId: string, status: 'approved' | 'rejected') => {
    setIsSubmitting(true);
    try {
      await onRespondToApproval(approvalId, status, responseNotes || undefined);
      setRespondingTo(null);
      setResponseNotes('');
    } catch (error) {
      console.error('Failed to respond to approval:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const completedApprovals = approvals.filter(a => a.status !== 'pending');
  const myPendingApprovals = pendingApprovals.filter(a => a.assignedTo === user?.email);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Approval Workflow</h3>
          <p className="text-sm text-gray-500">
            {pendingApprovals.length} pending, {completedApprovals.length} completed
          </p>
        </div>
        <button
          onClick={() => setShowNewRequest(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1d1d1f] text-white rounded-lg hover:bg-[#1d1d1f]/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Request Approval
        </button>
      </div>

      {/* My Pending Approvals Alert */}
      {myPendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-800 font-medium">
            <Clock className="w-5 h-5" />
            You have {myPendingApprovals.length} approval{myPendingApprovals.length > 1 ? 's' : ''} awaiting your response
          </div>
        </div>
      )}

      {/* New Request Form */}
      {showNewRequest && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
          <h4 className="font-medium text-gray-900">New Approval Request</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Approval Type</label>
              <select
                value={newRequest.type}
                onChange={e => setNewRequest(prev => ({ ...prev, type: e.target.value as ApprovalType }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
              >
                {APPROVAL_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {APPROVAL_TYPES.find(t => t.value === newRequest.type)?.description}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To (Email)</label>
              <input
                type="email"
                value={newRequest.assignedTo}
                onChange={e => setNewRequest(prev => ({ ...prev, assignedTo: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
                placeholder="approver@company.com"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <input
                type="text"
                value={newRequest.decision}
                onChange={e => setNewRequest(prev => ({ ...prev, decision: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
                placeholder="Please review the latest drawings..."
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowNewRequest(false)}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitRequest}
              disabled={!newRequest.assignedTo.trim() || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-[#1d1d1f] text-white rounded-lg hover:bg-[#1d1d1f]/90 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Pending Approvals</h4>
          {pendingApprovals.map(approval => {
            const config = STATUS_CONFIG[approval.status];
            const isMyApproval = approval.assignedTo === user?.email;
            const Icon = config.icon;
            
            return (
              <div 
                key={approval.id} 
                className={cn(
                  'border rounded-lg p-4',
                  isMyApproval && 'border-amber-300 bg-amber-50/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg', config.bg)}>
                      <Icon className={cn('w-4 h-4', config.text)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {APPROVAL_TYPES.find(t => t.value === approval.type)?.label}
                        </span>
                        <span className={cn('px-2 py-0.5 text-xs rounded-full', config.bg, config.text)}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {approval.assignedTo}
                        </span>
                        <span>Requested by {approval.requestedBy}</span>
                      </div>
                      {approval.decision && (
                        <p className="text-sm text-gray-600 mt-2">{approval.decision}</p>
                      )}
                    </div>
                  </div>
                  
                  {isMyApproval && (
                    <div className="flex gap-2">
                      {respondingTo === approval.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={responseNotes}
                            onChange={e => setResponseNotes(e.target.value)}
                            placeholder="Add notes..."
                            className="px-3 py-1.5 border rounded text-sm"
                          />
                          <button
                            onClick={() => handleRespond(approval.id, 'approved')}
                            disabled={isSubmitting}
                            className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRespond(approval.id, 'rejected')}
                            disabled={isSubmitting}
                            className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRespondingTo(null)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRespondingTo(approval.id)}
                          className="px-3 py-1.5 bg-[#1d1d1f] text-white text-sm rounded hover:bg-[#1d1d1f]/90"
                        >
                          Respond
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Approvals */}
      {completedApprovals.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Completed Approvals</h4>
          {completedApprovals.map(approval => {
            const config = STATUS_CONFIG[approval.status];
            const Icon = config.icon;
            
            return (
              <div key={approval.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg', config.bg)}>
                    <Icon className={cn('w-4 h-4', config.text)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {APPROVAL_TYPES.find(t => t.value === approval.type)?.label}
                      </span>
                      <span className={cn('px-2 py-0.5 text-xs rounded-full', config.bg, config.text)}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{approval.status === 'approved' ? 'Approved' : 'Rejected'} by {approval.assignedTo}</span>
                      {approval.decidedAt && (
                        <span>
                          {new Date(approval.decidedAt as any).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {approval.decision && (
                      <p className="text-sm text-gray-600 mt-2 italic">"{approval.decision}"</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {approvals.length === 0 && !showNewRequest && (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No approvals yet</p>
          <p className="text-sm mt-1">Request an approval to get sign-off on this design item</p>
        </div>
      )}
    </div>
  );
}

export default ApprovalWorkflow;
