/**
 * ImportDropzone — Drag-and-drop upload for revised STEP/X_T models
 *
 * Accepts STEP and Parasolid X_T files returned from Shapr3D editing.
 * Creates a new revision (N+1) with automatic diff computation.
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileUp, CheckCircle2 } from 'lucide-react';

const ACCEPTED_EXTENSIONS = ['.step', '.stp', '.x_t', '.x_b'];

interface ImportDropzoneProps {
  sourceRevisionId: string | null;
  onImport: (file: File, editNotes?: string) => Promise<string>;
  importing?: boolean;
}

export default function ImportDropzone({
  sourceRevisionId,
  onImport,
  importing = false,
}: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [importedRevisionId, setImportedRevisionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidFile = useCallback((file: File) => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      setSelectedFile(file);
    }
  }, [isValidFile]);

  const handleSubmit = useCallback(async () => {
    if (!selectedFile || !sourceRevisionId) return;
    const newId = await onImport(selectedFile, editNotes || undefined);
    setImportedRevisionId(newId);
    setSelectedFile(null);
    setEditNotes('');
  }, [selectedFile, sourceRevisionId, editNotes, onImport]);

  if (!sourceRevisionId) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground">
        <Upload className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Export a revision first before importing edits</p>
      </div>
    );
  }

  if (importedRevisionId) {
    return (
      <div className="p-3 text-center text-xs">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
        <p className="font-medium">Revision imported successfully</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          New revision created. GLB preview will be generated automatically.
        </p>
        <button
          onClick={() => setImportedRevisionId(null)}
          className="mt-2 text-[10px] text-primary hover:underline"
        >
          Import another
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 text-xs">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
        Import Revised Model
      </div>

      {!selectedFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/20'
            }
          `}
        >
          <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium">Drop revised model here</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            STEP (.step, .stp) or Parasolid (.x_t, .x_b)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && isValidFile(file)) setSelectedFile(file);
            }}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileUp className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{selectedFile.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(0)} KB
              </div>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Change
            </button>
          </div>

          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Edit notes (optional) — what was changed?"
            className="w-full h-14 px-2 py-1.5 text-[10px] border rounded resize-none bg-background mb-2"
          />

          <button
            onClick={handleSubmit}
            disabled={importing}
            className="w-full py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? 'Importing...' : 'Create Revision'}
          </button>
        </div>
      )}
    </div>
  );
}
