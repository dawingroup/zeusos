/**
 * Talent Roster module — Phase 4.
 *
 * Owns: talent_profiles, freelancer_contracts, talent_invoices.
 * Approval of invoices emits domain events that Phase 5 will use to
 * generate linked POs in Procurement.
 */

export type {
  TalentProfile,
  TalentType,
  TalentStatus,
} from './types/talent-profile.types';
export type {
  FreelancerContract,
  ContractStatus,
} from './types/freelancer-contract.types';
export type {
  TalentInvoice,
  TalentInvoiceStatus,
} from './types/talent-invoice.types';

export {
  createTalentProfile,
  getTalentProfile,
  listTalentProfiles,
  updateTalentProfile,
  createFreelancerContract,
  listContractsForProfile,
} from './services/talent-profile.service';

export {
  submitTalentInvoice,
  getTalentInvoice,
  listTalentInvoices,
  approveTalentInvoice,
  rejectTalentInvoice,
  markTalentInvoicePaid,
} from './services/talent-invoice.service';

export { TalentTypeBadge } from './components/TalentTypeBadge';
export { ContractStatusBadge } from './components/ContractStatusBadge';
export { TalentCard } from './components/TalentCard';
export { TalentInvoiceForm } from './components/TalentInvoiceForm';
export { InvoiceApprovalPanel } from './components/InvoiceApprovalPanel';

export { default as TalentRosterPage } from './pages/TalentRosterPage';
export { default as TalentProfilePage } from './pages/TalentProfilePage';
export { default as FreelancerContractsPage } from './pages/FreelancerContractsPage';
export { default as TalentInvoicesPage } from './pages/TalentInvoicesPage';
