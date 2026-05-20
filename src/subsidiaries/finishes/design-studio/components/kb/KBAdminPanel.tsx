/**
 * KBAdminPanel — Admin panel for DKB management
 * Trigger compile, view compile report, sync to memory, CRUD entries
 */
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase/functions';
import { useDKBSearch } from '../../hooks/useDesignKB';
import type { DKBEntryType } from '../../constants/knowledgeBase.constants';

interface CompileResult {
  compiled: number;
  skipped: number;
  errors: { articlePath: string; error: string }[];
}

export function KBAdminPanel() {
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DKBEntryType | ''>('');

  const { data: entries, isLoading } = useDKBSearch(
    '', // Empty query fetches all
    selectedType || undefined,
    true,
  );

  const handleCompile = async () => {
    setIsCompiling(true);
    setCompileError(null);
    try {
      const compileDKB = httpsCallable(functions, 'compileDKB');
      const result = await compileDKB({});
      setCompileResult(result.data as CompileResult);
    } catch (err) {
      setCompileError((err as Error).message);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleSyncToMemory = async () => {
    try {
      const syncDKB = httpsCallable(functions, 'syncDKBToMemory');
      await syncDKB({});
    } catch (err) {
      console.error('Failed to sync DKB to memory:', err);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Knowledge Base Admin
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCompile}
          disabled={isCompiling}
          className="px-3 py-1.5 text-[10px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isCompiling ? 'Compiling...' : 'Compile DKB'}
        </button>
        <button
          onClick={handleSyncToMemory}
          className="px-3 py-1.5 text-[10px] font-medium rounded-md border border-border hover:bg-accent"
        >
          Sync to Memory
        </button>
      </div>

      {/* Compile result */}
      {compileResult && (
        <div className="border border-border rounded-md p-2 text-[10px]">
          <div className="font-medium mb-1">Compile Result</div>
          <div className="grid grid-cols-3 gap-1">
            <div>
              <span className="text-green-600 font-medium">{compileResult.compiled}</span> compiled
            </div>
            <div>
              <span className="text-muted-foreground">{compileResult.skipped}</span> skipped
            </div>
            <div>
              <span className="text-destructive font-medium">{compileResult.errors.length}</span> errors
            </div>
          </div>
          {compileResult.errors.length > 0 && (
            <div className="mt-1 text-destructive">
              {compileResult.errors.map((e, i) => (
                <div key={i}>{e.articlePath}: {e.error}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {compileError && (
        <div className="text-[10px] text-destructive">{compileError}</div>
      )}

      {/* Entry type filter */}
      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value as DKBEntryType | '')}
        className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
      >
        <option value="">All types</option>
        <option value="component">Components</option>
        <option value="assembly_pattern">Assembly Patterns</option>
        <option value="hardware_spec">Hardware Specs</option>
        <option value="material_rule">Material Rules</option>
        <option value="product_archetype">Archetypes</option>
        <option value="dimensional_standard">Dimensional Standards</option>
      </select>

      {/* Entry list */}
      {isLoading ? (
        <div className="text-[10px] text-muted-foreground text-center">Loading...</div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="text-[9px] text-muted-foreground">
            {entries?.length || 0} entries
          </div>
          {entries?.map((entry) => (
            <div
              key={entry.id}
              className="px-2 py-1.5 rounded-md border border-border text-xs flex justify-between items-center"
            >
              <div>
                <span className="font-medium">{entry.name}</span>
                <span className="text-[10px] text-muted-foreground ml-2">
                  {entry.entryType}
                </span>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                entry.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-muted text-muted-foreground'
              }`}>
                v{entry.version}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
