/**
 * The 14-stage canonical Campaign workflow — Zeus's documented INTERNAL
 * PROCESS SUMMARY (profile pp. 41–42). This is the state machine for
 * `Campaign.stage`. Stage 6 (imc_execution) fans out into 5 parallel Jobs
 * (Media / PR / Digital / Creative / BTL) coordinated by the Traffic role.
 */

export const CAMPAIGN_STAGES = [
  'client_initial_briefing',
  'agency_internal_briefing_kickstart',
  'strategy_buildup_big_idea',
  'client_strategy_socialization',
  'client_strategy_approval',
  'imc_execution',                  // fan-out: Media / PR / Digital / Creative / BTL
  'internal_review_imc_gtm',        // GTM = Go-To-Market
  'client_presentation',
  'consolidated_feedback_approval',
  'ces_production_costs_timings',   // CES = Cost Estimate Sheet
  'selected_gtm_assets_rollout',
  'campaign_production_launch',
  'reporting_monitoring',
  'campaign_performance_review',
] as const;

export type CampaignStage = (typeof CAMPAIGN_STAGES)[number];

export const CAMPAIGN_STAGE_INDEX: Record<CampaignStage, number> = Object.fromEntries(
  CAMPAIGN_STAGES.map((s, i) => [s, i + 1])
) as Record<CampaignStage, number>;

export interface StageMeta {
  label: string;
  description: string;
  /** Tailwind-friendly hex (rendered into a style attribute or className). */
  color: string;
  /** Which ARAAM phase this stage rolls up into. */
  araam: 'analyze' | 'research' | 'approach' | 'action' | 'measure';
}

export const CAMPAIGN_STAGE_META: Record<CampaignStage, StageMeta> = {
  client_initial_briefing: {
    label: 'Client Initial Briefing',
    description: 'Brief received; agency + client align on objectives, audience, deliverables, timeline, budget.',
    color: '#E63946',
    araam: 'analyze',
  },
  agency_internal_briefing_kickstart: {
    label: 'Agency Internal Briefing / Kickstart',
    description: 'IMC team assembled; verbal briefing session within 24h of receiving the brief document.',
    color: '#F59E0B',
    araam: 'analyze',
  },
  strategy_buildup_big_idea: {
    label: 'Strategy Buildup & BIG IDEA',
    description: 'Strategy brainstorm; BIG IDEA agreed; presentation document prepared for client.',
    color: '#3B82F6',
    araam: 'research',
  },
  client_strategy_socialization: {
    label: 'Client Strategy Socialization',
    description: 'Walk client through the strategy direction; gather first-pass reactions.',
    color: '#EC4899',
    araam: 'approach',
  },
  client_strategy_approval: {
    label: 'Client Strategy Approval',
    description: 'Strategy formally signed off; creative-verbal-brief cascade to the rest of IMC team.',
    color: '#A855F7',
    araam: 'approach',
  },
  imc_execution: {
    label: 'IMC Execution',
    description: 'Five parallel streams: Media Plan, PR Plan, Digital Plan, Creative, BTL. Traffic role orchestrates.',
    color: '#F97316',
    araam: 'action',
  },
  internal_review_imc_gtm: {
    label: 'Internal Review of IMC GTM',
    description: 'Account + Strategy review the consolidated Go-To-Market plan before showing client.',
    color: '#92400E',
    araam: 'action',
  },
  client_presentation: {
    label: 'Client Presentation',
    description: 'IMC team and client meet to present the full campaign.',
    color: '#16A34A',
    araam: 'action',
  },
  consolidated_feedback_approval: {
    label: 'Consolidated Feedback & Approval',
    description: 'Client revisions consolidated; approval (with reverts where needed) recorded.',
    color: '#1D4ED8',
    araam: 'action',
  },
  ces_production_costs_timings: {
    label: 'CES — Production Costs & Timings',
    description: 'Cost Estimate Sheet prepared; production timings locked in.',
    color: '#7C3AED',
    araam: 'action',
  },
  selected_gtm_assets_rollout: {
    label: 'Selected GTM Assets Rollout',
    description: 'Client approves selected assets for production; final go-ahead.',
    color: '#9333EA',
    araam: 'action',
  },
  campaign_production_launch: {
    label: 'Campaign Production & Launch',
    description: 'Production runs to completion; assets shipped to media; campaign goes live.',
    color: '#EA580C',
    araam: 'action',
  },
  reporting_monitoring: {
    label: 'Reporting & Monitoring',
    description: 'Live KPI tracking (reach, impressions, engagement, brand-lift) during the flight.',
    color: '#DB2777',
    araam: 'measure',
  },
  campaign_performance_review: {
    label: 'Campaign Performance Review',
    description: 'Post-campaign Challenge → Strategy → Results case study with quantified metrics.',
    color: '#DC2626',
    araam: 'measure',
  },
};

export function getStageIndex(stage: CampaignStage): number {
  return CAMPAIGN_STAGE_INDEX[stage];
}

export function getStageLabel(stage: CampaignStage): string {
  return CAMPAIGN_STAGE_META[stage].label;
}
