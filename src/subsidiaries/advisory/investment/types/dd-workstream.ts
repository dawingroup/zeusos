/**
 * Due Diligence Workstream
 * 
 * Individual areas of investigation within the DD process.
 */

import { Timestamp } from 'firebase/firestore';
import { WorkstreamType } from './due-diligence';

export interface DDWorkstream {
  id: string;
  dueDiligenceId: string;
  
  // Classification
  type: WorkstreamType;
  name: string;
  description?: string;
  
  // Status
  status: WorkstreamStatus;
  completion: number;         // Percentage
  
  // Team
  lead?: WorkstreamLead;
  team: WorkstreamMember[];
  externalAdvisor?: ExternalAdvisor;
  
  // Key questions
  keyQuestions: KeyQuestion[];
  
  // Documents
  documents: WorkstreamDocument[];
  
  // Timeline
  startDate?: Date;
  targetDate?: Date;
  completedDate?: Date;
  
  // Sign-off
  signedOff: boolean;
  signedOffBy?: string;
  signedOffAt?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type WorkstreamStatus = 
  | 'not_started'
  | 'in_progress'
  | 'under_review'
  | 'completed'
  | 'blocked';

export interface WorkstreamLead {
  userId: string;
  name: string;
  email: string;
}

export interface WorkstreamMember {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface ExternalAdvisor {
  name: string;
  firm: string;
  email?: string;
  phone?: string;
  scope: string;
  fee?: number;
  feeCurrency?: string;
}

export interface WorkstreamDocument {
  id: string;
  name: string;
  type: DocumentType;
  status: DocumentStatus;
  url?: string;
  uploadedAt?: Timestamp;
  uploadedBy?: string;
  notes?: string;
}

export type DocumentType = 
  | 'report'
  | 'analysis'
  | 'data_request'
  | 'supporting_doc'
  | 'reference';

export type DocumentStatus = 
  | 'requested'
  | 'pending'
  | 'received'
  | 'under_review'
  | 'approved';

export interface KeyQuestion {
  id: string;
  question: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'addressed' | 'na';
  answer?: string;
  answeredAt?: Timestamp;
  notes?: string;
}

// Default workstream templates
export const WORKSTREAM_TEMPLATES: Record<WorkstreamType, WorkstreamTemplate> = {
  commercial: {
    type: 'commercial',
    name: 'Commercial Due Diligence',
    description: 'Market analysis, competitive positioning, and commercial viability',
    defaultTasks: [
      'Market size and growth analysis',
      'Competitive landscape assessment',
      'Customer analysis and retention',
      'Revenue model validation',
      'Sales pipeline review',
      'Pricing analysis',
      'Customer interviews',
      'Management interviews',
    ],
    keyQuestions: [
      'What is the total addressable market?',
      'Who are the main competitors and what is the competitive advantage?',
      'What is the customer acquisition cost and lifetime value?',
      'What are the key growth drivers?',
      'What are the main commercial risks?',
    ],
  },
  financial: {
    type: 'financial',
    name: 'Financial Due Diligence',
    description: 'Historical financial analysis and quality of earnings',
    defaultTasks: [
      'Quality of earnings analysis',
      'Working capital analysis',
      'Debt and liabilities review',
      'Financial projections validation',
      'Accounting policies review',
      'Tax compliance review',
      'Related party transactions',
      'Off-balance sheet items',
    ],
    keyQuestions: [
      'What is the quality of reported earnings?',
      'What are the normalized EBITDA levels?',
      'What is the working capital requirement?',
      'What are the key financial risks?',
      'Are there any contingent liabilities?',
    ],
  },
  legal: {
    type: 'legal',
    name: 'Legal Due Diligence',
    description: 'Corporate structure, contracts, and legal compliance',
    defaultTasks: [
      'Corporate structure review',
      'Material contracts review',
      'Litigation review',
      'IP and licenses review',
      'Employment matters',
      'Regulatory compliance',
      'Real estate review',
      'Environmental compliance',
    ],
    keyQuestions: [
      'Is the corporate structure clean?',
      'Are there any material litigation risks?',
      'Are key contracts assignable?',
      'Is the IP properly protected?',
      'Are there any regulatory issues?',
    ],
  },
  technical: {
    type: 'technical',
    name: 'Technical Due Diligence',
    description: 'Technical systems, infrastructure, and capabilities',
    defaultTasks: [
      'Technology architecture review',
      'Infrastructure assessment',
      'Security audit',
      'Scalability analysis',
      'Technical debt assessment',
      'Development processes',
      'Team capabilities',
      'Technology roadmap',
    ],
    keyQuestions: [
      'Is the technology stack modern and maintainable?',
      'What is the level of technical debt?',
      'Is the infrastructure scalable?',
      'What are the security risks?',
      'What is the technology roadmap?',
    ],
  },
  environmental: {
    type: 'environmental',
    name: 'Environmental Due Diligence',
    description: 'Environmental compliance and ESG assessment',
    defaultTasks: [
      'Environmental permits review',
      'Contamination assessment',
      'Waste management review',
      'Carbon footprint analysis',
      'ESG policy review',
      'Climate risk assessment',
      'Community impact assessment',
      'Sustainability initiatives',
    ],
    keyQuestions: [
      'Are environmental permits in place?',
      'Is there any site contamination?',
      'What are the environmental liabilities?',
      'What is the carbon footprint?',
      'What are the ESG risks?',
    ],
  },
  tax: {
    type: 'tax',
    name: 'Tax Due Diligence',
    description: 'Tax compliance and structuring',
    defaultTasks: [
      'Tax compliance review',
      'Tax returns analysis',
      'Transfer pricing review',
      'Tax attributes assessment',
      'Indirect taxes review',
      'Employment taxes',
      'Transaction structuring',
      'Post-acquisition planning',
    ],
    keyQuestions: [
      'Is the company tax compliant?',
      'Are there any tax exposures?',
      'What tax attributes exist?',
      'What is the optimal transaction structure?',
      'What are the post-acquisition tax considerations?',
    ],
  },
  hr: {
    type: 'hr',
    name: 'HR Due Diligence',
    description: 'Human resources and organizational assessment',
    defaultTasks: [
      'Organization structure review',
      'Key personnel assessment',
      'Compensation and benefits',
      'Employment contracts',
      'Labor relations',
      'Retention risks',
      'Culture assessment',
      'Training and development',
    ],
    keyQuestions: [
      'Who are the key personnel?',
      'What are the retention risks?',
      'Are compensation levels market-competitive?',
      'What is the organizational culture?',
      'Are there any labor disputes?',
    ],
  },
  it: {
    type: 'it',
    name: 'IT Due Diligence',
    description: 'Information technology systems and security',
    defaultTasks: [
      'IT infrastructure review',
      'Systems inventory',
      'Cybersecurity assessment',
      'Data privacy compliance',
      'Business continuity',
      'Vendor dependencies',
      'IT budget analysis',
      'Integration assessment',
    ],
    keyQuestions: [
      'What is the IT maturity level?',
      'What are the cybersecurity risks?',
      'Is the company GDPR compliant?',
      'What are the key vendor dependencies?',
      'What is required for IT integration?',
    ],
  },
  regulatory: {
    type: 'regulatory',
    name: 'Regulatory Due Diligence',
    description: 'Regulatory compliance and licensing',
    defaultTasks: [
      'License and permits review',
      'Regulatory filings review',
      'Compliance history',
      'Pending applications',
      'Regulatory relationships',
      'Industry-specific requirements',
      'Cross-border considerations',
      'Upcoming regulatory changes',
    ],
    keyQuestions: [
      'Are all required licenses in place?',
      'Is the company fully compliant?',
      'Are there any pending regulatory issues?',
      'What regulatory approvals are needed for the transaction?',
      'What are the key regulatory risks?',
    ],
  },
  insurance: {
    type: 'insurance',
    name: 'Insurance Due Diligence',
    description: 'Insurance coverage and risk transfer',
    defaultTasks: [
      'Insurance policies review',
      'Coverage adequacy assessment',
      'Claims history',
      'Premium analysis',
      'Representations and warranties',
      'D&O coverage',
      'Key man insurance',
      'Post-acquisition coverage',
    ],
    keyQuestions: [
      'Is insurance coverage adequate?',
      'What is the claims history?',
      'Are there any coverage gaps?',
      'Is R&W insurance appropriate?',
      'What are the post-acquisition insurance needs?',
    ],
  },
};

export interface WorkstreamTemplate {
  type: WorkstreamType;
  name: string;
  description: string;
  defaultTasks: string[];
  keyQuestions: string[];
}

// Helper functions
export function getWorkstreamStatusDisplayName(status: WorkstreamStatus): string {
  const names: Record<WorkstreamStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    under_review: 'Under Review',
    completed: 'Completed',
    blocked: 'Blocked',
  };
  return names[status] || status;
}

export function getWorkstreamStatusColor(status: WorkstreamStatus): string {
  const colors: Record<WorkstreamStatus, string> = {
    not_started: '#6b7280',
    in_progress: '#3b82f6',
    under_review: '#f59e0b',
    completed: '#22c55e',
    blocked: '#ef4444',
  };
  return colors[status] || '#6b7280';
}

export function getDocumentTypeDisplayName(type: DocumentType): string {
  const names: Record<DocumentType, string> = {
    report: 'Report',
    analysis: 'Analysis',
    data_request: 'Data Request',
    supporting_doc: 'Supporting Document',
    reference: 'Reference',
  };
  return names[type] || type;
}

export function getDocumentStatusDisplayName(status: DocumentStatus): string {
  const names: Record<DocumentStatus, string> = {
    requested: 'Requested',
    pending: 'Pending',
    received: 'Received',
    under_review: 'Under Review',
    approved: 'Approved',
  };
  return names[status] || status;
}
