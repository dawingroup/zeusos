/**
 * ExportConfigPanel — PDF export configuration as a drawer panel
 *
 * Same form content as PrintPackageDialog but rendered inline
 * in the right drawer so the viewport stays visible.
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, AlertCircle, FileDown, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Progress } from '@/core/components/ui/progress';
import { printPackageConfigSchema } from '../schemas/printPackageSchema';
import type { PrintPackageConfig, ProjectContext } from '../types/workshop-viewer.types';
import type { GenerationProgress } from '../services/printPackageService';
import {
  describeMaterialException,
  type MaterialException,
} from '../services/materialValidationService';

interface ExportConfigPanelProps {
  onGenerate: (config: PrintPackageConfig) => void;
  projectContext?: ProjectContext | null;
  progress: GenerationProgress | null;
  loading: boolean;
  assemblyGroupCount?: number;
  groupsConfirmed?: boolean;
  onReviewGroups?: () => void;
  /**
   * P14: the last print-package config saved on this session. When
   * provided, the form hydrates from it so the user keeps their
   * checkboxes / paper size / revision across browser reloads.
   * Falls back to hardcoded defaults when null/undefined.
   */
  initialConfig?: PrintPackageConfig;
  /**
   * P13b: blocking material-validation exceptions. When non-empty, the
   * Generate button is disabled and a bright-red alert lists the
   * offending finishes. Expect this to remain empty on most projects —
   * the alert fires for net-new unresolved mappings.
   */
  materialExceptions?: MaterialException[];
  /** True while finishes or stock aggregates are still loading. */
  materialValidationLoading?: boolean;
  /** Optional hook to jump the user to the Materials panel to fix mappings. */
  onReviewMaterials?: () => void;
}

export default function ExportConfigPanel({
  onGenerate,
  projectContext,
  progress,
  loading,
  assemblyGroupCount,
  groupsConfirmed,
  onReviewGroups,
  initialConfig,
  materialExceptions,
  materialValidationLoading,
  onReviewMaterials,
}: ExportConfigPanelProps) {
  const exceptions = materialExceptions ?? [];
  const hasMaterialExceptions = exceptions.length > 0;
  const materialGateBlocks = hasMaterialExceptions || materialValidationLoading;

  // P14: when a previous export config is saved on the session, use it
  // as the form's initial state. The persisted config already went
  // through Zod on its way out, so we trust it structurally; fallback
  // paths still cover missing fields via the spread below.
  const defaults = initialConfig
    ? {
        ...initialConfig,
        projectInfo: {
          ...initialConfig.projectInfo,
          // Always prefer live project-context for these when available —
          // the saved copy is stale if the project was renamed between
          // exports. Falls back to the saved value when context is empty.
          projectName:
            projectContext?.projectName ?? initialConfig.projectInfo.projectName ?? '',
          client:
            projectContext?.clientName ?? initialConfig.projectInfo.client ?? '',
          address:
            projectContext?.clientAddress ?? initialConfig.projectInfo.address ?? '',
          projectNo:
            projectContext?.projectCode ?? initialConfig.projectInfo.projectNo ?? '',
          // Always stamp today's date; the previous run's date is not useful.
          date: new Date().toLocaleDateString('en-GB'),
        },
      }
    : {
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
      };

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(printPackageConfigSchema) as any,
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!projectContext) return;
    if (projectContext.projectName) setValue('projectInfo.projectName', projectContext.projectName);
    if (projectContext.clientName) setValue('projectInfo.client', projectContext.clientName);
    if (projectContext.clientAddress) setValue('projectInfo.address', projectContext.clientAddress);
    if (projectContext.projectCode) setValue('projectInfo.projectNo', projectContext.projectCode);
    if (projectContext.stage) setValue('projectInfo.stage', projectContext.stage);
  }, [projectContext, setValue]);

  const onSubmit = (data: any) => {
    onGenerate(data as PrintPackageConfig);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-3 space-y-4">
      {/* Project Info */}
      <div>
        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Project Info</Label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <div className="col-span-2">
            <Label className="text-[10px]">Project Name</Label>
            <Input {...register('projectInfo.projectName')} className="h-7 text-xs" />
            {errors.projectInfo?.projectName && (
              <p className="text-[10px] text-red-500 mt-0.5">{errors.projectInfo.projectName.message}</p>
            )}
          </div>
          <div className="col-span-2">
            <Label className="text-[10px]">Client</Label>
            <Input {...register('projectInfo.client')} className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Project No.</Label>
            <Input {...register('projectInfo.projectNo')} className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Date</Label>
            <Input {...register('projectInfo.date')} className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Drawn By</Label>
            <Input {...register('projectInfo.drawnBy')} className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Revision</Label>
            <Input {...register('projectInfo.revision')} className="h-7 text-xs" />
          </div>
        </div>
      </div>

      {/* Sheets */}
      <div>
        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Sheets</Label>
        <div className="grid grid-cols-2 gap-1 mt-1.5">
          {([
            ['cover', 'Cover'],
            ['isometricView', 'Iso View'],
            ['frontElevation', 'Front'],
            ['rearElevation', 'Rear'],
            ['planView', 'Plan'],
            ['threeView', '3-View'],
            ['partDetails', 'Parts'],
            ['assemblyExploded', 'Assemblies'],
            ['cutList', 'Cut List'],
            ['edgeBandSchedule', 'Edge Band'],
            ['shopTraveller', 'Traveller'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 text-[11px]">
              <input type="checkbox" {...register(`includeSheets.${key}`)} className="rounded border-gray-300 h-3 w-3" />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Dimension Tiers */}
      <div>
        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Dimensions</Label>
        <div className="space-y-1 mt-1.5">
          <label className="flex items-center gap-1.5 text-[11px]">
            <input type="checkbox" {...register('dimensionTiers.overall')} className="rounded border-gray-300 h-3 w-3" />
            Overall
          </label>
          <label className="flex items-center gap-1.5 text-[11px]">
            <input type="checkbox" {...register('dimensionTiers.intermediate')} className="rounded border-gray-300 h-3 w-3" />
            Intermediate
          </label>
          <label className="flex items-center gap-1.5 text-[11px]">
            <input type="checkbox" {...register('dimensionTiers.openings')} className="rounded border-gray-300 h-3 w-3" />
            Detail
          </label>
        </div>
      </div>

      {/* Paper + Hidden Lines (inline) */}
      <div className="flex gap-4">
        <div>
          <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Paper</Label>
          <div className="flex gap-2 mt-1">
            <label className="flex items-center gap-1 text-[11px]">
              <input type="radio" value="A3" {...register('paperSize')} className="h-3 w-3" /> A3
            </label>
            <label className="flex items-center gap-1 text-[11px]">
              <input type="radio" value="A4" {...register('paperSize')} className="h-3 w-3" /> A4
            </label>
          </div>
        </div>
        <div>
          <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Hidden Lines</Label>
          <div className="flex gap-1 mt-1">
            <button
              type="button"
              className={`px-2 py-0.5 rounded text-[10px] ${watch('hiddenLineMode') === 'faint' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setValue('hiddenLineMode', 'faint')}
            >
              Faint
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded text-[10px] ${watch('hiddenLineMode') === 'hidden' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setValue('hiddenLineMode', 'hidden')}
            >
              Off
            </button>
          </div>
        </div>
      </div>

      {/* Assembly Groups Status */}
      {assemblyGroupCount !== undefined && (
        <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${
          groupsConfirmed
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {groupsConfirmed
            ? <CheckCircle className="w-3 h-3 shrink-0" />
            : <AlertCircle className="w-3 h-3 shrink-0" />
          }
          <span className="flex-1">
            {groupsConfirmed
              ? `${assemblyGroupCount} groups confirmed`
              : `${assemblyGroupCount} groups — review first`}
          </span>
          {!groupsConfirmed && onReviewGroups && (
            <button type="button" className="underline text-[10px] font-medium" onClick={onReviewGroups}>
              Review
            </button>
          )}
        </div>
      )}

      {/* P13b: Material validation status — loading / exceptions block Generate */}
      {materialValidationLoading && !hasMaterialExceptions && (
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] bg-muted text-muted-foreground border border-border">
          <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
          <span>Checking finish inventory…</span>
        </div>
      )}
      {hasMaterialExceptions && (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>
              {exceptions.length} material {exceptions.length === 1 ? 'issue' : 'issues'} blocking export
            </span>
            {onReviewMaterials && (
              <button
                type="button"
                className="ml-auto underline text-[10px] font-medium"
                onClick={onReviewMaterials}
              >
                Fix
              </button>
            )}
          </div>
          <ul className="space-y-0.5 pl-1">
            {exceptions.slice(0, 6).map((ex, i) => (
              <li key={`${ex.threeDsMaterialName}-${i}`} className="text-[10px] text-red-800 leading-tight">
                • {describeMaterialException(ex)}
              </li>
            ))}
            {exceptions.length > 6 && (
              <li className="text-[10px] text-red-700 italic">
                …and {exceptions.length - 6} more — open the Materials panel to resolve.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Progress */}
      {loading && progress && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{progress.phase}</span>
            <span className="ml-auto">{progress.percent}%</span>
          </div>
          <Progress value={progress.percent} />
        </div>
      )}

      {/* Generate button */}
      <Button
        type="submit"
        disabled={loading || materialGateBlocks}
        className="w-full h-8 text-xs"
      >
        <FileDown className="h-3.5 w-3.5 mr-2" />
        {loading
          ? 'Generating...'
          : hasMaterialExceptions
          ? 'Resolve material issues first'
          : materialValidationLoading
          ? 'Checking inventory…'
          : 'Generate PDF'}
      </Button>
    </form>
  );
}
