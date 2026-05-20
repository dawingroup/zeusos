import { Timestamp } from 'firebase/firestore';

/**
 * CONTACT ROLE
 * Role of contact within client organization
 */
export type ContactRole =
  // Executive
  | 'ceo'
  | 'cfo'
  | 'coo'
  | 'executive_director'
  | 'board_member'
  
  // Program/Project
  | 'program_director'
  | 'program_manager'
  | 'project_manager'
  | 'field_coordinator'
  
  // Finance
  | 'finance_director'
  | 'finance_manager'
  | 'accountant'
  
  // Technical
  | 'technical_director'
  | 'engineer'
  
  // Investment
  | 'investment_officer'
  | 'portfolio_manager'
  
  // Legal
  | 'legal_counsel'
  | 'company_secretary'
  
  // Admin
  | 'admin_officer'
  | 'other';

/**
 * CONTACT
 * Contact person for a client
 */
export interface Contact {
  /** Unique identifier */
  id: string;
  
  /** Parent client ID */
  clientId: string;
  
  // ─────────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────────
  
  /** First name */
  firstName: string;
  
  /** Last name */
  lastName: string;
  
  /** Full name (computed) */
  fullName: string;
  
  /** Title/salutation (Mr., Mrs., Dr., etc.) */
  title?: string;
  
  /** Job title */
  jobTitle?: string;
  
  /** Department */
  department?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // CONTACT INFO
  // ─────────────────────────────────────────────────────────────────
  
  /** Primary email */
  email: string;
  
  /** Secondary email */
  emailSecondary?: string;
  
  /** Primary phone */
  phone?: string;
  
  /** Mobile phone */
  mobile?: string;
  
  /** WhatsApp number */
  whatsapp?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // ROLE
  // ─────────────────────────────────────────────────────────────────
  
  /** Role in client organization */
  role: ContactRole;
  
  /** Is primary contact for client */
  isPrimary: boolean;
  
  /** Is authorized signatory */
  isSignatory: boolean;
  
  /** Authorization level */
  authorizationLevel?: 'full' | 'limited' | 'view_only';
  
  // ─────────────────────────────────────────────────────────────────
  // PREFERENCES
  // ─────────────────────────────────────────────────────────────────
  
  /** Preferred communication method */
  preferredContact: 'email' | 'phone' | 'whatsapp';
  
  /** Preferred language */
  language: string;
  
  // ─────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────
  
  /** Is contact active */
  isActive: boolean;
  
  /** Notes */
  notes?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * CONTACT REF
 * Lightweight contact reference
 */
export interface ContactRef {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: ContactRole;
  isPrimary: boolean;
}

/**
 * CREATE CONTACT DATA
 */
export interface CreateContactData {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: ContactRole;
  jobTitle?: string;
  isPrimary?: boolean;
}

/**
 * Get contact role display name
 */
export function getContactRoleDisplayName(role: ContactRole): string {
  const names: Record<ContactRole, string> = {
    ceo: 'CEO',
    cfo: 'CFO',
    coo: 'COO',
    executive_director: 'Executive Director',
    board_member: 'Board Member',
    program_director: 'Program Director',
    program_manager: 'Program Manager',
    project_manager: 'Project Manager',
    field_coordinator: 'Field Coordinator',
    finance_director: 'Finance Director',
    finance_manager: 'Finance Manager',
    accountant: 'Accountant',
    technical_director: 'Technical Director',
    engineer: 'Engineer',
    investment_officer: 'Investment Officer',
    portfolio_manager: 'Portfolio Manager',
    legal_counsel: 'Legal Counsel',
    company_secretary: 'Company Secretary',
    admin_officer: 'Admin Officer',
    other: 'Other',
  };
  return names[role];
}

/**
 * Get full name from contact parts
 */
export function getContactFullName(contact: Pick<Contact, 'firstName' | 'lastName' | 'title'>): string {
  const parts = [contact.title, contact.firstName, contact.lastName].filter(Boolean);
  return parts.join(' ');
}

/**
 * Convert Contact to ContactRef
 */
export function toContactRef(contact: Contact): ContactRef {
  return {
    id: contact.id,
    name: contact.fullName,
    email: contact.email,
    phone: contact.phone || contact.mobile,
    role: contact.role,
    isPrimary: contact.isPrimary,
  };
}

/**
 * Get display string for contact
 */
export function formatContactDisplay(contact: Contact | ContactRef): string {
  const name = 'fullName' in contact ? contact.fullName : contact.name;
  const role = contact.role ? getContactRoleDisplayName(contact.role) : '';
  return role ? `${name} (${role})` : name;
}

/**
 * Check if contact is executive level
 */
export function isExecutiveContact(role: ContactRole): boolean {
  return ['ceo', 'cfo', 'coo', 'executive_director', 'board_member'].includes(role);
}
