/**
 * Strategy document — extended section slugs.
 *
 * Minimal ZeusOS port of DawinOS's `sectionRegistry`. Only the
 * `EXTENDED_SECTIONS` slug map is carried over (consumed by the Options
 * Analysis + Experiments authoring surfaces to tag which document section a
 * record belongs to). The full DawinOS SECTION_REGISTRY metadata table is not
 * ported — ZeusOS does not render the modular-doc section chrome.
 */
export const EXTENDED_SECTIONS = {
  LINE_OF_SIGHT:       'lineOfSight',
  STRATEGIC_THEMES:    'strategicThemes',
  CAPITAL_ALLOCATION:  'capitalAllocation',
  FINANCIAL_MODEL:     'financialModel',
  CAPABILITY_MODEL:    'capabilityModel',
  INITIATIVES:         'initiatives',
  // New v2 modules (from the modular-doc design)
  SITUATION_SNAPSHOT:  'situationSnapshot',
  NORTH_STAR:          'northStar',
  CHOICES_MADE_AVOIDED:'choicesMadeAvoided',
  OUTCOME_OBJECTIVES:  'outcomeObjectives',
  CADENCE:             'cadence',
  APPROVALS:           'approvals',
  MICROFORECAST:       'microforecast',
  FINANCIAL_FORECAST:  'financialForecast',
  KPI_SCOREBOARD:      'kpiScoreboard',
  SPINOFF_EXPERIMENTS: 'spinoffExperiments',
  OPTIONS_ANALYSIS:    'optionsAnalysis',
} as const;

export type ExtendedSectionKey = (typeof EXTENDED_SECTIONS)[keyof typeof EXTENDED_SECTIONS];
