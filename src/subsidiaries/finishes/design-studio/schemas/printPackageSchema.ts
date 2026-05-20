/**
 * Zod validation schemas for the Workshop Viewer print package configuration
 */

import { z } from 'zod';

export const printPackageProjectInfoSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  client: z.string().min(1, 'Client name is required'),
  address: z.string().default(''),
  projectNo: z.string().default(''),
  drawnBy: z.string().default(''),
  checkedBy: z.string().default(''),
  revision: z.string().default('-'),
  stage: z.string().default('Construction Documents'),
  date: z.string().default(() => new Date().toLocaleDateString('en-GB')),
});

export const printPackageConfigSchema = z.object({
  projectInfo: printPackageProjectInfoSchema,
  includeSheets: z.object({
    cover: z.boolean(),
    isometricView: z.boolean(),
    frontElevation: z.boolean(),
    rearElevation: z.boolean(),
    planView: z.boolean(),
    threeView: z.boolean(),
    partDetails: z.boolean(),
    assemblyExploded: z.boolean(),
    cutList: z.boolean(),
    edgeBandSchedule: z.boolean(),
    shopTraveller: z.boolean(),
    // Scene-level additions — all optional for backwards-compat with
    // saved configs from before these sections landed.
    projectSection: z.boolean().optional(),
    cabinetSection: z.boolean().optional(),
    renderGallery: z.boolean().optional(),
    hardwareSchedule: z.boolean().optional(),
    finishSchedule: z.boolean().optional(),
    architecturalPlans: z.boolean().optional(),
  }),
  partFilter: z.array(z.string()).optional(),
  dimensionTiers: z.object({
    overall: z.boolean(),
    intermediate: z.boolean(),
    openings: z.boolean(),
  }),
  hiddenLineMode: z.enum(['faint', 'hidden']),
  shopTravellerSource: z.enum(['auto-generate', 'link-existing']),
  paperSize: z.enum(['A3', 'A4']),
  orientation: z.literal('landscape'),
  includeAutoDimensions: z.boolean().optional(),
  includeUserDimensions: z.boolean().optional(),
  respectVisibilityOverrides: z.boolean().optional(),
});

export type PrintPackageProjectInfoFormData = z.infer<typeof printPackageProjectInfoSchema>;
export type PrintPackageConfigFormData = z.infer<typeof printPackageConfigSchema>;
