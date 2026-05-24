/**
 * Task Assignment Dialog
 * UI for managers to assign/reassign tasks
 */

import { useState, useEffect } from 'react';
import { X, User, MessageSquare } from 'lucide-react';
import { assignTask, reassignTask, takeUpTask } from '../../services/taskAssignmentService';
import { useAuth } from '@/integration/store';
import { useEmployeeDocId } from '../../hooks/useEmployeeDocId';
import { db } from '@/shared/services/firebase/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: {
    title?: string;
  };
}

interface TaskAssignmentDialogProps {
  task: any;
  mode: 'assign' | 'reassign' | 'takeup';
  onClose: () => void;
  onSuccess: () => void;
}

export function TaskAssignmentDialog({ task, mode, onClose, onSuccess }: TaskAssignmentDialogProps) {
  const { userId: authUid, email: authEmail } = useAuth();
  const { employeeDocId: userId } = useEmployeeDocId(authUid, authEmail);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const employeesRef = collection(db, 'employees');
      const q = query(
        employeesRef,
        where('employmentStatus', 'in', ['active', 'probation'])
      );

      const snapshot = await getDocs(q);
      const employeeList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Employee[];

      setEmployees(employeeList);
    } catch (err) {
      console.error('Error loading employees:', err);
      setError('Failed to load employees');
    }
  };

  const handleSubmit = async () => {
    if (!selectedEmployee) {
      setError('Please select an employee');
      return;
    }

    if (!userId) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'assign') {
        await assignTask(task.id, selectedEmployee, userId, reason);
      } else if (mode === 'reassign') {
        await reassignTask(task.id, selectedEmployee, userId, reason);
      } else if (mode === 'takeup') {
        await takeUpTask(task.id, selectedEmployee, userId, reason);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error assigning task:', err);
      setError(err.message || 'Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'assign':
        return 'Assign Task';
      case 'reassign':
        return 'Reassign Task';
      case 'takeup':
        return 'Take Up Task';
      default:
        return 'Assign Task';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
          <h2 className="text-xl font-semibold text-foreground">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="text-[var(--fg-tertiary)] hover:text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Task Info */}
          <div className="bg-[var(--bg-sunken)] p-4 rounded-lg">
            <p className="text-sm font-medium text-foreground">{task.title}</p>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
            )}
            {task.assignedTo && mode !== 'assign' && (
              <p className="text-xs text-muted-foreground mt-2">
                Currently assigned to: {task.assignedTo}
              </p>
            )}
          </div>

          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              <User className="w-4 h-4 inline mr-1" />
              {mode === 'takeup' ? 'Assign to yourself or another employee' : 'Select Employee'}
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">Select an employee...</option>
              {mode === 'takeup' && (
                <option value={userId || ''}>Myself</option>
              )}
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} {emp.position?.title ? `(${emp.position.title})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter reason for assignment..."
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedEmployee}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading ? 'Assigning...' : getTitle()}
          </button>
        </div>
      </div>
    </div>
  );
}
