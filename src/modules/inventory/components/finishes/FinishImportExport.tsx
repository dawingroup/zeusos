/**
 * FinishImportExport Component
 * CSV/JSON bulk import and export for finishes.
 */

import { useState, useRef } from 'react';
import { Upload, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { FinishDocument } from '../../types';
import { importFinishes, exportFinishes } from '../../services/finishLibraryService';

interface FinishImportExportProps {
  organizationId: string;
  userId: string;
  onImportComplete: () => void;
}

export function FinishImportExport({
  organizationId,
  userId,
  onImportComplete,
}: FinishImportExportProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const data = await exportFinishes({ organizationId });
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finishes-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setResult({ type: 'success', message: `Exported ${data.length} finishes` });
    } catch (err) {
      setResult({ type: 'error', message: 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const finishes = Array.isArray(data) ? data : [data];

      // Add organizationId to each finish
      const prepared = finishes.map((f: Partial<FinishDocument>) => ({
        ...f,
        organizationId,
        isActive: f.isActive ?? true,
        tags: f.tags || [],
        availability: f.availability || 'in_stock',
      }));

      const ids = await importFinishes(prepared as Omit<FinishDocument, 'id' | 'createdAt' | 'updatedAt'>[], userId);
      setResult({ type: 'success', message: `Imported ${ids.length} finishes` });
      onImportComplete();
    } catch (err) {
      setResult({ type: 'error', message: 'Import failed — check file format' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        Import
      </button>

      {/* Export */}
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Export
      </button>

      {/* Result message */}
      {result && (
        <span className={`flex items-center gap-1 text-xs ${
          result.type === 'success' ? 'text-green-600' : 'text-red-600'
        }`}>
          {result.type === 'success'
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <AlertCircle className="w-3.5 h-3.5" />}
          {result.message}
        </span>
      )}
    </div>
  );
}
