/**
 * PrintPackageDialog — Export configuration modal
 * Project info fields (auto-populated, editable), sheet selection, dimension tiers
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Progress } from '@/core/components/ui/progress';
import { printPackageConfigSchema } from '../schemas/printPackageSchema';
import type { PrintPackageConfig, ProjectContext } from '../types/workshop-viewer.types';
import type { GenerationProgress } from '../services/printPackageService';

interface PrintPackageDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (config: PrintPackageConfig) => void;
  projectContext?: ProjectContext | null;
  progress: GenerationProgress | null;
  loading: boolean;
  assemblyGroupCount?: number;
  groupsConfirmed?: boolean;
  onReviewGroups?: () => void;
  /**
   * Previously-saved config from the ViewerSession (P14).
   * When provided, these values seed the form on mount, letting users resume
   * their previous export settings instead of starting from hard-coded defaults.
   */
  savedConfig?: PrintPackageConfig | null;
}

export default function PrintPackageDialog({
  open,
  onClose,
  onGenerate,
  projectContext,
  progress,
  loading,
  assemblyGroupCount,
  groupsConfirmed,
  onReviewGroups,
  savedConfig,
}: PrintPackageDialogProps) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(printPackageConfigSchema) as any,
    defaultValues: {
      projectInfo: {
        projectName: projectContext?.projectName ?? '',
        client: projectContext?.clientName ?? '',
        address: projectContext?.clientAddress ?? '',
        projectNo: projectContext?.projectCode ?? '',
        drawnBy: '',
        checkedBy: '',
        revision: '-',
        stage: projectContext?.stage ?? 'Construction Documents',
        date: new Date().toLocaleDateString('en-GB'),
      },
      includeSheets: {
        cover: true,
        isometricView: true,
        frontElevation: true,
        rearElevation: true,
        planView: true,
        threeView: true,
        partDetails: true,
        assemblyExploded: true,
        cutList: true,
        edgeBandSchedule: false,
        shopTraveller: true,
        // Scene-level extras — default off so workshop-focused exports
        // aren't bloated with schedules the user didn't ask for.
        renderGallery: false,
        hardwareSchedule: false,
        finishSchedule: false,
        architecturalPlans: false,
      },
      dimensionTiers: {
        overall: true,
        intermediate: true,
        openings: true,
      },
      hiddenLineMode: 'faint',
      shopTravellerSource: 'auto-generate',
      paperSize: 'A3',
      orientation: 'landscape',
    },
  });

  // Update form when projectContext arrives or changes (e.g., after browsing projects)
  useEffect(() => {
    if (!projectContext) return;
    if (projectContext.projectName) setValue('projectInfo.projectName', projectContext.projectName);
    if (projectContext.clientName) setValue('projectInfo.client', projectContext.clientName);
    if (projectContext.clientAddress) setValue('projectInfo.address', projectContext.clientAddress);
    if (projectContext.projectCode) setValue('projectInfo.projectNo', projectContext.projectCode);
    if (projectContext.stage) setValue('projectInfo.stage', projectContext.stage);
  }, [projectContext, setValue]);

  // P14: Restore previously-saved config when the dialog opens. Fresh `date`
  // each session so the new export is stamped with today.
  useEffect(() => {
    if (!open || !savedConfig) return;
    reset({
      ...savedConfig,
      projectInfo: {
        ...savedConfig.projectInfo,
        date: new Date().toLocaleDateString('en-GB'),
      },
    });
  }, [open, savedConfig, reset]);

  const onSubmit = (data: any) => {
    // Debug: verify checkbox boolean values reach the generator
    if (typeof window !== 'undefined') {
      console.log('[PrintPackageDialog] includeSheets:', JSON.stringify(data.includeSheets));
    }
    onGenerate(data as PrintPackageConfig);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Print Package</DialogTitle>
          <DialogDescription>Configure project info, sheets, and dimensions for the PDF output.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Project Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Project Name</Label>
              <Input {...register('projectInfo.projectName')} className="h-8 text-sm" />
              {errors.projectInfo?.projectName && (
                <p className="text-xs text-red-500 mt-0.5">{errors.projectInfo.projectName.message}</p>
              )}
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Client</Label>
              <Input {...register('projectInfo.client')} className="h-8 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Address</Label>
              <Input {...register('projectInfo.address')} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Project No.</Label>
              <Input {...register('projectInfo.projectNo')} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input {...register('projectInfo.date')} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Drawn By</Label>
              <Input {...register('projectInfo.drawnBy')} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Checked</Label>
              <Input {...register('projectInfo.checkedBy')} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Revision</Label>
              <Input {...register('projectInfo.revision')} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Stage</Label>
              <Input {...register('projectInfo.stage')} className="h-8 text-sm" />
            </div>
          </div>

          {/* Sheets */}
          <div>
            <Label className="text-xs font-semibold uppercase text-gray-500">Sheets to Include</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              {([
                ['cover', 'Cover / Index'],
                ['isometricView', 'Isometric SW View'],
                ['frontElevation', 'Front Elevation'],
                ['rearElevation', 'Rear Elevation'],
                ['planView', 'Plan View'],
                ['threeView', 'Three-View Arrangement'],
                ['partDetails', 'Part Details'],
                ['assemblyExploded', 'Assembly Exploded Views'],
                ['cutList', 'Cut List'],
                ['edgeBandSchedule', 'Edge Band Schedule'],
                ['shopTraveller', 'Shop Traveller'],
                // Scene-level schedule + render + architectural sheets.
                ['renderGallery', 'Rendered Views'],
                ['hardwareSchedule', 'Hardware Schedule'],
                ['finishSchedule', 'Finish Schedule'],
                ['architecturalPlans', 'Architectural Plans'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" {...register(`includeSheets.${key}`)} className="rounded border-gray-300" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Dimension Tiers */}
          <div>
            <Label className="text-xs font-semibold uppercase text-gray-500">Dimension Levels</Label>
            <div className="space-y-1 mt-1.5">
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" {...register('dimensionTiers.overall')} className="rounded border-gray-300" />
                Overall dimensions
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" {...register('dimensionTiers.intermediate')} className="rounded border-gray-300" />
                Intermediate (divisions, shelves)
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" {...register('dimensionTiers.openings')} className="rounded border-gray-300" />
                Detail (openings, spacing)
              </label>
            </div>
            {/* Dimension visibility options */}
            <div className="space-y-1.5 pt-2 border-t mt-2">
              <label className="flex items-center gap-2 text-xs">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <input type="checkbox" {...(register as any)('respectVisibilityOverrides')} defaultChecked className="rounded" />
                Respect visibility overrides
              </label>
              <label className="flex items-center gap-2 text-xs">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <input type="checkbox" {...(register as any)('includeUserDimensions')} defaultChecked className="rounded" />
                Include user-added dimensions
              </label>
            </div>
          </div>

          {/* Paper Size */}
          <div>
            <Label className="text-xs font-semibold uppercase text-gray-500">Paper Size</Label>
            <div className="flex gap-3 mt-1.5">
              <label className="flex items-center gap-1.5 text-xs">
                <input type="radio" value="A3" {...register('paperSize')} className="border-gray-300" />
                A3 (420 x 297mm)
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="radio" value="A4" {...register('paperSize')} className="border-gray-300" />
                A4 (297 x 210mm)
              </label>
            </div>
          </div>

          {/* Hidden Lines */}
          <div>
            <Label className="text-xs font-semibold uppercase text-gray-500">Hidden Lines</Label>
            <div className="flex gap-2 mt-1.5">
              <Button
                type="button"
                variant={watch('hiddenLineMode') === 'faint' ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setValue('hiddenLineMode', 'faint')}
              >
                Faint
              </Button>
              <Button
                type="button"
                variant={watch('hiddenLineMode') === 'hidden' ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setValue('hiddenLineMode', 'hidden')}
              >
                Off
              </Button>
            </div>
          </div>

          {/* Assembly Groups Status */}
          {assemblyGroupCount !== undefined && (
            <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
              groupsConfirmed
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {groupsConfirmed ? (
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="flex-1">
                {groupsConfirmed
                  ? `Assembly groups confirmed — ${assemblyGroupCount} groups will generate I2xx sheets`
                  : `${assemblyGroupCount} assembly groups auto-detected — review before generating`}
              </span>
              {!groupsConfirmed && onReviewGroups && (
                <button
                  type="button"
                  className="underline underline-offset-2 font-medium"
                  onClick={() => { onClose(); onReviewGroups(); }}
                >
                  Review
                </button>
              )}
            </div>
          )}

          {/* Progress */}
          {loading && progress && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>{progress.phase}</span>
                <span className="ml-auto">{progress.percent}%</span>
              </div>
              <Progress value={progress.percent} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Generating...' : 'Generate PDF'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
