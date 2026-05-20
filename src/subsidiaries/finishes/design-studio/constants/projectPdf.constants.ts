/**
 * Project PDF Constants — Multi-section project PDF export
 */

export const PDF_SECTION_TYPES = [
  'cover', 'project_summary', 'cabinet_detail', 'project_cutlist',
  'project_hardware_schedule', 'project_edge_banding', 'assembly_drawings', 'appendix',
] as const;
export type PDFSectionType = (typeof PDF_SECTION_TYPES)[number];

export const DEFAULT_PDF_SECTIONS: readonly PDFSectionType[] = [
  'cover', 'project_summary', 'cabinet_detail', 'project_cutlist', 'project_hardware_schedule',
];

export const PDF_PAGE_SIZE = 'A4' as const;
export const PDF_ORIENTATION_DEFAULT = 'portrait' as const;
export const PDF_ORIENTATION_CUTLIST = 'landscape' as const;

export const CABINET_RENDER_WIDTH_PX = 800;
export const CABINET_RENDER_HEIGHT_PX = 600;
export const CABINET_RENDER_BACKGROUND = 'transparent';

export const PDF_RENDER_PRESET = 'product_catalog';

export const PROJECT_PDF_FILENAME_PATTERN = '{projectCode}-{projectName}-cutting-list-{date}.pdf';
