/**
 * Bulk Importer Component
 * Upload Master CSV, split by cabinet, and create/update Design Items with cost estimation
 */

import { useState, useRef } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { optimizationService, type OptimizationResult } from '@/shared/services/optimization';
import { splitByCabinet, getSplitSummary, type SplitResult } from '../../utils/csvSplitter';
import { calculatePartsSummary } from '../../services/partsService';
import type { RAGStatusValue, PartEntry, PartEdgeBanding } from '../../types';
import type { Panel } from '@/shared/services/optimization';

interface BulkImporterProps {
  projectId: string;
  projectCode: string;
  onComplete: (results: ImportResult[]) => void;
  onCancel: () => void;
}

interface ImportResult {
  cabinetCode: string;
  designItemId: string;
  status: 'created' | 'updated' | 'error';
  estimationResult?: OptimizationResult;
  error?: string;
}

type ImportStep = 'upload' | 'preview' | 'processing' | 'complete';

export function BulkImporter({ projectId, projectCode, onComplete, onCancel }: BulkImporterProps) {
  // Step state
  const [step, setStep] = useState<ImportStep>('upload');
  
  // File state
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Split result state
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  
  // Processing state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setErrors(['Please upload a CSV file']);
      return;
    }

    setFileName(file.name);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target?.result as string;
      const result = splitByCabinet(csvText);
      
      setSplitResult(result);
      // Select all groups by default
      setSelectedGroups(new Set(result.groups.map(g => g.cabinetCode)));
      
      if (result.parseErrors.length > 0) {
        setErrors(result.parseErrors);
      }
      
      setStep('preview');
    };
    reader.onerror = () => {
      setErrors(['Failed to read file']);
    };
    reader.readAsText(file);
  };

  // Toggle group selection
  const toggleGroup = (cabinetCode: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(cabinetCode)) {
      newSelected.delete(cabinetCode);
    } else {
      newSelected.add(cabinetCode);
    }
    setSelectedGroups(newSelected);
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedGroups.size === splitResult?.groups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(splitResult?.groups.map(g => g.cabinetCode) || []));
    }
  };

  // Convert panels to PartEntry format for storage
  const panelsToPartEntries = (panels: Panel[], filename: string, isTimberSection = false): PartEntry[] => {
    return panels.map((panel, idx) => {
      const defaultEdgeBanding: PartEdgeBanding = {
        top: false,
        bottom: false,
        left: false,
        right: false,
      };

      const isBar = isTimberSection;
      // For timber/bar sections: profile = "thicknessxwidth" (e.g. "45x140")
      const barProfile = isBar ? `${panel.thickness}x${panel.width}` : undefined;

      return {
        id: `${Date.now()}-${idx}`,
        partNumber: `P${String(idx + 1).padStart(3, '0')}`,
        name: panel.label || `Part ${idx + 1}`,
        length: panel.length,
        width: panel.width,
        thickness: panel.thickness || 18,
        quantity: panel.quantity,
        materialName: panel.material || 'Unspecified',
        grainDirection: panel.grain === 1 ? 'length' : panel.grain === 2 ? 'width' : 'none',
        edgeBanding: defaultEdgeBanding,
        hasCNCOperations: false,
        source: 'polyboard' as const,
        importedFrom: filename,
        partType: isBar ? 'bar' as const : 'sheet' as const,
        ...(barProfile ? { barProfile } : {}),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as PartEntry;
    });
  };

  // Convert PartEntry back to Panel format for re-estimation after merge
  const partEntriesToPanels = (parts: PartEntry[]): Panel[] => {
    return parts.map(part => ({
      length: part.length,
      width: part.width,
      thickness: part.thickness,
      quantity: part.quantity,
      material: part.materialName,
      grain: part.grainDirection === 'length' ? 1 : part.grainDirection === 'width' ? 2 : 0,
      label: part.name,
    }));
  };

  // Process selected groups
  const processGroups = async () => {
    if (!splitResult) return;

    setStep('processing');
    setImportResults([]);

    const groupsToProcess = splitResult.groups.filter(g => selectedGroups.has(g.cabinetCode));
    const results: ImportResult[] = [];

    for (let i = 0; i < groupsToProcess.length; i++) {
      setCurrentIndex(i);
      const group = groupsToProcess[i];

      try {
        const currentFileName = fileName || 'bulk-import';
        const isTimberSection = group.isTimberSection ?? false;

        // Convert current CSV's panels to parts (bar parts get partType:'bar' and barProfile)
        const parts = panelsToPartEntries(group.panels, currentFileName, isTimberSection);

        // Check if design item already exists — match by itemCode first, then by name
        console.log(`[BulkImporter] Looking up cabinet: "${group.cabinetCode}" (name: "${group.cabinetName}")`);
        const [byCodeDocs, byNameDocs] = await Promise.all([
          getDocs(query(
            collection(db, 'designProjects', projectId, 'designItems'),
            where('itemCode', '==', group.cabinetCode)
          )),
          getDocs(query(
            collection(db, 'designProjects', projectId, 'designItems'),
            where('name', '==', group.cabinetCode)
          )),
        ]);
        const existingDocs = !byCodeDocs.empty ? byCodeDocs : byNameDocs;
        console.log(`[BulkImporter] Match result: byCode=${byCodeDocs.size}, byName=${byNameDocs.size}`);

        let designItemId: string;
        let status: 'created' | 'updated' = 'created';
        let estimationResult: OptimizationResult;

        if (!existingDocs.empty) {
          // Merge: keep parts from other imported files, replace parts from this file
          designItemId = existingDocs.docs[0].id;
          status = 'updated';

          const existingData = existingDocs.docs[0].data();
          const existingParts = (existingData.parts || []) as PartEntry[];

          // Parts imported from a different file are kept; same-file parts are replaced
          const keptParts = existingParts.filter(p => p.importedFrom !== currentFileName);
          const mergedParts = [...keptParts, ...parts];
          const mergedPartsSummary = calculatePartsSummary(mergedParts);

          // Re-run estimation on merged sheet panels only (bar estimation is done by cutlistAggregation)
          const sheetParts = mergedParts.filter(p => (p.partType ?? 'sheet') === 'sheet');
          const allPanels = partEntriesToPanels(sheetParts.length > 0 ? sheetParts : mergedParts);
          estimationResult = sheetParts.length > 0
            ? optimizationService.optimize(allPanels, { mode: 'ESTIMATION' })
            : { sheets: [], totalSheets: 0, totalPanels: mergedParts.length, totalUsedArea: 0, totalWastedArea: 0, estimatedMaterialCost: 0, averageUtilization: 0, sheetsByMaterial: {} };

          await updateDoc(
            doc(db, 'designProjects', projectId, 'designItems', designItemId),
            {
              parts: mergedParts,
              partsSummary: mergedPartsSummary,
              'ragStatus.manufacturingReadiness.costValidation': {
                status: estimationResult.estimatedMaterialCost ? 'green' : 'amber' as RAGStatusValue,
                notes: `Estimated: ${formatCurrency(estimationResult.estimatedMaterialCost || 0)} (${estimationResult.totalSheets} sheets)`,
                updatedAt: serverTimestamp(),
                updatedBy: 'bulk-import',
              },
              estimationData: {
                totalSheets: estimationResult.totalSheets,
                totalPanels: estimationResult.totalPanels,
                estimatedMaterialCost: estimationResult.estimatedMaterialCost,
                averageUtilization: estimationResult.averageUtilization,
                sheetsByMaterial: estimationResult.sheetsByMaterial,
                estimatedAt: new Date().toISOString(),
              },
              updatedAt: serverTimestamp(),
            }
          );
        } else {
          // Create new design item
          // For timber/bar sections, skip sheet optimization (bar estimation is done by cutlistAggregation)
          estimationResult = isTimberSection
            ? { sheets: [], totalSheets: 0, totalPanels: parts.length, totalUsedArea: 0, totalWastedArea: 0, estimatedMaterialCost: 0, averageUtilization: 0, sheetsByMaterial: {} }
            : optimizationService.optimize(group.panels, { mode: 'ESTIMATION' });
          const partsSummary = calculatePartsSummary(parts);

          const newItem = {
            itemCode: group.cabinetCode,
            name: group.cabinetName || group.cabinetCode,
            description: `Imported from ${currentFileName}`,
            category: 'casework',
            projectId,
            projectCode,
            currentStage: 'concept',
            overallReadiness: 15,
            ragStatus: createInitialRAGStatus(estimationResult),
            stageHistory: [],
            approvals: [],
            files: [],
            tags: ['bulk-import'],
          };

          const docRef = await addDoc(
            collection(db, 'designProjects', projectId, 'designItems'),
            {
              ...newItem,
              parts,
              partsSummary,
              estimationData: {
                totalSheets: estimationResult.totalSheets,
                totalPanels: estimationResult.totalPanels,
                estimatedMaterialCost: estimationResult.estimatedMaterialCost,
                averageUtilization: estimationResult.averageUtilization,
                sheetsByMaterial: estimationResult.sheetsByMaterial,
                estimatedAt: new Date().toISOString(),
              },
              createdAt: serverTimestamp(),
              createdBy: 'bulk-import',
              updatedAt: serverTimestamp(),
              updatedBy: 'bulk-import',
            }
          );
          designItemId = docRef.id;
        }

        results.push({
          cabinetCode: group.cabinetCode,
          designItemId,
          status,
          estimationResult,
        });
      } catch (error) {
        console.error(`Error processing ${group.cabinetCode}:`, error);
        results.push({
          cabinetCode: group.cabinetCode,
          designItemId: '',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    setImportResults(results);
    setStep('complete');
  };

  // Create initial RAG status with cost validation
  const createInitialRAGStatus = (estimation: OptimizationResult) => {
    const defaultRag = {
      status: 'red' as RAGStatusValue,
      notes: '',
      updatedBy: 'bulk-import',
    };

    return {
      designCompleteness: {
        overallDimensions: { ...defaultRag, status: 'amber' as RAGStatusValue, notes: 'From cutlist' },
        model3D: defaultRag,
        productionDrawings: defaultRag,
        materialSpecs: { ...defaultRag, status: 'green' as RAGStatusValue, notes: 'From cutlist' },
        hardwareSpecs: defaultRag,
        finishSpecs: defaultRag,
        joineryDetails: defaultRag,
        tolerances: defaultRag,
        assemblyInstructions: defaultRag,
      },
      manufacturingReadiness: {
        materialAvailability: defaultRag,
        hardwareAvailability: defaultRag,
        toolingReadiness: defaultRag,
        processDocumentation: defaultRag,
        qualityCriteria: defaultRag,
        costValidation: {
          status: (estimation.estimatedMaterialCost ? 'green' : 'amber') as RAGStatusValue,
          notes: `Estimated: ${formatCurrency(estimation.estimatedMaterialCost || 0)} (${estimation.totalSheets} sheets)`,
          updatedBy: 'bulk-import',
        },
      },
      qualityGates: {
        internalDesignReview: defaultRag,
        manufacturingReview: defaultRag,
        clientApproval: defaultRag,
        prototypeValidation: { ...defaultRag, status: 'not-applicable' as RAGStatusValue },
      },
    };
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Render based on step
  const renderStep = () => {
    switch (step) {
      case 'upload':
        return renderUploadStep();
      case 'preview':
        return renderPreviewStep();
      case 'processing':
        return renderProcessingStep();
      case 'complete':
        return renderCompleteStep();
    }
  };

  const renderUploadStep = () => (
    <div className="py-8">
      <div className="text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <div
          onClick={() => fileInputRef.current?.click()}
          className="mx-auto w-96 h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-gray-600 font-medium">Upload Polyboard Master CSV</p>
          <p className="text-sm text-gray-400 mt-1">Click or drag and drop</p>
        </div>

        {errors.length > 0 && (
          <div className="mt-4 max-w-lg mx-auto">
            {errors.map((error, i) => (
              <p key={i} className="text-sm text-red-600">{error}</p>
            ))}
          </div>
        )}
      </div>

      {/* CSV Format Guide */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6 max-w-4xl mx-auto">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          CSV Format Guide
        </h4>
        
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-gray-700 mb-2">Polyboard CSV Format (column order):</p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <div className="bg-green-50 rounded px-2 py-1.5 border border-green-300 text-xs">
                <span className="font-mono text-green-700 font-bold">1. Cabinet</span>
                <p className="text-green-600 text-xs">→ Design Item</p>
              </div>
              <div className="bg-blue-50 rounded px-2 py-1.5 border border-blue-300 text-xs">
                <span className="font-mono text-blue-700">2. Label</span>
              </div>
              <div className="bg-white rounded px-2 py-1.5 border text-xs">
                <span className="font-mono text-gray-600">3. Material</span>
              </div>
              <div className="bg-white rounded px-2 py-1.5 border text-xs">
                <span className="font-mono text-gray-600">4. Thickness</span>
              </div>
              <div className="bg-white rounded px-2 py-1.5 border text-xs">
                <span className="font-mono text-gray-600">5. Quantity</span>
              </div>
              <div className="bg-blue-50 rounded px-2 py-1.5 border border-blue-300 text-xs">
                <span className="font-mono text-blue-700">6. Length</span>
              </div>
              <div className="bg-blue-50 rounded px-2 py-1.5 border border-blue-300 text-xs">
                <span className="font-mono text-blue-700">7. Width</span>
              </div>
              <div className="bg-white rounded px-2 py-1.5 border text-xs">
                <span className="font-mono text-gray-600">8. Grain</span>
              </div>
              <div className="bg-white rounded px-2 py-1.5 border text-xs">
                <span className="font-mono text-gray-600">9-12. Edges</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              <span className="inline-block bg-green-100 px-1 rounded">Green</span> = grouping, 
              <span className="inline-block bg-blue-100 px-1 rounded ml-1">Blue</span> = required
            </p>
          </div>

          <div className="bg-blue-50 rounded p-3 border border-blue-200">
            <p className="font-medium text-blue-800 mb-2">Example CSV (Polyboard export format):</p>
            <pre className="text-xs font-mono text-blue-700 overflow-x-auto">
cabinet,label,material,thickness,quantity,length,width,grain,topEdge,rightEdge,bottomEdge,leftEdge
Kitchen-01,Top Panel,MDF 18mm,18,1,800,600,0,ABS-White,ABS-White,,
Kitchen-01,Side Panel,MDF 18mm,18,2,700,550,1,,,,
Kitchen-02,Bottom,Plywood 15mm,15,1,780,580,0,ABS-Oak,ABS-Oak,ABS-Oak,ABS-Oak</pre>
          </div>

          <div className="text-gray-500 text-xs">
            <p><strong>Supported delimiters:</strong> Comma (,), Semicolon (;), Tab</p>
            <p><strong>Supported formats:</strong> Polyboard, SketchUp Cutlist, Generic CSV</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreviewStep = () => {
    if (!splitResult) return null;
    const summary = getSplitSummary(splitResult);

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Import Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-600">File:</span>
              <span className="ml-2 font-medium">{fileName}</span>
            </div>
            <div>
              <span className="text-blue-600">Cabinets:</span>
              <span className="ml-2 font-medium">{summary.totalCabinets}</span>
            </div>
            <div>
              <span className="text-blue-600">Total Panels:</span>
              <span className="ml-2 font-medium">{summary.totalPanels}</span>
            </div>
            <div>
              <span className="text-blue-600">Total Area:</span>
              <span className="ml-2 font-medium">{(summary.totalArea / 1000000).toFixed(2)} m²</span>
            </div>
          </div>
        </div>

        {/* Debug Info - Column Detection */}
        {splitResult.debugInfo && (
          <div className="bg-gray-100 rounded-lg p-4 text-xs font-mono">
            <details>
              <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                Debug: Column Detection (click to expand)
                {splitResult.debugInfo.hasHeaderRow === false && (
                  <span className="ml-2 text-amber-600 font-normal">[No header row - using positional format]</span>
                )}
              </summary>
              <div className="space-y-2 mt-2">
                <div>
                  <span className="font-bold">Headers found:</span>
                  <div className="bg-white p-2 rounded mt-1 overflow-x-auto">
                    {splitResult.debugInfo.headers.map((h, i) => (
                      <span key={i} className="inline-block bg-gray-200 px-2 py-1 rounded mr-1 mb-1">
                        [{i}] {h || '(empty)'}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="font-bold">Column mapping:</span>
                  <div className="bg-white p-2 rounded mt-1 grid grid-cols-2 gap-1">
                    <span className={splitResult.debugInfo.columnMapping.cabinetCode !== undefined ? 'text-green-600' : 'text-red-600'}>
                      Cabinet: {splitResult.debugInfo.columnMapping.cabinetCode ?? 'NOT FOUND'}
                    </span>
                    <span className={splitResult.debugInfo.columnMapping.label !== undefined ? 'text-green-600' : 'text-red-600'}>
                      Label: {splitResult.debugInfo.columnMapping.label ?? 'NOT FOUND'}
                    </span>
                    <span className={splitResult.debugInfo.columnMapping.length !== undefined ? 'text-green-600' : 'text-red-600'}>
                      Length: {splitResult.debugInfo.columnMapping.length ?? 'NOT FOUND'}
                    </span>
                    <span className={splitResult.debugInfo.columnMapping.width !== undefined ? 'text-green-600' : 'text-red-600'}>
                      Width: {splitResult.debugInfo.columnMapping.width ?? 'NOT FOUND'}
                    </span>
                    <span className={splitResult.debugInfo.columnMapping.thickness !== undefined ? 'text-green-600' : 'text-gray-400'}>
                      Thickness: {splitResult.debugInfo.columnMapping.thickness ?? 'not found'}
                    </span>
                    <span className={splitResult.debugInfo.columnMapping.quantity !== undefined ? 'text-green-600' : 'text-gray-400'}>
                      Quantity: {splitResult.debugInfo.columnMapping.quantity ?? 'not found'}
                    </span>
                    <span className={splitResult.debugInfo.columnMapping.material !== undefined ? 'text-green-600' : 'text-gray-400'}>
                      Material: {splitResult.debugInfo.columnMapping.material ?? 'not found'}
                    </span>
                  </div>
                </div>
                {splitResult.debugInfo.sampleRow && (
                  <div>
                    <span className="font-bold">First data row:</span>
                    <div className="bg-white p-2 rounded mt-1 overflow-x-auto">
                      {splitResult.debugInfo.sampleRow.map((v, i) => (
                        <span key={i} className="inline-block bg-blue-100 px-2 py-1 rounded mr-1 mb-1">
                          [{i}] {v || '(empty)'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-amber-50 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">Parse Warnings ({errors.length})</h4>
            <div className="max-h-32 overflow-y-auto text-sm text-amber-700">
              {errors.map((error, i) => (
                <p key={i}>{error}</p>
              ))}
            </div>
          </div>
        )}

        {/* Cabinet Groups */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium">Select Cabinets to Import</h4>
            <button
              onClick={toggleAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedGroups.size === splitResult.groups.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          
          <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
            {splitResult.groups.map((group) => (
              <label
                key={group.cabinetCode}
                className={`flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-50 ${
                  selectedGroups.has(group.cabinetCode) ? 'bg-blue-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedGroups.has(group.cabinetCode)}
                  onChange={() => toggleGroup(group.cabinetCode)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{group.cabinetCode}</p>
                  {group.cabinetName && (
                    <p className="text-sm text-gray-500">{group.cabinetName}</p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-900">{group.totalPanels} panels</p>
                  <p className="text-gray-500">{group.materials.join(', ')}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={() => {
              setStep('upload');
              setSplitResult(null);
              setFileName(null);
              setErrors([]);
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={processGroups}
              disabled={selectedGroups.size === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {selectedGroups.size} Cabinet{selectedGroups.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProcessingStep = () => {
    const totalGroups = [...selectedGroups].length;
    const progress = totalGroups > 0 ? ((currentIndex + 1) / totalGroups) * 100 : 0;

    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4">
          <svg className="animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold mb-2">Processing Cabinets...</h3>
        <p className="text-gray-500 mb-4">
          {currentIndex + 1} of {totalGroups}
        </p>
        
        <div className="w-64 mx-auto bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  const renderCompleteStep = () => {
    const created = importResults.filter(r => r.status === 'created').length;
    const updated = importResults.filter(r => r.status === 'updated').length;
    const errored = importResults.filter(r => r.status === 'error').length;

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Import Complete</h3>
          <p className="text-gray-500">
            {created} created, {updated} updated{errored > 0 ? `, ${errored} errors` : ''}
          </p>
        </div>

        {/* Results */}
        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {importResults.map((result) => (
            <div
              key={result.cabinetCode}
              className={`flex items-center gap-4 p-3 ${
                result.status === 'error' ? 'bg-red-50' : ''
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                result.status === 'created' ? 'bg-green-500' :
                result.status === 'updated' ? 'bg-blue-500' :
                'bg-red-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{result.cabinetCode}</p>
                {result.error && (
                  <p className="text-sm text-red-600">{result.error}</p>
                )}
              </div>
              <div className="text-right text-sm">
                {result.estimationResult && (
                  <>
                    <p className="text-gray-900">
                      {formatCurrency(result.estimationResult.estimatedMaterialCost || 0)}
                    </p>
                    <p className="text-gray-500">
                      {result.estimationResult.totalSheets} sheets
                    </p>
                  </>
                )}
                <span className={`text-xs px-2 py-0.5 rounded ${
                  result.status === 'created' ? 'bg-green-100 text-green-800' :
                  result.status === 'updated' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {result.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => onComplete(importResults)}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-6">Bulk Import Design Items</h3>
      {renderStep()}
    </div>
  );
}
