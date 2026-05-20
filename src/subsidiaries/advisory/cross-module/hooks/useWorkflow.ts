import { useState, useEffect, useCallback } from 'react';
import {
  Workflow,
  WorkflowTemplate,
  WorkflowType,
  WorkflowStatus
} from '../types/cross-module';
import { workflowOrchestratorService } from '../services/workflow-orchestrator';

export function useWorkflow(workflowId: string | null) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!workflowId) {
      setWorkflow(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = workflowOrchestratorService.subscribeToWorkflow(
      workflowId,
      updatedWorkflow => {
        setWorkflow(updatedWorkflow);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [workflowId]);

  const approveStep = useCallback(
    async (stepId: string, userId: string) => {
      if (!workflowId) return;
      try {
        await workflowOrchestratorService.approveStep(workflowId, stepId, userId);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to approve step'));
        throw err;
      }
    },
    [workflowId]
  );

  const cancelWorkflow = useCallback(async () => {
    if (!workflowId) return;
    try {
      await workflowOrchestratorService.cancelWorkflow(workflowId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to cancel workflow'));
      throw err;
    }
  }, [workflowId]);

  const retryWorkflow = useCallback(async () => {
    if (!workflowId) return;
    try {
      await workflowOrchestratorService.retryWorkflow(workflowId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to retry workflow'));
      throw err;
    }
  }, [workflowId]);

  return {
    workflow,
    loading,
    error,
    approveStep,
    cancelWorkflow,
    retryWorkflow
  };
}

export function useWorkflowList(status?: WorkflowStatus) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedWorkflows = await workflowOrchestratorService.getWorkflowsByStatus(
        status || 'in_progress'
      );
      setWorkflows(fetchedWorkflows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch workflows'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const startWorkflow = useCallback(
    async (type: WorkflowType, inputs: Record<string, unknown>, userId: string) => {
      const newWorkflow = await workflowOrchestratorService.startWorkflow(
        type,
        inputs,
        userId
      );
      setWorkflows(prev => [newWorkflow, ...prev]);
      return newWorkflow;
    },
    []
  );

  return {
    workflows,
    loading,
    error,
    refresh: fetchWorkflows,
    startWorkflow
  };
}

export function useWorkflowTemplates() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);

  useEffect(() => {
    const allTemplates = workflowOrchestratorService.getAllWorkflowTemplates();
    setTemplates(allTemplates);
  }, []);

  const getTemplate = useCallback((type: WorkflowType) => {
    return workflowOrchestratorService.getWorkflowTemplate(type);
  }, []);

  return { templates, getTemplate };
}
