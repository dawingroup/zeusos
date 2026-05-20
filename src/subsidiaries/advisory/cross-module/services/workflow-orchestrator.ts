import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  Workflow,
  WorkflowTemplate,
  WorkflowType,
  WorkflowStep,
  WorkflowStatus,
  WorkflowAction
} from '../types/cross-module';
import { entityLinkerService } from './entity-linker';

const WORKFLOWS_COLLECTION = 'workflows';

const WORKFLOW_TEMPLATES: Record<WorkflowType, WorkflowTemplate> = {
  project_setup: {
    id: 'project_setup',
    type: 'project_setup',
    name: 'Project Setup Workflow',
    description: 'Complete workflow for setting up a new infrastructure project',
    estimatedDuration: '2-3 days',
    requiredInputs: ['projectName', 'engagementId', 'budget', 'startDate'],
    steps: [
      {
        id: 'create_project',
        name: 'Create Project',
        description: 'Create the main project entity',
        module: 'infrastructure',
        action: { type: 'create', targetModule: 'infrastructure', targetEntity: 'project', params: {} },
        dependencies: []
      },
      {
        id: 'link_engagement',
        name: 'Link to Engagement',
        description: 'Link project to parent engagement',
        module: 'infrastructure',
        action: { type: 'link', targetModule: 'infrastructure', params: { linkType: 'belongs_to' } },
        dependencies: ['create_project']
      },
      {
        id: 'create_boq',
        name: 'Create BOQ',
        description: 'Create initial Bill of Quantities',
        module: 'matflow',
        action: { type: 'create', targetModule: 'matflow', targetEntity: 'boq', params: {} },
        dependencies: ['create_project'],
        requiresApproval: true
      },
      {
        id: 'notify_team',
        name: 'Notify Team',
        description: 'Send notifications to project team',
        module: 'infrastructure',
        action: { type: 'notify', targetModule: 'infrastructure', params: { template: 'project_created' } },
        dependencies: ['create_boq']
      }
    ]
  },
  procurement_cycle: {
    id: 'procurement_cycle',
    type: 'procurement_cycle',
    name: 'Procurement Cycle Workflow',
    description: 'End-to-end procurement process for materials',
    estimatedDuration: '5-10 days',
    requiredInputs: ['projectId', 'boqId', 'materials', 'budget'],
    steps: [
      {
        id: 'create_requisition',
        name: 'Create Requisition',
        description: 'Create material requisition from BOQ',
        module: 'matflow',
        action: { type: 'create', targetModule: 'matflow', targetEntity: 'requisition', params: {} },
        dependencies: []
      },
      {
        id: 'approve_requisition',
        name: 'Approve Requisition',
        description: 'Get requisition approved',
        module: 'matflow',
        action: { type: 'approve', targetModule: 'matflow', params: {} },
        dependencies: ['create_requisition'],
        requiresApproval: true
      },
      {
        id: 'create_po',
        name: 'Create Purchase Order',
        description: 'Generate purchase order for approved requisition',
        module: 'matflow',
        action: { type: 'create', targetModule: 'matflow', targetEntity: 'purchase_order', params: {} },
        dependencies: ['approve_requisition']
      },
      {
        id: 'send_po',
        name: 'Send to Supplier',
        description: 'Send purchase order to selected supplier',
        module: 'matflow',
        action: { type: 'notify', targetModule: 'matflow', params: { template: 'po_sent' } },
        dependencies: ['create_po']
      },
      {
        id: 'record_delivery',
        name: 'Record Delivery',
        description: 'Record material delivery',
        module: 'matflow',
        action: { type: 'create', targetModule: 'matflow', targetEntity: 'delivery', params: {} },
        dependencies: ['send_po']
      }
    ]
  },
  investment_deployment: {
    id: 'investment_deployment',
    type: 'investment_deployment',
    name: 'Investment Deployment Workflow',
    description: 'Deploy investment funds to infrastructure projects',
    estimatedDuration: '1-2 weeks',
    requiredInputs: ['investmentId', 'projectId', 'amount', 'disbursementSchedule'],
    steps: [
      {
        id: 'verify_investment',
        name: 'Verify Investment',
        description: 'Verify investment availability and terms',
        module: 'investment',
        action: { type: 'custom', targetModule: 'investment', params: { action: 'verify' } },
        dependencies: []
      },
      {
        id: 'link_to_project',
        name: 'Link to Project',
        description: 'Create link between investment and project',
        module: 'investment',
        action: { type: 'link', targetModule: 'infrastructure', params: { linkType: 'funds' } },
        dependencies: ['verify_investment']
      },
      {
        id: 'create_disbursement',
        name: 'Create Disbursement Schedule',
        description: 'Set up disbursement milestones',
        module: 'investment',
        action: { type: 'create', targetModule: 'investment', params: {} },
        dependencies: ['link_to_project'],
        requiresApproval: true
      },
      {
        id: 'notify_stakeholders',
        name: 'Notify Stakeholders',
        description: 'Notify all stakeholders of deployment',
        module: 'investment',
        action: { type: 'notify', targetModule: 'investment', params: { template: 'investment_deployed' } },
        dependencies: ['create_disbursement']
      }
    ]
  },
  deal_execution: {
    id: 'deal_execution',
    type: 'deal_execution',
    name: 'Deal Execution Workflow',
    description: 'Execute an investment deal from approval to closing',
    estimatedDuration: '2-4 weeks',
    requiredInputs: ['dealId', 'investorId', 'terms'],
    steps: [
      {
        id: 'due_diligence',
        name: 'Complete Due Diligence',
        description: 'Complete due diligence process',
        module: 'investment',
        action: { type: 'update', targetModule: 'investment', targetEntity: 'deal', params: { stage: 'due_diligence' } },
        dependencies: [],
        requiresApproval: true
      },
      {
        id: 'term_sheet',
        name: 'Generate Term Sheet',
        description: 'Generate and send term sheet',
        module: 'investment',
        action: { type: 'generate', targetModule: 'investment', params: { documentType: 'term_sheet' } },
        dependencies: ['due_diligence']
      },
      {
        id: 'finalize_terms',
        name: 'Finalize Terms',
        description: 'Finalize deal terms',
        module: 'investment',
        action: { type: 'update', targetModule: 'investment', targetEntity: 'deal', params: { stage: 'terms_finalized' } },
        dependencies: ['term_sheet'],
        requiresApproval: true
      },
      {
        id: 'close_deal',
        name: 'Close Deal',
        description: 'Complete deal closing',
        module: 'investment',
        action: { type: 'update', targetModule: 'investment', targetEntity: 'deal', params: { stage: 'closed' } },
        dependencies: ['finalize_terms']
      }
    ]
  },
  ipc_generation: {
    id: 'ipc_generation',
    type: 'ipc_generation',
    name: 'IPC Generation Workflow',
    description: 'Generate Interim Payment Certificate for a project',
    estimatedDuration: '3-5 days',
    requiredInputs: ['projectId', 'period', 'milestones'],
    steps: [
      {
        id: 'verify_milestones',
        name: 'Verify Milestones',
        description: 'Verify completed milestones for the period',
        module: 'infrastructure',
        action: { type: 'custom', targetModule: 'infrastructure', params: { action: 'verify_milestones' } },
        dependencies: []
      },
      {
        id: 'calculate_valuation',
        name: 'Calculate Valuation',
        description: 'Calculate valuation for completed works',
        module: 'infrastructure',
        action: { type: 'custom', targetModule: 'infrastructure', params: { action: 'calculate_valuation' } },
        dependencies: ['verify_milestones']
      },
      {
        id: 'generate_ipc',
        name: 'Generate IPC',
        description: 'Generate the IPC document',
        module: 'infrastructure',
        action: { type: 'generate', targetModule: 'infrastructure', params: { documentType: 'ipc' } },
        dependencies: ['calculate_valuation']
      },
      {
        id: 'approve_ipc',
        name: 'Approve IPC',
        description: 'Get IPC approved',
        module: 'infrastructure',
        action: { type: 'approve', targetModule: 'infrastructure', params: {} },
        dependencies: ['generate_ipc'],
        requiresApproval: true
      }
    ]
  }
};

export class WorkflowOrchestratorService {
  getWorkflowTemplate(type: WorkflowType): WorkflowTemplate | undefined {
    return WORKFLOW_TEMPLATES[type];
  }

  getAllWorkflowTemplates(): WorkflowTemplate[] {
    return Object.values(WORKFLOW_TEMPLATES);
  }

  async startWorkflow(
    type: WorkflowType,
    inputs: Record<string, unknown>,
    userId: string
  ): Promise<Workflow> {
    const template = this.getWorkflowTemplate(type);
    if (!template) {
      throw new Error(`Unknown workflow type: ${type}`);
    }

    const workflowId = doc(collection(db, WORKFLOWS_COLLECTION)).id;
    const now = Timestamp.now();

    const steps: WorkflowStep[] = template.steps.map(step => ({
      ...step,
      status: 'pending' as const
    }));

    const workflow: Workflow = {
      id: workflowId,
      templateId: template.id,
      type,
      name: template.name,
      status: 'in_progress',
      steps,
      inputs,
      outputs: {},
      currentStepId: steps[0]?.id,
      startedAt: now,
      startedBy: userId
    };

    await setDoc(doc(db, WORKFLOWS_COLLECTION, workflowId), workflow);
    await this.executeNextStep(workflowId);

    return workflow;
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const docSnap = await getDoc(doc(db, WORKFLOWS_COLLECTION, workflowId));
    if (!docSnap.exists()) return null;
    return docSnap.data() as Workflow;
  }

  private async executeNextStep(workflowId: string): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow || workflow.status !== 'in_progress') return;

    const nextStep = workflow.steps.find(
      s => s.status === 'pending' &&
        s.dependencies.every(d =>
          workflow.steps.find(dep => dep.id === d)?.status === 'completed'
        )
    );

    if (!nextStep) {
      const allComplete = workflow.steps.every(s => s.status === 'completed' || s.status === 'skipped');
      if (allComplete) {
        await this.completeWorkflow(workflowId);
      }
      return;
    }

    if (nextStep.requiresApproval && !nextStep.approvedBy) {
      const stepIndex = workflow.steps.findIndex(s => s.id === nextStep.id);
      await updateDoc(doc(db, WORKFLOWS_COLLECTION, workflowId), {
        currentStepId: nextStep.id,
        [`steps.${stepIndex}.status`]: 'pending'
      });
      return;
    }

    try {
      const stepIndex = workflow.steps.findIndex(s => s.id === nextStep.id);
      await updateDoc(doc(db, WORKFLOWS_COLLECTION, workflowId), {
        currentStepId: nextStep.id,
        [`steps.${stepIndex}.status`]: 'in_progress',
        [`steps.${stepIndex}.startedAt`]: Timestamp.now()
      });

      const result = await this.executeStepAction(nextStep.action, workflow.inputs);

      await updateDoc(doc(db, WORKFLOWS_COLLECTION, workflowId), {
        [`steps.${stepIndex}.status`]: 'completed',
        [`steps.${stepIndex}.result`]: result,
        [`steps.${stepIndex}.completedAt`]: Timestamp.now(),
        [`outputs.${nextStep.id}`]: result
      });

      await this.executeNextStep(workflowId);
    } catch (error) {
      const stepIndex = workflow.steps.findIndex(s => s.id === nextStep.id);
      await updateDoc(doc(db, WORKFLOWS_COLLECTION, workflowId), {
        status: 'failed',
        [`steps.${stepIndex}.status`]: 'failed',
        [`steps.${stepIndex}.error`]: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeStepAction(
    action: WorkflowAction,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    switch (action.type) {
      case 'create':
        return { created: true, entityType: action.targetEntity, timestamp: new Date().toISOString() };

      case 'update':
        return { updated: true, changes: action.params, timestamp: new Date().toISOString() };

      case 'link':
        if (inputs.sourceEntityId && inputs.targetEntityId) {
          await entityLinkerService.createLink({
            sourceEntity: inputs.sourceEntity as Parameters<typeof entityLinkerService.createLink>[0]['sourceEntity'],
            targetEntity: inputs.targetEntity as Parameters<typeof entityLinkerService.createLink>[0]['targetEntity'],
            linkType: (action.params.linkType as string) || 'related_to'
          }, (inputs.userId as string) || 'system');
        }
        return { linked: true, linkType: action.params.linkType };

      case 'notify':
        return { notified: true, template: action.params.template, timestamp: new Date().toISOString() };

      case 'generate':
        return { generated: true, documentType: action.params.documentType, timestamp: new Date().toISOString() };

      case 'approve':
        return { approved: true, timestamp: new Date().toISOString() };

      case 'custom':
        return { executed: true, action: action.params.action, timestamp: new Date().toISOString() };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async approveStep(workflowId: string, stepId: string, userId: string): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) throw new Error('Step not found');

    await updateDoc(doc(db, WORKFLOWS_COLLECTION, workflowId), {
      [`steps.${stepIndex}.approvedBy`]: userId,
      [`steps.${stepIndex}.approvedAt`]: Timestamp.now()
    });

    await this.executeNextStep(workflowId);
  }

  private async completeWorkflow(workflowId: string): Promise<void> {
    await updateDoc(doc(db, WORKFLOWS_COLLECTION, workflowId), {
      status: 'completed',
      completedAt: Timestamp.now()
    });
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    await updateDoc(doc(db, WORKFLOWS_COLLECTION, workflowId), {
      status: 'cancelled',
      completedAt: Timestamp.now()
    });
  }

  async getWorkflowsByStatus(status: WorkflowStatus): Promise<Workflow[]> {
    const q = query(
      collection(db, WORKFLOWS_COLLECTION),
      where('status', '==', status),
      orderBy('startedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => docSnap.data() as Workflow);
  }

  subscribeToWorkflow(
    workflowId: string,
    callback: (workflow: Workflow) => void
  ): () => void {
    return onSnapshot(doc(db, WORKFLOWS_COLLECTION, workflowId), snapshot => {
      if (snapshot.exists()) {
        callback(snapshot.data() as Workflow);
      }
    });
  }

  async retryWorkflow(workflowId: string): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow || workflow.status !== 'failed') {
      throw new Error('Can only retry failed workflows');
    }

    const failedStepIndex = workflow.steps.findIndex(s => s.status === 'failed');
    if (failedStepIndex === -1) return;

    await updateDoc(doc(db, WORKFLOWS_COLLECTION, workflowId), {
      status: 'in_progress',
      error: null,
      [`steps.${failedStepIndex}.status`]: 'pending',
      [`steps.${failedStepIndex}.error`]: null
    });

    await this.executeNextStep(workflowId);
  }
}

export const workflowOrchestratorService = new WorkflowOrchestratorService();
