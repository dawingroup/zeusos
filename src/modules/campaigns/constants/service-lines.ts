/**
 * The 5 parallel IMC execution streams that fan out from stage 6 of the
 * Campaign workflow, plus the 7 service lines Zeus offers (profile p. 6 wheel
 * diagram).
 *
 * `SERVICE_LINES` is the long form (7 entries) — the offering catalogue used
 * on Campaign creation forms when listing what's in scope.
 * `IMC_STREAMS` is the short form (5 entries) — the parallel Job streams in
 * stage 6, also drives the colour scheme on the JobBoard kanban.
 */

export const IMC_STREAMS = ['creative', 'digital', 'pr', 'btl', 'media'] as const;
export type IMCStream = (typeof IMC_STREAMS)[number];

export const SERVICE_LINES = [
  'creative',
  'digital',
  'pr',
  'btl',
  'media',
  'production',
  'brand_strategy',
] as const;
export type ServiceLine = (typeof SERVICE_LINES)[number];

export interface ServiceLineMeta {
  label: string;
  description: string;
  /** Background colour for the chip on the Campaign card. */
  color: string;
  /** True if the stream gets a parallel Job in stage 6 (IMC execution). */
  isImcStream: boolean;
}

export const SERVICE_LINE_META: Record<ServiceLine, ServiceLineMeta> = {
  creative: {
    label: 'Creative',
    description: 'Copywriting, script writing, 2D / 3D graphics, brand design, motion graphics, finished art.',
    color: '#EC4899',
    isImcStream: true,
  },
  digital: {
    label: 'Digital',
    description: 'Influencer, content, paid media, SEM/SEO, community management, digital listening.',
    color: '#00C5E5',
    isImcStream: true,
  },
  pr: {
    label: 'PR',
    description: 'Media relations, press releases, events & coverage, crisis management, thought leadership.',
    color: '#7C3AED',
    isImcStream: true,
  },
  btl: {
    label: 'BTL',
    description: 'On-trade / off-trade activations, exhibitions, weddings, live concerts, press conferences.',
    color: '#F97316',
    isImcStream: true,
  },
  media: {
    label: 'Media',
    description: 'Planning, negotiation, buying, monitoring & reporting across TV / radio / print / OOH / digital.',
    color: '#A855F7',
    isImcStream: true,
  },
  production: {
    label: 'Production',
    description: 'Print, radio, TV/film production, equipment supply, stage, sound.',
    color: '#F59E0B',
    isImcStream: false,
  },
  brand_strategy: {
    label: 'Brand Strategy',
    description: 'Comms strategy hub — the centre of the offerings wheel. Sets the BIG IDEA for the whole campaign.',
    color: '#F5D900',
    isImcStream: false,
  },
};

export function getServiceLineLabel(line: ServiceLine): string {
  return SERVICE_LINE_META[line].label;
}
