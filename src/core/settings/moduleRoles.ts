/**
 * Module Roles Registry — ZeusOS (Phase 2.C)
 *
 * Per-module role catalogue, keyed by SubsidiaryModule. When an admin grants
 * a user access to a module, the `ModuleAccess.role` field on
 * `SubsidiaryAccess.modules[]` is constrained to one of the IDs listed here.
 *
 * The role names are drawn directly from Zeus Group's documented job
 * descriptions, the IMC Team composition in the company profile (Account /
 * Strategy / Creative / Digital / PR / Media / Production / Traffic
 * Coordinator), and the 14-stage Campaign workflow + 6-stage Internal
 * Creative Approval Chain described in §5.2–§5.7 of the work plan.
 *
 * This file is the canonical source of truth — both UI dropdowns (RoleAssignment
 * components) and policy checks (`canUserDo(...)`) should import from here.
 *
 * Phase 3 will wire these into Firestore-rules role checks. For now the
 * registry defines the labels and IDs so the data shape is locked in.
 */

import type { SubsidiaryModule } from '@/types/subsidiary';

export interface ModuleRoleDef {
  id: string;
  label: string;
  description: string;
}

export const MODULE_ROLES: Record<SubsidiaryModule, ModuleRoleDef[]> = {
  // ─── Campaigns (core P0) ─────────────────────────────────────────────────
  campaigns: [
    { id: 'account_director',    label: 'Account Director',    description: 'Owns the client relationship and the campaign-level P&L; final escalation point for the IMC Team.' },
    { id: 'account_manager',     label: 'Account Manager',     description: 'Day-to-day client contact; runs the brief, schedules approvals, drives the IMC Team to deadlines.' },
    { id: 'account_executive',   label: 'Account Executive',   description: 'Supports Account Manager on coordination, briefs, status reports, and revisions.' },
    { id: 'traffic_coordinator', label: 'Traffic Coordinator', description: 'Orchestrates execution across the 5 parallel IMC streams (Media / PR / Digital / Creative / BTL) inside stage 6 of the Campaign workflow.' },
    { id: 'traffic_manager',     label: 'Traffic Manager',     description: 'Senior Traffic role — owns the cross-campaign Traffic dashboard and SLA enforcement against the Tier System.' },
    { id: 'strategy_director',   label: 'Strategy Director',   description: 'Builds the BIG IDEA in stages 3–5; signs off strategy documents before client presentation.' },
    { id: 'strategist',          label: 'Strategist',          description: 'Audience analysis, SWOT, message development, and post-campaign brand-lift reporting.' },
    { id: 'client_reviewer',     label: 'Client Reviewer',     description: 'External client user — read + comment on briefs and deliverables via the Client Portal; no access to internal IMC chatter.' },
  ],

  // ─── Media Plan & Buying (P0) ────────────────────────────────────────────
  media: [
    { id: 'head_of_media',           label: 'Head of Media',           description: 'Owns media-pillar P&L; negotiates master agreements with media houses; final sign-off on plans above a configurable spend threshold.' },
    { id: 'media_planner',           label: 'Media Planner',           description: 'Channel selection, reach/frequency modelling, weekly plan grid (vehicles × dates × spend).' },
    { id: 'media_buyer',             label: 'Media Buyer',             description: 'Executes negotiated buys, books inserts, reconciles tear-sheets, manages bonus impressions and premium placements.' },
    { id: 'paid_media_specialist',   label: 'Paid Media Specialist',   description: 'Digital-only — Meta Ads Manager, Google Ads, DSP/DMP programmatic buying.' },
    { id: 'media_monitoring_analyst', label: 'Media Monitoring Analyst', description: 'Post-campaign measurement, KPI reports (reach, impressions, CTR, conversions), PR-value calculations.' },
  ],

  // ─── Production (P1) ─────────────────────────────────────────────────────
  production: [
    { id: 'studio_director',     label: 'Studio Director',    description: 'Runs Labyrinth (or any sub-brand production unit); resourcing across active shoots.' },
    { id: 'producer',            label: 'Producer',           description: 'End-to-end production owner per Job — pre-prod, shoot, post-prod, delivery.' },
    { id: 'production_manager',  label: 'Production Manager', description: 'Locations, crew booking, equipment booking, call sheets, daily call running.' },
    { id: 'videographer',        label: 'Videographer',       description: 'Camera operator for film / TVC shoots.' },
    { id: 'photographer',        label: 'Photographer',       description: 'Stills photography — products, lifestyle, BTS, activations.' },
    { id: 'editor',              label: 'Editor',             description: 'Post-production editor — picture cut, sound mix, colour grade.' },
    { id: 'sound_engineer',      label: 'Sound Engineer',     description: 'Radio spots, podcast post, VO recording.' },
  ],

  // ─── Talent / Freelancer Roster (P1) ─────────────────────────────────────
  talent: [
    { id: 'talent_manager',     label: 'Talent Manager',     description: 'Owns the freelancer + influencer roster; rate cards, NDAs, work-history, payment workflow.' },
    { id: 'talent_coordinator', label: 'Talent Coordinator', description: 'Books talent for shoots / activations / influencer campaigns; manages calendars and conflicts.' },
    { id: 'freelancer',         label: 'Freelancer',         description: 'External freelance contributor (copywriter, photographer, voice-over, influencer) — limited-access invite with scoped permissions.' },
  ],

  // ─── Creative Asset Library (P1) ─────────────────────────────────────────
  'asset-library': [
    { id: 'asset_library_admin', label: 'Asset Library Admin', description: 'Manages the DAM-lite over Firebase Storage — taxonomies, retention policies, shareable client links.' },
    { id: 'asset_contributor',   label: 'Asset Contributor',   description: 'Uploads new approved assets; cannot delete or reorganize.' },
    { id: 'asset_consumer',      label: 'Asset Consumer',      description: 'Read-only access to approved assets — used by external partner agencies / clients via shared links.' },
  ],

  // ─── Asset Registry (corporate fixed assets) ─────────────────────────────
  'asset-registry': [
    { id: 'asset_register_admin', label: 'Asset Register Admin', description: 'Maintains the corporate asset register (cameras, lighting, edit stations, vehicles).' },
    { id: 'asset_custodian',      label: 'Asset Custodian',      description: 'Checks assets in/out, logs status changes, books maintenance.' },
  ],

  // ─── Advisory (financial backbone — to be renamed agency-core in Phase 3) ─
  advisory: [
    { id: 'advisor',                label: 'Advisor',                description: 'Senior advisory consultant — leads engagements and writes strategy decks.' },
    { id: 'analyst',                label: 'Analyst',                description: 'Supports engagements with research, financial modelling, deck production.' },
    { id: 'pipeline_owner',         label: 'Pipeline Owner',         description: 'Manages new-business pipeline / pitch tracker — RFPs, proposals, win-loss.' },
  ],

  // ─── Market Intelligence ─────────────────────────────────────────────────
  market_intelligence: [
    { id: 'mi_lead',         label: 'MI Lead',         description: 'Owns the intelligence dashboard; commissions deep-dive reports.' },
    { id: 'mi_analyst',      label: 'MI Analyst',      description: 'Runs competitor scans, social-listening reports, market-share analysis.' },
    { id: 'mi_viewer',       label: 'MI Viewer',       description: 'Read-only — for account teams who consume MI in client briefs.' },
  ],

  // ─── Strategy (OKRs / KPIs / Executive Dashboard) ────────────────────────
  strategy: [
    { id: 'strategy_owner',    label: 'Strategy Owner',    description: 'Sets OKRs at group + sub-brand level; runs quarterly reviews.' },
    { id: 'kpi_steward',       label: 'KPI Steward',       description: 'Curates KPI definitions and data sources; maintains scorecards.' },
    { id: 'strategy_reviewer', label: 'Strategy Reviewer', description: 'Approves strategy documents and quarterly reviews.' },
  ],

  // ─── HR (HR Central — kept as-is from DawinOS, light branding edits) ────
  hr: [
    { id: 'hr_director',          label: 'HR Director',          description: 'Owns the HR function — policy, hiring strategy, total rewards.' },
    { id: 'hr_business_partner',  label: 'HR Business Partner',  description: 'Embedded HR support for one or more sub-brands.' },
    { id: 'payroll_admin',        label: 'Payroll Admin',        description: 'Runs the monthly payroll batches; manages allowances and deductions.' },
    { id: 'recruiter',            label: 'Recruiter',            description: 'Manages requisitions, candidate pipelines, and onboarding.' },
    { id: 'employee_self_service', label: 'Employee Self-Service', description: 'Every employee — view own payslips, submit leave requests, update personal info.' },
  ],

  // ─── Finance ─────────────────────────────────────────────────────────────
  finance: [
    { id: 'finance_director',  label: 'Finance Director',  description: 'Owns the finance function — approves spend plan, CFO briefing, all material payments.' },
    { id: 'accountant',        label: 'Accountant',        description: 'Books journal entries, reconciles accounts, runs month-end close.' },
    { id: 'finance_assistant', label: 'Finance Assistant', description: 'Captures bills and receipts, processes expense claims, manages the expenditure queue.' },
    { id: 'tax_compliance',    label: 'Tax Compliance',    description: 'URA filings (PAYE, VAT, WHT, NSSF) and corporate tax compliance.' },
  ],

  // ─── Capital Hub (corporate-treasury — kept from DawinOS) ────────────────
  capital: [
    { id: 'capital_owner',      label: 'Capital Owner',      description: 'Owns the capital-seeking strategy and active facilities.' },
    { id: 'capital_analyst',    label: 'Capital Analyst',    description: 'Prepares applications, readiness packs, and funder responses.' },
  ],

  // ─── Compliance ──────────────────────────────────────────────────────────
  compliance: [
    { id: 'compliance_officer', label: 'Compliance Officer', description: 'Owns the obligations register, UAA membership renewals, client NDA tracking.' },
    { id: 'audit_reviewer',     label: 'Audit Reviewer',     description: 'Reads the audit log; investigates flagged events.' },
  ],

  // ─── Intelligence Layer (cross-module AI insights) ───────────────────────
  'intelligence-layer': [
    { id: 'intelligence_admin', label: 'Intelligence Admin', description: 'Configures intelligence sources, AI prompts, and cross-module insight rules.' },
    { id: 'task_owner',         label: 'Task Owner',         description: 'Manages a personal Smart-Tasks inbox and incoming nudges.' },
  ],
};

/**
 * Convenience — every role ID across every module, deduped + sorted. Useful
 * for autocomplete inputs that aren't yet scoped to a single module.
 */
export const ALL_MODULE_ROLE_IDS: readonly string[] = Array.from(
  new Set(Object.values(MODULE_ROLES).flatMap((roles) => roles.map((r) => r.id)))
).sort();

/**
 * Check whether a given role ID is valid for a given module.
 * Used by RoleAssignment UI + (eventually) Firestore-rules-side helpers.
 */
export function isValidModuleRole(module: SubsidiaryModule, roleId: string): boolean {
  return MODULE_ROLES[module]?.some((r) => r.id === roleId) ?? false;
}

/**
 * Look up the human-readable label for a role ID inside a module.
 */
export function getModuleRoleLabel(module: SubsidiaryModule, roleId: string): string | null {
  const def = MODULE_ROLES[module]?.find((r) => r.id === roleId);
  return def?.label ?? null;
}
