// Single source of truth for the Firestore companies/{companyId}/... path
// segment used by the CEO Strategy collections (OKRs, KPIs, scorecards,
// strategy reviews, performance snapshots). ZeusOS consolidates strategy data
// under the group entity. (Replaces the DawinOS 'dawin_group' value.)
export const STRATEGY_COMPANY_ID = 'zeus-group';
