/**
 * PartsImportDialog Component
 * Dialog for importing parts from CSV files
 */

import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { parseCSV, parsedPartsToPartEntries, type CSVParseResult } from '../../services/csvParser';
import type { PartEntry } from '../../types';

interface PartsImportDialogProps {
  onImport: (parts: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[], mode: 'append' | 'replace') => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function PartsImportDialog({ onImport, onClose, loading }: PartsImportDialogProps) {
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const result = parseCSV(text, file.name);
    setParseResult(result);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.parts.length === 0) return;
    
    const source = (parseResult.sourceType === 'polyboard' || parseResult.sourceType === 'polyboard-bar' || parseResult.sourceType === 'polyboard-timber') ? 'polyboard' :
                   parseResult.sourceType === 'sketchup' ? 'sketchup' : 'csv-import';
    
    const partEntries = parsedPartsToPartEntries(
      parseResult.parts,
      source,
      parseResult.metadata.filename
    );
    
    await onImport(partEntries, importMode);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Import Parts from CSV</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!parseResult ? (
            <>
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">Drop CSV file here or click to browse</p>
                <p className="text-sm text-gray-500 mt-1">
                  Supports Polyboard, SketchUp CutList, and generic CSV formats
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Format Help */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-3">
                <h3 className="font-medium text-gray-900">CSV Format Guide (Polyboard Export)</h3>

                <div>
                  <p className="font-medium text-gray-700 mb-1">Panel cutting list — Column Order:</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="bg-gray-200 px-2 py-1 rounded text-xs text-gray-500">1. Cabinet (ignored)</span>
                    <span className="bg-blue-50 px-2 py-1 rounded border border-blue-300 text-xs text-blue-700">2. Label</span>
                    <span className="bg-white px-2 py-1 rounded border text-xs">3. Material</span>
                    <span className="bg-white px-2 py-1 rounded border text-xs">4. Thickness</span>
                    <span className="bg-white px-2 py-1 rounded border text-xs">5. Quantity</span>
                    <span className="bg-blue-50 px-2 py-1 rounded border border-blue-300 text-xs text-blue-700">6. Length</span>
                    <span className="bg-blue-50 px-2 py-1 rounded border border-blue-300 text-xs text-blue-700">7. Width</span>
                    <span className="bg-white px-2 py-1 rounded border text-xs">8. Grain</span>
                    <span className="bg-white px-2 py-1 rounded border text-xs">9–12. Edges</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="inline-block bg-blue-100 px-1 rounded">Blue</span> = required
                  </p>
                </div>

                <div className="bg-blue-50 rounded p-2 border border-blue-200">
                  <p className="font-medium text-blue-800 text-xs mb-1">Example — Panel (Polyboard):</p>
                  <pre className="text-xs font-mono text-blue-700 overflow-x-auto whitespace-pre-wrap">cabinet,label,material,thickness,quantity,length,width,grain,topEdge,rightEdge,bottomEdge,leftEdge
Kitchen-01,Top Panel,MDF 18mm,18,1,800,600,0,ABS-White,ABS-White,,
Kitchen-01,Side Panel,MDF 18mm,18,2,700,550,1,,,,</pre>
                </div>

                <div>
                  <p className="font-medium text-gray-700 mb-1">Bar / section cutting list — Column Order:</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="bg-gray-200 px-2 py-1 rounded text-xs text-gray-500">1. Cabinet (ignored)</span>
                    <span className="bg-amber-50 px-2 py-1 rounded border border-amber-300 text-xs text-amber-700">2. Label</span>
                    <span className="bg-white px-2 py-1 rounded border text-xs">3. Material</span>
                    <span className="bg-white px-2 py-1 rounded border text-xs">4. Profile (e.g. 40x40x2)</span>
                    <span className="bg-white px-2 py-1 rounded border text-xs">5. Quantity</span>
                    <span className="bg-amber-50 px-2 py-1 rounded border border-amber-300 text-xs text-amber-700">6. Length</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Used for metal bars, aluminium extrusions, timber sections, etc.</p>
                </div>

                <div className="bg-amber-50 rounded p-2 border border-amber-200">
                  <p className="font-medium text-amber-800 text-xs mb-1">Example — Bar/Section (Polyboard):</p>
                  <pre className="text-xs font-mono text-amber-700 overflow-x-auto whitespace-pre-wrap">cabinet,label,material,profile,quantity,length
Frame-01,Top Rail,Aluminium 6060-T5,40x40x2,2,2400
Frame-01,Vertical Post,Aluminium 6060-T5,40x40x2,4,900</pre>
                </div>

                <p className="text-gray-500 text-xs">
                  <strong>Note:</strong> Cabinet column is ignored here (all parts go to this Design Item). Use Bulk Import at project level to split by cabinet.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Parse Results */}
              <div className="space-y-3">
                {/* File Info */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <FileText className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{parseResult.metadata.filename}</p>
                    <p className="text-sm text-gray-500">
                      Format: {
                        parseResult.sourceType === 'polyboard-bar' ? 'Polyboard Bar/Section' :
                        parseResult.sourceType === 'polyboard-timber' ? 'Polyboard Timber Section' :
                        parseResult.sourceType
                      } • {parseResult.metadata.totalRows} rows
                    </p>
                  </div>
                </div>

                {/* Warnings */}
                {parseResult.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-800 font-medium mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Warnings
                    </div>
                    <ul className="text-sm text-amber-700 list-disc list-inside">
                      {parseResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Errors */}
                {parseResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-800 font-medium mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      {parseResult.errors.length} row(s) skipped
                    </div>
                    <ul className="text-sm text-red-700 list-disc list-inside max-h-24 overflow-y-auto">
                      {parseResult.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>Row {e.row}: {e.message}</li>
                      ))}
                      {parseResult.errors.length > 5 && (
                        <li>...and {parseResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Success Summary */}
                {parseResult.parts.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-800 font-medium">
                      <CheckCircle className="w-4 h-4" />
                      {parseResult.parts.length} parts ready to import
                    </div>
                  </div>
                )}

                {/* Preview Table */}
                {parseResult.parts.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-48">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-700">Name</th>
                            <th className="px-3 py-2 text-center text-gray-700">Type</th>
                            <th className="px-3 py-2 text-right text-gray-700">L (mm)</th>
                            <th className="px-3 py-2 text-right text-gray-700">W / Profile</th>
                            <th className="px-3 py-2 text-right text-gray-700">T</th>
                            <th className="px-3 py-2 text-center text-gray-700">Qty</th>
                            <th className="px-3 py-2 text-left text-gray-700">Material</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {parseResult.parts.slice(0, 10).map((part, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-gray-900">{part.name}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  part.partType === 'bar'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {part.partType === 'bar' ? 'Bar' : 'Sheet'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-gray-600">{part.length}</td>
                              <td className="px-3 py-2 text-right text-gray-600">
                                {part.partType === 'bar' ? (part.barProfile ?? '—') : part.width}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-600">
                                {part.partType === 'bar' ? '—' : part.thickness}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-600">{part.quantity}</td>
                              <td className="px-3 py-2 text-gray-600">{part.materialName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {parseResult.parts.length > 10 && (
                      <div className="px-3 py-2 bg-gray-50 text-sm text-gray-500 text-center">
                        ...and {parseResult.parts.length - 10} more parts
                      </div>
                    )}
                  </div>
                )}

                {/* Import Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Import Mode</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-primary"
                      />
                      <span className="text-sm text-gray-700">Add to existing parts</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-primary"
                      />
                      <span className="text-sm text-gray-700">Replace all parts</span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3 p-4 border-t border-gray-200">
          {parseResult && (
            <button
              onClick={() => setParseResult(null)}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Choose Different File
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            {parseResult && parseResult.parts.length > 0 && (
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Importing...' : `Import ${parseResult.parts.length} Parts`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PartsImportDialog;
