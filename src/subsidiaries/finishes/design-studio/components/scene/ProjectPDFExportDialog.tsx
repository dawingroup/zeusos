/**
 * ProjectPDFExportDialog — Export configuration modal
 *
 * Layout selector (detailed/workshop/client), section toggles,
 * render quality, customer info, notes. Preview + download.
 */
import { useState, useCallback } from 'react';
import { useProjectPDF } from '../../hooks/useProjectPDF';
import { DEFAULT_PDF_SECTIONS, PDF_SECTION_TYPES, type PDFSectionType } from '../../constants/projectPdf.constants';
import type { ProjectPDFRequest } from '../../types/projectPdf.types';
import type { DesignScene, SceneCabinet } from '../../types/scene.types';
import { PdfExportPreviewPanel } from './PdfExportPreviewPanel';

interface ProjectPDFExportDialogProps {
  sceneId: string;
  /** Optional scene + cabinets for the interactive preview panel.
   *  When provided, the dialog renders a live summary of what will
   *  land in the PDF (finishes, hardware, renders, architectural)
   *  so the user isn't flying blind before hitting Generate. */
  scene?: Pick<DesignScene, 'name' | 'architecturalAssets'> | null;
  cabinets?: SceneCabinet[];
  onClose: () => void;
}

const LAYOUT_OPTIONS = [
  { value: 'detailed' as const, label: 'Detailed', desc: 'All sections with full breakdowns' },
  { value: 'workshop' as const, label: 'Workshop', desc: 'Cutlist + hardware schedule only' },
  { value: 'client_presentation' as const, label: 'Client', desc: 'Cover + summary + renders + total price' },
];

const SECTION_LABELS: Record<string, string> = {
  cover: 'Cover Page',
  project_summary: 'Project Summary',
  cabinet_detail: 'Cabinet Detail Pages',
  project_cutlist: 'Aggregated Cut List',
  project_hardware_schedule: 'Hardware Schedule',
  project_edge_banding: 'Edge Banding Schedule',
  assembly_drawings: 'Assembly Drawings',
  appendix: 'Appendix',
};

export function ProjectPDFExportDialog({
  sceneId, scene, cabinets, onClose,
}: ProjectPDFExportDialogProps) {
  const { isGenerating, progress, pdfBlob, error, generate, download } = useProjectPDF();
  const [layout, setLayout] = useState<'detailed' | 'workshop' | 'client_presentation'>('detailed');
  const [sections, setSections] = useState<Set<PDFSectionType>>(new Set(DEFAULT_PDF_SECTIONS));
  const [includeRenders, setIncludeRenders] = useState(true);
  const [renderQuality, setRenderQuality] = useState<'standard' | 'high'>('standard');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');

  // Scene-level schedule sheets. Defaults track the layout so users who
  // don't tick anything still get a sensible output: detailed → all on,
  // workshop → schedules on but renders/architectural off, client →
  // renders + finishes on, hardware off. `undefined` means "use the
  // layout default" (the service then applies it).
  const [renderGallery,      setRenderGallery]      = useState<boolean | undefined>(undefined);
  const [hardwareSchedule,   setHardwareSchedule]   = useState<boolean | undefined>(undefined);
  const [finishSchedule,     setFinishSchedule]     = useState<boolean | undefined>(undefined);
  const [architecturalPlans, setArchitecturalPlans] = useState<boolean | undefined>(undefined);

  // Reflect the layout defaults in the dialog so users can see what's
  // implied before ticking. Service uses the same rules when the flag
  // is omitted, so the UI + the PDF always agree.
  const layoutDefault = (flag: 'render' | 'hardware' | 'finish' | 'arch'): boolean => {
    switch (flag) {
      case 'render':   return layout !== 'workshop';
      case 'hardware': return layout !== 'client_presentation';
      case 'finish':   return true;
      case 'arch':     return layout !== 'workshop';
    }
  };
  const effective = {
    render:   renderGallery      ?? layoutDefault('render'),
    hardware: hardwareSchedule   ?? layoutDefault('hardware'),
    finish:   finishSchedule     ?? layoutDefault('finish'),
    arch:     architecturalPlans ?? layoutDefault('arch'),
  };

  const toggleSection = useCallback((section: PDFSectionType) => {
    setSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    const request: ProjectPDFRequest = {
      sceneId,
      sections: Array.from(sections),
      includeAssemblyDrawings: sections.has('assembly_drawings'),
      includeRenders,
      renderQuality,
      layout,
      customer: customerName ? { name: customerName, address: '' } : undefined,
      notes: notes || undefined,
      includeRenderGallery:      renderGallery,
      includeHardwareSchedule:   hardwareSchedule,
      includeFinishSchedule:     finishSchedule,
      includeArchitecturalPlans: architecturalPlans,
    };
    await generate(request);
  }, [
    sceneId, sections, includeRenders, renderQuality, layout,
    customerName, notes, generate,
    renderGallery, hardwareSchedule, finishSchedule, architecturalPlans,
  ]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Export Project PDF</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Layout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Layout</label>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLayout(opt.value)}
                  className={`p-2 rounded-lg border text-left ${
                    layout === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <p className="text-xs font-medium">{opt.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sections</label>
            <div className="space-y-1">
              {PDF_SECTION_TYPES.map(s => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sections.has(s)}
                    onChange={() => toggleSection(s)}
                    className="rounded border-gray-300"
                  />
                  {SECTION_LABELS[s] ?? s}
                </label>
              ))}
            </div>
          </div>

          {/* Scene schedules & supplementary sheets. Each flag starts
              `undefined` — i.e. "use the layout default" — and only
              overrides the layout once the user ticks or unticks it.
              Display state shows the effective value so the dialog
              matches what the PDF will contain. */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scene schedules & supplementary sheets
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                ['render',   'Rendered Views (I500)',          renderGallery,      setRenderGallery,      effective.render]  ,
                ['hardware', 'Hardware Schedule (I303)',       hardwareSchedule,   setHardwareSchedule,   effective.hardware],
                ['finish',   'Finish Schedule (I304)',         finishSchedule,     setFinishSchedule,     effective.finish],
                ['arch',     'Architectural Plans (A1xx–A9xx)', architecturalPlans, setArchitecturalPlans, effective.arch],
              ] as const).map(([key, label, explicit, setExplicit, eff]) => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={eff}
                    onChange={e => setExplicit(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="flex-1 truncate">{label}</span>
                  {explicit === undefined && (
                    <span
                      className="text-[9px] text-gray-400 italic"
                      title="Following the layout default — tick to override"
                    >
                      auto
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              Layout drives defaults: <b>Detailed</b> includes all; <b>Workshop</b> drops renders + architectural;
              <b> Client</b> drops hardware. Toggle any checkbox to override the default for this export.
            </p>
          </div>

          {/* Live preview of what the enabled sections will contain —
              hardware from Materials library, finishes from Finish
              Library, renders from the cabinets, architectural from
              the scene's uploaded assets. Lazily fetches each schedule
              when its group is expanded. */}
          {scene && cabinets && (
            <PdfExportPreviewPanel
              scene={scene}
              cabinets={cabinets}
              enabled={{
                renderGallery:      effective.render,
                hardwareSchedule:   effective.hardware,
                finishSchedule:     effective.finish,
                architecturalPlans: effective.arch,
              }}
            />
          )}

          {/* Renders */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeRenders}
                onChange={e => setIncludeRenders(e.target.checked)}
                className="rounded border-gray-300"
              />
              Include cabinet renders
            </label>
            {includeRenders && (
              <select
                value={renderQuality}
                onChange={e => setRenderQuality(e.target.value as 'standard' | 'high')}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="standard">Standard</option>
                <option value="high">High Quality</option>
              </select>
            )}
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Optional"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes for the PDF"
              rows={2}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* Status */}
          {isGenerating && progress && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              <span className="truncate">{progress.phase}</span>
              <span className="text-xs text-blue-500">{Math.round(progress.percent)}%</span>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error.message}</p>}
          {pdfBlob && !isGenerating && (
            <button
              type="button"
              onClick={() => download(`${(customerName || 'project').replace(/\s+/g, '-').toLowerCase()}-scene.pdf`)}
              className="block text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Download PDF
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-3 border-t bg-gray-50">
          <button type="button" onClick={onClose} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || sections.size === 0}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
