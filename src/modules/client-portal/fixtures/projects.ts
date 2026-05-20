import type { PortalProject } from '../components/DesktopShell';

export const VELA_PROJECT: PortalProject = {
  slug: 'vela-difc',
  tag: 'FIN · 2026 · 014',
  name: 'Vela Boutique — DIFC',
  sub: 'Fit-out · 412 m²',
  line: 'finishes',
};

export const NAQAA_PROJECT: PortalProject = {
  slug: 'naqaa-rollout',
  tag: 'ADV · 2026 · 008',
  name: 'Naqaa Retail Rollout',
  sub: '14 stores · KSA + UAE',
  line: 'advisory',
};

export const PORTAL_PROJECTS: PortalProject[] = [VELA_PROJECT, NAQAA_PROJECT];

export function getProjectBySlug(slug: string | undefined): PortalProject | undefined {
  if (!slug) return undefined;
  return PORTAL_PROJECTS.find((p) => p.slug === slug);
}
