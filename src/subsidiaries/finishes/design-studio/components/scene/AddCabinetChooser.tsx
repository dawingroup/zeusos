/**
 * AddCabinetChooser — Two clear paths to add cabinets to a scene
 *
 * Path A: From Template (PDD)
 *   - Pick an existing parametric template (PDD)
 *   - Configure parameters (width, depth, finishes)
 *   - Cabinet is created with computed BOM but no 3D model yet
 *
 * Path B: From 3D Model
 *   - Upload a 3DS / DXF / GLB file
 *   - AI detects each cabinet within the file
 *   - Each detection becomes one SceneCabinet
 *   - Optionally auto-process each one with AI grouping
 */
import { Box, Upload, Sparkles } from 'lucide-react';

interface AddCabinetChooserProps {
  onPickTemplate: () => void;
  onPickModel: () => void;
  onClose: () => void;
}

export function AddCabinetChooser({ onPickTemplate, onPickModel, onClose }: AddCabinetChooserProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Add Cabinet to Scene</h3>
            <p className="text-xs text-gray-500 mt-0.5">Choose how you want to add cabinets</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Two paths */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-6">
          {/* Template */}
          <button
            type="button"
            onClick={onPickTemplate}
            className="group text-left rounded-lg border-2 border-gray-200 p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">From Template</h4>
                <p className="text-[10px] text-gray-500">One cabinet at a time</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Pick an existing Product Definition (PDD) and configure its parameters: width, depth, height, finishes.
            </p>
            <div className="space-y-1 text-[11px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                Best for: known archetypes (Kitchen Base 600, Wardrobe 2-Door...)
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                BOM and pricing computed from the PDD's formulas
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                No 3D model yet — assemblies set later
              </div>
            </div>
            <div className="mt-3 text-[11px] text-blue-600 font-medium group-hover:underline">
              Choose template →
            </div>
          </button>

          {/* From 3D model */}
          <button
            type="button"
            onClick={onPickModel}
            className="group text-left rounded-lg border-2 border-gray-200 p-4 hover:border-purple-400 hover:bg-purple-50/30 transition-all"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  From 3D Model
                  <Sparkles className="w-3 h-3 text-purple-500" />
                </h4>
                <p className="text-[10px] text-gray-500">Multiple cabinets, AI-split</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Upload one model file (3DS / DXF / GLB) containing many cabinets. AI identifies each cabinet and creates them as a batch.
            </p>
            <div className="space-y-1 text-[11px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-purple-400" />
                Best for: PolyBoard exports, full kitchen runs, wardrobe walls
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-purple-400" />
                Claude detects boundaries (KB-A, KB-B, WR-A...) automatically
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-purple-400" />
                Optionally auto-processes each cabinet (assemblies, materials)
              </div>
            </div>
            <div className="mt-3 text-[11px] text-purple-600 font-medium group-hover:underline">
              Upload model →
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
